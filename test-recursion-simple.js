#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

console.log('🔍 TESTING RECURSION LIMIT WITH DIRECT AGENT SIMULATION\n');

import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { Command } from '@langchain/langgraph';

// Create a simple agent that will hit recursion limits
async function testRecursionScenario() {
  console.log('Creating agent that simulates the sales agent behavior...\n');
  
  let extractCount = 0;
  let messageCount = 0;
  
  // Tool that extracts info but sometimes doesn't find anything
  const extractLeadInfo = tool(async ({ message }, config) => {
    extractCount++;
    console.log(`[${extractCount}] extractLeadInfo called`);
    
    // Simulate the bug: always trying to extract but not finding new info
    // This mimics the behavior when the agent gets stuck
    const currentLeadInfo = config?.configurable?.leadInfo || {};
    
    // Return the same info (no new extraction)
    return new Command({
      update: {
        leadInfo: currentLeadInfo,
        extractionCount: extractCount
      }
    });
  }, {
    name: 'extractLeadInfo',
    description: 'Extract lead information from message',
    schema: z.object({
      message: z.string()
    })
  });
  
  // Tool to send messages
  const sendMessage = tool(async ({ message }, config) => {
    messageCount++;
    console.log(`[${messageCount}] sendMessage: "${message.substring(0, 50)}..."`);
    
    return new Command({
      update: {
        lastMessageSent: message
      }
    });
  }, {
    name: 'sendMessage',
    description: 'Send message to user',
    schema: z.object({
      message: z.string()
    })
  });
  
  // Create agent with tools
  const model = new ChatOpenAI({ 
    temperature: 0,
    modelName: 'gpt-4o-mini'
  });
  
  const agent = createReactAgent({
    llm: model,
    tools: [extractLeadInfo, sendMessage],
    stateModifier: (state) => {
      // Add system prompt that might cause looping
      return [
        {
          role: "system",
          content: `You are a sales agent. You MUST extract ALL of the following information before proceeding:
- Name
- Problem
- Goal  
- Budget
- Email

Current lead info: ${JSON.stringify(state.leadInfo || {})}

If ANY field is missing, you MUST keep trying to extract it from the conversation.
Always use extractLeadInfo first, then respond based on what's missing.`
        },
        ...state.messages
      ];
    }
  });
  
  // Test scenario that causes recursion
  const initialState = {
    messages: [
      new HumanMessage("Hola"),
      new HumanMessage("Q horas tienes?")
    ],
    leadInfo: {
      name: "Jaime",
      // Missing: problem, goal, budget, email
    }
  };
  
  console.log('Initial state:');
  console.log('- Messages:', initialState.messages.length);
  console.log('- Lead info:', JSON.stringify(initialState.leadInfo));
  console.log('\nRunning agent with recursion limit of 10...\n');
  
  try {
    const startTime = Date.now();
    
    const result = await agent.invoke(initialState, {
      recursionLimit: 10,
      configurable: {
        leadInfo: initialState.leadInfo
      }
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Completed in ${duration}s`);
    console.log('Tool calls:', { extractCount, messageCount });
    
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n❌ ERROR after ${duration}s`);
    console.log(`Error: ${error.message}`);
    console.log('Tool calls at error:', { extractCount, messageCount });
    
    if (error.message.includes('Recursion limit')) {
      console.log('\n🔴 RECURSION LIMIT HIT!');
      console.log('\nThis demonstrates the issue:');
      console.log('1. Agent has partial lead info (only name)');
      console.log('2. System prompt requires ALL fields before proceeding');
      console.log('3. extractLeadInfo keeps being called but finds no new info');
      console.log('4. Agent gets stuck in loop until recursion limit');
      
      console.log('\n💡 SOLUTION:');
      console.log('1. Add extraction attempt limits per conversation');
      console.log('2. Allow agent to proceed with partial info after X attempts');
      console.log('3. Add explicit termination conditions');
      console.log('4. Track which messages have been processed');
    }
  }
}

// Test infinite loop pattern
async function testInfiniteLoopPattern() {
  console.log('\n\n=== TESTING INFINITE LOOP PATTERN ===\n');
  
  let loopCount = 0;
  
  // Tool that always triggers another tool call
  const loopingTool = tool(async (input, config) => {
    loopCount++;
    console.log(`Loop ${loopCount}: Still trying...`);
    
    // This simulates a tool that never provides a satisfactory result
    return new Command({
      update: {
        attempts: loopCount,
        stillMissingInfo: true
      }
    });
  }, {
    name: 'loopingTool',
    description: 'A tool that never satisfies the requirement',
    schema: z.object({
      input: z.string()
    })
  });
  
  const model = new ChatOpenAI({ 
    temperature: 0,
    modelName: 'gpt-4o-mini'
  });
  
  const agent = createReactAgent({
    llm: model,
    tools: [loopingTool],
    stateModifier: (state) => {
      return [
        {
          role: "system",
          content: "Keep using loopingTool until stillMissingInfo is false."
        },
        ...state.messages
      ];
    }
  });
  
  try {
    console.log('Starting agent that will loop indefinitely...\n');
    
    await agent.invoke(
      { messages: [new HumanMessage("Start")] },
      { recursionLimit: 5 }
    );
    
  } catch (error) {
    console.log(`\n❌ Caught after ${loopCount} loops: ${error.message}`);
    
    if (loopCount === 5) {
      console.log('✅ Recursion limit correctly prevented infinite loop');
    }
  }
}

// Run tests
(async () => {
  try {
    await testRecursionScenario();
    await testInfiniteLoopPattern();
    
    console.log('\n\n=== TEST COMPLETE ===');
    console.log('These tests demonstrate how recursion limits can be hit');
    console.log('when agents get stuck in loops trying to satisfy requirements.');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
})();