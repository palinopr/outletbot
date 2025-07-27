#!/usr/bin/env node
/**
 * Simple test to debug extractLeadInfo error
 */

import { config as dotenvConfig } from 'dotenv';
import { salesAgent } from './agents/salesAgent.js';
import { HumanMessage } from '@langchain/core/messages';
import { GHLService } from './services/ghlService.js';

dotenvConfig();

// Enable tracing
process.env.LANGSMITH_TRACING = 'true';
process.env.LANGSMITH_PROJECT = 'debug-error';

async function testSimple() {
  console.log('🔍 Testing simple message extraction...\n');
  
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );

  const state = {
    messages: [
      new HumanMessage("Hola")
    ],
    leadInfo: {},
    contactId: `test-error-${Date.now()}`,
    conversationId: `conv-error-${Date.now()}`
  };

  console.log('Initial state:', JSON.stringify(state, null, 2));

  try {
    const result = await salesAgent.invoke(state, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        contactId: state.contactId,
        thread_id: `error-test-${Date.now()}`
      },
      recursionLimit: 5  // Lower limit to fail faster
    });

    console.log('\n=== RESULTS ===');
    console.log('Success!');
    console.log('Messages:', result.messages?.length);
    console.log('Lead info:', result.leadInfo);
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run test
testSimple().catch(console.error);