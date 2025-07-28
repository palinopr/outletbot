import { salesAgentInvoke } from './salesAgent.js';
import { GHLService, formatPhoneNumber } from '../services/ghlService.js';
import ConversationManager from '../services/conversationManager.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { StateGraph, MessagesAnnotation, Annotation, END, START } from '@langchain/langgraph';
import crypto from 'crypto';
import { Logger } from '../services/logger.js';
import { config } from '../services/config.js';
import { configureLangSmith } from '../services/langsmithConfig.js';
import { interceptLangSmithRequests } from '../services/uuidInterceptor.js';
import { getTimeout, getErrorMessage } from '../production-fixes.js';
import { installGlobalErrorHandlers } from '../services/errorHandlers.js';
import { onShutdown } from '../services/shutdown.js';

// Initialize logger
const logger = new Logger('webhookHandler');

// Embedded production cache for reliability
const PRODUCTION_CACHE = {
  greetings: {
    "hola": "¡Hola! Soy María, tu consultora de ventas de Outlet Media. ¿Podrías decirme tu nombre, por favor?",
    "buenos dias": "¡Buenos días! Soy María de Outlet Media. ¿Cómo te llamas?",
    "buenos días": "¡Buenos días! Soy María de Outlet Media. ¿Cómo te llamas?",
    "buenas tardes": "¡Buenas tardes! Soy María de Outlet Media. ¿Cuál es tu nombre?",
    "buenas noches": "¡Buenas noches! Soy María de Outlet Media. ¿Me podrías compartir tu nombre?",
    "hi": "¡Hola! Soy María, tu consultora de ventas de Outlet Media. ¿Podrías decirme tu nombre, por favor?",
    "hello": "¡Hola! Soy María de Outlet Media. ¿Cómo te llamas?",
    "hey": "¡Hola! Soy María de Outlet Media. ¿Cómo te llamas?",
    "que tal": "¡Hola! Soy María de Outlet Media. ¿Cómo te llamas?",
    "qué tal": "¡Hola! Soy María de Outlet Media. ¿Cómo te llamas?"
  },
  rejections: {
    "no me interesa": "Entiendo perfectamente. Si cambias de opinión o tienes preguntas sobre marketing digital, aquí estaré. ¡Mucho éxito con tu negocio!",
    "no gracias": "No hay problema. Si en el futuro necesitas ayuda para atraer más clientes, no dudes en contactarme. ¡Éxito!",
    "no thanks": "No hay problema. Si en el futuro necesitas ayuda para atraer más clientes, no dudes en contactarme. ¡Éxito!",
    "ahora no": "Perfecto, entiendo. Cuando sea el momento adecuado para ti, aquí estaré. ¡Mucho éxito!",
    "tal vez despues": "Claro, sin presión. Guarda mi contacto para cuando estés listo. ¡Éxito con tu negocio!",
    "tal vez después": "Claro, sin presión. Guarda mi contacto para cuando estés listo. ¡Éxito con tu negocio!"
  }
};

// Production-safe cache function
function getCachedResponse(message, context = {}) {
  try {
    if (!message || typeof message !== 'string') return null;
    
    const normalized = message.toLowerCase().trim();
    const { leadInfo = {} } = context;
    
    // Check greetings (only if no name collected)
    if (!leadInfo.name && PRODUCTION_CACHE.greetings[normalized]) {
      logger.info('💨 PRODUCTION CACHE HIT - Greeting', { message: normalized });
      return PRODUCTION_CACHE.greetings[normalized];
    }
    
    // Check rejections
    if (PRODUCTION_CACHE.rejections[normalized]) {
      logger.info('💨 PRODUCTION CACHE HIT - Rejection', { message: normalized });
      return PRODUCTION_CACHE.rejections[normalized];
    }
    
    return null;
  } catch (error) {
    logger.error('Cache check error', { error: error.message });
    return null;
  }
}

// Install global error handlers
installGlobalErrorHandlers();

// Configure LangSmith
configureLangSmith();

// Intercept and fix invalid UUIDs
interceptLangSmithRequests();

// Initialize services with lazy loading
let ghlService;
let conversationManager;

// FIXED: Thread-aware message cache
class ThreadAwareMessageCache {
  constructor(ttl = 10 * 60 * 1000) {
    this.cache = new Map();
    this.ttl = ttl;
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }
  
  getKey(threadId, messageHash) {
    return `${threadId}:${messageHash}`;
  }
  
  add(threadId, messageHash, value = Date.now()) {
    const key = this.getKey(threadId, messageHash);
    this.cache.set(key, { timestamp: value, data: true });
  }
  
