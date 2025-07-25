import { salesAgent } from './salesAgent.js';
import { GHLService, formatPhoneNumber } from '../services/ghlService.js';
import ConversationManager from '../services/conversationManager.js';
import { HumanMessage } from '@langchain/core/messages';
import { StateGraph, MessagesAnnotation } from '@langchain/langgraph';

// Initialize services with lazy loading
let ghlService;
let conversationManager;

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

// Enhanced webhook handler with error recovery
async function webhookHandlerNode(state) {
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
    // If not JSON, treat as regular message with contactId from config
    webhookData = {
      message: lastMessage.content,
      contactId: state.contactId || state.configurable?.contactId,
      phone: state.phone || state.configurable?.phone,
      conversationId: state.conversationId || state.configurable?.conversationId
    };
  }
  
  const { phone, message, contactId, conversationId } = webhookData;
  
  // Validate required fields
  if (!phone || !message || !contactId) {
    throw new Error('Missing required fields: phone, message, or contactId');
  }
  
  console.log('Webhook received:', { 
    contactId, 
    conversationId, 
    message: message.substring(0, 50) + '...',
    timestamp: new Date().toISOString()
  });
  
  // Get conversation state with timeout (pass phone for better search)
  const conversationStatePromise = conversationManager.getConversationState(
    contactId, 
    conversationId,
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
      conversationId,
      leadName: null,
      leadProblem: null,
      leadGoal: null,
      leadBudget: null,
      leadEmail: null
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
  
  // Invoke the sales agent with timeout protection
  const result = await salesAgent({
    messages: agentMessages,
    // Pass current lead info as context
    leadInfo: currentLeadInfo,
    contactId,
    conversationId: conversationState.conversationId
  }, {
    // Configuration for tools
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
    conversationManager.clearCache(contactId, conversationId);
  });
  
  console.log(`Webhook processed in ${Date.now() - startTime}ms`);
  
  // Return updated messages
  return {
    messages: result.messages
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

// Create the webhook handler graph
export const graph = new StateGraph(MessagesAnnotation)
  .addNode('webhook_handler', webhookHandlerNode)
  .addEdge('__start__', 'webhook_handler')
  .addEdge('webhook_handler', '__end__')
  .compile();