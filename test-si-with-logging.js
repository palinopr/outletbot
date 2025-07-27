#!/usr/bin/env node
/**
 * Test "si" confirmation with detailed logging
 */

import { config as dotenvConfig } from 'dotenv';
import { salesAgent } from './agents/salesAgent.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { GHLService } from './services/ghlService.js';

dotenvConfig();

// Enable tracing
process.env.LANGSMITH_TRACING = 'true';
process.env.LANGSMITH_PROJECT = 'si-confirmation-debug';

async function testSiConfirmation() {
  console.log('🔍 Testing "si" confirmation with detailed logging...\n');
  
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );

  // Test case: User says "si" to confirm budget
  const messages = [
    new HumanMessage("Soy Juan"),
    new AIMessage("Mucho gusto Juan. ¿Tu presupuesto mensual es de $500?"),
    new HumanMessage("si")
  ];

  const state = {
    messages,
    leadInfo: { name: "Juan", phone: "+1234567890" },
    contactId: `test-si-${Date.now()}`,
    conversationId: `conv-si-${Date.now()}`
  };

  console.log('Full conversation:');
  messages.forEach((msg, i) => {
    const role = msg._getType() === 'human' ? 'Customer' : 'Assistant';
    console.log(`${i+1}. ${role}: ${msg.content}`);
  });
  
  console.log('\nExpected: When user says "si" to "$500?" → Extract budget: 500\n');

  try {
    const result = await salesAgent.invoke(state, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        contactId: state.contactId,
        thread_id: `si-test-${Date.now()}`
      }
    });

    // Get all tool calls
    const toolCalls = result.messages?.filter(m => m.tool_calls)
      .flatMap(m => m.tool_calls) || [];
    
    console.log('\n=== TOOL CALLS ===');
    toolCalls.forEach(tc => {
      console.log(`- ${tc.name}: ${JSON.stringify(tc.args)}`);
    });

    // Check if budget was extracted
    console.log('\n=== RESULTS ===');
    console.log('Final lead info:', JSON.stringify(result.leadInfo, null, 2));
    console.log('Budget extracted:', result.leadInfo?.budget || 'NONE');
    
    // Get last AI message
    const lastAi = result.messages?.filter(m => 
      m._getType?.() === 'ai' || m.type === 'ai'
    ).pop();
    
    console.log('\nBot response:', lastAi?.content || 'No response');
    
    const success = result.leadInfo?.budget === 500 || result.leadInfo?.budget === '$500';
    console.log('\n' + (success ? '✅ SUCCESS: Budget extracted from "si"!' : 
                       '❌ FAILED: Budget not extracted'));
    
    return success;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    return false;
  }
}

// Run test
testSiConfirmation().then(success => {
  console.log('\n' + (success ? '✅ "Si" confirmation working!' : '❌ "Si" confirmation needs more work'));
  process.exit(success ? 0 : 1);
});