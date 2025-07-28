import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, AIMessage } from "@langchain/core/messages";
import { MemorySaver, Annotation, Command, MessagesAnnotation } from '@langchain/langgraph';
import crypto from 'crypto';
import { Logger } from '../services/logger.js';
import { config } from '../services/config.js';
import { metrics } from '../services/monitoring.js';
import { featureFlags, FLAGS } from '../services/featureFlags.js';
import { ManagedMemorySaver } from '../services/memoryManager.js';

// Initialize logger
const logger = new Logger('salesAgent');

// Initialize checkpointer for conversation persistence (if enabled)
const checkpointer = featureFlags.isEnabled(FLAGS.USE_MEMORY_SAVER) 
  ? new ManagedMemorySaver({ 
      ttl: 3600000, // 1 hour
      maxEntries: 1000,
      cleanupInterval: 300000 // 5 minutes
    }) 
  : null;

// Agent configuration with timeout and retry handling
const AGENT_CONFIG = {
  conversationTimeout: config.conversationTimeout,
  retryConfig: {
    maxRetries: config.maxRetries,
    retryDelay: config.retryDelay,
    retryMultiplier: 2,
    retryableErrors: ['CancelledError', 'TimeoutError', 'ECONNRESET', 'ETIMEDOUT']
  }
};

// Maximum extraction attempts per conversation
const MAX_EXTRACTION_ATTEMPTS = 3;

// Define custom state schema with Annotation.Root
const AgentStateAnnotation = Annotation.Root({
  // Include messages from MessagesAnnotation
  ...MessagesAnnotation.spec,
  
  // Lead information
  leadInfo: Annotation({
    default: () => ({}),
    reducer: (current, update) => ({ ...current, ...update })
  }),
  
  // User info for context
  userInfo: Annotation({
    default: () => ({}),
    reducer: (current, update) => ({ ...current, ...update })
  }),
  
  // Track if appointment is booked
  appointmentBooked: Annotation({
    default: () => false
  }),
  
  // Track extraction attempts
  extractionCount: Annotation({
    reducer: (x, y) => y,  // Replace value
    default: () => 0
  }),
  
  // Track processed messages to avoid duplicates
  processedMessages: Annotation({
    reducer: (x, y) => [...new Set([...x, ...y])], // Merge arrays
    default: () => []
  }),
  
  // Available calendar slots
  availableSlots: Annotation({
    default: () => []
  }),
  
  // Contact and conversation IDs
  contactId: Annotation({
    default: () => null
  }),
  
  conversationId: Annotation({
    default: () => null
  }),
  
  // GHL update status
  ghlUpdated: Annotation({
    default: () => false
  }),
  
  // Track if max extraction attempts reached
  maxExtractionReached: Annotation({
    default: () => false
  }),
  
  // Track if all required fields are collected
  allFieldsCollected: Annotation({
    default: () => false
  }),
  
  // Track if calendar has been shown
  calendarShown: Annotation({
    default: () => false
  }),
  
  // Last update timestamp
  lastUpdate: Annotation({
    default: () => null
  })
});

