import { ChatOpenAI } from '@langchain/openai';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { MemorySaver } from '@langchain/langgraph';
import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { Command, MessagesAnnotation, Annotation } from '@langchain/langgraph';
import { config as appConfig } from '../services/config.js';
import { Logger } from '../services/logger.js';
import crypto from 'crypto';
import { GHLService } from '../services/ghlService.js';
import { updateGHLContactAsync } from '../services/ghlAsyncUpdater.js';
import { formatPhoneNumber } from '../services/ghlService.js';
import { config } from '../services/config.js';
import { SALES_AGENT_PROMPT } from '../prompts/salesAgentPrompt.js';
import { featureFlags, FLAGS } from '../services/featureFlags.js';
import { ManagedMemorySaver } from '../services/memoryManager.js';
import { modelSelector } from '../services/modelSelector.js';
import { toolResponseCompressor } from '../services/toolResponseCompressor.js';

// Initialize logger
const logger = new Logger('salesAgent');

// Agent configuration
const AGENT_CONFIG = {
  minBudget: config.business.minBudget,
  modelName: config.models.primary.name,
  temperature: 0.2,
  maxRetries: 2,
  maxExecutionTime: 30000
};

// Choose prompt based on optimization flag
const SALES_AGENT_PROMPT_TO_USE = config.features.enablePromptOptimization ? 
  config.prompts.optimizedSalesAgent : 
  SALES_AGENT_PROMPT;

// Initialize LLM with configuration
const llm = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: AGENT_CONFIG.modelName,
  temperature: AGENT_CONFIG.temperature,
  maxRetries: AGENT_CONFIG.maxRetries,
  timeout: AGENT_CONFIG.maxExecutionTime,
  streaming: true
});

// Define custom state schema with FIXED state access
const AgentStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  
  leadInfo: Annotation({
    default: () => ({}),
    reducer: (current, update) => ({ ...current, ...update })
  }),
  
  userInfo: Annotation({
    default: () => ({}),
    reducer: (current, update) => ({ ...current, ...update })
  }),
  
  appointmentBooked: Annotation({
    default: () => false
  }),
  
  extractionCount: Annotation({
    reducer: (x, y) => y,
    default: () => 0
  }),
  
  processedMessages: Annotation({
    reducer: (x, y) => [...new Set([...x, ...y])],
    default: () => []
  }),
  
  availableSlots: Annotation({
    default: () => []
  }),
  
  contactId: Annotation({
    default: () => null
  }),
  
  conversationId: Annotation({
    default: () => null
  }),
  
  threadId: Annotation({
    default: () => null
  })
});

// Choose memory implementation
const checkpointer = featureFlags.isEnabled(FLAGS.USE_MEMORY_SAVER) 
  ? new ManagedMemorySaver()
  : new MemorySaver();

// FIXED: Helper to get current state from tool context
function getCurrentTaskInput(config) {
  // Try multiple paths to find the state
  const paths = [
    config?.configurable?.__pregel_scratchpad?.currentTaskInput,
    config?.configurable?.currentTaskInput,
    config?.currentTaskInput,
    config?.state,
    config
  ];
  
  for (const path of paths) {
    if (path && (path.leadInfo || path.contactId)) {
      logger.debug('Found state at path', { 
        hasLeadInfo: !!path.leadInfo,
        hasContactId: !!path.contactId,
        leadInfoFields: path.leadInfo ? Object.keys(path.leadInfo).filter(k => path.leadInfo[k]) : []
      });
      return path;
    }
  }
  
  logger.warn('Could not find state in any path', { 
    configKeys: Object.keys(config || {}),
    configurableKeys: Object.keys(config?.configurable || {})
  });
  
  return {};
}

