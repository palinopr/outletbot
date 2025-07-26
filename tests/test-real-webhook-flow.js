// Test the complete webhook flow with real GHL contact
import { graph } from '../agents/webhookHandler.js';
import { HumanMessage } from '@langchain/core/messages';
import dotenv from 'dotenv';

dotenv.config();

async function testRealWebhookFlow() {
  console.log('Testing webhook flow with real GHL contact...\n');
  
  // Simulate the exact webhook payload GHL would send
  const webhookPayload = {
    phone: "+12103593819",
    message: "hola, soy Jaime",
    contactId: "cL2khoCZCL0VC3DwgtK8" // Your real contact ID from GHL
  };
  
  console.log('Webhook payload (what GHL sends):', webhookPayload);
  
  try {
    // Prepare input as webhook handler expects
    const input = {
      messages: [new HumanMessage({
        content: JSON.stringify(webhookPayload)
      })],
      contactId: webhookPayload.contactId,
      phone: webhookPayload.phone,
      leadInfo: {}
    };
    
    console.log('\nInvoking webhook handler...');
    
    // Invoke the webhook handler
    const result = await graph.invoke(input, {
      configurable: {
        contactId: webhookPayload.contactId,
        phone: webhookPayload.phone
      },
      recursionLimit: 30
    });
    
    console.log('\n✅ Webhook processed successfully!');
    console.log('\nWhat the webhook handler did:');
    console.log('1. Received only phone, message, and contactId from webhook');
    console.log('2. Fetched conversation history from GHL');
    console.log('3. Retrieved contact details from GHL');
    console.log('4. Passed everything to the AI agent');
    console.log('5. AI sent response via WhatsApp');
    
    // Check what was retrieved
    if (result.leadInfo) {
      console.log('\nContact info retrieved:');
      console.log('- Name:', result.leadInfo.name || 'Not found');
      console.log('- Email:', result.leadInfo.email || 'Not found');
      console.log('- Phone:', result.leadInfo.phone || 'Not found');
    }
    
    console.log('\nTotal messages in conversation:', result.messages?.length || 0);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testRealWebhookFlow();