// Tool: Extract lead information from messages
const extractLeadInfo = tool(
  async ({ message }, config) => {
    const startTime = Date.now();
    const toolCallId = config.toolCall?.id || 'extract_lead_info';
    
    logger.info('🔍 EXTRACT LEAD INFO START', {
      toolCallId,
      messageLength: message.length,
      messagePreview: message.substring(0, 50)
    });
    
    try {
      // Access state from __pregel_scratchpad.currentTaskInput
      const currentTaskInput = config?.configurable?.__pregel_scratchpad?.currentTaskInput || {};
      const currentLeadInfo = currentTaskInput.leadInfo || config?.configurable?.leadInfo || {};
      const extractionCount = currentTaskInput.extractionCount || 0;
      const processedMessages = currentTaskInput.processedMessages || [];
      const stateMessages = currentTaskInput.messages || [];
      
      // Check extraction attempt limit
      const MAX_EXTRACTION_ATTEMPTS = 3;
      if (extractionCount >= MAX_EXTRACTION_ATTEMPTS) {
        logger.warn('⚠️ Max extraction attempts reached', {
          toolCallId,
          extractionCount,
          maxAttempts: MAX_EXTRACTION_ATTEMPTS
        });
        
        return new Command({
          update: {
            maxExtractionReached: true,
            messages: [{
              role: "tool",
              content: "Max extraction attempts reached. Continue with available info.",
              tool_call_id: toolCallId
            }]
          }
        });
      }
      
      // Check if message was already processed
      const messageHash = crypto.createHash('md5').update(message.toLowerCase().trim()).digest('hex');
      if (processedMessages.includes(messageHash)) {
        logger.debug('Message already processed', {
          toolCallId,
          messageHash
        });
        
        return new Command({
          update: {
            messages: [{
              role: "tool",
              content: "Message already processed. No new info.",
              tool_call_id: toolCallId
            }]
          }
        });
      }
      
      logger.debug('📊 Current extraction state', {
        toolCallId,
        extractionCount,
        hasName: !!currentLeadInfo.name,
        hasProblem: !!currentLeadInfo.problem,
        hasGoal: !!currentLeadInfo.goal,
        hasBudget: !!currentLeadInfo.budget,
        hasEmail: !!currentLeadInfo.email
      });
      
      // Check extraction limit
      if (extractionCount >= MAX_EXTRACTION_ATTEMPTS) {
        logger.warn('⚠️ MAX EXTRACTION ATTEMPTS REACHED', { 
          toolCallId,
          extractionCount,
          limit: MAX_EXTRACTION_ATTEMPTS
        });
        // Return tool message even when hitting limit
        return new Command({
          update: {
            messages: [{
              role: "tool",
              content: "Max extraction attempts reached",
              tool_call_id: toolCallId
            }]
          }
        });
      }
      
      const llm = new ChatOpenAI({ model: "gpt-4", temperature: 0 });
      
      // Build currentInfo from state
      const currentInfo = {
        name: currentLeadInfo.name || "",
        businessType: currentLeadInfo.businessType || "",
        problem: currentLeadInfo.problem || "",
        goal: currentLeadInfo.goal || "",
        budget: currentLeadInfo.budget || 0,
        email: currentLeadInfo.email || "",
        businessDetails: currentLeadInfo.businessDetails || ""
      };
      
      logger.debug('Extract lead info - Current context', { currentInfo });
      
      // Get conversation context from state messages
      const recentMessages = stateMessages.slice(-5); // Get last 5 messages for context
      
      // Build conversation context
      let conversationContext = "";
      let lastAssistantQuestion = "";
      
      for (let i = 0; i < recentMessages.length; i++) {
        const msg = recentMessages[i];
        const role = msg._getType?.() === 'human' ? 'Customer' : 
                    msg._getType?.() === 'ai' ? 'Assistant' : 
                    msg.role || 'Unknown';
        
        if (role === 'Assistant' && msg.content) {
          lastAssistantQuestion = msg.content;
        }
        
        if (role === 'Customer' || role === 'Assistant') {
          conversationContext += `${role}: ${msg.content || ''}\n`;
        }
      }
      
      // Special handling for "si" confirmation
      logger.debug('Checking for si confirmation', { 
        message, 
        lastAssistantQuestion,
        isSi: message.toLowerCase() === 'si' || message.toLowerCase() === 'sí' || message.toLowerCase() === 'yes'
      });
      
      if (message.toLowerCase() === 'si' || message.toLowerCase() === 'sí' || message.toLowerCase() === 'yes' || message.toLowerCase() === 'sí.') {
        // Check if last assistant message contains a budget question with a number
        const budgetMatch = lastAssistantQuestion.match(/\$?(\d+)/);
        const containsBudgetQuestion = lastAssistantQuestion.toLowerCase().includes('presupuesto') || 
                                       lastAssistantQuestion.toLowerCase().includes('budget');
        
        logger.debug('Budget match check', { 
          budgetMatch: budgetMatch?.[1], 
          containsBudgetQuestion
        });
        
        if (budgetMatch && containsBudgetQuestion) {
          logger.info('✅ Si confirmation detected for budget', { 
            extractedBudget: budgetMatch[1] 
          });
          
          // Directly return the extracted budget
          const extractedBudget = parseInt(budgetMatch[1]);
          const merged = { ...currentInfo, budget: extractedBudget };
          
          logger.info('✅ BUDGET EXTRACTED FROM SI CONFIRMATION', {
            toolCallId,
            budget: extractedBudget,
            processingTime: Date.now() - startTime
          });
          
          return new Command({
            update: {
              leadInfo: merged,
              extractionCount: extractionCount + 1,
              processedMessages: [...processedMessages, messageHash],
              messages: [{
                role: "tool",
                content: `Extracted: {"budget": ${extractedBudget}}`,
                tool_call_id: toolCallId
              }]
            }
          });
        }
      }
      
      const prompt = `Analyze ONLY this CURRENT customer message (DO NOT extract from conversation history):

CURRENT MESSAGE TO ANALYZE: "${message}"

CONVERSATION CONTEXT (for understanding only, DO NOT extract info from here):
${conversationContext}

IMPORTANT CONTEXT RULES:
1. ONLY extract information that appears in the CURRENT MESSAGE above
2. If customer says "all", "todo", "toda la información" after a multi-part question - they're responding to ALL parts
3. If customer says "si", "sí", "yes" - they're confirming what was asked in the previous message
4. If assistant asked about budget and customer responds with just a number (like "500") - that's the budget in current message
5. If assistant asked for name and customer responds with just a name in current message - extract it
6. If assistant asked "Is your budget $X?" and customer says "si" in current message - extract budget: X

Last assistant message (for context only): "${lastAssistantQuestion}"

Current info we already have: ${JSON.stringify(currentInfo)}

Extract any NEW information from the CURRENT MESSAGE ONLY (if mentioned):
- name (person's name)
- businessType (restaurant, store, clinic, salon, etc)
- problem (their pain point or challenge - e.g., "no tengo clientes", "necesito más ventas", "nesesito mas clientez" (with typos))
- goal (what they want to achieve - e.g., "crecer mi negocio", "vender $10k al mes", "mas clientez")
- budget (IMPORTANT: Numbers with "mes", "mensual", "al mes", "por mes", "$" or standalone numbers after budget questions)
- email (email address)
- businessDetails (any specific details about their business)
- returningCustomer (true if they mention "hablamos ayer", "ya hablamos", "we spoke yesterday", etc.)

IMPORTANT: Be VERY flexible with typos and spelling errors. Common typos:
- "nesesito", "nesecito", "nesisito" = "necesito"
- "clientez", "clientes" = "clientes"
- "ola", "hola" = "hola"
- "soi", "soy" = "soy"
- "mas", "más" = "más"
- Always extract the intended meaning despite spelling errors.

IMPORTANT: Extract ALL fields mentioned in the message, even if multiple fields are in one message.
Example: "Hola, soy María, tengo una tienda online, no vendo nada, quiero vender $10k al mes, mi presupuesto es $800, mi email es maria@shop.com"
Should extract: {"name": "María", "businessType": "tienda online", "problem": "no vendo nada", "goal": "vender $10k al mes", "budget": 800, "email": "maria@shop.com"}

For contextual responses:
- "si" after "¿Tu presupuesto es de $500?" → Extract budget: 500
- "si" after "¿Tu presupuesto mensual es de $500?" → Extract budget: 500
- "300" after "¿Cuál es tu presupuesto?" → Extract budget: 300
- "espera, puedo hacer $400" → Extract budget: 400 (update even if budget was already set)
- "mejor $X" or "puedo hacer $X" → Always update to new budget amount
- "all" after multi-part question → Ask for specific details
- Single name after "¿Cómo te llamas?" → Extract as name

IMPORTANT: When user says "si" or "sí", check the previous assistant message:
- If it contains a number with $ or mentions budget, extract that number as budget
- If it asks a yes/no question about a specific value, extract that value

Example extraction:
Assistant: "¿Tu presupuesto mensual es de $500?"
Customer: "si"
You should extract: {"budget": 500}

Return ONLY a JSON object with any new/updated fields using LOWERCASE field names.
Example: {"name": "Carlos", "problem": "no tengo clientes", "budget": 500}

CRITICAL: Do NOT include fields that haven't changed or weren't mentioned.
NEVER return empty strings like {"problem": "", "goal": ""}
ONLY return fields with actual values from the current message.
If the message only mentions budget, return ONLY {"budget": 500}
If the message only mentions name, return ONLY {"name": "Juan"}`;
      
      const response = await llm.invoke([
        new SystemMessage("You extract information from messages WITH CONTEXT. When user says 'si' to confirm a value, extract that value. Return only valid JSON with ONLY new/changed fields. NEVER include empty strings, null values, or fields that weren't mentioned in the current message. Use lowercase field names: name, businessType, problem, goal, budget, email, businessDetails."),
        { role: "user", content: prompt }
      ]);
      
      try {
        let extracted = JSON.parse(response.content);
        
        // Fix common field name issues
        if ('businesstype' in extracted && !('businessType' in extracted)) {
          extracted.businessType = extracted.businesstype;
          delete extracted.businesstype;
        }
        
        // Remove any empty/null/undefined fields before merging
        Object.keys(extracted).forEach(key => {
          if (extracted[key] === null || 
              extracted[key] === undefined || 
              extracted[key] === "" ||
              (key !== 'budget' && extracted[key] === 0)) {
            delete extracted[key];
          }
        });
        
        // Only update if there are actual changes
        const hasChanges = Object.keys(extracted).length > 0;
        if (!hasChanges) {
          logger.info('ℹ️ NO NEW INFORMATION EXTRACTED', {
            toolCallId,
            processingTime: Date.now() - startTime
          });
          // Still need to return a tool message for the tool call
          return new Command({
            update: {
              extractionCount: extractionCount + 1, // Count failed attempts too
              processedMessages: [...processedMessages, messageHash],
              messages: [{
                role: "tool",
                content: "No new information extracted from message",
                tool_call_id: toolCallId
              }]
            }
          });
        }
        
        // Merge with existing info - ONLY update fields that have values
        const merged = { ...currentInfo };
        Object.keys(extracted).forEach(key => {
          // Only update if the extracted value is not empty/null/undefined
          // This prevents clearing existing data
          if (extracted[key] !== null && 
              extracted[key] !== undefined && 
              extracted[key] !== "" &&
              extracted[key] !== 0) { // Don't overwrite with 0 unless it's budget
            merged[key] = extracted[key];
          } else if (key === 'budget' && extracted[key] === 0) {
            // Special case: budget can be legitimately 0
            merged[key] = extracted[key];
          }
        });
        
        logger.info('✅ LEAD INFO EXTRACTED', {
          toolCallId,
          rawExtracted: extracted,
          currentInfoBefore: currentInfo,
          mergedResult: merged,
          extractedFields: Object.keys(extracted),
          mergedFields: Object.keys(merged).filter(k => merged[k]),
          newBudget: extracted.budget,
          processingTime: Date.now() - startTime
        });
        
        // Check if all fields are now present for calendar
        // Handle budget that might be a string like "$800" or "800"
        let budgetValue = merged.budget;
        if (typeof budgetValue === 'string') {
          budgetValue = parseInt(budgetValue.replace(/[$,]/g, ''));
        }
        
        const hasAllFields = merged.name && merged.problem && merged.goal && 
                            budgetValue && budgetValue >= config.minBudget && merged.email;
        
        if (hasAllFields) {
          logger.info('🎯 ALL FIELDS COLLECTED - Ready for calendar', {
            name: merged.name,
            problem: merged.problem,
            goal: merged.goal,
            budget: merged.budget,
            email: merged.email
          });
        }
        
        // Log the merge result for debugging
        logger.warn('🔍 STATE BUILDING DEBUG', {
          currentInfoBefore: currentInfo,
          extractedData: extracted,
          mergedResult: merged,
          problemField: merged.problem,
          goalField: merged.goal
        });
        
        // Build detailed state summary for the agent
        const stateInfo = {
          currentLeadInfo: merged,
          missingFields: [],
          nextStep: ''
        };
        
        if (!merged.name) stateInfo.missingFields.push('name');
        if (!merged.problem) stateInfo.missingFields.push('problem');
        if (!merged.goal) stateInfo.missingFields.push('goal');
        if (!merged.budget) stateInfo.missingFields.push('budget');
        if (!merged.email && merged.budget >= config.minBudget) stateInfo.missingFields.push('email');
        
        // Determine next step
        if (hasAllFields) {
          stateInfo.nextStep = 'SHOW_CALENDAR_NOW';
        } else if (stateInfo.missingFields.length > 0) {
          stateInfo.nextStep = `ASK_FOR_${stateInfo.missingFields[0].toUpperCase()}`;
        }
        
        // Return Command object with state updates and tool message
        return new Command({
          update: {
            leadInfo: merged,
            extractionCount: extractionCount + 1,
            processedMessages: [...processedMessages, messageHash],
            allFieldsCollected: hasAllFields,
            messages: [{
              role: "tool",
              content: `Extracted: ${JSON.stringify(extracted)}\nCURRENT_STATE: ${JSON.stringify(stateInfo)}${hasAllFields ? '\nALL_FIELDS_READY: Show calendar now!' : ''}`,
              tool_call_id: toolCallId
            }]
          }
        });
      } catch (e) {
        logger.error('Failed to parse extraction response', { 
          error: e.message,
          response: response.content 
        });
        return new Command({ 
          update: {
            extractionCount: extractionCount + 1, // Count errors too
            processedMessages: [...processedMessages, messageHash],
            messages: [{
              role: "tool",
              content: `Error parsing response: ${e.message}`,
              tool_call_id: toolCallId
            }]
          }
        });
      }
    } catch (error) {
      logger.error('Error in extractLeadInfo tool', { 
        error: error.message,
        stack: error.stack,
        toolCallId 
      });
      return new Command({ 
        update: {
          extractionCount: extractionCount + 1, // Count all attempts including errors
          processedMessages: [...processedMessages, messageHash],
          messages: [{
            role: "tool",
            content: `Error extracting info: ${error.message}`,
            tool_call_id: toolCallId
          }]
        }
      });
    }
  },
  {
    name: "extract_lead_info",
    description: "Extract lead information from customer message using current state context",
    schema: z.object({
      message: z.string().describe("Customer's message")
      // Removed currentInfo parameter - we get it from state now
    })
  }
);