// Tool: Extract lead information from messages
const extractLeadInfo = tool(
  async ({ message }, config) => {
    const toolCallId = config.toolCall?.id || 'extract_lead_info';
    const startTime = Date.now();
    
    logger.info('🔍 EXTRACT LEAD INFO START', {
      toolCallId,
      messageLength: message.length,
      messagePreview: message.substring(0, 50)
    });
    
    try {
      // FIXED: Get state properly
      const currentTaskInput = getCurrentTaskInput(config);
      const currentLeadInfo = currentTaskInput.leadInfo || {};
      const extractionCount = currentTaskInput.extractionCount || 0;
      const processedMessages = currentTaskInput.processedMessages || [];
      const stateMessages = currentTaskInput.messages || [];
      
      // Skip extraction for simple messages
      const SKIP_PATTERNS = [
        /^(hola|hi|hello|hey|buenos dias|buenas tardes|buenas noches)$/i,
        /^(ok|okay|bien|perfecto|genial|excelente|entendido)$/i,
        /^(si|sí|no|yes|nope)$/i,
        /^(gracias|thanks|thank you)$/i,
        /^(adios|adiós|bye|chao|hasta luego|nos vemos)$/i,
        /^\d+$/,
        /^[.,!?¿¡]$/,
        /^(ah|oh|hmm|mmm|aja|ajá)$/i
      ];
      
      const messageToCheck = message.trim().toLowerCase();
      if (SKIP_PATTERNS.some(pattern => pattern.test(messageToCheck))) {
        logger.info('⚡ EXTRACTION SKIPPED - Simple message', {
          toolCallId,
          message: messageToCheck,
          savedTokens: 800
        });
        
        return new Command({
          update: {
            messages: [toolResponse("No extraction needed for simple greeting/response", toolCallId)]
          }
        });
      }
      
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
            messages: [toolResponse("Max extraction attempts reached. Continue with available info.", toolCallId)]
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
            messages: [toolResponse("Message already processed. No new info.", toolCallId)]
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
        hasEmail: !!currentLeadInfo.email,
        currentLeadInfo
      });
      
      // Smart model selection
      const llm = modelSelector.getModelForTool('extract_lead_info', { message });
      
      // Build current info properly
      const currentInfo = {
        name: currentLeadInfo.name || "",
        businessType: currentLeadInfo.businessType || "",
        problem: currentLeadInfo.problem || "",
        goal: currentLeadInfo.goal || "",
        budget: currentLeadInfo.budget || 0,
        email: currentLeadInfo.email || "",
        businessDetails: currentLeadInfo.businessDetails || ""
      };
      
      // Get conversation context
      const recentMessages = stateMessages.slice(-5);
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
      
      // Check for contextual responses (si, numbers, etc.)
      const isJustNumber = /^\$?\d+(?:,\d{3})*(?:\.\d{2})?$/.test(message.trim());
      const isConfirmation = /^(si|sí|yes|sí\.|si\.|claro|por supuesto|correcto|exacto|eso es)$/i.test(message.trim());
      
      if (isJustNumber) {
        const wasBudgetQuestion = ['presupuesto', 'budget', 'mensual', 'al mes', 'por mes', 'invertir']
          .some(keyword => lastAssistantQuestion.toLowerCase().includes(keyword));
        
        if (wasBudgetQuestion) {
          const budgetAmount = parseInt(message.replace(/[$,]/g, ''));
          logger.info('✅ Budget extracted from standalone number', {
            toolCallId,
            budget: budgetAmount,
            lastQuestion: lastAssistantQuestion.substring(0, 50)
          });
          
          const merged = { ...currentInfo, budget: budgetAmount };
          
          return new Command({
            update: {
              leadInfo: merged,
              extractionCount: extractionCount + 1,
              processedMessages: [...processedMessages, messageHash],
              messages: [{
                role: "tool",
                content: toolResponseCompressor.compress(`Extracted: {"budget": ${budgetAmount}}`),
                tool_call_id: toolCallId
              }]
            }
          });
        }
      }
      
      // Extract information using LLM
      const prompt = `Analyze ONLY this CURRENT customer message:

CURRENT MESSAGE TO ANALYZE: "${message}"

CONVERSATION CONTEXT:
${conversationContext}

Last assistant message: "${lastAssistantQuestion}"

Current info we already have: ${JSON.stringify(currentInfo)}

Extract any NEW information from the CURRENT MESSAGE ONLY:
- name (person's name)
- businessType (restaurant, store, clinic, salon, etc)
- problem (their pain point)
- goal (what they want to achieve)
- budget (monthly budget in numbers)
- email (email address)
- businessDetails (specific details)

Return ONLY a JSON object with the extracted fields. If no new info, return empty object {}`;

      const result = await llm.invoke(prompt);
      const extracted = JSON.parse(result.content);
      
      // Merge with existing info
      const merged = { ...currentInfo };
      let fieldsUpdated = [];
      
      for (const [key, value] of Object.entries(extracted)) {
        if (value && value !== merged[key]) {
          merged[key] = value;
          fieldsUpdated.push(key);
        }
      }
      
      logger.info('✅ LEAD INFO EXTRACTED', {
        toolCallId,
        rawExtracted: extracted,
        currentInfoBefore: currentInfo,
        mergedResult: merged,
        extractedFields: Object.keys(extracted).filter(k => extracted[k]),
        mergedFields: fieldsUpdated,
        processingTime: Date.now() - startTime
      });
      
      // Return with proper state update
      return new Command({
        update: {
          leadInfo: merged,
          extractionCount: extractionCount + 1,
          processedMessages: [...processedMessages, messageHash],
          messages: [{
            role: "tool",
            content: toolResponseCompressor.compress(
              fieldsUpdated.length > 0 ? 
                `+${fieldsUpdated.join(',')}` : 
                'NoInfo'
            ),
            tool_call_id: toolCallId
          }]
        }
      });
      
    } catch (error) {
      logger.error('❌ EXTRACTION ERROR', {
        toolCallId,
        error: error.message,
        stack: error.stack
      });
      
      return new Command({
        update: {
          messages: [{
            role: "tool",
            content: toolResponseCompressor.compress(`Error: ${error.message}`),
            tool_call_id: toolCallId
          }]
        }
      });
    }
  },
  {
    name: "extract_lead_info",
    description: "Extract lead information from customer message",
    schema: z.object({
      message: z.string().describe("The customer message to analyze")
    })
  }
);

