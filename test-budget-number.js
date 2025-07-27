#!/usr/bin/env node
/**
 * Test budget extraction from number response
 */

import { config as dotenvConfig } from 'dotenv';
import { salesAgent } from './agents/salesAgent.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { GHLService } from './services/ghlService.js';

dotenvConfig();

// Enable tracing
process.env.LANGSMITH_TRACING = 'true';
process.env.LANGSMITH_PROJECT = 'budget-number-test';

async function testBudgetNumber() {
  console.log('🔍 Testing budget extraction from number response...\n');
  
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );

  // Test case: User responds with just a number after budget question
  const messages = [
    new HumanMessage("Soy Carlos"),
    new AIMessage("Mucho gusto Carlos. ¿Cuál es tu presupuesto mensual para marketing?"),
    new HumanMessage("500")
  ];

  const state = {
    messages,
    leadInfo: { name: "Carlos", phone: "+1234567890" },
    contactId: `test-budget-${Date.now()}`,
    conversationId: `conv-budget-${Date.now()}`
  };

  console.log('Scenario: Bot asks "¿Cuál es tu presupuesto mensual para marketing?"');
  console.log('User response: "500"');
  console.log('Expected: Extract budget: 500\n');

  try {
    const result = await salesAgent.invoke(state, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        contactId: state.contactId,
        thread_id: `budget-test-${Date.now()}`
      }
    });

    // Check if budget was extracted
    console.log('\n=== RESULTS ===');
    console.log('Lead info:', result.leadInfo);
    console.log('Budget extracted:', result.leadInfo?.budget || 'NONE');
    
    const success = result.leadInfo?.budget == 500;
    console.log('\n' + (success ? '✅ SUCCESS: Budget extracted from number!' : 
                       '❌ FAILED: Budget not extracted from number'));
    
    return success;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

// Run test
testBudgetNumber().then(success => {
  console.log('\n' + (success ? '✅ Number response working!' : '❌ Number response not working'));
  process.exit(success ? 0 : 1);
});