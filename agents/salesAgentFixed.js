import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, AIMessage } from "@langchain/core/messages";
import { MemorySaver, Annotation, MessagesAnnotation } from '@langchain/langgraph';
import crypto from 'crypto';
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
  
  // Track if appointment was booked
  appointmentBooked: Annotation({
    reducer: (x, y) => y,
    default: () => false
  }),
  
  // Track extraction attempts to prevent loops
  extractionCount: Annotation({
    reducer: (x, y) => y,
    default: () => 0
  }),
  
  // Track processed messages to avoid duplicates
  processedMessages: Annotation({
    reducer: (x, y) => [...new Set([...x, ...y])],
    default: () => []
  }),
  
  // Available slots for booking
  availableSlots: Annotation({
    reducer: (x, y) => y,
    default: () => []
  }),
  
  // Track GHL update status
  ghlUpdated: Annotation({
    reducer: (x, y) => y,
    default: () => false
  }),
  
  // Current conversation step
  currentStep: Annotation({
    reducer: (x, y) => y,
    default: () => "greeting"
  }),
  
  // Contact/conversation IDs
  contactId: Annotation({
    reducer: (x, y) => y || x,
    default: () => null
  }),
  conversationId: Annotation({
    reducer: (x, y) => y || x,
    default: () => null
  }),
  
  // Last update timestamp
  lastUpdate: Annotation({
    reducer: (x, y) => y,
    default: () => null
  })
});