// Simple in-memory cache for calendar slots (30 min TTL)
const calendarCache = {
  data: null,
  timestamp: 0,
  TTL: 30 * 60 * 1000 // 30 minutes
};

// Tool: Get calendar slots (ONLY after full qualification)
const getCalendarSlots = tool(
  async ({ startDate, endDate }, config) => {
    const toolCallId = config.toolCall?.id || 'get_calendar_slots';
    
    // Access state from __pregel_scratchpad.currentTaskInput
    const currentTaskInput = config?.configurable?.__pregel_scratchpad?.currentTaskInput || {};
    const currentLeadInfo = currentTaskInput.leadInfo || config?.configurable?.leadInfo || {};
    
    // Initialize services if not provided - check multiple config paths
    let ghlService = config?.configurable?.ghlService || 
                    config?.ghlService || 
                    config?.configurable?.__pregel_scratchpad?.ghlService;
    let calendarId = config?.configurable?.calendarId || process.env.GHL_CALENDAR_ID;
    
    if (!ghlService) {
      const { GHLService } = await import('../services/ghlService.js');
      ghlService = new GHLService(
        process.env.GHL_API_KEY,
        process.env.GHL_LOCATION_ID
      );
    }
    
    // STRICT validation - must have ALL info before showing slots
    if (!currentLeadInfo.name || !currentLeadInfo.problem || !currentLeadInfo.goal || !currentLeadInfo.budget || !currentLeadInfo.email) {
      const missingFields = {
        name: !currentLeadInfo.name,
        problem: !currentLeadInfo.problem,
        goal: !currentLeadInfo.goal,
        budget: !currentLeadInfo.budget,
        email: !currentLeadInfo.email
      };
      
      return new Command({
        update: {
          messages: [{
            role: "tool",
            content: "Missing required information for calendar: " + Object.keys(missingFields).filter(k => missingFields[k]).join(", "),
            tool_call_id: toolCallId
          }]
        }
      });
    }
    
    // Budget must be qualified
    if (currentLeadInfo.budget < config.minBudget) {
      return new Command({
        update: {
          messages: [{
            role: "tool",
            content: `Cannot fetch slots - budget under $${config.minBudget}/month (current: $${currentLeadInfo.budget})`,
            tool_call_id: toolCallId
          }]
        }
      });
    }
    
    // Default to next 7 days if dates not provided
    const start = startDate || new Date().toISOString();
    const end = endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    try {
      let slots;
      
      // Check cache first
      if (calendarCache.data && (Date.now() - calendarCache.timestamp < calendarCache.TTL)) {
        logger.debug('Using cached calendar slots');
        slots = calendarCache.data;
      } else {
        // Fetch fresh slots and cache them
        slots = await ghlService.getAvailableSlots(
          calendarId,
          start,
          end
        );
        calendarCache.data = slots;
        calendarCache.timestamp = Date.now();
        logger.debug('Fetched and cached new calendar slots');
      }
      
      // Format slots for display in Spanish with Texas timezone
      const formattedSlots = slots.slice(0, 5).map((slot, index) => {
        const date = new Date(slot.startTime);
        const spanishDays = {
          'Monday': 'Lunes',
          'Tuesday': 'Martes',
          'Wednesday': 'Miércoles',
          'Thursday': 'Jueves',
          'Friday': 'Viernes',
          'Saturday': 'Sábado',
          'Sunday': 'Domingo'
        };
        const spanishMonths = {
          'Jan': 'enero',
          'Feb': 'febrero',
          'Mar': 'marzo',
          'Apr': 'abril',
          'May': 'mayo',
          'Jun': 'junio',
          'Jul': 'julio',
          'Aug': 'agosto',
          'Sep': 'septiembre',
          'Oct': 'octubre',
          'Nov': 'noviembre',
          'Dec': 'diciembre'
        };
        
        const dayName = date.toLocaleString('en-US', { weekday: 'long', timeZone: 'America/Chicago' });
        const monthName = date.toLocaleString('en-US', { month: 'short', timeZone: 'America/Chicago' });
        const formattedTime = date.toLocaleString('es-US', {
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'America/Chicago'
        });
        
        return {
          index: index + 1,
          display: `${spanishDays[dayName]} ${formattedTime.split(',')[0]} de ${spanishMonths[monthName]} a las ${formattedTime.split(',')[1].trim()}`,
          startTime: slot.startTime,
          endTime: slot.endTime,
          slotId: slot.id || `slot-${index}`
        };
      });
      
      // Return Command with slots in state and tool message
      return new Command({
        update: {
          availableSlots: formattedSlots,
          messages: [{
            role: "tool",
            content: `Found ${formattedSlots.length} available slots`,
            tool_call_id: toolCallId
          }]
        }
      });
    } catch (error) {
      logger.error("Error fetching calendar slots", {
        error: error.message,
        calendarId,
        startDate: start,
        endDate: end
      });
      return new Command({
        update: {
          messages: [{
            role: "tool",
            content: `Error fetching calendar: ${error.message}`,
            tool_call_id: toolCallId
          }]
        }
      });
    }
  },
  {
    name: "get_calendar_slots",
    description: "Fetch available calendar slots from GHL (requires full qualification)",
    schema: z.object({
      startDate: z.string().optional().describe("Start date in ISO format (defaults to today)"),
      endDate: z.string().optional().describe("End date in ISO format (defaults to 7 days from now)")
    })
  }
);

