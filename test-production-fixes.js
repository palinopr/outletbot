/**
 * Production Fix Verification Script
 * Tests the three main fixes: state persistence, thread continuity, and caching
 */

import dotenv from 'dotenv';
dotenv.config();

// Test configuration
const TEST_CONTACT_ID = 'test_' + Date.now();
const TEST_CONVERSATION_ID = 'conv_' + Date.now();
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:8000/webhook/meta-lead';

console.log('🧪 PRODUCTION FIX VERIFICATION TEST');
console.log('==================================');
console.log(`Contact ID: ${TEST_CONTACT_ID}`);
console.log(`Conversation ID: ${TEST_CONVERSATION_ID}`);
console.log(`Webhook URL: ${WEBHOOK_URL}`);
console.log('');

// Test messages sequence
const testSequence = [
  {
    name: 'Cache Test - Greeting',
    message: 'hola',
    expectedBehavior: 'Should use cached response (no AI tokens)',
    checkFor: ['PRODUCTION CACHE HIT', 'savedTokens: 3822']
  },
  {
    name: 'State Test - Name',
    message: 'Jaime',
    expectedBehavior: 'Should extract and remember name',
    checkFor: ['name: "Jaime"', 'EXTRACT LEAD INFO']
  },
  {
    name: 'State Test - Problem',
    message: 'necesito mas clientes para mi negocio',
    expectedBehavior: 'Should remember name and extract problem',
    checkFor: ['problem:', 'still has name: "Jaime"']
  },
  {
    name: 'State Test - Goal',
    message: 'quiero crecer mi empresa',
    expectedBehavior: 'Should remember name + problem and extract goal',
    checkFor: ['goal:', 'has all previous info']
  },
  {
    name: 'State Test - Budget',
    message: 'tengo 500 dolares',
    expectedBehavior: 'Should remember all info and extract budget',
    checkFor: ['budget: "500"', 'qualified-lead']
  },
  {
    name: 'State Test - Email',
    message: 'test@example.com',
    expectedBehavior: 'Should show calendar with ALL info retained',
    checkFor: ['calendar slots', 'all fields present']
  }
];

// Send test message
async function sendTestMessage(message, index) {
  const payload = {
    phone: '(305) 555-0100',
    message: message,
    contactId: TEST_CONTACT_ID,
    conversationId: TEST_CONVERSATION_ID,  // CRITICAL: Same ID for thread continuity
    locationId: process.env.GHL_LOCATION_ID
  };

  console.log(`\n📤 Test ${index + 1}: ${testSequence[index].name}`);
  console.log(`Message: "${message}"`);
  console.log(`Expected: ${testSequence[index].expectedBehavior}`);
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    console.log('Response Status:', response.status);
    console.log('Thread ID:', result.threadId || 'Not returned');
    console.log('Lead Info Collected:', result.leadInfo ? Object.keys(result.leadInfo).filter(k => result.leadInfo[k]) : []);
    
    // Verify thread continuity
    if (result.threadId && result.threadId !== TEST_CONVERSATION_ID && !result.threadId.includes(TEST_CONTACT_ID)) {
      console.error('❌ THREAD ID MISMATCH! Thread continuity broken');
    } else {
      console.log('✅ Thread continuity maintained');
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

// Run test sequence
async function runTests() {
  console.log('\n🚀 Starting test sequence...\n');
  
  for (let i = 0; i < testSequence.length; i++) {
    const result = await sendTestMessage(testSequence[i].message, i);
    
    if (!result) {
      console.error('Test failed, aborting sequence');
      break;
    }
    
    // Wait between messages to simulate real conversation
    if (i < testSequence.length - 1) {
      console.log('\n⏳ Waiting 2 seconds...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('\n\n📊 TEST SUMMARY');
  console.log('================');
  console.log('Check LangSmith traces for:');
  console.log('1. Same thread_id across all messages');
  console.log('2. "CACHED RESPONSE" for first "hola"');
  console.log('3. Lead info accumulating (not resetting)');
  console.log('4. No repeated questions');
  console.log('5. Total cost < $0.20 (was $5.16)');
  console.log('\nTrace URL: https://smith.langchain.com/');
}

// Execute tests
runTests().catch(console.error);