// Tool: Send message to customer via GHL WhatsApp
const sendGHLMessage = tool(
  async ({ message }, config) => {
    const toolCallId = config.toolCall?.id || 'send_ghl_message';
    const startTime = Date.now();
    
    logger.info('📤 SEND GHL MESSAGE START', {
      toolCallId,
      messageLength: message.length,
      messagePreview: message.substring(0, 50)
    });
    
    try {
      // Get GHL service and contact ID from config
      const ghlService = config?.configurable?.ghlService;
      const contactId = config?.configurable?.contactId;
      
      if (!ghlService || !contactId) {
        throw new Error('Missing GHL service or contact ID');
      }
      
      await ghlService.sendMessage(contactId, message, 'WhatsApp');
      
      logger.info('✅ MESSAGE SENT SUCCESSFULLY', {
        toolCallId,
        contactId,
        sendTime: Date.now() - startTime,
        totalTime: Date.now() - startTime
      });
      
      // Return simple success response for tool
      return "Message sent successfully";
      
    } catch (error) {
      logger.error('❌ SEND MESSAGE ERROR', {
        toolCallId,
        error: error.message,
        processingTime: Date.now() - startTime
      });
      return `Error sending message: ${error.message}`;
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

// Tool: Extract lead information from message
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
      // Get current state from config
      const currentState = config?.configurable?.state || {};
      const currentLeadInfo = currentState.leadInfo || {};
      const extractionCount = currentState.extractionCount || 0;
      
      // Check extraction limit
      if (extractionCount >= MAX_EXTRACTION_ATTEMPTS) {
        logger.warn('⚠️ MAX EXTRACTION ATTEMPTS REACHED', { 
          toolCallId,
          extractionCount,
          limit: MAX_EXTRACTION_ATTEMPTS
        });
        return "Max extraction attempts reached";
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
      
      Return ONLY a JSON object with any new/updated fields.`;
      
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
          return "No new information extracted from message";
        }
        
        logger.info('✅ LEAD INFO EXTRACTED', {
          toolCallId,
          extractedFields: Object.keys(extracted),
          processingTime: Date.now() - startTime
        });
        
        // Return the extracted info as a string
        return `Extracted: ${JSON.stringify(extracted)}`;
        
      } catch (e) {
        logger.error('Failed to parse extraction response', { 
          error: e.message,
          response: response.content 
        });
        return "Failed to extract information";
      }
    } catch (error) {
      logger.error('Error in extractLeadInfo tool', { error: error.message });
      return `Error: ${error.message}`;
    }
  },
  {
    name: "extract_lead_info",
    description: "Extract lead information from customer message",
    schema: z.object({
      message: z.string().describe("Customer's message")
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
    const currentState = config?.configurable?.state || {};
    const currentLeadInfo = currentState.leadInfo || {};
    
    // Initialize services if not provided
    let ghlService = config?.configurable?.ghlService;
    let calendarId = config?.configurable?.calendarId || process.env.GHL_CALENDAR_ID;
    
    // STRICT validation - must have ALL info before showing slots
    if (!currentLeadInfo.name || !currentLeadInfo.problem || !currentLeadInfo.goal || !currentLeadInfo.budget || !currentLeadInfo.email) {
      const missingFields = {
        name: !currentLeadInfo.name,
        problem: !currentLeadInfo.problem,
        goal: !currentLeadInfo.goal,
        budget: !currentLeadInfo.budget,
        email: !currentLeadInfo.email
      };
      
      return "Missing required information for calendar: " + Object.keys(missingFields).filter(k => missingFields[k]).join(", ");
    }
    
    // Budget must be qualified
    if (currentLeadInfo.budget < 300) {
      return `Cannot fetch slots - budget under $300/month (current: $${currentLeadInfo.budget})`;
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
        
        const dayName = spanishDays[date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' })];
        const monthName = spanishMonths[date.toLocaleDateString('en-US', { month: 'short', timeZone: 'America/Chicago' })];
        const dayNum = date.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'America/Chicago' });
        const time = date.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true,
          timeZone: 'America/Chicago'
        });
        
        return `${index + 1}. ${dayName} ${dayNum} de ${monthName} a las ${time}`;
      });
      
      return formattedSlots.join('\n');
      
    } catch (error) {
      logger.error('Calendar fetch error', { error: error.message });
      return `Error fetching calendar: ${error.message}`;
    }
  },
  {
    name: "get_calendar_slots",
    description: "Get available calendar slots ONLY after collecting ALL lead info",
    schema: z.object({
      startDate: z.string().optional().describe("Start date for slot search"),
      endDate: z.string().optional().describe("End date for slot search")
    })
  }
);

// Other tools would follow the same pattern...
// For brevity, I'm showing the key change: tools return strings, not Command objects

// Define tools array
const tools = [
  sendGHLMessage,
  extractLeadInfo,
  getCalendarSlots
  // Add other tools here
];

// Sales agent system prompt
const SALES_AGENT_PROMPT = `Eres María, agente de ventas de Outlet Media. Tu objetivo es calificar leads para agendar llamadas de estrategia.

FLUJO ESTRICTO DE CONVERSACIÓN:
1. SALUDO: Preséntate y pregunta el nombre
2. DESCUBRIMIENTO: Pregunta sobre su problema/dolor principal
3. META: Pregunta qué quieren lograr
4. PRESUPUESTO: Pregunta cuánto invierten mensualmente en marketing
5. SI $300+: Pide email y muestra calendario
6. SI <$300: Agradece e indica que no es buen fit

REGLAS IMPORTANTES:
- SIEMPRE extraer información con extract_lead_info antes de responder
- SOLO mostrar calendario después de tener TODA la información
- Presupuesto mínimo: $300/mes
- Mantén conversación natural y empática
- Una pregunta a la vez
- Respuestas cortas y conversacionales`;

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

// Message window hook to limit context size and clean history
const messageReducer = (state) => {
  // Keep only last 10 messages for token efficiency
  let recentMessages = state.messages.slice(-10);
  
  // Clean up any orphaned tool calls to prevent OpenAI errors
  const cleaned = [];
  for (let i = 0; i < recentMessages.length; i++) {
    const msg = recentMessages[i];
    
    // Convert message objects to proper format if needed
    if (msg.role === 'tool' && !msg.tool_call_id) {
      // Skip tool messages without proper tool_call_id
      continue;
    }
    
    // Skip AI messages with tool_calls that don't have corresponding tool responses
    if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
      // Check if all tool calls have responses
      let hasAllResponses = true;
      for (const toolCall of msg.tool_calls) {
        const hasResponse = recentMessages.some(m => 
          m.role === 'tool' && m.tool_call_id === toolCall.id
        );
        if (!hasResponse) {
          hasAllResponses = false;
          break;
        }
      }
      
      if (!hasAllResponses) {
        // Skip this orphaned tool call message
        logger.debug('Skipping orphaned tool_call message', { 
          content: msg.content?.substring(0, 50) 
        });
        continue;
      }
    }
    
    cleaned.push(msg);
  }
  
  return cleaned;
};

// Configure LLM with explicit tool binding
const llm = new ChatOpenAI({ 
  model: "gpt-4",
  temperature: 0.7,
  timeout: process.env.NODE_ENV === 'production' ? 30000 : 20000, // 30s in prod, 20s in dev
  maxRetries: 2
});

// Bind tools to the model
const modelWithTools = llm.bindTools(tools);

// Create the agent with modern parameters
export const salesAgent = createReactAgent({
  llm: modelWithTools,
  tools: tools,
  stateSchema: AgentStateAnnotation,
  checkpointer: checkpointer,
  messageModifier: promptFunction,
  stateModifier: (state) => ({
    ...state,
    messages: messageReducer(state),
    // Pass state to tools via configurable
    configurable: {
      ...state.configurable,
      state: state
    }
  })
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
  getCalendarSlots
};

// Export configuration for monitoring
export const agentConfig = AGENT_CONFIG;

// Export prompt for reuse
export { SALES_AGENT_PROMPT };

// Export state annotation for testing
export { AgentStateAnnotation };