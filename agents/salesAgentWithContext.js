import { salesAgent } from './modernSalesAgent.js';
import { SystemMessage } from '@langchain/core/messages';

/**
 * Wrapper for the sales agent that injects contactId into the conversation
 * This ensures the agent knows which contactId to use when calling tools
 */
export async function salesAgentWithContext(input, config) {
  const { messages, contactId, ...rest } = input;
  
  if (!contactId) {
    throw new Error('contactId is required for the sales agent');
  }
  
  // Create a system message that provides the contactId context
  const contextMessage = new SystemMessage(
    `IMPORTANT: The current contactId for this conversation is: ${contactId}
    You MUST use this exact contactId when calling send_ghl_message and other tools.
    Example: send_ghl_message({"contactId": "${contactId}", "message": "your message"})`
  );
  
  // Prepend the context message to the conversation
  const messagesWithContext = [contextMessage, ...messages];
  
  // Call the original agent with the modified messages
  return salesAgent.invoke({
    ...input,
    messages: messagesWithContext
  }, config);
}

// For LangGraph deployment
export default salesAgentWithContext;