// Tool: Send message via GHL
const sendGHLMessage = tool(
  async ({ message }, config) => {
    const toolCallId = config.toolCall?.id || 'send_ghl_message';
    const startTime = Date.now();
    
    logger.info('📤 SEND GHL MESSAGE START', {
      toolCallId,
      messageLength: message.length,
      messagePreview: message.substring(0, 50)
    });
    
    // FIXED: Get state properly
    const currentTaskInput = getCurrentTaskInput(config);
    const contactId = currentTaskInput.contactId || config?.configurable?.contactId;
    
    if (!contactId) {
      logger.error('❌ NO CONTACT ID', { toolCallId });
      throw new Error('No contact ID available for sending message');
    }
    
    let ghlService = config?.configurable?.ghlService;
    if (!ghlService) {
      ghlService = new GHLService(
        process.env.GHL_API_KEY,
        process.env.GHL_LOCATION_ID
      );
    }
    
    try {
      await ghlService.sendSMS(contactId, message);
      
      logger.info('✅ MESSAGE SENT SUCCESSFULLY', {
        toolCallId,
        contactId,
        sendTime: Date.now() - startTime,
        totalTime: Date.now() - startTime
      });
      
      return new Command({
        update: {
          messages: [{
            role: "tool",
            content: toolResponseCompressor.compress("SentOK"),
            tool_call_id: toolCallId
          }]
        }
      });
      
    } catch (error) {
      logger.error('❌ MESSAGE SEND ERROR', {
        toolCallId,
        error: error.message,
        contactId
      });
      
      throw error;
    }
  },
  {
    name: "send_ghl_message",
    description: "Send message to customer via GHL WhatsApp",
    schema: z.object({
      message: z.string().describe("Message to send to the customer")
    })
  }
);

