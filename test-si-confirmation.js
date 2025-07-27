#!/usr/bin/env node
/**
 * Test "si" confirmation for budget
 */

import { config as dotenvConfig } from 'dotenv';
import { salesAgent } from './agents/salesAgent.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { GHLService } from './services/ghlService.js';

dotenvConfig();

// Enable tracing
process.env.LANGSMITH_TRACING = 'true';
process.env.LANGSMITH_PROJECT = 'si-confirmation-test';

async function testSiConfirmation() {
  console.log('🔍 Testing "si" confirmation for budget...\n');
  
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

  console.log('Scenario: Bot asks "¿Tu presupuesto mensual es de $500?"');
  console.log('User response: "si"');
  console.log('Expected: Extract budget: 500\n');

  try {
    const result = await salesAgent.invoke(state, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        contactId: state.contactId,
        thread_id: `si-test-${Date.now()}`
      }
    });

    // Check if budget was extracted
    console.log('\n=== RESULTS ===');
    console.log('Lead info:', result.leadInfo);
    console.log('Budget extracted:', result.leadInfo?.budget || 'NONE');
    
    const success = result.leadInfo?.budget === 500 || result.leadInfo?.budget === '$500';
    console.log('\n' + (success ? '✅ SUCCESS: Budget extracted from "si" confirmation!' : 
                       '❌ FAILED: Budget not extracted from "si"'));
    
    return success;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

// Run test
testSiConfirmation().then(success => {
  console.log('\n' + (success ? '✅ "Si" confirmation working!' : '❌ "Si" confirmation not working'));
  process.exit(success ? 0 : 1);
});