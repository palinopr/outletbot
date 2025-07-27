#!/usr/bin/env node
/**
 * Debug why simple greeting doesn't send messages
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

async function debugSimpleGreeting() {
  console.log('🔍 Debugging Simple Greeting Scenario\n');
  
  const state = {
    messages: [new HumanMessage('Hola')],
    leadInfo: {},
    contactId: 'ym8G7K6GSzm8dJDZ6BNo',
    conversationId: 'nrVkJFN5Zi0I3vRQx1pO'
  };
  
  console.log('Input state:', JSON.stringify(state, null, 2));
  
  try {
    console.log('\n🚀 Invoking sales agent...');
    const result = await salesAgent.invoke(state, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        contactId: state.contactId,
        thread_id: `debug-greeting-${Date.now()}`
      },
      recursionLimit: 10
    });
    
    console.log('\n📊 Result analysis:');
    console.log('Total messages:', result.messages?.length);
    
    // Find AI messages with tool calls
    const aiMessages = result.messages?.filter(m => 
      m._getType?.() === 'ai' || m.type === 'ai' || m.constructor.name === 'AIMessage'
    ) || [];
    
    console.log('AI messages:', aiMessages.length);
    
    // Check tool calls
    console.log('\n🔧 Tool calls:');
    aiMessages.forEach((msg, idx) => {
      if (msg.tool_calls?.length > 0) {
        console.log(`\nAI Message ${idx + 1} tools:`);
        msg.tool_calls.forEach(tc => {
          console.log(`  - ${tc.function?.name || tc.name}`);
          console.log(`    Args: ${JSON.stringify(tc.function?.arguments || tc.args)}`);
        });
      }
    });
    
    // Check tool responses
    console.log('\n📝 Tool responses:');
    const toolMessages = result.messages?.filter(m => m.role === 'tool') || [];
    toolMessages.forEach(tm => {
      console.log(`  - ${tm.name || 'unknown'}: ${tm.content?.substring(0, 100)}...`);
    });
    
    // Check if sendGHLMessage was called
    const sendMessageCalls = aiMessages.flatMap(m => 
      (m.tool_calls || []).filter(tc => 
        tc.function?.name === 'send_ghl_message' || tc.name === 'send_ghl_message'
      )
    );
    
    console.log(`\n📤 send_ghl_message calls: ${sendMessageCalls.length}`);
    if (sendMessageCalls.length > 0) {
      sendMessageCalls.forEach(call => {
        const args = JSON.parse(call.function?.arguments || call.args || '{}');
        console.log(`  Message: "${args.message?.substring(0, 100)}..."`);
      });
    } else {
      console.log('  ❌ No send_ghl_message calls found!');
    }
    
    // Check lead info
    console.log('\n📋 Lead info:', JSON.stringify(result.leadInfo || {}, null, 2));
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

debugSimpleGreeting().catch(console.error);