// Simple webhook for testing without GHL dependency
import { StateGraph, MessagesAnnotation, Annotation, END, START } from '@langchain/langgraph';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

console.log('Simple webhook loaded');

// Simple handler that just echoes back
async function simpleHandler(state) {
  console.log('Simple handler called');
  
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];
  
  // Just echo back a simple response
  return {
    messages: [
      ...messages,
      new AIMessage({
        content: "Hola! Simple webhook is working. Your message was received.",
        name: "TestBot"
      })
    ]
  };
}

// Create simple graph
export const graph = new StateGraph(MessagesAnnotation)
  .addNode('simple_handler', simpleHandler)
  .addEdge(START, 'simple_handler')
  .addEdge('simple_handler', END)
  .compile();

console.log('Simple webhook graph compiled');