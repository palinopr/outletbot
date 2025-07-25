import { graph as salesAgent } from './salesAgent.js';
import { GHLService, formatPhoneNumber } from '../services/ghlService.js';
import ConversationManager from '../services/conversationManager.js';
import { HumanMessage } from '@langchain/core/messages';
import { StateGraph, MessagesAnnotation } from '@langchain/langgraph';

// Initialize services
let ghlService;
let conversationManager;

// Initialize on cold start
async function initialize() {
  if (!ghlService) {
    ghlService = new GHLService(
      process.env.GHL_API_KEY,
      process.env.GHL_LOCATION_ID
    );
    
    conversationManager = new ConversationManager(ghlService);
  }
}

// Define the webhook handler node
async function webhookHandlerNode(state) {
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
  
  console.log('Webhook received:', { contactId, conversationId, message });
  
  // Get conversation state from GHL
  let conversationState = await conversationManager.getConversationState(contactId, conversationId);
  
  // Build messages array for the agent
  const agentMessages = [
    ...conversationState.messages,
    new HumanMessage(message)
  ];
  
  // Extract current lead info for context
  const currentLeadInfo = {
    name: conversationState.leadName,
    problem: conversationState.leadProblem,
    goal: conversationState.leadGoal,
    budget: conversationState.leadBudget,
    email: conversationState.leadEmail,
    phone: formatPhoneNumber(phone)
  };
  
  // Invoke the sales agent
  const result = await salesAgent.invoke({
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
    }
  });
  
  // Clear conversation cache
  conversationManager.clearCache(contactId, conversationId);
  
  // Return updated messages
  return {
    messages: result.messages
  };
}

// Create the webhook handler graph
export const graph = new StateGraph(MessagesAnnotation)
  .addNode('webhook_handler', webhookHandlerNode)
  .addEdge('__start__', 'webhook_handler')
  .addEdge('webhook_handler', '__end__')
  .compile();