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

// Message deduplication cache with automatic cleanup
class MessageCache {
  constructor(ttl = 10 * 60 * 1000) {
    this.cache = new Map();
    this.ttl = config.features.enableDeduplication ? ttl : 0;
    
    // Start cleanup interval if deduplication is enabled
    if (this.ttl > 0) {
      this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Clean every minute
    }
  }
  
  add(key, value = Date.now()) {
    if (this.ttl === 0) return;
    this.cache.set(key, { timestamp: value, data: true });
  }
  
  has(key) {
    if (this.ttl === 0) return false;
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check if expired
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
    logger.debug('Message cache cleanup', { 
      size: this.cache.size,
      ttl: this.ttl 
    });
  }
  
  clear() {
    this.cache.clear();
  }
  
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

const processedMessages = new MessageCache();

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
 * Webhook handler node for processing incoming messages
 * Follows LangGraph best practices with state management
 * @param {Object} state - Current graph state
 * @param {Array} state.messages - Message history
 * @param {string} state.contactId - GHL contact identifier
 * @param {string} state.phone - Contact phone number
 * @param {Object} config - Node configuration
 * @returns {Promise<Object>} Updated state with processed messages
 */
async function webhookHandlerNode(state, config) {
  const startTime = Date.now();
  // Generate a proper UUID if no runId provided
  const traceId = config?.runId || crypto.randomUUID();
  
  logger.info('🔍 WEBHOOK HANDLER START', {
    traceId,
    stateMessagesCount: state.messages?.length || 0,
    hasContactId: !!state.contactId,
    hasPhone: !!state.phone,
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
  
  // Create message hash for deduplication
  const messageHash = crypto.createHash('md5')
    .update(`${contactId}-${message}-${phone}`)
    .digest('hex');
  
  // Check if we've already processed this exact message recently
  const enableDeduplication = config?.configurable?.features?.enableDeduplication ?? true;
  if (enableDeduplication && processedMessages.has(messageHash)) {
    const processedTime = Date.now();
    const timeSince = Date.now() - processedTime;
    logger.info('🔁 DUPLICATE MESSAGE DETECTED', {
      traceId,
      contactId,
      messagePreview: message.substring(0, 30) + '...',
      hash: messageHash,
      timeSinceProcessed: timeSince,
      processingSkipped: true
    });
    
    // Return empty state to indicate no processing needed
    return {
      messages: state.messages,
      duplicate: true
    };
  }
  
  // Mark message as processed
  if (enableDeduplication) {
    processedMessages.add(messageHash, Date.now());
    logger.debug('📌 Message marked as processed', {
      traceId,
      hash: messageHash,
      cacheSize: processedMessages.size
    });
  }
  
  logger.info('✅ WEBHOOK VALIDATION PASSED', { 
    traceId,
    contactId, 
    phone,
    messagePreview: message.substring(0, 50) + '...',
    timestamp: new Date().toISOString(),
    hash: messageHash
  });
  
  // Get conversationId from state or config
  const conversationId = state.conversationId || config?.configurable?.conversationId || null;
  
  logger.info('🔄 FETCHING CONVERSATION STATE', {
    traceId,
    contactId,
    conversationId,
    phone,
    conversationIdProvided: !!conversationId
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
      conversationId: conversationState.conversationId,
      messageCount: conversationState.messages?.length || 0,
      hasLeadInfo: !!(conversationState.leadName || conversationState.leadEmail),
      leadName: conversationState.leadName || 'not-set',
      leadBudget: conversationState.leadBudget || 'not-set'
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
  
  // Extract current lead info for context
  const currentLeadInfo = {
    name: conversationState.leadName,
    problem: conversationState.leadProblem,
    goal: conversationState.leadGoal,
    budget: conversationState.leadBudget,
    email: conversationState.leadEmail,
    phone: formatPhoneNumber(phone)
  };
  
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
      message: message.substring(0, 50),
      cachedResponseLength: cachedResponse.length,
      savedTokens: 3822  // Average tokens saved
    });
    
    // Send cached response directly
    try {
      await ghlService.sendSMS(contactId, cachedResponse);
      
      // Return early with minimal state update
      return {
        ...state,
        messages: [
          ...state.messages,
          new AIMessage(cachedResponse)
        ],
        cached: true,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      logger.error('Failed to send cached response', {
        error: error.message,
        contactId,
        traceId
      });
      // Fall through to normal processing if cache send fails
    }
  }
  
  // Invoke the sales agent with proper configuration
  logger.info('🤖 INVOKING SALES AGENT', {
    traceId,
    contactId,
    conversationId: conversationState.conversationId,
    messageCount: agentMessages.length
  });
  
  const agentStartTime = Date.now();
  const result = await salesAgentInvoke({
    messages: agentMessages,  // Only current message
    // Pass current lead info as context
    leadInfo: currentLeadInfo,
    contactId,
    conversationId: conversationState.conversationId,
    // Pass conversation history separately for context
    conversationHistory: conversationHistory
  }, {
    // Configuration for tools - matching config parameter pattern
    configurable: {
      ghlService,
      calendarId: process.env.GHL_CALENDAR_ID,
      contactId
    },
    runId: traceId  // Pass trace ID to agent
  });
  
  logger.info('✅ AGENT RESPONSE RECEIVED', {
    traceId,
    agentProcessingTime: Date.now() - agentStartTime,
    responseMessageCount: result.messages?.length || 0,
    appointmentBooked: result.appointmentBooked || false,
    leadInfoUpdated: Object.keys(result.leadInfo || {}).length > Object.keys(currentLeadInfo).filter(k => currentLeadInfo[k]).length
  });
  
  // Clear conversation cache (non-blocking)
  setImmediate(() => {
    conversationManager.clearCache(contactId, conversationState.conversationId);
    logger.debug('🧹 Cache cleared', {
      traceId,
      contactId,
      conversationId: conversationState.conversationId
    });
  });
  
  logger.info('✅ WEBHOOK PROCESSED SUCCESSFULLY', {
    traceId,
    totalProcessingTime: Date.now() - startTime,
    contactId,
    finalMessageCount: result.messages?.length || 0,
    appointmentBooked: result.appointmentBooked || false
  });
  
  // Record success for circuit breaker
  circuitBreaker.recordSuccess();
  
  // Return updated state with messages following MessagesAnnotation pattern
  return {
    messages: result.messages,
    contactId,
    phone,
    leadInfo: result.leadInfo || currentLeadInfo  // Use updated leadInfo from agent
  };
  
  } catch (error) {
    logger.error('❌ WEBHOOK HANDLER ERROR', {
      traceId,
      error: error.message,
      stack: error.stack,
      contactId: state.contactId,
      errorType: error.name,
      errorCode: error.code,
      phase: 'webhook_processing',
      inputMessages: state.messages?.length || 0,
      lastMessage: state.messages?.[state.messages.length - 1]?.content?.substring(0, 100),
      processingTimeBeforeError: Date.now() - startTime
    });
    
    // Record failure for circuit breaker
    circuitBreaker.recordFailure();
    
    // Log to LangSmith trace if available
    if (config.callbacks) {
      config.callbacks.handleError?.(error);
    }
    
    
    // Return user-friendly error message for other errors
    const errorMessage = error.name === 'CancelledError' || error.message.includes('cancelled')
      ? 'Hubo una interrupción temporal. Por favor, envía tu mensaje nuevamente.'
      : 'Lo siento, hubo un error procesando tu mensaje. Por favor intenta de nuevo.';
    
    return {
      messages: [
        ...state.messages,
        new AIMessage({
          content: errorMessage,
          name: 'María'
        })
      ],
      contactId: state.contactId,
      phone: state.phone
    };
  }
}

// Define extended state annotation for webhook handler
const WebhookAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,  // Use the spec to properly inherit message handling
  contactId: Annotation({
    default: () => null
  }),
  phone: Annotation({
    default: () => null
  }),
  leadInfo: Annotation({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({})
  })
});

// Create the webhook handler graph with proper state management
export const graph = new StateGraph(WebhookAnnotation)
  .addNode('webhook_handler', webhookHandlerNode)
  .addEdge(START, 'webhook_handler')
  .addEdge('webhook_handler', END)
  .compile();