import { graph } from './agents/webhookHandler.js';
import { HumanMessage } from '@langchain/core/messages';
import dotenv from 'dotenv';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

async function testTraceError() {
  console.log('\n🔍 Testing Trace Error - 1f06a415-0081-608f-adce-537c1ffe8d2a');
  console.log('=' . repeat(80));
  
  // Replicate the exact input from the failed trace
  const webhookPayload = {
    phone: "(305) 487-0475",
    message: "Hola",
    contactId: "54sJIGTtwmR89Qc5JeEt"
  };
  
  const initialState = {
    messages: [
      new HumanMessage(JSON.stringify(webhookPayload))
    ],
    contactId: null,
    phone: null
  };
  
  try {
    console.log('\n📥 INPUT STATE:');
    console.log(JSON.stringify(initialState, null, 2));
    
    // Invoke with a trace ID for tracking
    const traceId = crypto.randomUUID();
    console.log(`\n🆔 Test Trace ID: ${traceId}`);
    
    const result = await graph.invoke(initialState, {
      runId: traceId,
      configurable: {
        features: {
          enableDeduplication: true
        }
      }
    });
    
    console.log('\n📤 RESULT:');
    console.log('- Message Count:', result.messages?.length);
    console.log('- Last Message:', result.messages?.[result.messages.length - 1]?.content);
    console.log('- Lead Info:', result.leadInfo);
    console.log('- Contact ID:', result.contactId);
    console.log('- Phone:', result.phone);
    
    // Check if it returned an error message
    const lastMessage = result.messages?.[result.messages.length - 1];
    if (lastMessage?.content?.includes('error procesando')) {
      console.log('\n❌ ERROR MESSAGE DETECTED');
      console.log('The agent returned an error message, indicating processing failure.');
    }
    
  } catch (error) {
    console.error('\n❌ ERROR OCCURRED:');
    console.error('- Message:', error.message);
    console.error('- Type:', error.name);
    console.error('- Stack:', error.stack);
    
    // Check for specific error patterns
    if (error.message.includes('Missing required fields')) {
      console.log('\n🔍 ANALYSIS: Missing required fields error');
      console.log('The webhook handler is not finding required fields in the payload.');
    }
  }
}

// Run the test
testTraceError().catch(console.error);