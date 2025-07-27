#!/usr/bin/env node
/**
 * Test all scenarios with real GHL contact and webhook handler
 * This simulates actual webhook calls as they would come from GHL
 */

import { config as dotenvConfig } from 'dotenv';
import { graph as webhookHandler } from './agents/webhookHandler.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { GHLService } from './services/ghlService.js';

dotenvConfig();

// Enable tracing
process.env.LANGSMITH_TRACING = 'true';
process.env.LANGSMITH_PROJECT = 'real-webhook-test';

const ghlService = new GHLService(
  process.env.GHL_API_KEY,  
  process.env.GHL_LOCATION_ID
);

// Real test contact ID from GHL
const REAL_CONTACT_ID = 'ym8G7K6GSzm8dJDZ6BNo'; // Jaime's contact
const REAL_PHONE = '(305) 487-0475';

async function simulateWebhook(scenario, webhookPayload, existingMessages = []) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📱 Testing: ${scenario}`);
  console.log(`Contact: ${REAL_CONTACT_ID}`);
  console.log(`Webhook: ${JSON.stringify(webhookPayload)}`);
  console.log(`${'='.repeat(70)}`);
  
  try {
    // Create initial state as the webhook would receive it
    const initialState = {
      messages: [
        ...existingMessages,
        new HumanMessage(JSON.stringify(webhookPayload))
      ],
      contactId: webhookPayload.contactId,
      phone: webhookPayload.phone
    };
    
    console.log('📨 Initial state:', {
      messageCount: initialState.messages.length,
      lastMessage: initialState.messages[initialState.messages.length - 1].content
    });
    
    // Invoke webhook handler
    const startTime = Date.now();
    const result = await webhookHandler.invoke(initialState, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        thread_id: `webhook-test-${Date.now()}`
      },
      recursionLimit: 20
    });
    
    const duration = Date.now() - startTime;
    
    // Analyze results
    console.log(`\n✅ Webhook processed in ${(duration / 1000).toFixed(2)}s`);
    
    // Check if any messages were sent
    const messagesSent = result.messages?.filter(m => 
      m.role === 'assistant' || m._getType?.() === 'ai'
    ).length || 0;
    
    console.log(`📤 Messages sent: ${messagesSent}`);
    
    // Check lead info
    if (result.leadInfo) {
      console.log('📋 Lead info collected:', JSON.stringify(result.leadInfo, null, 2));
    }
    
    // Look for the actual response sent to customer
    const lastAiMessage = result.messages?.filter(m => 
      m._getType?.() === 'ai' || m.role === 'assistant'
    ).pop();
    
    if (lastAiMessage) {
      console.log('💬 Response to customer:', lastAiMessage.content?.substring(0, 150) + '...');
    } else {
      console.log('❌ No response generated');
    }
    
    return {
      success: true,
      duration,
      messagesSent,
      leadInfo: result.leadInfo,
      response: lastAiMessage?.content
    };
    
  } catch (error) {
    console.log('❌ Error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

async function runAllScenarios() {
  console.log('🚀 REAL WEBHOOK INTEGRATION TEST');
  console.log('Testing with actual GHL contact and webhook handler\n');
  
  const results = [];
  
  // Scenario 1: Simple greeting
  results.push(await simulateWebhook(
    'Simple Greeting',
    {
      phone: REAL_PHONE,
      message: 'Hola',
      contactId: REAL_CONTACT_ID
    }
  ));
  
  // Wait a bit between tests
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Scenario 2: Name introduction
  results.push(await simulateWebhook(
    'Name Introduction',
    {
      phone: REAL_PHONE,
      message: 'Soy Carlos',
      contactId: REAL_CONTACT_ID
    }
  ));
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Scenario 3: Complex message
  results.push(await simulateWebhook(
    'Complex Message',
    {
      phone: REAL_PHONE,
      message: 'Hola, soy Maria, tengo una tienda online y no vendo nada',
      contactId: REAL_CONTACT_ID
    }
  ));
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Scenario 4: Si confirmation (with context)
  const aiQuestion = new AIMessage('¿Tu presupuesto mensual es de $600?');
  results.push(await simulateWebhook(
    'Si Confirmation',
    {
      phone: REAL_PHONE,
      message: 'si',
      contactId: REAL_CONTACT_ID
    },
    [new HumanMessage('Soy Pedro'), aiQuestion]
  ));
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Scenario 5: All response
  const aiContext = new AIMessage('¿Cuál es el problema con tu negocio? ¿Qué resultado te gustaría lograr?');
  results.push(await simulateWebhook(
    'All Response',
    {
      phone: REAL_PHONE,
      message: 'all',
      contactId: REAL_CONTACT_ID
    },
    [new HumanMessage('Carlos'), aiContext]
  ));
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Scenario 6: Full qualification
  results.push(await simulateWebhook(
    'Full Qualification',
    {
      phone: REAL_PHONE,
      message: 'Hola, soy Roberto, tengo un restaurante, no tengo clientes, quiero llenar el lugar, mi presupuesto es $800, mi email es roberto@test.com',
      contactId: REAL_CONTACT_ID
    }
  ));
  
  // Summary
  console.log(`\n\n${'='.repeat(70)}`);
  console.log('📊 TEST SUMMARY');
  console.log(`${'='.repeat(70)}`);
  
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`\nTotal scenarios: ${total}`);
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${total - successful}`);
  console.log(`Success rate: ${((successful / total) * 100).toFixed(1)}%`);
  
  console.log('\nDetailed results:');
  results.forEach((result, idx) => {
    const scenarios = [
      'Simple Greeting',
      'Name Introduction', 
      'Complex Message',
      'Si Confirmation',
      'All Response',
      'Full Qualification'
    ];
    
    console.log(`\n${scenarios[idx]}:`);
    console.log(`  Status: ${result.success ? '✅' : '❌'}`);
    if (result.success) {
      console.log(`  Duration: ${(result.duration / 1000).toFixed(2)}s`);
      console.log(`  Messages sent: ${result.messagesSent}`);
      console.log(`  Lead info: ${result.leadInfo ? Object.keys(result.leadInfo).filter(k => result.leadInfo[k]).join(', ') : 'none'}`);
    } else {
      console.log(`  Error: ${result.error}`);
    }
  });
  
  // Check actual GHL contact
  console.log('\n📱 Checking GHL contact for updates...');
  try {
    const contact = await ghlService.getContact(REAL_CONTACT_ID);
    console.log('Contact name:', contact.firstName || contact.name || 'Not set');
    console.log('Tags:', contact.tags?.join(', ') || 'None');
    
    // Get recent messages
    const messages = await ghlService.getConversationMessages(contact.lastMessageBody?.conversationId);
    if (messages && messages.length > 0) {
      console.log(`Recent messages: ${messages.length}`);
      const lastMessage = messages[0];
      console.log(`Last message: ${lastMessage.body?.substring(0, 100)}...`);
    }
  } catch (error) {
    console.log('Could not fetch GHL contact:', error.message);
  }
  
  console.log('\n✅ Test complete!');
  console.log('Check LangSmith for detailed traces:', `https://smith.langchain.com/projects/${process.env.LANGSMITH_PROJECT}`);
}

runAllScenarios().catch(console.error);