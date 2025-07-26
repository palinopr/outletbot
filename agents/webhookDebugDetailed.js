// Detailed debug version of webhook handler
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { StateGraph, MessagesAnnotation, Annotation, END, START } from '@langchain/langgraph';
import crypto from 'crypto';

// Simple logger that returns messages
const debugLog = [];
function log(message, data = {}) {
  debugLog.push({ message, data, timestamp: Date.now() });
}

// Initialize services with debugging
let ghlService;
let conversationManager;

async function initializeDebug() {
  log('Starting initialization');
  
  try {
    const { GHLService } = await import('../services/ghlService.js');
    log('GHLService imported');
    
    ghlService = new GHLService(
      process.env.GHL_API_KEY,
      process.env.GHL_LOCATION_ID
    );
    log('GHLService created');
    
    const ConversationManagerModule = await import('../services/conversationManager.js');
    log('ConversationManager imported');
    
    conversationManager = new ConversationManagerModule.default(ghlService);
    log('ConversationManager created');
    
    return true;
  } catch (error) {
    log('Initialization error', { 
      message: error.message, 
      type: error.constructor.name,
      stack: error.stack?.split('\n').slice(0, 3)
    });
    return false;
  }
}

async function debugWebhookHandler(state, config) {
  debugLog.length = 0; // Clear previous logs
  const startTime = Date.now();
  const traceId = config?.runId || crypto.randomUUID();
  
  log('Handler started', { traceId, messageCount: state.messages?.length });
  
  try {
    // Initialize if needed
    if (!ghlService) {
      log('Cold start - initializing');
      const initResult = await initializeDebug();
      if (!initResult) {
        throw new Error('Failed to initialize services');
      }
    } else {
      log('Warm start');
    }
    
    // Parse webhook
    const lastMessage = state.messages[state.messages.length - 1];
    log('Parsing webhook', { contentType: typeof lastMessage.content });
    
    let webhookData;
    if (typeof lastMessage.content === 'string' && lastMessage.content.includes('{')) {
      webhookData = JSON.parse(lastMessage.content);
      log('Webhook parsed', { 
        hasPhone: !!webhookData.phone,
        hasMessage: !!webhookData.message,
        hasContactId: !!webhookData.contactId
      });
    } else {
      throw new Error('Invalid webhook format');
    }
    
    const { phone, message, contactId } = webhookData;
    
    // Validate
    if (!phone || !message || !contactId) {
      throw new Error('Missing required fields');
    }
    
    log('Webhook validated', { contactId, phoneLength: phone.length });
    
    // Try to fetch conversation
    log('Fetching conversation state');
    try {
      const convState = await conversationManager.getConversationState(
        contactId, 
        null,
        phone
      );
      log('Conversation fetched', { 
        messageCount: convState.messages?.length,
        conversationId: convState.conversationId
      });
    } catch (convError) {
      log('Conversation fetch failed', { 
        error: convError.message,
        type: convError.constructor.name
      });
      throw convError;
    }
    
    // If we get here, everything worked
    log('Success - would invoke sales agent');
    
    return {
      messages: [
        ...state.messages,
        new AIMessage({
          content: `DEBUG SUCCESS! Steps completed: ${debugLog.length}\n\nDebug log:\n${JSON.stringify(debugLog, null, 2)}`,
          name: "DebugBot"
        })
      ]
    };
    
  } catch (error) {
    log('Handler error caught', {
      message: error.message,
      type: error.constructor.name,
      phase: debugLog[debugLog.length - 1]?.message || 'unknown'
    });
    
    return {
      messages: [
        ...state.messages,
        new AIMessage({
          content: `DEBUG FAILED at step ${debugLog.length}\n\nError: ${error.message}\n\nDebug log:\n${JSON.stringify(debugLog, null, 2)}`,
          name: "DebugBot"
        })
      ]
    };
  }
}

// Create graph
export const graph = new StateGraph(MessagesAnnotation)
  .addNode('debug_handler', debugWebhookHandler)
  .addEdge(START, 'debug_handler')
  .addEdge('debug_handler', END)
  .compile();