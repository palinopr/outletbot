#!/usr/bin/env node
/**
 * Minimal test to understand state passing in createReactAgent
 */

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver, Annotation, Command } from '@langchain/langgraph';
import dotenv from 'dotenv';

dotenv.config();

// Define state
const StateAnnotation = Annotation.Root({
  messages: Annotation({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  testValue: Annotation({
    default: () => "initial",
  })
});

// Create a test tool
const testTool = tool(
  async (input, config) => {
    console.log('Tool called with:', input);
    console.log('Config:', JSON.stringify(config, null, 2));
    
    // Try different ways to access state
    console.log('config.configurable:', config?.configurable);
    console.log('config.runnable_config:', config?.runnable_config);
    
    return "Tool executed";
  },
  {
    name: "test_tool",
    description: "Test tool to understand state access",
    schema: z.object({
      message: z.string()
    })
  }
);

// Create agent
const llm = new ChatOpenAI({ model: "gpt-4", temperature: 0 });
const agent = createReactAgent({
  llm: llm.bindTools([testTool]),
  tools: [testTool],
  stateSchema: StateAnnotation,
  messageModifier: (state) => {
    console.log('Message modifier - state keys:', Object.keys(state));
    console.log('State messages:', state.messages);
    return [
      { role: "system", content: "You are a test agent. Always use the test_tool." },
      ...(state.messages || [])
    ];
  }
});

// Test
async function test() {
  const result = await agent.invoke({
    messages: [new HumanMessage("Hello, test the tool")],
    testValue: "custom value"
  }, {
    configurable: {
      customConfig: "from configurable",
      testValue: "from configurable"
    }
  });
  
  console.log('\nResult:', result);
}

test().catch(console.error);