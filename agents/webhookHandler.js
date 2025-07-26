import { salesAgent } from './salesAgent.js';
import { GHLService, formatPhoneNumber } from '../services/ghlService.js';
import ConversationManager from '../services/conversationManager.js';
import { HumanMessage } from '@langchain/core/messages';
import { StateGraph, MessagesAnnotation, Annotation, END } from '@langchain/langgraph';
import crypto from 'crypto';

// Initialize services with lazy loading
let ghlService;
let conversationManager;

// Message deduplication cache (10 minute TTL)
const processedMessages = new Map();
const MESSAGE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [hash, timestamp] of processedMessages.entries()) {
    if (now - timestamp > MESSAGE_CACHE_TTL) {
      processedMessages.delete(hash);
    }
  }
}, MESSAGE_CACHE_TTL / 2);

// Health check for services
async function healthCheck() {
  try {
    if (ghlService) {
      // Simple health check - just verify service is initialized
      return true;
    }
    return false;
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
}

// Initialize with retry logic
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
        console.log('Services initialized successfully');
        break;
      } catch (error) {
        console.error(`Initialization attempt ${i + 1} failed:`, error);
        if (i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
}

// Enhanced webhook handler following LangGraph best practices
async function webhookHandlerNode(state, config) {
  const startTime = Date.now();
  
  try {
    // Initialize services with retry
    await initialize();
    
    const { messages } = state;
    const lastMessage = messages[messages.length - 1];
  
  // Parse webhook payload from message content
  let webhookData;
  try {
    webhookData = JSON.parse(lastMessage.content);
  } catch (e) {
    // If not JSON, treat as regular message with contactId from state
    webhookData = {
      message: lastMessage.content,
      contactId: state.contactId || config?.configurable?.contactId,
      phone: state.phone || config?.configurable?.phone
    };
  }
  
  const { phone, message, contactId } = webhookData;
  
  // Validate required fields - only need phone, message, and contactId
  if (!phone || !message || !contactId) {
    throw new Error('Missing required fields: phone, message, or contactId');
  }
  
  // Create message hash for deduplication
  const messageHash = crypto.createHash('md5')
    .update(`${contactId}-${message}-${phone}`)
    .digest('hex');
  
  // Check if we've already processed this exact message recently
  if (processedMessages.has(messageHash)) {
    const processedTime = processedMessages.get(messageHash);
    const timeSince = Date.now() - processedTime;
    console.log(`Duplicate message detected (processed ${timeSince}ms ago), skipping:`, {
      contactId,
      messagePreview: message.substring(0, 30) + '...',
      hash: messageHash
    });
    
    // Return empty state to indicate no processing needed
    return {
      messages: state.messages,
      duplicate: true
    };
  }
  
  // Mark message as processed
  processedMessages.set(messageHash, Date.now());
  
  console.log('Webhook received:', { 
    contactId, 
    phone,
    message: message.substring(0, 50) + '...',
    timestamp: new Date().toISOString(),
    hash: messageHash
  });
  
  // Always fetch conversation by contactId and phone (no conversationId from webhook)
  const conversationStatePromise = conversationManager.getConversationState(
    contactId, 
    null, // Let the system find the conversation
    phone
  );
  
  const conversationTimeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Conversation fetch timeout')), 10000);
  });
  
  let conversationState;
  try {
    conversationState = await Promise.race([
      conversationStatePromise,
      conversationTimeoutPromise
    ]);
  } catch (error) {
    console.error('Failed to fetch conversation state:', error);
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
  
  console.log(`Passing ${agentMessages.length} total messages to agent (${conversationState.messages.length} from history + 1 new)`);
  
  // Extract current lead info for context
  const currentLeadInfo = {
    name: conversationState.leadName,
    problem: conversationState.leadProblem,
    goal: conversationState.leadGoal,
    budget: conversationState.leadBudget,
    email: conversationState.leadEmail,
    phone: formatPhoneNumber(phone)
  };
  
  // Invoke the sales agent with proper configuration
  const result = await salesAgent({
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
      contactId,
      currentLeadInfo
    },
    // Add recursion limit per LangGraph docs
    recursionLimit: 25
  });
  
  // Clear conversation cache (non-blocking)
  setImmediate(() => {
    conversationManager.clearCache(contactId, conversationState.conversationId);
  });
  
  console.log(`Webhook processed in ${Date.now() - startTime}ms`);
  
  // Return updated state with messages following MessagesAnnotation pattern
  return {
    messages: result.messages,
    contactId,
    phone,
    leadInfo: currentLeadInfo
  };
  
  } catch (error) {
    console.error('Webhook handler error:', error);
    
    // Return user-friendly error message
    const errorMessage = error.name === 'CancelledError' || error.message.includes('cancelled')
      ? 'Hubo una interrupción temporal. Por favor, envía tu mensaje nuevamente.'
      : 'Lo siento, hubo un error procesando tu mensaje. Por favor intenta de nuevo.';
    
    return {
      messages: [
        ...state.messages,
        {
          role: 'assistant',
          content: errorMessage
        }
      ]
    };
  }
}

// Define extended state annotation for webhook handler
const WebhookAnnotation = Annotation.Root({
  messages: Annotation({
    reducer: (x, y) => x.concat(y),
    default: () => []
  }),
  contactId: Annotation(),
  phone: Annotation(),
  leadInfo: Annotation({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({})
  })
});

// Create the webhook handler graph with proper state management
export const graph = new StateGraph(WebhookAnnotation)
  .addNode('webhook_handler', webhookHandlerNode)
  .addEdge('__start__', 'webhook_handler')
  .addEdge('webhook_handler', END)
  .compile();