#!/usr/bin/env node
/**
 * Debug test for state passing to tools
 */

import { config as dotenvConfig } from 'dotenv';
import { salesAgent } from './agents/salesAgent.js';
import { HumanMessage } from '@langchain/core/messages';
import { GHLService } from './services/ghlService.js';

dotenvConfig();

// Enable tracing
process.env.LANGSMITH_TRACING = 'true';
process.env.LANGSMITH_PROJECT = 'debug-state-passing';

async function testStatePassing() {
  console.log('🔍 Testing state passing to tools...\n');
  
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );

  // Create state with pre-populated leadInfo
  const initialState = {
    messages: [
      new HumanMessage("Mi email es test@example.com")
    ],
    leadInfo: {
      name: "Carlos",
      problem: "No sales",
      goal: "More sales", 
      budget: 500,
      phone: "+1234567890"
    },
    contactId: `test-state-${Date.now()}`,
    conversationId: `conv-state-${Date.now()}`
  };

  console.log('Initial state:');
  console.log(JSON.stringify(initialState, null, 2));

  try {
    // Invoke agent
    const result = await salesAgent.invoke(initialState, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        contactId: initialState.contactId,
        thread_id: `state-test-${Date.now()}`,
        // Try passing leadInfo through configurable too
        leadInfo: initialState.leadInfo
      }
    });

    console.log('\n=== RESULTS ===');
    console.log('Final leadInfo:', JSON.stringify(result.leadInfo, null, 2));
    console.log('Expected leadInfo to contain:', {
      name: "Carlos",
      problem: "No sales", 
      goal: "More sales",
      budget: 500,
      email: "test@example.com"
    });
    
    // Check if state was preserved
    const statePreserved = result.leadInfo?.name === "Carlos" && 
                          result.leadInfo?.email === "test@example.com";
    
    console.log('\nState preserved:', statePreserved);
    
    return statePreserved;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    return false;
  }
}

// Run test
testStatePassing().then(success => {
  console.log('\n' + (success ? '✅ State passing works!' : '❌ State passing broken'));
  process.exit(success ? 0 : 1);
});