#!/usr/bin/env node
/**
 * Quick test to count tool calls in common scenarios
 */

import { config as dotenvConfig } from 'dotenv';
import { salesAgent } from './agents/salesAgent.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { GHLService } from './services/ghlService.js';

dotenvConfig();

const ghlService = new GHLService(
  process.env.GHL_API_KEY,  
  process.env.GHL_LOCATION_ID
);

async function countToolCalls(name, state) {
  console.log(`\nTesting: ${name}`);
  
  try {
    const result = await salesAgent.invoke(state, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        contactId: state.contactId,
        thread_id: `efficiency-${Date.now()}`
      },
      recursionLimit: 10
    });
    
    // Count tool calls in messages
    let toolCalls = 0;
    const toolTypes = {};
    
    result.messages?.forEach(msg => {
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        msg.tool_calls.forEach(call => {
          toolCalls++;
          const toolName = call.function.name;
          toolTypes[toolName] = (toolTypes[toolName] || 0) + 1;
        });
      }
    });
    
    console.log(`  Total tool calls: ${toolCalls}`);
    console.log(`  Breakdown:`, toolTypes);
    
    // Check for efficiency issues
    if (toolTypes.extract_lead_info > 2) {
      console.log(`  ⚠️ Excessive extraction: ${toolTypes.extract_lead_info} calls`);
    }
    if (toolTypes.send_ghl_message > 2) {
      console.log(`  ⚠️ Multiple messages sent: ${toolTypes.send_ghl_message} calls`);
    }
    
    return { toolCalls, toolTypes };
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return null;
  }
}

async function runEfficiencyTest() {
  console.log('🔍 Tool Efficiency Analysis\n');
  
  // Test 1: Simple greeting
  await countToolCalls('Simple Greeting "Hola"', {
    messages: [new HumanMessage('Hola')],
    leadInfo: {},
    contactId: 'test-1',
    conversationId: 'conv-1'
  });
  
  // Test 2: Name extraction
  await countToolCalls('Name Introduction "Soy Juan"', {
    messages: [new HumanMessage('Soy Juan')],
    leadInfo: {},
    contactId: 'test-2',
    conversationId: 'conv-2'
  });
  
  // Test 3: Multiple info in one message
  await countToolCalls('Complex Message with Multiple Info', {
    messages: [new HumanMessage('Hola, soy Maria, tengo una tienda online y no vendo nada')],
    leadInfo: {},
    contactId: 'test-3',
    conversationId: 'conv-3'
  });
  
  // Test 4: Si confirmation
  await countToolCalls('Si Confirmation for Budget', {
    messages: [
      new HumanMessage('Soy Pedro'),
      new AIMessage('Hola Pedro, ¿cuál es tu presupuesto mensual para marketing? ¿$500?'),
      new HumanMessage('si')
    ],
    leadInfo: { name: 'Pedro' },
    contactId: 'test-4',
    conversationId: 'conv-4'
  });
  
  // Test 5: Already qualified lead
  await countToolCalls('Already Qualified Lead Asking for Email', {
    messages: [new HumanMessage('Mi email es test@example.com')],
    leadInfo: {
      name: 'Carlos',
      problem: 'no sales',
      goal: 'increase sales',
      budget: 500
    },
    contactId: 'test-5',
    conversationId: 'conv-5'
  });
  
  console.log('\n✅ Analysis complete');
}

runEfficiencyTest().catch(console.error);