import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, AIMessage } from "@langchain/core/messages";
import { MemorySaver, Annotation, Command, MessagesAnnotation } from '@langchain/langgraph';
import { Logger } from '../services/logger.js';
import { config } from '../services/config.js';
import { metrics } from '../services/monitoring.js';
import { featureFlags, FLAGS } from '../services/featureFlags.js';

// Initialize logger
const logger = new Logger('salesAgent');

// Initialize checkpointer for conversation persistence (if enabled)
const checkpointer = featureFlags.isEnabled(FLAGS.USE_MEMORY_SAVER) 
  ? new MemorySaver() 
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
      // Access current state via config
      const currentState = config?.getState ? await config.getState() : config?.configurable || {};
      const currentLeadInfo = currentState.leadInfo || {};
      const extractionCount = currentState.extractionCount || 0;
      
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
              tool_call_id: config.toolCall?.id || "extract_lead_info"
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
      
      const prompt = `Analyze this customer message and extract any information provided:
      Message: "${message}"
      
      Current info we already have: ${JSON.stringify(currentInfo)}
      
      Extract any NEW information (if mentioned):
      - Name
      - BusinessType (restaurant, store, clinic, salon, etc)
      - Problem/Pain point
      - Goal
      - Budget (IMPORTANT: Look for numbers with "mes", "mensual", "al mes", "por mes", "$". Examples: "500 al mes" = 500, "$1000 mensual" = 1000)
      - Email
      - Any specific details about their business
      
      For budget, if you see a number followed by any monthly indicator, extract just the number.
      
      Return ONLY a JSON object with any new/updated fields. Do NOT include fields that haven't changed.
      Example: If current name is "Jaime" and message doesn't mention a different name, don't include "name" in response.`;
      
      const response = await llm.invoke([
        new SystemMessage("You extract information from messages. Return only valid JSON with ONLY new/changed fields."),
        { role: "user", content: prompt }
      ]);
      
      try {
        const extracted = JSON.parse(response.content);
        
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
              messages: [{
                role: "tool",
                content: "No new information extracted from message",
                tool_call_id: config.toolCall?.id || "extract_lead_info"
              }]
            }
          });
        }
        
        // Merge with existing info
        const merged = { ...currentInfo };
        Object.keys(extracted).forEach(key => {
          if (extracted[key] !== null && extracted[key] !== undefined && extracted[key] !== "") {
            merged[key] = extracted[key];
          }
        });
        
        logger.info('✅ LEAD INFO EXTRACTED', {
          toolCallId,
          extractedFields: Object.keys(extracted),
          mergedFields: Object.keys(merged).filter(k => merged[k]),
          newBudget: extracted.budget,
          processingTime: Date.now() - startTime
        });
        
        // Return Command object with state updates
        return new Command({
          update: {
            leadInfo: merged,
            extractionCount: extractionCount + 1,
            messages: [{
              role: "tool",
              content: `Extracted: ${JSON.stringify(extracted)}`,
              tool_call_id: config.toolCall?.id || "extract_lead_info",
            }]
          }
        });
      } catch (e) {
        logger.error('Failed to parse extraction response', { 
          error: e.message,
          response: response.content 
        });
        return new Command({ update: {} });
      }
    } catch (error) {
      logger.error('Error in extractLeadInfo tool', { error: error.message });
      return new Command({ update: {} });
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
    // Access current state via config
    const currentState = config?.getState ? await config.getState() : config?.configurable || {};
    const currentLeadInfo = currentState.leadInfo || {};
    
    // Initialize services if not provided
    let ghlService = config?.configurable?.ghlService;
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
            tool_call_id: config.toolCall?.id || "get_calendar_slots"
          }]
        }
      });
    }
    
    // Budget must be qualified
    if (currentLeadInfo.budget < 300) {
      return new Command({
        update: {
          messages: [{
            role: "tool",
            content: `Cannot fetch slots - budget under $300/month (current: $${currentLeadInfo.budget})`,
            tool_call_id: config.toolCall?.id || "get_calendar_slots"
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
      
      // Return Command with slots in state
      return new Command({
        update: {
          availableSlots: formattedSlots,
          messages: [{
            role: "tool",
            content: `Found ${formattedSlots.length} available slots`,
            tool_call_id: config.toolCall?.id || "get_calendar_slots"
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
            tool_call_id: config.toolCall?.id || "get_calendar_slots"
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
    // Access current state via config
    const currentState = config?.getState ? await config.getState() : config?.configurable || {};
    const contactId = currentState.contactId || config?.configurable?.contactId;
    
    if (!contactId) {
      throw new Error('contactId not found in state. Cannot book appointment.');
    }
    
    // Initialize services if not provided
    let ghlService = config?.configurable?.ghlService;
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
      
      // Return Command with termination signal
      return new Command({
        update: {
          appointmentBooked: true,
          messages: [
            {
              role: "assistant",
              content: `¡Perfecto! Tu cita está confirmada para ${slot.display}. Te enviaré un recordatorio antes de nuestra llamada.`,
              name: "María"
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
      // Return Command with error
      return new Command({
        update: {
          messages: [
            {
              role: "assistant",
              content: `Error al reservar la cita: ${error.message}. Por favor, intenta nuevamente.`,
              name: "María"
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
    // Access current state via config
    const currentState = config?.getState ? await config.getState() : config?.configurable || {};
    const contactId = currentState.contactId || config?.configurable?.contactId;
    const leadInfo = currentState.leadInfo || {};
    
    if (!contactId) {
      throw new Error('contactId not found in state. Cannot update contact.');
    }
    
    // Initialize GHL service if not provided
    let ghlService = config?.configurable?.ghlService;
    
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
      
      // Return Command with update status
      return new Command({
        update: {
          ghlUpdated: true,
          lastUpdate: new Date().toISOString()
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
      // Return Command with error in state
      return new Command({
        update: {
          ghlUpdated: false,
          lastUpdate: new Date().toISOString()
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
    // Access current state to get available slots
    const currentState = config?.getState ? await config.getState() : config?.configurable || {};
    const availableSlots = currentState.availableSlots || [];
    
    if (!availableSlots || availableSlots.length === 0) {
      return new Command({
        update: {
          messages: [{
            role: "tool",
            content: "No available slots in state to parse selection from",
            tool_call_id: config.toolCall?.id || "parse_time_selection"
          }]
        }
      });
    }
    
    const llm = new ChatOpenAI({ model: "gpt-4", temperature: 0 });
    
    const prompt = `User selected a time from these options:
    ${availableSlots.map(s => `${s.index}. ${s.display}`).join('\n')}
    
    User said: "${userMessage}"
    
    Return the index number (1-5) of their selection, or 0 if unclear.
    Return ONLY a number.`;
    
    const response = await llm.invoke([
      new SystemMessage("Extract the time slot selection. Return only a number 1-5, or 0 if unclear."),
      { role: "user", content: prompt }
    ]);
    
    const selection = parseInt(response.content.trim());
    
    if (selection > 0 && selection <= availableSlots.length) {
      // Return Command with selected slot
      const selectedSlot = availableSlots[selection - 1];
      return new Command({
        update: {
          messages: [{
            role: "tool",
            content: `User selected slot ${selection}: ${selectedSlot.display}`,
            tool_call_id: config.toolCall?.id || "parse_time_selection"
          }]
        }
      });
    }
    
    // Return Command with error
    return new Command({
      update: {
        messages: [{
          role: "tool",
          content: "Could not understand time selection from user message",
          tool_call_id: config.toolCall?.id || "parse_time_selection"
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
    
    // Access current state via config
    const currentState = config?.getState ? await config.getState() : config?.configurable || {};
    const contactId = currentState.contactId || config?.configurable?.contactId;
    
    if (!contactId) {
      logger.error('❌ NO CONTACT ID', { toolCallId });
      throw new Error('contactId not found in state. Cannot send message.');
    }
    
    // Check if appointment is already booked from state
    const appointmentBooked = currentState.appointmentBooked || false;
    
    logger.debug('📊 Send message state', {
      toolCallId,
      contactId,
      appointmentBooked
    });
    
    // Initialize GHL service
    let ghlService = config?.configurable?.ghlService;
    
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
      
      // Return Command object with message update
      return new Command({
        update: {
          messages: [
            {
              role: "assistant",
              content: message,
              name: "María"
            }
          ],
          lastUpdate: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error("Error sending GHL message", {
        error: error.message,
        contactId,
        messageLength: message.length
      });
      // Return Command with error in messages
      return new Command({
        update: {
          messages: [
            {
              role: "tool",
              content: `Error sending message: ${error.message}`,
              tool_call_id: config.toolCall?.id || "send_ghl_message"
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

🚨 CRITICAL RULES 🚨
1. NEVER respond directly - ONLY use send_ghl_message tool
2. Check leadInfo state BEFORE asking questions
3. If appointmentBooked=true, only handle follow-up questions

TOOL USAGE PATTERN:
1. extract_lead_info → Analyze message (pass ONLY message)
2. send_ghl_message + update_ghl_contact → Execute in PARALLEL

QUALIFICATION FLOW (based on merged leadInfo):
1. No name → Ask for name
2. Has name, no problem → Ask about problem
3. Has problem, no goal → Ask about goal  
4. Has goal, no budget → Ask about budget
5. Budget >= $300, no email → Ask for email
6. Has all info → Show calendar slots

CONTEXT AWARENESS:
- leadInfo contains ALL known data
- extract_lead_info merges new info automatically
- NEVER re-ask for existing info

PERSONALITY:
- Smart & proud to be AI
- Industry insights when relevant
- Use customer's exact words
- Emoji sparingly: 🚀 📈 💡

Budget < $300: Tag "nurture-lead", explain minimum
Budget >= $300: Continue to scheduling

After booking: appointmentBooked=true - only answer questions`;


// Create the agent following LangGraph patterns
// Configure LLM with explicit tool binding
const llm = new ChatOpenAI({ 
  model: "gpt-4",
  temperature: 0.7,
  timeout: 10000, // 10 second timeout for production
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

// Dynamic prompt function that uses state
const promptFunction = (state) => {
  const { leadInfo, appointmentBooked } = state;
  
  // Build context-aware prompt
  let systemPrompt = SALES_AGENT_PROMPT;
  
  if (appointmentBooked) {
    systemPrompt += `\n\nAPPOINTMENT ALREADY BOOKED. Only answer follow-up questions.`;
  } else if (leadInfo && leadInfo.budget && leadInfo.budget >= 300) {
    systemPrompt += `\n\nQualified lead with budget: $${leadInfo.budget}/month. Ready to show calendar.`;
  }
  
  return [
    { role: "system", content: systemPrompt },
    ...state.messages
  ];
};

// Message window hook to limit context size
const preModelHook = (state) => {
  // Keep only last 10 messages for token efficiency
  const recentMessages = state.messages.slice(-10);
  
  return {
    ...state,
    messages: recentMessages
  };
};

// Bind tools to the model
const modelWithTools = llm.bindTools(tools);

// Create the agent with modern parameters
export const salesAgent = createReactAgent({
  llm: modelWithTools,
  tools: tools,
  stateSchema: AgentStateAnnotation,  // Custom state schema
  checkpointer: checkpointer,
  prompt: promptFunction,  // Dynamic prompt function
  preModelHook: preModelHook,  // Message windowing
});

// Keep graph export for backwards compatibility
export const graph = salesAgent;

// Enhanced sales agent wrapper with error recovery
export async function salesAgentInvoke(input, agentConfig) {
  const traceId = agentConfig?.runId || 'no-trace-id';
  
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
  
  // Prepare initial state with all necessary fields
  const initialState = {
    messages: input.messages || [],
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
    const result = await Promise.race([
      salesAgent.invoke(initialState, {
        ...enhancedConfig,
        recursionLimit: 25 // Prevent infinite loops
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