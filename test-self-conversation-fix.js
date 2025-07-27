#!/usr/bin/env node
/**
 * Test self-conversation fix
 * Simulates the trace scenario where agent was talking to itself
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import { graph as webhookHandler } from './agents/webhookHandler.js';
import { HumanMessage } from '@langchain/core/messages';
import { GHLService } from './services/ghlService.js';

const ghlService = new GHLService(
  process.env.GHL_API_KEY,
  process.env.GHL_LOCATION_ID
);

async function testSelfConversationFix() {
  console.log('🧪 Testing Self-Conversation Fix\n');
  console.log('Simulating scenario from trace 1f06b3bc-8e5a-6d3d-aa19-f423acb8dc3c\n');
  
  // Use a test contact
  const testContactId = 'test-self-conv-' + Date.now();
  const testPhone = '+1234567890';
  
  console.log('📋 Test Setup:');
  console.log(`Contact ID: ${testContactId}`);
  console.log(`Phone: ${testPhone}`);
  console.log('\n═══════════════════════════════════════════\n');
  
  // Step 1: User says "Hola"
  console.log('👤 USER: "Hola"');
  
  const webhookPayload1 = {
    phone: testPhone,
    message: 'Hola',
    contactId: testContactId
  };
  
  const state1 = {
    messages: [new HumanMessage(JSON.stringify(webhookPayload1))],
    contactId: testContactId,
    phone: testPhone
  };
  
  try {
    const result1 = await webhookHandler.invoke(state1, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        thread_id: `test-self-conv-1-${Date.now()}`
      },
      recursionLimit: 10
    });
    
    // Extract agent response
    const response1 = result1.messages.find(m => 
      m.tool_calls?.some(tc => tc.function?.name === 'send_ghl_message')
    );
    
    if (response1) {
      const tc = response1.tool_calls.find(tc => tc.function?.name === 'send_ghl_message');
      const args = JSON.parse(tc.function.arguments);
      console.log(`🤖 AGENT: "${args.message}"`);
      
      // Check if response is appropriate
      if (args.message.toLowerCase().includes('hola') && 
          args.message.toLowerCase().includes('maría')) {
        console.log('✅ Good: Agent gave proper greeting');
      } else {
        console.log('⚠️  Warning: Unexpected greeting response');
      }
    }
    
    console.log('\n───────────────────────────────────────────\n');
    
    // Step 2: User provides name
    console.log('👤 USER: "Soy Juan"');
    
    const webhookPayload2 = {
      phone: testPhone,
      message: 'Soy Juan',
      contactId: testContactId
    };
    
    const state2 = {
      messages: [new HumanMessage(JSON.stringify(webhookPayload2))],
      contactId: testContactId,
      phone: testPhone
    };
    
    const result2 = await webhookHandler.invoke(state2, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        thread_id: `test-self-conv-2-${Date.now()}`
      },
      recursionLimit: 10
    });
    
    // Extract agent response
    const response2 = result2.messages.find(m => 
      m.tool_calls?.some(tc => tc.function?.name === 'send_ghl_message')
    );
    
    if (response2) {
      const tc = response2.tool_calls.find(tc => tc.function?.name === 'send_ghl_message');
      const args = JSON.parse(tc.function.arguments);
      console.log(`🤖 AGENT: "${args.message}"`);
      
      // Check for self-conversation patterns
      const suspiciousPatterns = [
        'gracias por proporcionar',
        'entiendo que',
        'me has dicho que',
        'mencionaste que',
        'según lo que me dijiste'
      ];
      
      let foundSuspicious = false;
      suspiciousPatterns.forEach(pattern => {
        if (args.message.toLowerCase().includes(pattern)) {
          console.log(`❌ SELF-CONVERSATION DETECTED: Agent used phrase "${pattern}"`);
          foundSuspicious = true;
        }
      });
      
      if (!foundSuspicious) {
        console.log('✅ Good: No self-conversation patterns detected');
      }
      
      // Check if agent asks about problem (next step in flow)
      if (args.message.toLowerCase().includes('problema') || 
          args.message.toLowerCase().includes('ayudarte') ||
          args.message.toLowerCase().includes('necesitas')) {
        console.log('✅ Good: Agent moved to next step (asking about problem)');
      } else {
        console.log('⚠️  Warning: Agent should ask about problem after getting name');
      }
    }
    
    console.log('\n═══════════════════════════════════════════\n');
    console.log('Test Summary:');
    console.log('- Agent should only respond to the latest message');
    console.log('- Agent should not reference its own previous responses');
    console.log('- Conversation flow should progress naturally');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

process.env.SKIP_ENV_VALIDATION = 'true';
testSelfConversationFix().catch(console.error);