// Tool: Book appointment
const bookAppointment = tool(
  async ({ slot, leadName, leadEmail }, config) => {
    const toolCallId = config.toolCall?.id || 'book_appointment';
    
    // Access state from __pregel_scratchpad.currentTaskInput
    const currentTaskInput = config?.configurable?.__pregel_scratchpad?.currentTaskInput || {};
    const contactId = currentTaskInput.contactId || config?.configurable?.contactId;
    
    if (!contactId) {
      throw new Error('contactId not found in state. Cannot book appointment.');
    }
    
    // Initialize services if not provided - check multiple config paths
    let ghlService = config?.configurable?.ghlService || 
                    config?.ghlService || 
                    config?.configurable?.__pregel_scratchpad?.ghlService;
    let calendarId = config?.configurable?.calendarId || process.env.GHL_CALENDAR_ID;
    
    if (!ghlService) {
      const { GHLService } = await import('../services/ghlService.js');
      ghlService = new GHLService(
        process.env.GHL_API_KEY,
        process.env.GHL_LOCATION_ID
      );
    }
    
    try {
      const appointment = await ghlService.bookAppointment(
        calendarId,
        contactId,
        {
          title: `Sales Call with ${leadName}`,
          appointmentStatus: 'confirmed',
          startTime: slot.startTime,
          endTime: slot.endTime
        }
      );
      
      // Return Command with tool message and termination signal
      return new Command({
        update: {
          appointmentBooked: true,
          messages: [
            {
              role: "tool",
              content: `Appointment booked successfully for ${slot.display}`,
              tool_call_id: toolCallId
            }
          ],
          lastUpdate: new Date().toISOString()
        },
        goto: "END"  // Terminate conversation after booking
      });
    } catch (error) {
      logger.error("Error booking appointment", {
        error: error.message,
        contactId,
        calendarId,
        slot
      });
      // Return Command with tool error message
      return new Command({
        update: {
          messages: [
            {
              role: "tool",
              content: `Error booking appointment: ${error.message}`,
              tool_call_id: toolCallId
            }
          ]
        }
      });
    }
  },
  {
    name: "book_appointment",
    description: "Book an appointment in GHL calendar",
    schema: z.object({
      slot: z.object({
        startTime: z.string(),
        endTime: z.string(),
        display: z.string()
      }).describe("Selected time slot"),
      leadName: z.string().describe("Lead's name"),
      leadEmail: z.string().describe("Lead's email")
    })
  }
);

