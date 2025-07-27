#!/usr/bin/env node
/**
 * Debug conversation isolation issue
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import { graph as webhookHandler } from './agents/webhookHandler.js';
import { HumanMessage } from '@langchain/core/messages';
import { GHLService } from './services/ghlService.js';
import ConversationManager from './services/conversationManager.js';

const ghlService = new GHLService(
  process.env.GHL_API_KEY,
  process.env.GHL_LOCATION_ID
);

const conversationManager = new ConversationManager(ghlService);

async function testConversationIsolation() {
  console.log('🔍 Testing Conversation Isolation\n');
  
  // Test with two different users
  const users = [
    {
      name: 'User A',
      contactId: 'user-a-' + Date.now(),
      phone: '+1234567890',
      message: 'Hola, soy Maria'
    },
    {
      name: 'User B', 
      contactId: 'user-b-' + Date.now(),
      phone: '+0987654321',
      message: 'Hola'
    }
  ];
  
  console.log('📊 Testing with two different users to ensure isolation\n');
  
  // First, send message from User A
  console.log('='.repeat(60));
  console.log('USER A sends message');
  console.log('='.repeat(60));
  
  const userAPayload = {
    phone: users[0].phone,
    message: users[0].message,
    contactId: users[0].contactId
  };
  
  const userAState = {
    messages: [new HumanMessage(JSON.stringify(userAPayload))],
    contactId: users[0].contactId,
    phone: users[0].phone
  };
  
  try {
    console.log('\n🚀 Processing User A webhook...');
    const resultA = await webhookHandler.invoke(userAState, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        thread_id: `test-userA-${Date.now()}`
      },
      recursionLimit: 10
    });
    
    // Extract response
    const responseA = resultA.messages.find(m => 
      m.tool_calls?.some(tc => tc.function?.name === 'send_ghl_message')
    );
    
    if (responseA) {
      const tc = responseA.tool_calls.find(tc => tc.function?.name === 'send_ghl_message');
      const args = JSON.parse(tc.function.arguments);
      console.log(`\n🤖 Response to User A: "${args.message}"`);
    }
    
  } catch (error) {
    console.error('Error processing User A:', error.message);
  }
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Now send message from User B
  console.log('\n\n' + '='.repeat(60));
  console.log('USER B sends message (different user)');
  console.log('='.repeat(60));
  
  const userBPayload = {
    phone: users[1].phone,
    message: users[1].message,
    contactId: users[1].contactId
  };
  
  const userBState = {
    messages: [new HumanMessage(JSON.stringify(userBPayload))],
    contactId: users[1].contactId,
    phone: users[1].phone
  };
  
  try {
    console.log('\n🚀 Processing User B webhook...');
    
    // Check what's in the conversation manager cache before processing
    console.log('\n📦 Cache state before User B:');
    console.log(`Cache size: ${conversationManager.cache.size}`);
    for (const [key, value] of conversationManager.cache.entries()) {
      console.log(`  Key: ${key}`);
      console.log(`  Messages: ${value.state.messages?.length || 0}`);
      console.log(`  Lead name: ${value.state.leadName || 'none'}`);
    }
    
    const resultB = await webhookHandler.invoke(userBState, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        thread_id: `test-userB-${Date.now()}`
      },
      recursionLimit: 10
    });
    
    // Extract response
    const responseB = resultB.messages.find(m => 
      m.tool_calls?.some(tc => tc.function?.name === 'send_ghl_message')
    );
    
    if (responseB) {
      const tc = responseB.tool_calls.find(tc => tc.function?.name === 'send_ghl_message');
      const args = JSON.parse(tc.function.arguments);
      console.log(`\n🤖 Response to User B: "${args.message}"`);
      
      // Check if response mentions User A's name
      if (args.message.toLowerCase().includes('maria')) {
        console.log('\n❌ ISOLATION FAILURE: User B got response mentioning User A (Maria)!');
      } else if (args.message.toLowerCase().includes('juan')) {
        console.log('\n❌ ISOLATION FAILURE: User B got response mentioning Juan from previous conversation!');
      } else {
        console.log('\n✅ Good: Response doesn\'t mention other users');
      }
    }
    
  } catch (error) {
    console.error('Error processing User B:', error.message);
  }
  
  // Final cache check
  console.log('\n\n📦 Final cache state:');
  console.log(`Cache size: ${conversationManager.cache.size}`);
  for (const [key, value] of conversationManager.cache.entries()) {
    console.log(`\n  Key: ${key}`);
    console.log(`  Contact ID: ${key.split('-')[0]}`);
    console.log(`  Messages: ${value.state.messages?.length || 0}`);
    console.log(`  Lead info:`, value.state.leadName || 'none');
  }
}

process.env.SKIP_ENV_VALIDATION = 'true';
testConversationIsolation().catch(console.error);