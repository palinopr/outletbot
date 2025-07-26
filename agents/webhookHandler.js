import { salesAgentInvoke } from './salesAgent.js';
import { GHLService, formatPhoneNumber } from '../services/ghlService.js';
import ConversationManager from '../services/conversationManager.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { StateGraph, MessagesAnnotation, Annotation, END, START } from '@langchain/langgraph';
import crypto from 'crypto';
import { Logger } from '../services/logger.js';
import { config } from '../services/config.js';

// Initialize logger
const logger = new Logger('webhookHandler');

// Initialize services with lazy loading
let ghlService;
let conversationManager;

// Message deduplication cache
const processedMessages = new Map();
const MESSAGE_CACHE_TTL = config.features.enableDeduplication ? 10 * 60 * 1000 : 0; // 10 minutes if enabled

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [hash, timestamp] of processedMessages.entries()) {
    if (now - timestamp > MESSAGE_CACHE_TTL) {
      processedMessages.delete(hash);
    }
  }
}, MESSAGE_CACHE_TTL / 2);

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
        
        // Verify initialization
        await healthCheck();
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
  const traceId = config?.runId || 'no-trace-id';
  
  logger.info('🔍 WEBHOOK HANDLER START', {
    traceId,
    stateMessagesCount: state.messages?.length || 0,
    hasContactId: !!state.contactId,
    hasPhone: !!state.phone,
    timestamp: new Date().toISOString()
  });
  
  try {
    // Initialize services with retry
    await initialize();
    
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
  try {
    if (typeof lastMessage.content === 'string' && lastMessage.content.trim().startsWith('{')) {
      webhookData = JSON.parse(lastMessage.content);
      logger.debug('Parsed JSON webhook payload', {
        keys: Object.keys(webhookData),
        hasPhone: !!webhookData.phone,
        hasMessage: !!webhookData.message,
        hasContactId: !!webhookData.contactId
      });
    } else {
      // If not JSON, treat as regular message with contactId from state
      webhookData = {
        message: lastMessage.content,
        contactId: state.contactId || config?.configurable?.contactId,
        phone: state.phone || config?.configurable?.phone
      };
      logger.debug('Using plain text message', { messageLength: lastMessage.content.length });
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
  
  // Create message hash for deduplication
  const messageHash = crypto.createHash('md5')
    .update(`${contactId}-${message}-${phone}`)
    .digest('hex');
  
  // Check if we've already processed this exact message recently
  const enableDeduplication = config?.configurable?.features?.enableDeduplication ?? true;
  if (enableDeduplication && processedMessages.has(messageHash)) {
    const processedTime = processedMessages.get(messageHash);
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
    processedMessages.set(messageHash, Date.now());
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
  
  // Always fetch conversation by contactId and phone (no conversationId from webhook)
  logger.info('🔄 FETCHING CONVERSATION STATE', {
    traceId,
    contactId,
    phone,
    conversationIdProvided: false
  });
  
  const conversationStatePromise = conversationManager.getConversationState(
    contactId, 
    null, // Let the system find the conversation
    phone
  );
  
  const conversationTimeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Conversation fetch timeout')), config.apiTimeout || 10000);
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
  const agentMessages = [
    ...conversationState.messages,
    new HumanMessage(message)
  ];
  
  logger.info('📦 PREPARING AGENT INVOCATION', {
    traceId,
    totalMessages: agentMessages.length,
    historyMessages: conversationState.messages.length,
    newMessages: 1,
    lastHistoryMessage: conversationState.messages[conversationState.messages.length - 1]?.content?.substring(0, 50),
    newMessage: message.substring(0, 50)
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
  
  // Invoke the sales agent with proper configuration
  logger.info('🤖 INVOKING SALES AGENT', {
    traceId,
    contactId,
    conversationId: conversationState.conversationId,
    messageCount: agentMessages.length
  });
  
  const agentStartTime = Date.now();
  const result = await salesAgentInvoke({
    messages: agentMessages,
    // Pass current lead info as context
    leadInfo: currentLeadInfo,
    contactId,
    conversationId: conversationState.conversationId
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
    
    // Log to LangSmith trace if available
    if (config.callbacks) {
      config.callbacks.handleError?.(error);
    }
    
    // Return user-friendly error message
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