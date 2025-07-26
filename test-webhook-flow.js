#!/usr/bin/env node
import 'dotenv/config';
import { graph } from './agents/webhookHandler.js';
import { HumanMessage } from '@langchain/core/messages';

console.log('🧪 Testing Webhook Flow\n');

// Test payload matching the trace
const webhookPayload = {
  phone: "(305) 487-0475",
  message: "hola",
  contactId: "xbYIVSoDqF1g6l20SXHs"
};

async function testWebhookFlow() {
  try {
    console.log('1️⃣ Testing with JSON webhook payload...');
    
    // Create initial state with webhook payload as JSON string
    const initialState = {
      messages: [
        new HumanMessage(JSON.stringify(webhookPayload))
      ]
    };
    
    console.log('📥 Input:', JSON.stringify(initialState, null, 2));
    
    // Invoke the webhook handler graph
    const result = await graph.invoke(initialState, {
      configurable: {
        ghlService: {
          // Mock GHL service to see if it gets called
          sendSMS: async (contactId, message) => {
            console.log('✅ GHL sendSMS called!');
            console.log(`   Contact: ${contactId}`);
            console.log(`   Message: ${message}`);
            return { success: true, messageId: 'test-123' };
          }
        },
        calendarId: 'test-calendar',
        features: {
          enableDeduplication: true
        }
      },
      recursionLimit: 25
    });
    
    console.log('\n📤 Output:');
    console.log(`   Messages: ${result.messages.length}`);
    result.messages.forEach((msg, i) => {
      console.log(`   [${i}] ${msg.constructor.name}: ${msg.content?.substring(0, 100)}...`);
    });
    
    // Check if duplicate message issue exists
    const duplicates = result.messages.filter((msg, index) => 
      result.messages.findIndex(m => 
        m.content === msg.content && m.constructor.name === msg.constructor.name
      ) !== index
    );
    
    if (duplicates.length > 0) {
      console.log(`\n⚠️  Found ${duplicates.length} duplicate messages!`);
    } else {
      console.log('\n✅ No duplicate messages');
    }
    
  } catch (error) {
    console.error('\n❌ Error in webhook flow:', error.message);
    console.error('Stack:', error.stack);
    
    // Check specific error types
    if (error.message.includes('Missing required fields')) {
      console.log('\n🔍 Webhook validation failed - missing required fields');
    } else if (error.message.includes('Invalid webhook payload')) {
      console.log('\n🔍 Webhook payload parsing failed');
    } else if (error.message.includes('initialize')) {
      console.log('\n🔍 Service initialization failed');
      console.log('   Make sure GHL_API_KEY and GHL_LOCATION_ID are set');
    }
  }
}

// Test 2: Direct message format
async function testDirectMessage() {
  console.log('\n\n2️⃣ Testing with direct message format...');
  
  try {
    const initialState = {
      messages: [
        new HumanMessage("hola")
      ],
      contactId: "xbYIVSoDqF1g6l20SXHs",
      phone: "(305) 487-0475"
    };
    
    const result = await graph.invoke(initialState, {
      configurable: {
        ghlService: {
          sendSMS: async (contactId, message) => {
            console.log('✅ GHL sendSMS called!');
            console.log(`   Contact: ${contactId}`);
            console.log(`   Message: ${message}`);
            return { success: true };
          }
        },
        contactId: "xbYIVSoDqF1g6l20SXHs",
        phone: "(305) 487-0475"
      }
    });
    
    console.log('✅ Direct message test passed');
    
  } catch (error) {
    console.error('❌ Direct message test failed:', error.message);
  }
}

// Run tests
async function runTests() {
  await testWebhookFlow();
  await testDirectMessage();
  
  console.log('\n📊 Test Summary:');
  console.log('- Check if GHL sendSMS was called');
  console.log('- Check for duplicate messages');
  console.log('- Check for proper error handling');
}

runTests().catch(console.error);