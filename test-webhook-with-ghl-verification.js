#!/usr/bin/env node
/**
 * Test webhook flow and verify messages are sent to GHL
 */

import { config as dotenvConfig } from 'dotenv';
import { graph as webhookHandler } from './agents/webhookHandler.js';
import { HumanMessage } from '@langchain/core/messages';
import { GHLService } from './services/ghlService.js';

dotenvConfig();

// Enable detailed logging
process.env.LANGSMITH_TRACING = 'true';
process.env.LANGSMITH_PROJECT = 'webhook-ghl-verification';

const ghlService = new GHLService(
  process.env.GHL_API_KEY,  
  process.env.GHL_LOCATION_ID
);

const REAL_CONTACT_ID = 'ym8G7K6GSzm8dJDZ6BNo';
const REAL_PHONE = '(305) 487-0475';

async function getMessageCount(conversationId) {
  const messages = await ghlService.getConversationMessages(conversationId);
  const outbound = messages?.filter(m => m.direction === 'outbound').length || 0;
  return { total: messages?.length || 0, outbound };
}

async function testScenarioWithVerification(name, webhookPayload) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📱 Testing: ${name}`);
  console.log(`${'='.repeat(70)}`);
  
  try {
    // Get conversation ID
    const conversations = await ghlService.client.get('/conversations/search', {
      params: {
        locationId: process.env.GHL_LOCATION_ID,
        q: REAL_PHONE.replace(/\D/g, '')
      }
    });
    
    const conversationId = conversations.data.conversations?.[0]?.id;
    if (!conversationId) {
      console.log('❌ No conversation found');
      return { success: false, error: 'No conversation' };
    }
    
    // Get message count before
    const beforeCount = await getMessageCount(conversationId);
    console.log(`📊 Messages before: Total=${beforeCount.total}, Outbound=${beforeCount.outbound}`);
    
    // Create webhook state
    const initialState = {
      messages: [new HumanMessage(JSON.stringify(webhookPayload))],
      contactId: webhookPayload.contactId,
      phone: webhookPayload.phone
    };
    
    // Invoke webhook handler
    console.log('🚀 Invoking webhook handler...');
    const startTime = Date.now();
    
    const result = await webhookHandler.invoke(initialState, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        thread_id: `verify-${Date.now()}`
      },
      recursionLimit: 20
    });
    
    const duration = Date.now() - startTime;
    console.log(`✅ Webhook processed in ${(duration / 1000).toFixed(2)}s`);
    
    // Wait for messages to be delivered
    console.log('⏳ Waiting for message delivery...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get message count after
    const afterCount = await getMessageCount(conversationId);
    console.log(`📊 Messages after: Total=${afterCount.total}, Outbound=${afterCount.outbound}`);
    
    // Calculate new messages
    const newMessages = afterCount.outbound - beforeCount.outbound;
    console.log(`📤 New messages sent to GHL: ${newMessages}`);
    
    // Verify specific message was sent
    if (newMessages > 0) {
      const messages = await ghlService.getConversationMessages(conversationId);
      const latestOutbound = messages
        .filter(m => m.direction === 'outbound')
        .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))[0];
      
      console.log('✅ Latest message sent:');
      console.log(`   Time: ${new Date(latestOutbound.dateAdded).toLocaleTimeString()}`);
      console.log(`   Body: ${latestOutbound.body?.substring(0, 100)}...`);
      console.log(`   Type: ${latestOutbound.type}`);
      console.log(`   Status: ${latestOutbound.status}`);
    } else {
      console.log('❌ No new messages sent to GHL!');
    }
    
    return {
      success: true,
      duration,
      messagesSent: newMessages,
      leadInfo: result.leadInfo
    };
    
  } catch (error) {
    console.log('❌ Error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

async function runVerificationTests() {
  console.log('🧪 WEBHOOK TO GHL VERIFICATION TEST');
  console.log('This test verifies messages are actually sent to GHL\n');
  
  // Clean up conversation first
  console.log('🧹 Cleaning up test conversation...');
  try {
    // Note: GHL API doesn't have a delete messages endpoint, so we'll just note the current state
    console.log('Note: Starting fresh test sequence\n');
  } catch (e) {
    // Ignore cleanup errors
  }
  
  const results = [];
  
  // Test 1: Simple greeting
  results.push(await testScenarioWithVerification(
    'Simple Greeting - Should send welcome message',
    {
      phone: REAL_PHONE,
      message: 'Hola test ' + Date.now(),
      contactId: REAL_CONTACT_ID
    }
  ));
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Test 2: Name introduction
  results.push(await testScenarioWithVerification(
    'Name Introduction - Should ask about problem',
    {
      phone: REAL_PHONE,
      message: 'Soy TestUser' + Date.now(),
      contactId: REAL_CONTACT_ID
    }
  ));
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Test 3: Full qualification
  results.push(await testScenarioWithVerification(
    'Full Qualification - Should show calendar',
    {
      phone: REAL_PHONE,
      message: 'Soy Maria, tengo tienda, no vendo, quiero vender mas, $500 mensual, maria@test.com',
      contactId: REAL_CONTACT_ID
    }
  ));
  
  // Summary
  console.log(`\n\n${'='.repeat(70)}`);
  console.log('📊 VERIFICATION SUMMARY');
  console.log(`${'='.repeat(70)}`);
  
  let totalMessagesSent = 0;
  results.forEach((result, idx) => {
    const scenarios = ['Simple Greeting', 'Name Introduction', 'Full Qualification'];
    console.log(`\n${scenarios[idx]}:`);
    console.log(`  Status: ${result.success ? '✅' : '❌'}`);
    if (result.success) {
      console.log(`  Messages sent to GHL: ${result.messagesSent}`);
      console.log(`  Duration: ${(result.duration / 1000).toFixed(2)}s`);
      totalMessagesSent += result.messagesSent;
    } else {
      console.log(`  Error: ${result.error}`);
    }
  });
  
  console.log(`\n📤 Total messages sent to GHL: ${totalMessagesSent}`);
  
  if (totalMessagesSent === 0) {
    console.log('\n❌ CRITICAL: No messages are being sent to GHL!');
    console.log('The webhook handler is processing but not sending messages.');
  } else {
    console.log('\n✅ Messages are being sent to GHL successfully!');
  }
}

runVerificationTests().catch(console.error);