// Tool: Update GHL contact
const updateGHLContact = tool(
  async ({ tags, notes }, config) => {
    const toolCallId = config.toolCall?.id || 'update_ghl_contact';
    
    // Access state from __pregel_scratchpad.currentTaskInput
    const currentTaskInput = config?.configurable?.__pregel_scratchpad?.currentTaskInput || {};
    const contactId = currentTaskInput.contactId || config?.configurable?.contactId;
    const leadInfo = currentTaskInput.leadInfo || {};
    
    if (!contactId) {
      throw new Error('contactId not found in state. Cannot update contact.');
    }
    
    // Initialize GHL service if not provided - check multiple config paths
    let ghlService = config?.configurable?.ghlService || 
                    config?.ghlService || 
                    config?.configurable?.__pregel_scratchpad?.ghlService;
    
    if (!ghlService) {
      const { GHLService } = await import('../services/ghlService.js');
      ghlService = new GHLService(
        process.env.GHL_API_KEY,
        process.env.GHL_LOCATION_ID
      );
    }
    
    try {
      // Update tags
      if (tags && tags.length > 0) {
        await ghlService.addTags(contactId, tags);
      }
      
      // Add note
      if (notes) {
        await ghlService.addNote(contactId, notes);
      }
      
      // Update custom fields if we have lead info
      if (leadInfo && Object.keys(leadInfo).length > 0) {
        const updateData = {
          // Standard fields
          firstName: leadInfo.name,
          email: leadInfo.email,
          companyName: leadInfo.businessType,
          // Custom fields mapped to GHL IDs
          customFields: {
            goal: leadInfo.problem || leadInfo.goal,
            budget: String(leadInfo.budget || ''),
            businessType: leadInfo.businessType,
            verifiedName: leadInfo.name
          }
        };
        
        // Remove undefined values
        Object.keys(updateData).forEach(key => {
          if (updateData[key] === undefined) delete updateData[key];
        });
        
        await ghlService.updateContact(contactId, updateData);
      }
      
      // Return Command with update status and tool message
      return new Command({
        update: {
          ghlUpdated: true,
          lastUpdate: new Date().toISOString(),
          messages: [{
            role: "tool",
            content: "Contact updated successfully",
            tool_call_id: toolCallId
          }]
        }
      });
    } catch (error) {
      logger.error("Error updating GHL contact", {
        error: error.message,
        contactId,
        tags,
        hasNotes: !!notes,
        hasLeadInfo: !!leadInfo
      });
      // Return Command with error in state and tool message
      return new Command({
        update: {
          ghlUpdated: false,
          lastUpdate: new Date().toISOString(),
          messages: [{
            role: "tool",
            content: `Error updating contact: ${error.message}`,
            tool_call_id: toolCallId
          }]
        }
      });
    }
  },
  {
    name: "update_ghl_contact",
    description: "Update GHL contact with tags and notes (uses leadInfo from state)",
    schema: z.object({
      tags: z.array(z.string()).describe("Tags to add to contact"),
      notes: z.string().optional().describe("Note to add to contact timeline")
    })
  }
);

