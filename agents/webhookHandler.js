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
// Temporarily comment out problematic imports
// import { getCachedResponse } from '../services/responseCache.js';
// import { initializeCalendarCache } from '../services/calendarCache.js';
// import { conversationTerminator } from '../services/conversationTerminator.js';

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

// Initialize logger
const logger = new Logger('webhookHandler');

// Install global error handlers
installGlobalErrorHandlers();

// Configure LangSmith to prevent multipart errors
configureLangSmith();

// Intercept and fix invalid UUIDs
interceptLangSmithRequests();

// Initialize services with lazy loading
let ghlService;
let conversationManager;

// FIXED: Thread-aware message cache for proper deduplication
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

// Circuit breaker for production stability
const circuitBreaker = {
  failures: 0,
  lastFailure: 0,
  threshold: 3,
  timeout: 60000,  // 1 minute cooldown
  
  isOpen() {
    if (this.failures >= this.threshold) {
      const timeSinceLastFailure = Date.now() - this.lastFailure;
      if (timeSinceLastFailure < this.timeout) {
        return true;  // Circuit is open, reject requests
      }
      // Reset after cooldown
      this.failures = 0;
    }
    return false;
  },
  
  recordSuccess() {
    this.failures = 0;
  },
  
  recordFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    logger.warn('Circuit breaker failure recorded', {
      failures: this.failures,
      threshold: this.threshold
    });
  }
};

// Note: Cleanup is already handled by MessageCache class

/**
 * Health check for GHL services
 * @returns {Promise<boolean>} True if services are healthy, false otherwise
 */
