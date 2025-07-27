#!/usr/bin/env node
/**
 * Test calendar auto-trigger when all fields collected
 */

import { config as dotenvConfig } from 'dotenv';
import { salesAgent } from './agents/salesAgent.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { GHLService } from './services/ghlService.js';

dotenvConfig();

// Enable tracing
process.env.LANGSMITH_TRACING = 'true';
process.env.LANGSMITH_PROJECT = 'calendar-trigger-test';

async function testCalendarTrigger() {
  console.log('🔍 Testing calendar auto-trigger when all fields collected...\n');
  
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );

  // Test case: User provides email as last field
  const state = {
    messages: [
      new HumanMessage("Mi email es test@example.com")
    ],
    leadInfo: {
      name: "Test User",
      problem: "No sales",
      goal: "More sales", 
      budget: 500,
      phone: "+1234567890"
    },
    contactId: `test-calendar-${Date.now()}`,
    conversationId: `conv-calendar-${Date.now()}`
  };

  console.log('Initial lead info (missing email):');
  console.log(JSON.stringify(state.leadInfo, null, 2));
  console.log('\nUser message: "Mi email es test@example.com"');
  console.log('\nExpected: Should extract email AND trigger calendar slots\n');

  try {
    const result = await salesAgent.invoke(state, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        contactId: state.contactId,
        thread_id: `calendar-test-${Date.now()}`,
        // Pass initial leadInfo through configurable
        leadInfo: state.leadInfo
      }
    });

    // Check tool calls
    const toolCalls = result.messages?.filter(m => m.tool_calls)
      .flatMap(m => m.tool_calls) || [];
    
    console.log('=== TOOL CALLS ===');
    toolCalls.forEach(tc => {
      console.log(`- ${tc.name}: ${tc.args ? JSON.stringify(tc.args).substring(0, 100) : 'no args'}`);
    });

    // Check if calendar was triggered
    const calendarCalled = toolCalls.some(tc => tc.name === 'get_calendar_slots');
    console.log('\n=== RESULTS ===');
    console.log('Final lead info:', JSON.stringify(result.leadInfo, null, 2));
    console.log('All fields collected:', result.allFieldsCollected);
    console.log('Calendar slots called:', calendarCalled);
    console.log('Available slots:', result.availableSlots?.length || 0);
    
    const success = calendarCalled && result.allFieldsCollected;
    console.log('\n' + (success ? '✅ SUCCESS: Calendar auto-triggered!' : 
                       '❌ FAILED: Calendar not triggered'));
    
    return success;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    return false;
  }
}

// Run test
testCalendarTrigger().then(success => {
  console.log('\n' + (success ? '✅ Calendar auto-trigger working!' : '❌ Calendar auto-trigger needs work'));
  process.exit(success ? 0 : 1);
});