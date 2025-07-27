#!/usr/bin/env node
/**
 * Inspect message structure to understand tool calling
 */

import { config as dotenvConfig } from 'dotenv';
import { salesAgent } from './agents/salesAgent.js';
import { HumanMessage } from '@langchain/core/messages';
import { GHLService } from './services/ghlService.js';

dotenvConfig();

const ghlService = new GHLService(
  process.env.GHL_API_KEY,  
  process.env.GHL_LOCATION_ID
);

async function inspectMessages() {
  console.log('🔍 Inspecting message structure...\n');
  
  const state = {
    messages: [new HumanMessage('Hola, soy Carlos')],
    leadInfo: {},
    contactId: 'inspect-test',
    conversationId: 'conv-inspect'
  };
  
  try {
    const result = await salesAgent.invoke(state, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        contactId: state.contactId,
        thread_id: 'inspect-thread'
      },
      recursionLimit: 5
    });
    
    console.log('Result messages count:', result.messages?.length || 0);
    console.log('\nMessage details:');
    
    result.messages?.forEach((msg, idx) => {
      console.log(`\nMessage ${idx + 1}:`);
      console.log('  Type:', msg._getType?.() || msg.type || msg.constructor.name);
      console.log('  Role:', msg.role);
      console.log('  Content:', msg.content?.substring(0, 100) + '...');
      
      // Check different tool call properties
      if (msg.tool_calls) {
        console.log('  Tool calls (tool_calls):', msg.tool_calls.length);
        msg.tool_calls.forEach(tc => {
          console.log(`    - ${tc.function?.name || tc.name}`);
        });
      }
      
      if (msg.additional_kwargs?.tool_calls) {
        console.log('  Tool calls (additional_kwargs):', msg.additional_kwargs.tool_calls.length);
      }
      
      if (msg.tool_call_id) {
        console.log('  Tool response ID:', msg.tool_call_id);
      }
    });
    
    // Check state for tool tracking
    console.log('\nState analysis:');
    console.log('  extractionCount:', result.extractionCount);
    console.log('  processedMessages:', result.processedMessages?.length);
    console.log('  ghlUpdated:', result.ghlUpdated);
    console.log('  leadInfo:', result.leadInfo);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

inspectMessages().catch(console.error);