#!/usr/bin/env node
/**
 * Debug sales agent issue
 */

import { config as dotenvConfig } from 'dotenv';
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from '@langchain/core/messages';
import { tool } from "@langchain/core/tools";
import { z } from "zod";

dotenvConfig();

// Create a simple test tool
const testTool = tool(
  async ({ message }) => {
    console.log('Tool called with:', message);
    return `Received: ${message}`;
  },
  {
    name: "test_tool",
    description: "Test tool",
    schema: z.object({
      message: z.string()
    })
  }
);

// Create simple agent
const llm = new ChatOpenAI({ 
  model: "gpt-4",
  temperature: 0
});

const agent = createReactAgent({
  llm: llm.bindTools([testTool]),
  tools: [testTool],
  messageModifier: (state) => {
    console.log('State messages:', state.messages?.length);
    console.log('First message:', state.messages?.[0]);
    
    return [
      { 
        role: "system", 
        content: "You are a test agent. Always use the test_tool for any user message."
      },
      ...state.messages
    ];
  }
});

async function test() {
  console.log('Testing simple agent...\n');
  
  try {
    const result = await agent.invoke({
      messages: [new HumanMessage("Hello")]
    });
    
    console.log('\nResult:', result);
    console.log('Messages:', result.messages?.length);
    
    const aiMessages = result.messages?.filter(m => 
      m._getType?.() === 'ai' || m.role === 'assistant'
    );
    console.log('AI messages:', aiMessages?.length);
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

test().catch(console.error);