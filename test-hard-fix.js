#!/usr/bin/env node
/**
 * Test the hard fix for self-conversation issue
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

async function testHardFix() {
  console.log('🧪 Testing Hard Fix for Self-Conversation\n');
  
  const testContactId = 'test-hard-fix-' + Date.now();
  const testPhone = '+1234567890';
  
  console.log('📋 Test Setup:');
  console.log(`Contact ID: ${testContactId}`);
  console.log(`Phone: ${testPhone}`);
  console.log('\n═══════════════════════════════════════════\n');
  
  // Simulate user saying "Hola"
  console.log('👤 USER: "Hola"');
  
  const webhookPayload = {
    phone: testPhone,
    message: 'Hola',
    contactId: testContactId
  };
  
  const state = {
    messages: [new HumanMessage(JSON.stringify(webhookPayload))],
    contactId: testContactId,
    phone: testPhone
  };
  
  try {
    const result = await webhookHandler.invoke(state, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        thread_id: `test-hard-fix-${Date.now()}`
      },
      recursionLimit: 10
    });
    
    // Check results
    console.log('\n📊 RESULTS:');
    console.log(`Total messages in result: ${result.messages.length}`);
    
    // Count tool calls
    const toolCalls = result.messages.filter(m => m.tool_calls?.length > 0);
    console.log(`Messages with tool calls: ${toolCalls.length}`);
    
    // Extract responses
    const responses = [];
    toolCalls.forEach(msg => {
      msg.tool_calls.forEach(tc => {
        if (tc.function?.name === 'send_ghl_message') {
          const args = JSON.parse(tc.function.arguments);
          responses.push(args.message);
        }
      });
    });
    
    console.log(`\nResponses to send: ${responses.length}`);
    responses.forEach((resp, i) => {
      console.log(`\n🤖 Response ${i + 1}: "${resp}"`);
    });
    
    // Check for issues
    if (responses.length > 1) {
      console.log('\n❌ ISSUE: Multiple responses generated for single message!');
    } else if (responses.length === 1) {
      console.log('\n✅ SUCCESS: Only one response generated');
      
      // Check response quality
      const response = responses[0].toLowerCase();
      if (response.includes('hola') && response.includes('maría')) {
        console.log('✅ Response is appropriate greeting');
      }
    } else {
      console.log('\n❌ ISSUE: No response generated!');
    }
    
    // Check for extraction loops
    const extractCalls = result.messages.filter(m => 
      m.tool_calls?.some(tc => tc.function?.name === 'extract_lead_info')
    ).length;
    
    console.log(`\nExtraction calls: ${extractCalls}`);
    if (extractCalls > 1) {
      console.log('⚠️  WARNING: Multiple extraction attempts');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

process.env.SKIP_ENV_VALIDATION = 'true';
testHardFix().catch(console.error);