async function healthCheck() {
  try {
    if (ghlService) {
      // Simple health check - just verify service is initialized
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    return false;
  }
}

/**
 * Initialize GHL services with retry logic
 * @param {number} retries - Number of retry attempts (default: 3)
 * @throws {Error} If initialization fails after all retries
 * @returns {Promise<void>}
 */
async function initialize(retries = 3) {
  if (!ghlService) {
    for (let i = 0; i < retries; i++) {
      try {
        ghlService = new GHLService(
          process.env.GHL_API_KEY,
          process.env.GHL_LOCATION_ID
        );
        
        conversationManager = new ConversationManager(ghlService);
        
        // Initialize global calendar cache
        // initializeCalendarCache(ghlService, process.env.GHL_CALENDAR_ID);
        
        // Verify initialization
        await healthCheck();
        logger.info('Services initialized successfully');
        break;
      } catch (error) {
        logger.error(`Initialization attempt ${i + 1} failed`, { 
          error: error.message,
          errorType: error.name,
          stack: error.stack,
          attempt: i + 1,
          hasGHLKey: !!process.env.GHL_API_KEY,
          hasLocationId: !!process.env.GHL_LOCATION_ID
        });
        if (i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
}

/**
 * UPDATED webhook handler node with proper state management
 * @param {Object} state - Current graph state
 * @param {Array} state.messages - Message history
 * @param {string} state.contactId - GHL contact identifier
 * @param {string} state.phone - Contact phone number
 * @param {Object} config - Node configuration
 * @returns {Promise<Object>} Updated state with processed messages
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
  
  // Check circuit breaker first
  if (circuitBreaker.isOpen()) {
    logger.error('🚫 CIRCUIT BREAKER OPEN - rejecting request', {
      traceId,
      failures: circuitBreaker.failures,
      lastFailure: new Date(circuitBreaker.lastFailure).toISOString()
    });
    return {
      messages: [
        ...state.messages,
        new AIMessage({
          content: 'Sistema temporalmente no disponible. Por favor intenta en unos minutos.',
          name: 'María'
        })
      ],
      contactId: state.contactId,
      phone: state.phone
    };
  }
  
  try {
    // Initialize services with retry and timeout
    // Skip initialization if already done (warm instances)
    if (!ghlService) {
      logger.info('Cold start - initializing services...', { traceId });
      const initTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Service initialization timeout')), getTimeout('serviceInit'));
      });
      
      await Promise.race([
        initialize(),
        initTimeout
      ]);
    } else {
      logger.debug('Warm start - services already initialized', { traceId });
    }
    
    const { messages } = state;
    const lastMessage = messages[messages.length - 1];
    
    logger.debug('📨 Last message details', {
      traceId,
      messageType: lastMessage?.constructor?.name,
      contentLength: lastMessage?.content?.length,
      contentPreview: typeof lastMessage?.content === 'string' ? 
        lastMessage.content.substring(0, 100) : 'non-string content'
    });
  
  // Parse webhook payload from message content
  let webhookData;
  let actualMessage;
  
  try {
    // Check if this is the initial webhook call with JSON payload (legacy format)
    if (state.messages.length === 1 && typeof lastMessage.content === 'string' && lastMessage.content.trim().startsWith('{')) {
      // Legacy JSON format - parse and extract
      webhookData = JSON.parse(lastMessage.content);
      logger.debug('Parsed JSON webhook payload (legacy format)', {
        keys: Object.keys(webhookData),
        hasPhone: !!webhookData.phone,
        hasMessage: !!webhookData.message,
        hasContactId: !!webhookData.contactId
      });
      
      // Extract the actual message
      actualMessage = webhookData.message;
      
      // CRITICAL FIX: Replace the JSON message with the actual message content
      if (actualMessage) {
        state.messages = [new HumanMessage(actualMessage)];
        logger.info('🔧 FIXED: Extracted actual message from JSON payload', {
          originalContent: lastMessage.content.substring(0, 100),
          extractedMessage: actualMessage,
          contactId: webhookData.contactId
        });
      }
    } else {
      // New format - message is already plain text
      actualMessage = lastMessage.content;
      webhookData = {
        message: actualMessage,
        contactId: state.contactId || config?.configurable?.contactId,
        phone: state.phone || config?.configurable?.phone
      };
      logger.debug('Using direct message format', { 
        messageLength: actualMessage.length,
        contactId: webhookData.contactId,
        phone: webhookData.phone
      });
    }
  } catch (e) {
    logger.error('Invalid webhook payload', {
      content: lastMessage.content?.substring(0, 200),
      error: e.message,
      contentType: typeof lastMessage.content
    });
    throw new Error('Invalid webhook payload format');
  }
  
  const { phone, message, contactId } = webhookData;
  
  logger.info('📋 Webhook data extracted', {
    traceId,
    hasPhone: !!phone,
    hasMessage: !!message,
    hasContactId: !!contactId,
    phoneLength: phone?.length,
    messageLength: message?.length,
    contactIdValue: contactId
  });
  
  // Validate required fields - only need phone, message, and contactId
  if (!phone || !message || !contactId) {
    logger.error('❌ Missing required fields', {
      traceId,
      phone: !!phone,
      message: !!message,
      contactId: !!contactId
    });
    throw new Error('Missing required fields: phone, message, or contactId');
  }
  
  // Check for early user termination
  // TEMPORARILY DISABLED FOR PRODUCTION STABILITY
  /*
  if (conversationTerminator.isUserTermination(message)) {
    logger.info('🛑 USER TERMINATION DETECTED', {
      traceId,
      message: message.substring(0, 30),
      contactId
    });
    
    const terminalMessage = conversationTerminator.getTerminalMessage('user_rejection');
    
    // Send terminal message directly
    await ghlService.sendSMS(contactId, terminalMessage);
    
    // Update tags
    await ghlService.addTags(contactId, ['user-rejected', 'nurture-lead']);
    
    return {
      ...state,
      messages: [
        ...state.messages,
        new HumanMessage(message),
        new AIMessage(terminalMessage)
      ],
      terminated: true,
      terminationReason: 'user_rejection',
      processingTime: Date.now() - startTime
    };
  }
  */
  
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
      duplicate: true,
      cached: true,  // Duplicate messages are effectively cached
      contactId: state.contactId,
      phone: state.phone,
      leadInfo: state.leadInfo,
      threadId
    };
  }
  
  processedMessages.add(threadId, messageHash);
  
  logger.info('✅ WEBHOOK VALIDATION PASSED', { 
    traceId,
    contactId, 
    phone,
    messagePreview: message.substring(0, 50) + '...',
    timestamp: new Date().toISOString(),
    hash: messageHash
  });
  
  // Get conversation state WITH thread awareness
  const conversationId = state.conversationId || config?.configurable?.conversationId || null;
  
  logger.info('🔄 FETCHING CONVERSATION STATE', {
    traceId,
    threadId,
    contactId,
    conversationId,
    phone
  });
  
  const conversationStatePromise = conversationManager.getConversationState(
    contactId, 
    conversationId, // Use the conversationId if available
    phone
  );
  
  const conversationTimeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Conversation fetch timeout')), getTimeout('conversation'));
  });
  
  let conversationState;
  try {
    conversationState = await Promise.race([
      conversationStatePromise,
      conversationTimeoutPromise
    ]);
    
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
  } catch (error) {
    logger.error('❌ CONVERSATION FETCH FAILED', { 
      traceId,
      error: error.message,
      contactId,
      usingFallback: true
    });
    // Use minimal state if fetch fails
    conversationState = {
      messages: [],
      conversationId: null,
      leadName: null,
      leadProblem: null,
      leadGoal: null,
      leadBudget: null,
      leadEmail: null,
      ghlContactId: contactId,
      leadPhone: phone
    };
  }
  
  // Build messages array for the agent
  // CRITICAL FIX: Only pass the CURRENT message to the agent
  // History is available in leadInfo but agent only processes the latest message
  const agentMessages = state.messages.length === 1 && webhookData.message ? 
    [state.messages[0]] :  // Only current message
    [new HumanMessage(message)];  // Only current message
  
  // Store history in a separate variable for context (not for processing)
  const conversationHistory = conversationState.messages;
  
  logger.info('📦 PREPARING AGENT INVOCATION', {
    traceId,
    agentMessages: agentMessages.length,  // Should always be 1
    historyAvailable: conversationHistory.length,
    currentMessage: message.substring(0, 50),
    leadInfoFromHistory: !!conversationState.leadName || !!conversationState.leadBudget
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
  
  logger.debug('📋 Current lead info', {
    traceId,
    ...currentLeadInfo,
    hasAllInfo: !!(currentLeadInfo.name && currentLeadInfo.problem && currentLeadInfo.goal && currentLeadInfo.budget && currentLeadInfo.email)
  });
  
  // Check for conversation termination
  // TEMPORARILY DISABLED FOR PRODUCTION STABILITY
  /*
  const lastAssistantMessage = conversationHistory
    .filter(msg => msg._getType?.() === 'ai' || msg.role === 'assistant')
    .slice(-1)[0]?.content || '';
  
  const terminationCheck = conversationTerminator.shouldTerminate({
    appointmentBooked: conversationState.appointmentBooked,
    maxExtractionReached: conversationState.maxExtractionReached,
    allFieldsCollected: !!(currentLeadInfo.name && currentLeadInfo.problem && 
                           currentLeadInfo.goal && currentLeadInfo.budget && 
                           currentLeadInfo.email),
    calendarShown: conversationState.calendarShown,
    messages: conversationHistory
  }, lastAssistantMessage);
  
  if (terminationCheck.shouldTerminate) {
    logger.info('🛑 CONVERSATION TERMINATED', {
      traceId,
      reason: terminationCheck.reason,
      savedTokens: 3500,
      lastMessage: lastAssistantMessage.substring(0, 50)
    });
    
    // Check if user is trying to continue after termination
    if (!conversationTerminator.isCalendarSelection(message)) {
      const terminalMessage = conversationTerminator.getTerminalMessage(
        terminationCheck.reason, 
        { leadInfo: currentLeadInfo }
      );
      
      // Send terminal message
      await ghlService.sendSMS(contactId, terminalMessage);
      
      return {
        ...state,
        messages: [
          ...state.messages,
          new AIMessage(terminalMessage)
        ],
        terminated: true,
        terminationReason: terminationCheck.reason,
        processingTime: Date.now() - startTime
      };
    }
  }
  */
  
  // Check for cached response before invoking agent
  logger.info('🔍 CHECKING CACHE', {
    traceId,
    message: message,
    messageLength: message.length,
    messageLower: message.toLowerCase().trim(),
    cacheAvailable: typeof getCachedResponse === 'function'
  });
  
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
        conversationId: conversationState.conversationId,
        contactId,
        phone,
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
    messageCount: agentMessages.length,
    leadInfoFields: Object.keys(currentLeadInfo).filter(k => currentLeadInfo[k])
  });
  
  const agentStartTime = Date.now();
  const result = await salesAgentInvoke({
    messages: agentMessages,
    leadInfo: currentLeadInfo,
    contactId,
    conversationId: conversationState.conversationId,
    threadId,
    conversationHistory: conversationHistory
  }, {
    configurable: {
      ghlService,
      calendarId: process.env.GHL_CALENDAR_ID,
      contactId,
      thread_id: threadId,
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
    agentProcessingTime: Date.now() - agentStartTime,
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
    threadId,
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
    
    circuitBreaker.recordFailure();
    
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
  }),
  cached: Annotation({
    default: () => false
  }),
  duplicate: Annotation({
    default: () => false
  }),
  processingTime: Annotation({
    default: () => 0
  })
});

// Create the webhook handler graph with proper state management
export const graph = new StateGraph(WebhookAnnotation)
  .addNode('webhook_handler', webhookHandlerNode)
  .addEdge(START, 'webhook_handler')
  .addEdge('webhook_handler', END)
  .compile();