// Tool: Parse time selection
const parseTimeSelection = tool(
  async ({ userMessage }, config) => {
    const toolCallId = config.toolCall?.id || 'parse_time_selection';
    
    // Access current state - get from the annotation state
    const currentState = config.runnable_config?.store?.get() || {};
    
    // If that doesn't work, try alternate paths
    if (!currentState.availableSlots && config.configurable) {
      // Try getting from configurable directly
      Object.assign(currentState, config.configurable);
    }
    
    const availableSlots = currentState.availableSlots || [];
    
    if (!availableSlots || availableSlots.length === 0) {
      return new Command({
        update: {
          messages: [{
            role: "tool",
            content: "No available slots in state to parse selection from",
            tool_call_id: toolCallId
          }]
        }
      });
    }
    
    const llm = new ChatOpenAI({ model: "gpt-4", temperature: 0 });
    
    const prompt = `User selected a time from these options:
    ${availableSlots.map(s => `${s.index}. ${s.display}`).join('\n')}
    
    User said: "${userMessage}"
    
    IMPORTANT: Be flexible with time expressions:
    - "el martes a las 3" = Tuesday at 3pm
    - "mañana" = tomorrow 
    - "la primera" = option 1
    - "la segunda opción" = option 2
    - "el lunes" = Monday
    - Numbers like "1", "2", "3" refer to option numbers
    
    Return the index number (1-5) of their selection, or 0 if unclear.
    Return ONLY a number.`;
    
    const response = await llm.invoke([
      new SystemMessage("Extract the time slot selection. Return only a number 1-5, or 0 if unclear."),
      { role: "user", content: prompt }
    ]);
    
    const selection = parseInt(response.content.trim());
    
    if (selection > 0 && selection <= availableSlots.length) {
      // Return Command with selected slot and tool message
      const selectedSlot = availableSlots[selection - 1];
      return new Command({
        update: {
          selectedSlot: selectedSlot,
          messages: [{
            role: "tool",
            content: `User selected slot ${selection}: ${selectedSlot.display}`,
            tool_call_id: toolCallId
          }]
        }
      });
    }
    
    // Return Command with error and tool message
    return new Command({
      update: {
        messages: [{
          role: "tool",
          content: "Could not understand time selection from user message",
          tool_call_id: toolCallId
        }]
      }
    });
  },
  {
    name: "parse_time_selection",
    description: "Parse user's time slot selection (uses availableSlots from state)",
    schema: z.object({
      userMessage: z.string().describe("User's message selecting a time")
    })
  }
);

// Tool: Send message via GHL WhatsApp (NOT webhook response)
const sendGHLMessage = tool(
  async ({ message }, config) => {
    const startTime = Date.now();
    const toolCallId = config.toolCall?.id || 'send_ghl_message';
    
    logger.info('📤 SEND GHL MESSAGE START', {
      toolCallId,
      messageLength: message.length,
      messagePreview: message.substring(0, 50)
    });
    
    // Access state from __pregel_scratchpad.currentTaskInput
    const currentTaskInput = config?.configurable?.__pregel_scratchpad?.currentTaskInput || {};
    const contactId = currentTaskInput.contactId || config?.configurable?.contactId;
    
    if (!contactId) {
      logger.error('❌ NO CONTACT ID', { toolCallId });
      throw new Error('contactId not found in state. Cannot send message.');
    }
    
    // Check if appointment is already booked from state
    const appointmentBooked = currentTaskInput.appointmentBooked || false;
    
    logger.debug('📊 Send message state', {
      toolCallId,
      contactId,
      appointmentBooked
    });
    
    // Initialize GHL service - check multiple config paths
    let ghlService = config?.configurable?.ghlService || 
                    config?.ghlService || 
                    config?.configurable?.__pregel_scratchpad?.ghlService;
    
    if (!ghlService) {
      const { GHLService } = await import('../services/ghlService.js');
      ghlService = new GHLService(
        process.env.GHL_API_KEY,
        process.env.GHL_LOCATION_ID
      );
    }
    
    try {
      const sendStartTime = Date.now();
      await ghlService.sendSMS(contactId, message);
      
      logger.info('✅ MESSAGE SENT SUCCESSFULLY', {
        toolCallId,
        contactId,
        sendTime: Date.now() - sendStartTime,
        totalTime: Date.now() - startTime
      });
      
      // Check if message contains calendar slots to signal waiting for user response
      const containsCalendarSlots = message.includes('disponibles') && 
                                   (message.includes('1.') || message.includes('Opción 1'));
      
      // Return Command object with tool message
      return new Command({
        update: {
          messages: [
            {
              role: "tool",
              content: `Message sent successfully: "${message.substring(0, 50)}..."${containsCalendarSlots ? '\nCALENDAR_SHOWN: Waiting for user selection' : ''}`,
              tool_call_id: toolCallId
            }
          ],
          lastUpdate: new Date().toISOString(),
          calendarShown: containsCalendarSlots
        }
      });
    } catch (error) {
      logger.error("Error sending GHL message", {
        error: error.message,
        contactId,
        messageLength: message.length
      });
      // Return Command with error tool message
      return new Command({
        update: {
          messages: [
            {
              role: "tool",
              content: `Error sending message: ${error.message}`,
              tool_call_id: toolCallId
            }
          ]
        }
      });
    }
  },
  {
    name: "send_ghl_message",
    description: "Send WhatsApp message to customer via GHL",
    schema: z.object({
      message: z.string().describe("Message to send to customer")
    })
  }
);

