#!/usr/bin/env node
/**
 * Debug self-conversation issue
 * Trace ID: 1f06b3bc-8e5a-6d3d-aa19-f423acb8dc3c
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

async function debugSelfConversation() {
  console.log('🔍 Debugging Self-Conversation Issue\n');
  console.log('Problem: Agent appears to be talking to itself\n');
  
  // Test with a simple message
  const testContactId = 'test-debug-' + Date.now();
  const testPhone = '+1234567890';
  
  console.log('📋 Test Setup:');
  console.log(`Contact ID: ${testContactId}`);
  console.log(`Phone: ${testPhone}`);
  console.log('Message: "Hola"\n');
  
  // Check what happens with conversation state
  console.log('1️⃣ Checking conversation state before processing...\n');
  
  try {
    const initialState = await conversationManager.getConversationState(
      testContactId,
      null,
      testPhone
    );
    
    console.log('Initial state:');
    console.log(`- Messages: ${initialState.messages.length}`);
    console.log(`- Lead Name: ${initialState.leadName || 'none'}`);
    console.log(`- Current Step: ${initialState.currentStep}`);
    
    if (initialState.messages.length > 0) {
      console.log('\n⚠️  WARNING: Found existing messages for new contact!');
      console.log('Messages:');
      initialState.messages.forEach((msg, i) => {
        const type = msg.constructor.name;
        const preview = msg.content.substring(0, 100);
        console.log(`  ${i + 1}. [${type}] ${preview}...`);
      });
    }
  } catch (error) {
    console.log('No initial state (expected for new contact)');
  }
  
  console.log('\n2️⃣ Processing webhook with "Hola"...\n');
  
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
  
  // Add detailed logging to track the flow
  const originalLog = console.log;
  const logs = [];
  console.log = (...args) => {
    logs.push(args.join(' '));
    originalLog.apply(console, args);
  };
  
  try {
    const result = await webhookHandler.invoke(state, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        thread_id: `debug-self-${Date.now()}`
      },
      recursionLimit: 10
    });
    
    console.log = originalLog; // Restore original console.log
    
    console.log('\n3️⃣ Analyzing Results:\n');
    
    // Check how many messages were generated
    const aiMessages = result.messages.filter(m => m.constructor.name === 'AIMessage');
    const toolCalls = result.messages.filter(m => m.tool_calls && m.tool_calls.length > 0);
    
    console.log(`Total messages: ${result.messages.length}`);
    console.log(`AI messages: ${aiMessages.length}`);
    console.log(`Messages with tool calls: ${toolCalls.length}`);
    
    // Look for send_ghl_message calls
    const sendMessageCalls = [];
    toolCalls.forEach(msg => {
      msg.tool_calls.forEach(tc => {
        if (tc.function?.name === 'send_ghl_message') {
          const args = JSON.parse(tc.function.arguments);
          sendMessageCalls.push(args.message);
        }
      });
    });
    
    console.log(`\nMessages to be sent to customer: ${sendMessageCalls.length}`);
    sendMessageCalls.forEach((msg, i) => {
      console.log(`\n📤 Message ${i + 1}:`);
      console.log(`"${msg}"`);
    });
    
    // Check for self-conversation patterns
    console.log('\n4️⃣ Checking for self-conversation patterns:\n');
    
    if (sendMessageCalls.length > 1) {
      console.log('❌ ISSUE: Multiple messages generated for single input');
      console.log('This could cause the appearance of self-conversation');
    }
    
    // Check if agent is responding to its own messages
    const suspiciousPatterns = [
      'gracias por proporcionar',
      'entiendo que',
      'me has dicho que',
      'mencionaste que'
    ];
    
    let foundSuspicious = false;
    sendMessageCalls.forEach(msg => {
      suspiciousPatterns.forEach(pattern => {
        if (msg.toLowerCase().includes(pattern)) {
          console.log(`⚠️  Found suspicious pattern: "${pattern}"`);
          foundSuspicious = true;
        }
      });
    });
    
    if (foundSuspicious) {
      console.log('\n❌ ISSUE: Agent appears to be responding to information not provided by user');
    }
    
    // Check logs for duplicate processing
    console.log('\n5️⃣ Checking for duplicate processing:\n');
    
    const extractionCalls = logs.filter(log => log.includes('extract_lead_info'));
    console.log(`extract_lead_info called: ${extractionCalls.length} times`);
    
    if (extractionCalls.length > 2) {
      console.log('⚠️  WARNING: Excessive extraction calls could indicate a loop');
    }
    
  } catch (error) {
    console.log = originalLog; // Restore original console.log
    console.error('❌ Error during processing:', error.message);
  }
  
  console.log('\n6️⃣ Common causes of self-conversation:\n');
  console.log('1. Agent seeing its own previous responses in conversation history');
  console.log('2. Multiple tool calls generating multiple responses');
  console.log('3. Incorrect message filtering (not distinguishing human vs AI messages)');
  console.log('4. State management issues causing message duplication');
  console.log('5. Tool response being interpreted as user input');
}

process.env.SKIP_ENV_VALIDATION = 'true';
debugSelfConversation().catch(console.error);