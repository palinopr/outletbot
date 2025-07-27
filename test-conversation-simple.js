#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

console.log('🚀 TESTING FULL CONVERSATION FROM ZERO\n');

// Mock the sales agent for testing
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { Command } from '@langchain/langgraph';
import { Annotation, MessagesAnnotation } from '@langchain/langgraph';
import crypto from 'crypto';

// Define state schema
const AgentStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  leadInfo: Annotation({
    default: () => ({}),
    reducer: (current, update) => ({ ...current, ...update })
  }),
  extractionCount: Annotation({
    reducer: (x, y) => y,
    default: () => 0
  }),
  processedMessages: Annotation({
    reducer: (x, y) => [...new Set([...x, ...y])],
    default: () => []
  }),
  maxExtractionReached: Annotation({
    default: () => false
  }),
  appointmentBooked: Annotation({
    default: () => false
  })
});

// Create a mock sales agent for testing
async function createTestAgent() {
  let extractCount = 0;
  const processedMessages = new Set();
  
  // Tool: Extract lead info with limits
  const extractLeadInfo = tool(async ({ message }, config) => {
    const state = config?.configurable || {};
    extractCount = state.extractionCount || 0;
    
    // Check limits
    if (extractCount >= 3) {
      return new Command({
        update: {
          maxExtractionReached: true,
          messages: [{
            role: "tool",
            content: "Max extraction attempts reached",
            tool_call_id: config.toolCall?.id
          }]
        }
      });
    }
    
    // Track processed messages
    const messageHash = crypto.createHash('md5').update(message.toLowerCase()).digest('hex');
    if (processedMessages.has(messageHash)) {
      return new Command({
        update: {
          messages: [{
            role: "tool",
            content: "Message already processed",
            tool_call_id: config.toolCall?.id
          }]
        }
      });
    }
    processedMessages.add(messageHash);
    
    // Simulate extraction
    const currentInfo = state.leadInfo || {};
    const extracted = {};
    
    if (message.match(/carlos|maria|pedro|juan/i) && !currentInfo.name) {
      extracted.name = message.match(/carlos|maria|pedro|juan/i)[0];
    }
    if (message.match(/restaurante|tienda|negocio/i) && !currentInfo.problem) {
      extracted.problem = "needs more customers";
    }
    if (message.match(/llenar|vender|crecer/i) && !currentInfo.goal) {
      extracted.goal = "grow business";
    }
    if (message.match(/\d+\s*(dolares|usd|\$)/i) && !currentInfo.budget) {
      const match = message.match(/(\d+)\s*(dolares|usd|\$)/i);
      extracted.budget = parseInt(match[1]);
    }
    if (message.match(/[\w.-]+@[\w.-]+\.\w+/i) && !currentInfo.email) {
      extracted.email = message.match(/[\w.-]+@[\w.-]+\.\w+/i)[0];
    }
    
    const merged = { ...currentInfo, ...extracted };
    
    return new Command({
      update: {
        leadInfo: merged,
        extractionCount: extractCount + 1,
        messages: [{
          role: "tool",
          content: `Extracted: ${JSON.stringify(extracted)}`,
          tool_call_id: config.toolCall?.id
        }]
      }
    });
  }, {
    name: 'extractLeadInfo',
    description: 'Extract lead information',
    schema: z.object({ message: z.string() })
  });
  
  // Tool: Send message
  const sendMessage = tool(async ({ message }, config) => {
    console.log(`\n🤖 BOT: "${message}"`);
    return new Command({
      update: {
        messages: [{
          role: "tool",
          content: "Message sent",
          tool_call_id: config.toolCall?.id
        }]
      }
    });
  }, {
    name: 'sendMessage',
    description: 'Send message to user',
    schema: z.object({ message: z.string() })
  });
  
  // Create agent
  const model = new ChatOpenAI({ 
    temperature: 0,
    modelName: 'gpt-4o-mini',
    openAIApiKey: process.env.OPENAI_API_KEY || 'test-key'
  });
  
  const systemPrompt = `You are a sales agent. Extract info and respond appropriately.
Current info: {leadInfo}
Extraction count: {extractionCount}
Max reached: {maxExtractionReached}

If maxExtractionReached=true, don't use extractLeadInfo anymore.
Missing info? Ask for it. Have all info? Say calendar is ready.`;
  
  return createReactAgent({
    llm: model,
    tools: [extractLeadInfo, sendMessage],
    stateSchema: AgentStateAnnotation,
    stateModifier: (state) => {
      const prompt = systemPrompt
        .replace('{leadInfo}', JSON.stringify(state.leadInfo || {}))
        .replace('{extractionCount}', state.extractionCount || 0)
        .replace('{maxExtractionReached}', state.maxExtractionReached || false);
      
      return [
        { role: "system", content: prompt },
        ...state.messages
      ];
    }
  });
}

// Test full conversation
async function testConversation() {
  console.log('Creating test agent...\n');
  const agent = await createTestAgent();
  
  // Conversation messages
  const messages = [
    "Hola",
    "Soy Carlos Rodriguez", 
    "tengo un restaurante pero no tengo clientes",
    "quiero llenar mi restaurante",
    "puedo gastar 500 dolares",
    "carlos@restaurant.com"
  ];
  
  let state = {
    messages: [],
    leadInfo: {},
    extractionCount: 0,
    processedMessages: [],
    maxExtractionReached: false
  };
  
  console.log('Starting conversation...\n');
  console.log('='.repeat(60) + '\n');
  
  for (const msg of messages) {
    console.log(`\n👤 USER: "${msg}"`);
    state.messages.push(new HumanMessage(msg));
    
    try {
      const result = await agent.invoke(state, {
        recursionLimit: 10,
        configurable: state
      });
      
      // Update state
      state = {
        messages: result.messages || state.messages,
        leadInfo: result.leadInfo || state.leadInfo,
        extractionCount: result.extractionCount || state.extractionCount,
        processedMessages: result.processedMessages || state.processedMessages,
        maxExtractionReached: result.maxExtractionReached || false
      };
      
      console.log(`\n📊 State after response:`);
      console.log(`   Lead info: ${JSON.stringify(state.leadInfo)}`);
      console.log(`   Extraction count: ${state.extractionCount}`);
      
    } catch (error) {
      console.error(`\n❌ Error: ${error.message}`);
      if (error.message.includes('Recursion limit')) {
        console.log('🔴 Hit recursion limit!');
      }
      break;
    }
  }
  
  // Test edge case: early scheduling question
  console.log('\n\n' + '='.repeat(60));
  console.log('EDGE CASE: Early scheduling question\n');
  
  state = {
    messages: [
      new HumanMessage("Hola"),
      new HumanMessage("Q horas tienes?")
    ],
    leadInfo: { name: "Maria" },
    extractionCount: 0,
    processedMessages: [],
    maxExtractionReached: false
  };
  
  console.log('👤 USER: "Hola"');
  console.log('👤 USER: "Q horas tienes?"');
  console.log('(User asking for schedule with only partial info)');
  
  try {
    const result = await agent.invoke(state, {
      recursionLimit: 10,
      configurable: state
    });
    
    console.log('\n✅ Handled without recursion error');
    console.log(`   Extraction count: ${result.extractionCount || 0}`);
    
  } catch (error) {
    if (error.message.includes('Recursion limit')) {
      console.log('\n❌ FAILED: Hit recursion limit');
    }
  }
  
  console.log('\n\n🎉 Test complete!');
}

// Run test
testConversation().catch(console.error);