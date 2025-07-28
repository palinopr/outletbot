/**
 * Simple test graph for LangGraph CLI
 */

import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { ToolMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

// Create a simple graph
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0
});

// Define a simple tool
const weatherTool = {
  name: "weather",
  description: "Get weather in a location",
  schema: {
    type: "object",
    properties: {
      location: { type: "string" }
    },
    required: ["location"]
  },
  func: async ({ location }) => {
    return `The weather in ${location} is sunny!`;
  }
};

const modelWithTools = model.bindTools([weatherTool]);

// Create the graph
const graph = new StateGraph(MessagesAnnotation)
  .addNode("agent", async (state) => {
    const messages = state.messages;
    const response = await modelWithTools.invoke(messages);
    return { messages: [response] };
  })
  .addNode("tools", async (state) => {
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1];
    
    const outputs = await Promise.all(
      lastMessage.tool_calls.map(async (call) => {
        const tool = { weather: weatherTool }[call.name];
        const output = await tool.func.call(null, call.args);
        return new ToolMessage({
          tool_call_id: call.id,
          content: output,
          name: call.name
        });
      })
    );
    
    return { messages: outputs };
  })
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", (state) => {
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.tool_calls?.length > 0) {
      return "tools";
    }
    return "__end__";
  })
  .addEdge("tools", "agent");

export const simpleGraph = graph.compile();
export { simpleGraph as graph };