import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, ToolMessage } from "@langchain/core/messages";
import { getCurrentTaskInput, Annotation, MessagesAnnotation, MemorySaver, Command } from '@langchain/langgraph';
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

// Tool: Extract lead information from messages
const extractLeadInfo = tool(
  async ({ message }, config) => {
    const startTime = Date.now();
    try {
      // Access the current state properly using getCurrentTaskInput
      let currentState;
      try {
        currentState = getCurrentTaskInput();
      } catch (e) {
        logger.warn('getCurrentTaskInput not available, using empty state');
        currentState = { leadInfo: {}, extractionCount: 0, processedMessages: [] };
      }
      
      // Circuit breaker to prevent excessive extractions
      const extractionCount = currentState.extractionCount || 0;
      if (extractionCount >= MAX_EXTRACTION_ATTEMPTS) {
        logger.warn('Max extraction attempts reached, returning current state');
        return new Command({
          update: {}
        });
      }
      
      // Deduplication - check if we've already processed this message
      const messageHash = message.toLowerCase().trim();
      const processedMessages = currentState.processedMessages || [];
      if (processedMessages.includes(messageHash)) {
        logger.debug('Message already processed, skipping extraction');
        return new Command({
          update: {}
        });
      }
      
      const llm = new ChatOpenAI({ model: "gpt-4", temperature: 0 });
      const existingLeadInfo = currentState?.leadInfo || {};
      
      // Build currentInfo from state
      const currentInfo = {
        name: existingLeadInfo.name || "",
        businessType: existingLeadInfo.businessType || "",
        problem: existingLeadInfo.problem || "",
        goal: existingLeadInfo.goal || "",
        budget: existingLeadInfo.budget || 0,
        email: existingLeadInfo.email || "",
        businessDetails: existingLeadInfo.businessDetails || ""
      };
      
      logger.debug('Extract lead info - Current context', { currentInfo, extractionCount });
      
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
          logger.debug('No new information extracted');
          return new Command({
            update: {}
          });
        }
        
        // Merge with existing info
        const merged = { ...currentInfo };
        Object.keys(extracted).forEach(key => {
          if (extracted[key] !== null && extracted[key] !== undefined && extracted[key] !== "") {
            merged[key] = extracted[key];
          }
        });
        
        logger.debug('Lead info extraction', {
          extractedInfo: extracted,
          mergedInfo: merged
        });
        
        // Return Command to update state with extraction tracking
        return new Command({
          update: {
            leadInfo: merged,
            extractionCount: extractionCount + 1,
            processedMessages: [...processedMessages, messageHash]
          }
        });
      } catch (e) {
        logger.error('Failed to parse extraction response', { 
          error: e.message,
          response: response.content 
        });
        // Return update with incremented count even on error
        return new Command({
          update: {
            extractionCount: extractionCount + 1,
            processedMessages: [...processedMessages, messageHash]
          }
        });
      }
    } catch (error) {
      logger.error('Error in extractLeadInfo tool', { error: error.message });
      // Return update with processed message tracking
      const currentState = getCurrentTaskInput ? getCurrentTaskInput() : {};
      const extractionCount = currentState.extractionCount || 0;
      const processedMessages = currentState.processedMessages || [];
      const messageHash = message.toLowerCase().trim();
      
      return new Command({
        update: {
          extractionCount: extractionCount + 1,
          processedMessages: [...processedMessages, messageHash]
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
  async ({ leadInfo, startDate, endDate }, config) => {
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
    if (!leadInfo.name || !leadInfo.problem || !leadInfo.goal || !leadInfo.budget || !leadInfo.email) {
      return {
        error: "Cannot fetch slots - missing required information",
        missingFields: {
          name: !leadInfo.name,
          problem: !leadInfo.problem,
          goal: !leadInfo.goal,
          budget: !leadInfo.budget,
          email: !leadInfo.email
        }
      };
    }
    
    // Budget must be qualified
    if (leadInfo.budget < 300) {
      return {
        error: "Cannot fetch slots - budget under $300/month",
        budget: leadInfo.budget
      };
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
      return {
        success: true,
        slots: slots.slice(0, 5).map((slot, index) => {
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
        })
      };
    } catch (error) {
      logger.error("Error fetching calendar slots", {
        error: error.message,
        calendarId,
        startDate: start,
        endDate: end
      });
      return { error: error.message, slots: [] };
    }
  },
  {
    name: "get_calendar_slots",
    description: "Fetch available calendar slots from GHL (requires full qualification)",
    schema: z.object({
      leadInfo: z.object({
        name: z.string().optional().nullable(),
        problem: z.string().optional().nullable(),
        goal: z.string().optional().nullable(),
        budget: z.number().optional().nullable(),
        email: z.string().optional().nullable()
      }).describe("Lead information (all fields required before showing slots)"),
      startDate: z.string().optional().describe("Start date in ISO format (defaults to today)"),
      endDate: z.string().optional().describe("End date in ISO format (defaults to 7 days from now)")
    })
  }
);

// Tool: Book appointment
const bookAppointment = tool(
  async ({ slot, leadName, leadEmail }, config) => {
    // Get contactId from config
    const contactId = config?.configurable?.contactId;
    
    if (!contactId) {
      throw new Error('contactId not found in config. Cannot book appointment.');
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
      
      // Return a Command to update state with appointmentBooked flag and END signal
      return new Command({
        update: {
          appointmentBooked: true,
          messages: [
            new ToolMessage({
              content: `¡Perfecto! Tu cita está confirmada para ${slot.display}. Te enviaré un recordatorio antes de nuestra llamada.`,
              tool_call_id: config.toolCall?.id || 'book_appointment',
              name: 'book_appointment'
            })
          ]
        },
        goto: 'END' // Signal to end the conversation after booking
      });
    } catch (error) {
      logger.error("Error booking appointment", {
        error: error.message,
        contactId,
        calendarId,
        slot
      });
      // Return Command with error message
      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: `Error al reservar la cita: ${error.message}. Por favor, intenta nuevamente.`,
              tool_call_id: config.toolCall?.id || 'book_appointment',
              name: 'book_appointment'
            })
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
  async ({ tags, notes, leadInfo }, config) => {
    // Get contactId from config
    const contactId = config?.configurable?.contactId;
    
    if (!contactId) {
      throw new Error('contactId not found in config. Cannot update contact.');
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
      if (tags.length > 0) {
        await ghlService.addTags(contactId, tags);
      }
      
      // Add note
      if (notes) {
        await ghlService.addNote(contactId, notes);
      }
      
      // Update custom fields if we have lead info
      if (leadInfo) {
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
      
      // Return Command to maintain consistency
      return new Command({
        update: {
          lastGHLUpdate: {
            timestamp: new Date().toISOString(),
            tags: tags,
            hasNotes: !!notes,
            hasLeadInfo: !!leadInfo
          }
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
      // Return Command with error tracking
      return new Command({
        update: {
          lastError: `GHL Update Error: ${error.message}`
        }
      });
    }
  },
  {
    name: "update_ghl_contact",
    description: "Update GHL contact with tags, notes, and lead information",
    schema: z.object({
      tags: z.array(z.string()).describe("Tags to add to contact"),
      notes: z.string().optional().describe("Note to add to contact timeline"),
      leadInfo: z.object({
        name: z.string().optional(),
        email: z.string().optional(),
        businessType: z.string().optional(),
        budget: z.number().optional(),
        problem: z.string().optional(),
        goal: z.string().optional()
      }).optional().describe("Lead information to update")
    })
  }
);

// Tool: Parse time selection
const parseTimeSelection = tool(
  async ({ userMessage, availableSlots }, config) => {
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
      // Return Command to update state with selected slot
      return new Command({
        update: {
          selectedSlot: availableSlots[selection - 1],
          messages: [
            new ToolMessage({
              content: JSON.stringify({
                success: true,
                selectedIndex: selection,
                selectedSlot: availableSlots[selection - 1]
              }),
              tool_call_id: config.toolCall?.id || 'parse_time_selection',
              name: 'parse_time_selection'
            })
          ]
        }
      });
    }
    
    // Return Command with error message
    return new Command({
      update: {
        messages: [
          new ToolMessage({
            content: JSON.stringify({
              success: false,
              error: "Could not understand selection",
              selectedIndex: 0
            }),
            tool_call_id: config.toolCall?.id || 'parse_time_selection',
            name: 'parse_time_selection'
          })
        ]
      }
    });
  },
  {
    name: "parse_time_selection",
    description: "Parse user's time slot selection",
    schema: z.object({
      userMessage: z.string().describe("User's message selecting a time"),
      availableSlots: z.array(z.object({
        index: z.number(),
        display: z.string(),
        startTime: z.string(),
        endTime: z.string()
      })).describe("Available slots shown to user")
    })
  }
);

// Tool: Send message via GHL WhatsApp (NOT webhook response)
const sendGHLMessage = tool(
  async ({ message }, config) => {
    // Get contactId from config - this is how we pass it from the agent
    const contactId = config?.configurable?.contactId;
    
    if (!contactId) {
      throw new Error('contactId not found in config. Cannot send message.');
    }
    
    // Check if appointment is already booked
    const currentState = getCurrentTaskInput ? getCurrentTaskInput() : {};
    if (currentState.appointmentBooked) {
      // Allow post-appointment messages but signal to end if it's a thank you
      const isThankYou = message.toLowerCase().includes('gracias') || 
                        message.toLowerCase().includes('thank');
      
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
        await ghlService.sendSMS(contactId, message);
        
        // If it's a thank you message after booking, signal END
        if (isThankYou) {
          return new Command({
            update: {},
            goto: 'END'
          });
        }
        
        return new Command({
          update: {}
        });
      } catch (error) {
        logger.error("Error sending post-appointment message", { error: error.message });
        return new Command({ update: {} });
      }
    }
    
    // Normal message sending for pre-appointment flow
    let ghlService = config?.configurable?.ghlService;
    
    if (!ghlService) {
      const { GHLService } = await import('../services/ghlService.js');
      ghlService = new GHLService(
        process.env.GHL_API_KEY,
        process.env.GHL_LOCATION_ID
      );
    }
    
    try {
      await ghlService.sendSMS(contactId, message);
      
      return new Command({
        update: {
          lastMessageSent: message,
          lastMessageTime: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error("Error sending GHL message", {
        error: error.message,
        contactId,
        messageLength: message.length
      });
      return new Command({
        update: {
          lastError: error.message
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
  timeout: 30000, // 30 second timeout for LLM calls
  maxRetries: 3
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

// Define custom state annotation that includes leadInfo
const AgentStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  leadInfo: Annotation({
    reducer: (x, y) => ({ ...x, ...y }), // Merge leadInfo updates
    default: () => ({})
  }),
  appointmentBooked: Annotation({
    reducer: (x, y) => y || x, // Once true, stays true
    default: () => false
  }),
  extractionCount: Annotation({
    reducer: (x, y) => y, // Always use latest value
    default: () => 0
  }),
  processedMessages: Annotation({
    reducer: (x, y) => [...new Set([...(x || []), ...(y || [])])], // Merge and dedupe
    default: () => []
  }),
  contactId: Annotation(),
  conversationId: Annotation()
});

// Bind tools to the model to ensure it knows they're available
const modelWithTools = llm.bindTools(tools);

// Create the agent with proper state management
export const graph = createReactAgent({
  llm: modelWithTools,
  tools: tools,
  checkpointSaver: checkpointer,
  stateModifier: (state) => {
    // Add current lead info to the prompt if available
    let enhancedPrompt = SALES_AGENT_PROMPT;
    
    if (state.leadInfo) {
      const info = state.leadInfo;
      const knownInfo = [];
      if (info.name) knownInfo.push(`Nombre: ${info.name}`);
      if (info.businessType) knownInfo.push(`Tipo de negocio: ${info.businessType}`);
      if (info.problem) knownInfo.push(`Problema: ${info.problem}`);
      if (info.goal) knownInfo.push(`Meta: ${info.goal}`);
      if (info.budget) knownInfo.push(`Presupuesto: $${info.budget}/mes`);
      if (info.email) knownInfo.push(`Email: ${info.email}`);
      
      if (knownInfo.length > 0) {
        enhancedPrompt += `\n\n🔴 INFORMACIÓN CONOCIDA:\n${knownInfo.join('\n')}\n\n`;
        
        // Determine current stage based on what we have
        if (state.appointmentBooked) {
          enhancedPrompt += `STAGE: APPOINTMENT BOOKED - Only handle follow-up questions`;
        } else if (!info.name) {
          enhancedPrompt += `STAGE: Ask for NAME`;
        } else if (!info.problem) {
          enhancedPrompt += `STAGE: Ask about PROBLEM`;
        } else if (!info.goal) {
          enhancedPrompt += `STAGE: Ask about GOAL`;
        } else if (!info.budget) {
          enhancedPrompt += `STAGE: Ask about BUDGET`;
        } else if (info.budget >= 300 && !info.email) {
          enhancedPrompt += `STAGE: Ask for EMAIL`;
        } else if (info.email) {
          enhancedPrompt += `STAGE: Show CALENDAR`;
        }
      }
    }
    
    // Check if we should end the conversation
    if (state.appointmentBooked) {
      // Add a special marker that the agent can recognize
      enhancedPrompt += `\n\n⚠️ APPOINTMENT IS BOOKED - Only answer follow-up questions. Do not re-qualify or book again.`;
    }
    
    const systemMessage = new SystemMessage(enhancedPrompt);
    return [systemMessage, ...state.messages];
  }
});

// Enhanced sales agent with error recovery
export async function salesAgent(input, agentConfig) {
  logger.info('Agent invoked', {
    messageCount: input.messages?.length || 0,
    hasLeadInfo: !!input.leadInfo,
    leadInfo: input.leadInfo || 'No leadInfo'
  });
  
  const startTime = Date.now();
  
  // Track conversation start
  if (!input.isResume) {
    metrics.recordConversationStarted();
  }
  
  // Enhanced config with timeout tracking and thread_id for checkpointing
  const enhancedConfig = {
    ...agentConfig,
    configurable: {
      ...agentConfig?.configurable,
      contactId: input.contactId || agentConfig?.configurable?.contactId,
      // Use contactId as thread_id for conversation persistence
      thread_id: input.contactId || agentConfig?.configurable?.contactId || 'default',
      conversationStartTime: startTime,
      agentConfig: AGENT_CONFIG,
      currentLeadInfo: input.leadInfo || {} // Pass leadInfo through config for tools
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
      graph.invoke(input, {
        ...enhancedConfig,
        recursionLimit: 25 // Prevent infinite loops
      }),
      conversationTimeoutPromise
    ]);
    
    logger.info('Conversation completed', {
      duration: Date.now() - startTime,
      messageCount: result.messages?.length || 0
    });
    return result;
    
  } catch (error) {
    logger.error('Agent error', {
      error: error.message,
      stack: error.stack,
      duration: Date.now() - startTime
    });
    
    // Handle specific error types
    if (error.message === 'Conversation timeout exceeded') {
      return {
        messages: [
          ...input.messages,
          {
            role: 'assistant',
            content: 'Lo siento, la conversación tardó demasiado. Por favor, intenta de nuevo o contacta soporte.'
          }
        ]
      };
    }
    
    // Handle cancellation errors
    if (error.name === 'CancelledError' || error.message.includes('cancelled')) {
      logger.warn('Operation was cancelled - likely due to platform restart');
      return {
        messages: [
          ...input.messages,
          {
            role: 'assistant',
            content: 'Hubo una interrupción temporal. Por favor, envía tu mensaje nuevamente.'
          }
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