  has(threadId, messageHash) {
    const key = this.getKey(threadId, messageHash);
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }
  
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }
  
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

const processedMessages = new ThreadAwareMessageCache();

// Register cleanup on shutdown
if (typeof onShutdown === 'function') {
  onShutdown(() => {
    logger.info('Stopping message cache cleanup');
    processedMessages.stop();
  });
}

// Initialize GHL services with retry logic
async function initialize(retries = 3) {
  if (!ghlService) {
    for (let i = 0; i < retries; i++) {
      try {
        ghlService = new GHLService(
          process.env.GHL_API_KEY,
          process.env.GHL_LOCATION_ID
        );
        
        conversationManager = new ConversationManager(ghlService);
        
        logger.info('Services initialized successfully');
        break;
      } catch (error) {
        logger.error(`Initialization attempt ${i + 1} failed`, { 
          error: error.message,
          attempt: i + 1
        });
        if (i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
}

/**
 * UPDATED webhook handler node with proper state management
 */
async function webhookHandlerNode(state, config) {
  const startTime = Date.now();
  const traceId = config?.runId || crypto.randomUUID();
  
  // CRITICAL: Get thread ID for conversation continuity
  const threadId = config?.configurable?.thread_id || 
                   state.threadId || 
                   config?.configurable?.__pregel_thread_id ||
                   `thread_${state.contactId}`;
  
  logger.info('🔍 WEBHOOK HANDLER START', {
    traceId,
    threadId,
    stateMessagesCount: state.messages?.length || 0,
    hasContactId: !!state.contactId,
    hasPhone: !!state.phone,
    hasLeadInfo: !!state.leadInfo,
    existingLeadFields: state.leadInfo ? Object.keys(state.leadInfo).filter(k => state.leadInfo[k]) : [],
    timestamp: new Date().toISOString()
  });
  
  try {
    // Initialize services
    if (!ghlService) {
      await initialize();
    }
    
    const { messages } = state;
    const lastMessage = messages[messages.length - 1];
    
    // Parse webhook payload
    let webhookData;
    let actualMessage;
    
    // Extract message properly
    if (typeof lastMessage.content === 'string' && lastMessage.content.trim().startsWith('{')) {
      try {
        webhookData = JSON.parse(lastMessage.content);
        actualMessage = webhookData.message;
        
        if (actualMessage) {
          state.messages = [new HumanMessage(actualMessage)];
        }
      } catch (e) {
        actualMessage = lastMessage.content;
        webhookData = {
          message: actualMessage,
          contactId: state.contactId,
          phone: state.phone
        };
      }
    } else {
      actualMessage = lastMessage.content;
      webhookData = {
        message: actualMessage,
        contactId: state.contactId,
        phone: state.phone
      };
    }
    
    const { phone, message, contactId } = webhookData;
    
    // Validate required fields
    if (!phone || !message || !contactId) {
      throw new Error('Missing required fields: phone, message, or contactId');
    }
    
    // Check message deduplication with thread awareness
    const messageHash = crypto.createHash('md5')
      .update(`${contactId}-${message}-${phone}`)
      .digest('hex');
    
    if (processedMessages.has(threadId, messageHash)) {
      logger.info('🔁 DUPLICATE MESSAGE DETECTED', {
        traceId,
        threadId,
        contactId,
        messagePreview: message.substring(0, 30) + '...'
      });
      
      return {
        messages: state.messages,
        duplicate: true
      };
    }
    
    processedMessages.add(threadId, messageHash);
    
    // Get conversation state WITH thread awareness
    const conversationId = state.conversationId || config?.configurable?.conversationId || null;
    
    logger.info('🔄 FETCHING CONVERSATION STATE', {
      traceId,
      threadId,
      contactId,
      conversationId,
      phone
    });
    
    const conversationState = await conversationManager.getConversationState(
      contactId, 
      conversationId,
      phone
    );
    
    logger.info('✅ CONVERSATION STATE FETCHED', {
      traceId,
      threadId,
      conversationId: conversationState.conversationId,
      messageCount: conversationState.messages?.length || 0,
      existingLeadInfo: {
        name: conversationState.leadName,
        problem: conversationState.leadProblem,
        goal: conversationState.leadGoal,
        budget: conversationState.leadBudget,
        email: conversationState.leadEmail
      }
    });
    
    // CRITICAL: Merge existing lead info with any passed state
    const currentLeadInfo = {
      name: state.leadInfo?.name || conversationState.leadName,
      problem: state.leadInfo?.problem || conversationState.leadProblem,
      goal: state.leadInfo?.goal || conversationState.leadGoal,
      budget: state.leadInfo?.budget || conversationState.leadBudget,
      email: state.leadInfo?.email || conversationState.leadEmail,
      phone: formatPhoneNumber(phone),
      businessType: state.leadInfo?.businessType || conversationState.leadBusinessType
    };
    
    logger.info('📋 MERGED LEAD INFO', {
      traceId,
      threadId,
      currentLeadInfo,
      hasAllRequiredInfo: !!(
        currentLeadInfo.name && 
        currentLeadInfo.problem && 
        currentLeadInfo.goal && 
        currentLeadInfo.budget && 
        currentLeadInfo.email
      )
    });
    
    // Check for cached response AFTER extracting message
    const cachedResponse = getCachedResponse(message, {
      leadInfo: currentLeadInfo,
      calendarShown: conversationState.calendarShown || false,
      appointmentBooked: conversationState.appointmentBooked || false
    });
    
    if (cachedResponse) {
      logger.info('💨 USING CACHED RESPONSE', {
        traceId,
        threadId,
        message: message.substring(0, 50),
        savedTokens: 3822
      });
      
      try {
        await ghlService.sendSMS(contactId, cachedResponse);
        
        return {
          ...state,
          messages: [
            ...state.messages,
            new AIMessage(cachedResponse)
          ],
          leadInfo: currentLeadInfo,
          threadId,
          cached: true,
          processingTime: Date.now() - startTime
        };
      } catch (error) {
        logger.error('Failed to send cached response', {
          error: error.message,
          contactId,
          traceId
        });
      }
    }
    
    // Invoke sales agent with proper state
    logger.info('🤖 INVOKING SALES AGENT', {
      traceId,
      threadId,
      contactId,
      conversationId: conversationState.conversationId,
      messageCount: state.messages.length,
      leadInfoFields: Object.keys(currentLeadInfo).filter(k => currentLeadInfo[k])
    });
    
    const result = await salesAgentInvoke({
      messages: [new HumanMessage(message)],
      leadInfo: currentLeadInfo,
      contactId,
      conversationId: conversationState.conversationId,
      threadId,  // Pass thread ID
      conversationHistory: conversationState.messages
    }, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        contactId,
        thread_id: threadId,  // Ensure thread continuity
        // Pass state for tools to access
        __pregel_scratchpad: {
          currentTaskInput: {
            leadInfo: currentLeadInfo,
            contactId,
            threadId,
            conversationId: conversationState.conversationId
          }
        }
      },
      runId: traceId
    });
    
    logger.info('✅ AGENT RESPONSE RECEIVED', {
      traceId,
      threadId,
      agentProcessingTime: Date.now() - startTime,
      responseMessageCount: result.messages?.length || 0,
      appointmentBooked: result.appointmentBooked || false,
      leadInfoUpdated: result.leadInfo ? Object.keys(result.leadInfo).filter(k => result.leadInfo[k]) : []
    });
    
    // Clear conversation cache
    setImmediate(() => {
      conversationManager.clearCache(contactId, conversationState.conversationId);
    });
    
    // Return updated state with ALL information preserved
    return {
      messages: result.messages,
      contactId,
      phone,
      leadInfo: result.leadInfo || currentLeadInfo,
      threadId,  // Preserve thread ID
      conversationId: conversationState.conversationId,
      appointmentBooked: result.appointmentBooked || false,
      processingTime: Date.now() - startTime
    };
    
  } catch (error) {
    logger.error('❌ WEBHOOK HANDLER ERROR', {
      traceId,
      threadId,
      error: error.message,
      stack: error.stack,
      contactId: state.contactId
    });
    
    const errorMessage = 'Lo siento, hubo un error procesando tu mensaje. Por favor intenta de nuevo.';
    
    return {
      messages: [
        ...state.messages,
        new AIMessage({
          content: errorMessage,
          name: 'María'
        })
      ],
      contactId: state.contactId,
      phone: state.phone,
      leadInfo: state.leadInfo,
      threadId
    };
  }
}

// UPDATED: Extended state annotation with thread support
const WebhookAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  contactId: Annotation({
    default: () => null
  }),
  phone: Annotation({
    default: () => null
  }),
  leadInfo: Annotation({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({})
  }),
  threadId: Annotation({
    default: () => null
  }),
  conversationId: Annotation({
    default: () => null
  }),
  appointmentBooked: Annotation({
    default: () => false
  })
});

// Create the webhook handler graph
export const graph = new StateGraph(WebhookAnnotation)
  .addNode('webhook_handler', webhookHandlerNode)
  .addEdge(START, 'webhook_handler')
  .addEdge('webhook_handler', END)
  .compile();