// Tool: Get calendar slots
const getCalendarSlots = tool(
  async ({ startDate, endDate }, config) => {
    const toolCallId = config.toolCall?.id || 'get_calendar_slots';
    
    // FIXED: Get state properly
    const currentTaskInput = getCurrentTaskInput(config);
    const currentLeadInfo = currentTaskInput.leadInfo || {};
    
    let ghlService = config?.configurable?.ghlService;
    let calendarId = config?.configurable?.calendarId || process.env.GHL_CALENDAR_ID;
    
    if (!ghlService) {
      ghlService = new GHLService(
        process.env.GHL_API_KEY,
        process.env.GHL_LOCATION_ID
      );
    }
    
    // STRICT validation
    if (!currentLeadInfo.name || !currentLeadInfo.problem || !currentLeadInfo.goal || 
        !currentLeadInfo.budget || !currentLeadInfo.email) {
      const missingFields = {
        name: !currentLeadInfo.name,
        problem: !currentLeadInfo.problem,
        goal: !currentLeadInfo.goal,
        budget: !currentLeadInfo.budget,
        email: !currentLeadInfo.email
      };
      
      logger.warn('Missing required fields for calendar', {
        toolCallId,
        missingFields,
        currentLeadInfo
      });
      
      return new Command({
        update: {
          messages: [{
            role: "tool",
            content: "Missing required information for calendar: " + 
                    Object.keys(missingFields).filter(k => missingFields[k]).join(", "),
            tool_call_id: toolCallId
          }]
        }
      });
    }
    
    // Budget check
    if (currentLeadInfo.budget < AGENT_CONFIG.minBudget) {
      return new Command({
        update: {
          messages: [{
            role: "tool",
            content: toolResponseCompressor.compress(
              `Cannot fetch slots - budget under $${AGENT_CONFIG.minBudget}/month`
            ),
            tool_call_id: toolCallId
          }]
        }
      });
    }
    
    const start = startDate || new Date().toISOString();
    const endDate2 = new Date(start);
    endDate2.setDate(endDate2.getDate() + 7);
    
    try {
      const slotsData = await ghlService.getAvailableSlots(
        calendarId,
        new Date(start),
        endDate2
      );
      
      // Convert to array
      const slots = [];
      for (const dateKey in slotsData) {
        if (slotsData[dateKey] && slotsData[dateKey].slots) {
          slotsData[dateKey].slots.forEach(slotTime => {
            slots.push({
              startTime: slotTime,
              endTime: new Date(new Date(slotTime).getTime() + 30 * 60000).toISOString(),
              date: dateKey
            });
          });
        }
      }
      
      logger.debug('Retrieved calendar slots', {
        count: slots.length
      });
      
      // Format slots for display
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
        
        const dayName = date.toLocaleString('en-US', { weekday: 'long', timeZone: 'America/Chicago' });
        const formattedTime = date.toLocaleString('es-US', {
          day: 'numeric',
          month: 'long',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'America/Chicago'
        });
        
        return {
          index: index + 1,
          display: `${spanishDays[dayName]} ${formattedTime}`,
          startTime: slot.startTime,
          endTime: slot.endTime,
          slotId: slot.id || `slot-${index}`
        };
      });
      
      return new Command({
        update: {
          availableSlots: formattedSlots,
          messages: [{
            role: "tool",
            content: toolResponseCompressor.compress(`Found ${formattedSlots.length} available slots`),
            tool_call_id: toolCallId
          }]
        }
      });
      
    } catch (error) {
      logger.error("Error fetching calendar slots", {
        error: error.message,
        calendarId
      });
      
      return new Command({
        update: {
          messages: [{
            role: "tool",
            content: toolResponseCompressor.compress(`Error fetching calendar: ${error.message}`),
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
      startDate: z.string().optional().describe("Start date in ISO format"),
      endDate: z.string().optional().describe("End date in ISO format")
    })
  }
);

// Tool: Book appointment
const bookAppointment = tool(
  async ({ slot, leadName, leadEmail }, config) => {
    const toolCallId = config.toolCall?.id || 'book_appointment';
    
    // FIXED: Get state properly
    const currentTaskInput = getCurrentTaskInput(config);
    const contactId = currentTaskInput.contactId || config?.configurable?.contactId;
    
    if (!contactId) {
      throw new Error('contactId not found in state. Cannot book appointment.');
    }
    
    let ghlService = config?.configurable?.ghlService;
    if (!ghlService) {
      ghlService = new GHLService(
        process.env.GHL_API_KEY,
        process.env.GHL_LOCATION_ID
      );
    }
    
    try {
      const slotData = {
        startTime: slot.startTime,
        endTime: slot.endTime,
        title: `Consulta - ${leadName}`,
        appointmentStatus: 'confirmed'
      };
      
      const appointment = await ghlService.bookAppointment(
        config?.configurable?.calendarId || process.env.GHL_CALENDAR_ID,
        contactId,
        slotData
      );
      
      // Update contact async
      updateGHLContactAsync({
        ghlService,
        contactId,
        tags: ['appointment-booked', 'qualified-lead'],
        notes: `Appointment booked for ${slot.display}`
      });
      
      return new Command({
        update: {
          appointmentBooked: true,
          messages: [{
            role: "tool",
            content: toolResponseCompressor.compress("BookedOK"),
            tool_call_id: toolCallId
          }]
        },
        goto: 'END'
      });
      
    } catch (error) {
      logger.error('Booking error', { error: error.message });
      
      return new Command({
        update: {
          messages: [{
            role: "tool",
            content: toolResponseCompressor.compress(`BookError: ${error.message}`),
            tool_call_id: toolCallId
          }]
        }
      });
    }
  },
  {
    name: "book_appointment",
    description: "Book appointment in GHL calendar",
    schema: z.object({
      slot: z.object({
        startTime: z.string(),
        endTime: z.string(),
        display: z.string()
      }).describe("Selected time slot"),
      leadName: z.string().describe("Customer name"),
      leadEmail: z.string().describe("Customer email")
    })
  }
);

// Tool: Update GHL contact
const updateGHLContact = tool(
  async ({ tags, notes }, config) => {
    const toolCallId = config.toolCall?.id || 'update_ghl_contact';
    
    // FIXED: Get state properly
    const currentTaskInput = getCurrentTaskInput(config);
    const contactId = currentTaskInput.contactId || config?.configurable?.contactId;
    const leadInfo = currentTaskInput.leadInfo || {};
    
    if (!contactId) {
      throw new Error('contactId not found in state. Cannot update contact.');
    }
    
    updateGHLContactAsync({
      ghlService: config?.configurable?.ghlService || new GHLService(
        process.env.GHL_API_KEY,
        process.env.GHL_LOCATION_ID
      ),
      contactId,
      tags,
      notes,
      customFields: {
        budget: leadInfo.budget,
        problem: leadInfo.problem,
        goal: leadInfo.goal
      }
    });
    
    return new Command({
      update: {
        messages: [{
          role: "tool",
          content: toolResponseCompressor.compress("UpdateQueued"),
          tool_call_id: toolCallId
        }]
      }
    });
  },
  {
    name: "update_ghl_contact",
    description: "Update GHL contact with tags and notes",
    schema: z.object({
      tags: z.array(z.string()).describe("Tags to add"),
      notes: z.string().optional().describe("Note to add")
    })
  }
);

// Tool: Parse time selection
const parseTimeSelection = tool(
  async ({ userMessage }, config) => {
    const toolCallId = config.toolCall?.id || 'parse_time_selection';
    
    // FIXED: Get state properly
    const currentTaskInput = getCurrentTaskInput(config);
    const availableSlots = currentTaskInput.availableSlots || [];
    
    if (!availableSlots || availableSlots.length === 0) {
      return new Command({
        update: {
          messages: [{
            role: "tool",
            content: toolResponseCompressor.compress("No available slots in state"),
            tool_call_id: toolCallId
          }]
        }
      });
    }
    
    const llm = modelSelector.getModelForTool('parse_time_selection', { message: userMessage });
    
    const prompt = `User selected a time from these options:
    ${availableSlots.map(s => `${s.index}. ${s.display}`).join('\n')}
    
    User said: "${userMessage}"
    
    Return the index number (1-5) of their selection, or 0 if unclear.`;
    
    try {
      const result = await llm.invoke(prompt);
      const selectedIndex = parseInt(result.content.trim());
      
      if (selectedIndex > 0 && selectedIndex <= availableSlots.length) {
        const selectedSlot = availableSlots[selectedIndex - 1];
        
        return new Command({
          update: {
            selectedSlot,
            messages: [{
              role: "tool",
              content: toolResponseCompressor.compress(`Selected: ${selectedIndex}`),
              tool_call_id: toolCallId
            }]
          }
        });
      }
      
      return new Command({
        update: {
          messages: [{
            role: "tool",
            content: toolResponseCompressor.compress("NoSelection"),
            tool_call_id: toolCallId
          }]
        }
      });
      
    } catch (error) {
      logger.error('Parse error', { error: error.message });
      
      return new Command({
        update: {
          messages: [{
            role: "tool",
            content: toolResponseCompressor.compress("ParseError"),
            tool_call_id: toolCallId
          }]
        }
      });
    }
  },
  {
    name: "parse_time_selection",
    description: "Parse user's time selection from available slots",
    schema: z.object({
      userMessage: z.string().describe("User's time selection message")
    })
  }
);

// Tool response helper
const toolResponse = (content, toolCallId) => ({
  role: "tool",
  content: toolResponseCompressor.compress(content),
  tool_call_id: toolCallId
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

// Dynamic prompt function
const promptFunction = (messages) => {
  let recentMessages = messages || [];
  if (recentMessages.length > 10) {
    recentMessages = recentMessages.slice(-10);
  }
  
  const systemPrompt = SALES_AGENT_PROMPT_TO_USE;
  
  return [
    { role: "system", content: systemPrompt },
    ...recentMessages
  ];
};

// Bind tools to model
const modelWithTools = llm.bindTools(tools, {
  tool_choice: "auto"
});

// Create the agent
export const salesAgent = createReactAgent({
  llm: modelWithTools,
  tools: tools,
  stateSchema: AgentStateAnnotation,
  checkpointer: checkpointer,
  messageModifier: promptFunction
});

// Keep graph export for backwards compatibility
export const graph = salesAgent;

// Enhanced sales agent wrapper
export async function salesAgentInvoke(input, agentConfig) {
  const traceId = agentConfig?.runId || crypto.randomUUID();
  
  logger.info('🤖 SALES AGENT INVOKED', {
    traceId,
    messageCount: input.messages?.length || 0,
    hasLeadInfo: !!input.leadInfo,
    leadInfoFields: input.leadInfo ? Object.keys(input.leadInfo).filter(k => input.leadInfo[k]) : [],
    contactId: input.contactId,
    conversationId: input.conversationId,
    threadId: input.threadId
  });
  
  const startTime = Date.now();
  
  try {
    // CRITICAL: Pass state in a way tools can access it
    const enhancedConfig = {
      ...agentConfig,
      configurable: {
        ...agentConfig?.configurable,
        // Ensure state is accessible to tools
        __pregel_scratchpad: {
          currentTaskInput: {
            ...input,
            leadInfo: input.leadInfo || {},
            contactId: input.contactId,
            conversationId: input.conversationId,
            threadId: input.threadId,
            extractionCount: input.extractionCount || 0,
            processedMessages: input.processedMessages || [],
            messages: input.messages || []
          }
        },
        // Also pass directly for fallback
        currentTaskInput: input,
        state: input
      }
    };
    
    const result = await salesAgent.invoke(input, enhancedConfig);
    
    const duration = Date.now() - startTime;
    
    logger.info('✅ AGENT CONVERSATION COMPLETED', {
      traceId,
      duration,
      messageCount: result.messages?.length || 0,
      appointmentBooked: result.appointmentBooked || false,
      leadInfoUpdated: result.leadInfo ? Object.keys(result.leadInfo).filter(k => result.leadInfo[k]) : []
    });
    
    return result;
    
  } catch (error) {
    logger.error('❌ AGENT ERROR', {
      traceId,
      error: error.message,
      stack: error.stack,
      duration: Date.now() - startTime
    });
    
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

// Export configuration
export const agentConfig = AGENT_CONFIG;
export { SALES_AGENT_PROMPT };
export { AgentStateAnnotation };