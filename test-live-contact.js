import { graph } from './agents/webhookHandler.js';
import { config } from 'dotenv';

config();

console.log('🚀 TESTING WITH LIVE GHL CONTACT');
console.log('================================\n');

console.log('Contact URL: https://app.gohighlevel.com/v2/location/sHFG9Rw6BdGh6d6bfMqG/contacts/detail/54sJIGTtwmR89Qc5JeEt');
console.log('Contact ID: 54sJIGTtwmR89Qc5JeEt\n');

async function testLiveContact() {
  // Real contact data
  const livePayload = {
    phone: '+14085551234', // Using standard format
    message: 'Hola, me interesa información sobre marketing digital',
    contactId: '54sJIGTtwmR89Qc5JeEt' // Real contact from GHL
  };
  
  console.log('📨 Live Test Payload:');
  console.log(JSON.stringify(livePayload, null, 2));
  console.log('\n');
  
  // Create webhook state
  const initialState = {
    messages: [{
      role: 'human',
      content: JSON.stringify(livePayload)
    }],
    contactId: livePayload.contactId,
    phone: livePayload.phone
  };
  
  console.log('⏱️  Starting test with timeout protections...\n');
  const startTime = Date.now();
  
  try {
    // Set overall timeout for the test
    const testTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Test timeout after 20 seconds')), 20000);
    });
    
    // Run the webhook
    const result = await Promise.race([
      graph.invoke(initialState, {
        configurable: {
          features: {
            enableDeduplication: false // Disable for testing
          }
        },
        runId: `live-test-${Date.now()}`
      }),
      testTimeout
    ]);
    
    const duration = Date.now() - startTime;
    
    console.log('✅ WEBHOOK COMPLETED SUCCESSFULLY!');
    console.log(`Total time: ${duration}ms\n`);
    
    console.log('📊 RESULTS:');
    console.log('- Total messages:', result.messages?.length || 0);
    console.log('- Contact ID:', result.contactId);
    console.log('- Phone:', result.phone);
    
    if (result.leadInfo) {
      console.log('\n👤 Lead Information:');
      Object.entries(result.leadInfo).forEach(([key, value]) => {
        if (value) console.log(`- ${key}: ${value}`);
      });
    }
    
    if (result.messages && result.messages.length > initialState.messages.length) {
      const responseMessages = result.messages.slice(initialState.messages.length);
      console.log(`\n💬 Bot Responses (${responseMessages.length}):`);
      responseMessages.forEach((msg, i) => {
        console.log(`\n${i + 1}. ${msg.constructor.name}:`);
        console.log(msg.content);
      });
    }
    
    console.log('\n✅ SUCCESS! The webhook is working correctly with live data.');
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error(`\n❌ WEBHOOK FAILED after ${duration}ms`);
    console.error(`Error: ${error.message}`);
    
    // Analyze where it failed based on timing
    if (duration < 3500) {
      console.error('\n🔍 Failed during: SERVICE INITIALIZATION');
      console.error('- GHL service creation timeout (3s)');
      console.error('- Check GHL_API_KEY and GHL_LOCATION_ID');
    } else if (duration < 5500) {
      console.error('\n🔍 Failed during: CONVERSATION FETCH');
      console.error('- GHL API timeout fetching conversation (5s)');
      console.error('- Check if contact exists in GHL');
      console.error('- Check GHL API rate limits');
    } else if (duration < 11000) {
      console.error('\n🔍 Failed during: AGENT PROCESSING');
      console.error('- LLM timeout (10s)');
      console.error('- Check OPENAI_API_KEY');
      console.error('- Check OpenAI API status');
    } else {
      console.error('\n🔍 Failed during: OVERALL TIMEOUT');
      console.error('- Total processing exceeded 20s');
    }
    
    if (error.message.includes('Circuit breaker')) {
      console.error('\n🚫 CIRCUIT BREAKER IS OPEN');
      console.error('- Too many recent failures');
      console.error('- Wait 1 minute before retrying');
    }
    
    console.error('\nStack trace:', error.stack);
  }
  
  console.log('\n📋 TIMEOUT CONFIGURATION:');
  console.log('- Initialization: 3 seconds');
  console.log('- Conversation: 5 seconds');
  console.log('- LLM calls: 10 seconds');
  console.log('- Circuit breaker: 3 failures → 1 min cooldown');
}

// Check environment
console.log('🔍 Environment Check:');
console.log('- GHL_API_KEY:', process.env.GHL_API_KEY ? '✅ Set' : '❌ Missing');
console.log('- GHL_LOCATION_ID:', process.env.GHL_LOCATION_ID ? '✅ Set' : '❌ Missing');
console.log('- GHL_CALENDAR_ID:', process.env.GHL_CALENDAR_ID ? '✅ Set' : '❌ Missing');
console.log('- OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing');
console.log('- LOG_LEVEL:', process.env.LOG_LEVEL || 'info');
console.log('\n');

// Run the test
testLiveContact().catch(console.error);