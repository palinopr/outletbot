// Debug webhook handler to identify production issues
import { StateGraph, MessagesAnnotation, Annotation, END, START } from '@langchain/langgraph';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

// Debug handler that shows what's happening
async function debugHandler(state, config) {
  const debugInfo = {
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      hasGHLKey: !!process.env.GHL_API_KEY,
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      hasLocationId: !!process.env.GHL_LOCATION_ID,
      hasCalendarId: !!process.env.GHL_CALENDAR_ID
    },
    state: {
      messageCount: state.messages?.length || 0,
      hasContactId: !!state.contactId,
      hasPhone: !!state.phone
    },
    config: {
      hasConfig: !!config,
      hasRunId: !!config?.runId,
      configKeys: config ? Object.keys(config) : []
    }
  };
  
  try {
    // Try to parse the webhook payload
    const lastMessage = state.messages[state.messages.length - 1];
    let webhookData = null;
    
    if (typeof lastMessage.content === 'string' && lastMessage.content.includes('{')) {
      webhookData = JSON.parse(lastMessage.content);
      debugInfo.webhook = {
        hasPhone: !!webhookData.phone,
        hasMessage: !!webhookData.message,
        hasContactId: !!webhookData.contactId
      };
    }
    
    // Try to import GHL service
    debugInfo.imports = {};
    try {
      const { GHLService } = await import('../services/ghlService.js');
      debugInfo.imports.ghlService = 'success';
    } catch (e) {
      debugInfo.imports.ghlService = `failed: ${e.message}`;
    }
    
    // Try to import conversation manager
    try {
      const ConversationManager = await import('../services/conversationManager.js');
      debugInfo.imports.conversationManager = 'success';
    } catch (e) {
      debugInfo.imports.conversationManager = `failed: ${e.message}`;
    }
    
  } catch (error) {
    debugInfo.error = {
      message: error.message,
      type: error.constructor.name,
      stack: error.stack?.split('\n')[0]
    };
  }
  
  // Return debug information
  return {
    messages: [
      ...state.messages,
      new AIMessage({
        content: `DEBUG INFO: ${JSON.stringify(debugInfo, null, 2)}`,
        name: "DebugBot"
      })
    ]
  };
}

// Create debug graph
export const graph = new StateGraph(MessagesAnnotation)
  .addNode('debug', debugHandler)
  .addEdge(START, 'debug')
  .addEdge('debug', END)
  .compile();