// System prompt (optimized for token efficiency)
const SALES_AGENT_PROMPT = `You are María, an AI sales consultant for Outlet Media.
Language: Spanish (Texas style)

🚨 CRITICAL RULES - MUST FOLLOW 🚨
1. YOU MUST USE TOOLS - NEVER GENERATE DIRECT RESPONSES
2. ALWAYS use send_ghl_message tool to communicate with the customer
3. NEVER put your response in the content field - ONLY use tools
4. FIRST call extract_lead_info on EVERY customer message to update leadInfo
5. THEN check leadInfo state to decide what to do next
6. EVERY response to the customer MUST go through send_ghl_message tool

🎯 RESPONSE RULES:
- ONLY respond to the LATEST human message (the last HumanMessage in the conversation)
- Previous messages are for CONTEXT ONLY - to understand what info was already collected
- NEVER respond to AI messages or your own previous responses
- If maxExtractionReached=true, send a simple response without calling extract_lead_info
- If appointmentBooked=true, conversation is complete - ONLY use send_ghl_message, NO OTHER TOOLS
- If you see your own messages in history, IGNORE them - they're just for context

STATE CHECKING RULES:
- ALWAYS check the leadInfo object in state before asking questions
- leadInfo.name exists? Don't ask for name again
- leadInfo.problem exists? Don't ask about problems again
- leadInfo.goal exists? Don't ask about goals again
- leadInfo.budget exists? Don't ask about budget again
- leadInfo.email exists? Don't ask for email again

QUALIFICATION FLOW:
1. If no leadInfo.name → Ask for name
2. If has name but no leadInfo.problem → Ask about problem
3. If has problem but no leadInfo.goal → Ask about goal
4. If has goal but no leadInfo.budget → Ask about budget
5. If budget >= ${config.minBudget} but no leadInfo.email → Ask for email
6. If ALL fields present AND budget >= ${config.minBudget} → IMMEDIATELY call get_calendar_slots

OTHER RULES:
- ALWAYS introduce yourself: "¡Hola! Soy María" in first greeting
- If appointmentBooked=true, only handle follow-up questions
- If calendarShown=true, STOP and wait for customer to select a time - do NOT call any tools
- NEVER mention calendar until ALL fields collected AND budget >= ${config.minBudget}
- If asked about scheduling before qualified, say "Primero necesito conocer más sobre tu negocio"

EXTRACTION RULES:
- ALWAYS call extract_lead_info FIRST on customer messages
- The tool response includes CURRENT_STATE with nextStep guidance
- Follow the nextStep instruction EXACTLY

TOOL RESPONSE INTERPRETATION:
- Look for CURRENT_STATE in the extract_lead_info response
- If nextStep = 'SHOW_CALENDAR_NOW' → IMMEDIATELY call get_calendar_slots
- If nextStep = 'ASK_FOR_NAME' → Ask for name
- If nextStep = 'ASK_FOR_PROBLEM' → Ask about problem
- If nextStep = 'ASK_FOR_GOAL' → Ask about goal
- If nextStep = 'ASK_FOR_BUDGET' → Ask about budget
- If nextStep = 'ASK_FOR_EMAIL' → Ask for email

CRITICAL RULES:
1. NEVER ask for information that's already in currentLeadInfo
2. If tool says "ALL_FIELDS_READY" → call get_calendar_slots IMMEDIATELY
3. DO NOT ask more questions if all fields are collected
4. Always call update_ghl_contact after successful extraction
5. If appointmentBooked=true → ONLY use send_ghl_message (no extraction, no other tools)

PERSONALITY:
- Smart & proud to be AI
- Industry insights when relevant
- Use customer's exact words
- Emoji sparingly: 🚀 📈 💡

Budget < $${config.minBudget}: Tag "nurture-lead", explain minimum
Budget >= $${config.minBudget}: Continue to scheduling

CALENDAR HANDLING:
- After showing calendar slots with send_ghl_message, calendarShown will be set to true
- When calendarShown=true, STOP ALL PROCESSING - do NOT call any tools
- Wait for customer to select a time before continuing
- When customer selects a time, use parse_time_selection → book_appointment

After booking: appointmentBooked=true - only answer questions`;


// Create the agent following LangGraph patterns
// Configure LLM with explicit tool binding and force tool usage
const llm = new ChatOpenAI({ 
  model: "gpt-4",
  temperature: 0.7,
  timeout: process.env.NODE_ENV === 'production' ? 20000 : 10000, // 20s in prod, 10s in dev
  maxRetries: 2    // Reduce retries to fail fast
});

// Define tools array
const tools = [
  sendGHLMessage,
  extractLeadInfo,
  getCalendarSlots,
  bookAppointment,
  updateGHLContact,
  parseTimeSelection
];

// Dynamic prompt function - messageModifier receives messages array, not state
const promptFunction = (messages) => {
  // First apply message windowing (keep only last 10 messages)
  let recentMessages = messages || [];
  if (recentMessages.length > 10) {
    recentMessages = recentMessages.slice(-10);
  }
  
  // For now, use basic prompt since we can't access state in messageModifier
  // TODO: Find a way to access state for dynamic prompt
  const systemPrompt = SALES_AGENT_PROMPT;
  
  return [
    { role: "system", content: systemPrompt },
    ...recentMessages
  ];
};

// Message window hook to limit context size and clean history
const preModelHook = (state) => {
  // Keep only last 10 messages for token efficiency
  let recentMessages = state.messages.slice(-10);
  
  // Clean up any orphaned tool calls to prevent OpenAI errors
  const cleaned = [];
  for (let i = 0; i < recentMessages.length; i++) {
    const msg = recentMessages[i];
    
    // Skip AI messages with tool_calls that don't have corresponding tool responses
    if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
      const nextMsg = recentMessages[i + 1];
      if (!nextMsg || nextMsg.role !== 'tool') {
        // Skip this orphaned tool call message
        logger.debug('Skipping orphaned tool_call message', { 
          content: msg.content?.substring(0, 50) 
        });
        continue;
      }
    }
    
    // Skip tool messages that don't have a preceding AI message with tool_calls
    if (msg.role === 'tool' && i > 0) {
      const prevMsg = recentMessages[i - 1];
      if (!prevMsg || prevMsg.role !== 'assistant' || !prevMsg.tool_calls) {
        logger.debug('Skipping orphaned tool response', { 
          tool_call_id: msg.tool_call_id 
        });
        continue;
      }
    }
    
    cleaned.push(msg);
  }
  
  return {
    ...state,
    messages: cleaned
  };
};

// Bind tools to the model with auto tool choice
const modelWithTools = llm.bindTools(tools, {
  tool_choice: "auto"  // Let the model decide when to use tools
});

