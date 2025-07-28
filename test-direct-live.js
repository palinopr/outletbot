#!/usr/bin/env node

/**
 * Direct Live Test - Tests the sales agent directly
 */

import dotenv from 'dotenv';
dotenv.config();

import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { performance } from 'perf_hooks';

console.log('🚀 DIRECT LIVE TEST - Sales Agent');
console.log('================================\n');

// Test the sales agent directly
async function testSalesAgent() {
  console.log('📦 Loading sales agent...');
  
  try {
    const { salesAgent } = await import('./agents/salesAgent.js');
    console.log('✅ Sales agent loaded\n');
    
    // Test conversation flow
    const testConversation = [
      { role: 'user', message: 'Hola' },
      { role: 'user', message: 'Me llamo Carlos' },
      { role: 'user', message: 'Necesito más clientes para mi restaurante' },
      { role: 'user', message: 'Quiero llenar mi restaurante todos los días' },
      { role: 'user', message: 'Mi presupuesto es $800 al mes' },
      { role: 'user', message: 'carlos@mirestaurante.com' }
    ];
    
    const state = {
      messages: [],
      leadInfo: {},
      extractionCount: 0,
      processedMessages: [],
      contactId: 'test-contact-' + Date.now(),
      phone: '+1234567890',
      conversationId: 'test-conv-' + Date.now()
    };
    
    console.log('💬 Starting conversation flow:\n');
    
    for (const turn of testConversation) {
      console.log(`User: "${turn.message}"`);
      
      // Add user message
      state.messages.push(new HumanMessage(turn.message));
      
      const startTime = performance.now();
      
      try {
        // Invoke the agent
        const result = await salesAgent.invoke(state, {
          recursionLimit: 10,
          configurable: {
            thread_id: state.conversationId
          }
        });
        
        const responseTime = performance.now() - startTime;
        
        // Find the last AI message
        const lastMessage = result.messages[result.messages.length - 1];
        if (lastMessage && lastMessage.content) {
          console.log(`Bot: "${lastMessage.content}"`);
          console.log(`⏱️  Response time: ${responseTime.toFixed(2)}ms`);
          
          // Update state for next turn
          state.messages = result.messages;
          state.leadInfo = result.leadInfo || state.leadInfo;
          state.extractionCount = result.extractionCount || 0;
          state.processedMessages = result.processedMessages || [];
        }
        
        console.log('─'.repeat(50) + '\n');
        
        // Wait a bit between messages
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        if (error.stack) {
          console.error('Stack:', error.stack);
        }
        break;
      }
    }
    
    // Final state
    console.log('\n📊 Final Conversation State:');
    console.log('Lead Info:', JSON.stringify(state.leadInfo, null, 2));
    console.log('Messages:', state.messages.length);
    console.log('Extraction Count:', state.extractionCount);
    
  } catch (error) {
    console.error('❌ Failed to load sales agent:', error.message);
    process.exit(1);
  }
}

// Test GHL Service directly
async function testGHLService() {
  console.log('\n\n🔧 Testing GHL Service...\n');
  
  try {
    const { default: GHLService } = await import('./services/ghlService.js');
    const ghlService = new GHLService();
    
    // Test 1: Send message
    console.log('1. Testing WhatsApp message send...');
    try {
      const messageResult = await ghlService.sendWhatsAppMessage(
        'test-contact-123',
        'This is a test message from the live test'
      );
      console.log('✅ Message sent:', messageResult ? 'Success' : 'Failed');
    } catch (error) {
      console.log('❌ Message send error:', error.message);
    }
    
    // Test 2: Get calendar slots
    console.log('\n2. Testing calendar slots...');
    try {
      const slots = await ghlService.getAvailableSlots();
      console.log('✅ Calendar slots:', Object.keys(slots).length, 'days available');
      const firstDay = Object.keys(slots)[0];
      if (firstDay) {
        console.log('   First day:', firstDay, 'with', slots[firstDay].slots.length, 'slots');
      }
    } catch (error) {
      console.log('❌ Calendar error:', error.message);
    }
    
    // Test 3: Contact search
    console.log('\n3. Testing contact search...');
    try {
      const contact = await ghlService.searchContactByPhone('+1234567890');
      console.log('✅ Contact search:', contact ? 'Found' : 'Not found');
    } catch (error) {
      console.log('❌ Contact search error:', error.message);
    }
    
  } catch (error) {
    console.error('❌ GHL Service test failed:', error.message);
  }
}

// Test webhook handler directly
async function testWebhookHandler() {
  console.log('\n\n🌐 Testing Webhook Handler...\n');
  
  try {
    const { graph: webhookHandler } = await import('./agents/webhookHandler.js');
    
    const webhookData = {
      type: 'InboundMessage',
      locationId: process.env.GHL_LOCATION_ID,
      contactId: 'test-contact-123',
      conversationId: 'test-conv-123',
      message: 'Hello from webhook test',
      phone: '+1234567890'
    };
    
    console.log('Invoking webhook handler with:', webhookData);
    
    const startTime = performance.now();
    
    try {
      const result = await webhookHandler.invoke({
        webhookData
      }, {
        recursionLimit: 5,
        configurable: {
          thread_id: webhookData.conversationId
        }
      });
      
      const responseTime = performance.now() - startTime;
      console.log('✅ Webhook processed in', responseTime.toFixed(2) + 'ms');
      console.log('Result:', result.result);
      
    } catch (error) {
      console.error('❌ Webhook error:', error.message);
      if (error.cause) {
        console.error('Cause:', error.cause.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Webhook handler test failed:', error.message);
  }
}

// Main test runner
async function runTests() {
  // Test 1: Sales Agent
  await testSalesAgent();
  
  // Test 2: GHL Service  
  await testGHLService();
  
  // Test 3: Webhook Handler
  await testWebhookHandler();
  
  console.log('\n\n✅ All tests completed!');
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});