// Create the agent with modern parameters
export const salesAgent = createReactAgent({
  llm: modelWithTools,
  tools: tools,
  stateSchema: AgentStateAnnotation,  // Custom state schema
  checkpointer: checkpointer,
  messageModifier: promptFunction  // Use messageModifier for both prompt and windowing
});

// Keep graph export for backwards compatibility
export const graph = salesAgent;

// Enhanced sales agent wrapper with error recovery
export async function salesAgentInvoke(input, agentConfig) {
  // Use provided runId or generate a valid UUID
  const traceId = agentConfig?.runId || crypto.randomUUID();
  
  logger.info('🤖 SALES AGENT INVOKED', {
    traceId,
    messageCount: input.messages?.length || 0,
    hasLeadInfo: !!input.leadInfo,
    leadInfoFields: input.leadInfo ? Object.keys(input.leadInfo).filter(k => input.leadInfo[k]) : [],
    contactId: input.contactId,
    conversationId: input.conversationId
  });
  
  const startTime = Date.now();
  const contactId = input.contactId || agentConfig?.configurable?.contactId;
  
  // Track conversation start
  if (!input.isResume) {
    metrics.recordConversationStarted();
  }
  
  // Clean messages to prevent OpenAI tool_calls error
  const cleanedMessages = [];
  const inputMessages = input.messages || [];
  
  for (let i = 0; i < inputMessages.length; i++) {
    const msg = inputMessages[i];
    
    // Skip AI messages with tool_calls that don't have corresponding tool responses
    if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
      // Check if all tool calls have responses
      let hasAllResponses = true;
      for (const toolCall of msg.tool_calls) {
        const hasResponse = inputMessages.slice(i + 1).some(m => 
          m.role === 'tool' && m.tool_call_id === toolCall.id
        );
        if (!hasResponse) {
          hasAllResponses = false;
          break;
        }
      }
      
      if (!hasAllResponses) {
        // Convert to regular message without tool_calls
        logger.debug('Cleaning orphaned tool_call message', { 
          content: msg.content?.substring(0, 50) 
        });
        cleanedMessages.push({
          ...msg,
          tool_calls: undefined,
          additional_kwargs: {}
        });
        continue;
      }
    }
    
    // Skip orphaned tool responses
    if (msg.role === 'tool') {
      const prevMsg = i > 0 ? inputMessages[i - 1] : null;
      if (!prevMsg || prevMsg.role !== 'assistant' || !prevMsg.tool_calls?.some(tc => tc.id === msg.tool_call_id)) {
        logger.debug('Skipping orphaned tool response', { 
          tool_call_id: msg.tool_call_id 
        });
        continue;
      }
    }
    
    cleanedMessages.push(msg);
  }
  
  // Prepare initial state with all necessary fields
  const initialState = {
    messages: cleanedMessages,
    leadInfo: input.leadInfo || {},
    contactId: contactId,
    conversationId: input.conversationId || null,
    appointmentBooked: false,
    extractionCount: 0,
    processedMessages: [],
    availableSlots: [],
    ghlUpdated: false,
    lastUpdate: null,
    userInfo: {}
  };
  
  // Enhanced config with thread_id for checkpointing
  const enhancedConfig = {
    ...agentConfig,
    configurable: {
      ...agentConfig?.configurable,
      thread_id: contactId || 'default',  // For conversation persistence
      conversationStartTime: startTime,
      agentConfig: AGENT_CONFIG,
      // Pass GHL service and calendar ID for tools
      ghlService: agentConfig?.configurable?.ghlService,
      calendarId: agentConfig?.configurable?.calendarId
    }
  };
  
  try {
    // Set overall timeout for the conversation
    const conversationTimeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Conversation timeout exceeded'));
      }, AGENT_CONFIG.conversationTimeout);
    });
    
    // Run agent with timeout and recursion limit
    // Pass state in configurable so tools can access it
    const result = await Promise.race([
      salesAgent.invoke(initialState, {
        ...enhancedConfig,
        recursionLimit: 15, // Reasonable limit to prevent infinite loops
        configurable: {
          ...enhancedConfig.configurable,
          // Ensure state is available to tools
          ...initialState
        }
      }),
      conversationTimeoutPromise
    ]);
    
    logger.info('✅ AGENT CONVERSATION COMPLETED', {
      traceId,
      duration: Date.now() - startTime,
      messageCount: result.messages?.length || 0,
      appointmentBooked: result.appointmentBooked,
      leadInfoUpdated: result.leadInfo ? Object.keys(result.leadInfo).filter(k => result.leadInfo[k]) : [],
      finalStep: result.currentStep
    });
    
    return result;
    
  } catch (error) {
    logger.error('❌ AGENT ERROR', {
      traceId,
      error: error.message,
      stack: error.stack,
      duration: Date.now() - startTime,
      errorType: error.name,
      contactId
    });
    
    // Handle specific error types
    if (error.message === 'Conversation timeout exceeded') {
      return {
        ...initialState,
        messages: [
          ...input.messages,
          new AIMessage('Lo siento, la conversación tardó demasiado. Por favor, intenta de nuevo o contacta soporte.')
        ]
      };
    }
    
    
    // Handle cancellation errors
    if (error.name === 'CancelledError' || error.message.includes('cancelled')) {
      logger.warn('Operation was cancelled - likely due to platform restart');
      return {
        ...initialState,
        messages: [
          ...input.messages,
          new AIMessage('Hubo una interrupción temporal. Por favor, envía tu mensaje nuevamente.')
        ]
      };
    }
    
    // Re-throw other errors
    throw error;
  }
}

// Export tools for testing
export const exportedTools = {
  sendGHLMessage,
  extractLeadInfo,
  getCalendarSlots,
  bookAppointment,
  updateGHLContact,
  parseTimeSelection
};

// Export configuration for monitoring
export const agentConfig = AGENT_CONFIG;

// Export prompt for reuse
export { SALES_AGENT_PROMPT };

// Export state annotation for testing
export { AgentStateAnnotation };