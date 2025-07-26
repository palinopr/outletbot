// Test the updated webhook handler with proper state management
import { graph } from '../agents/webhookHandler.js';
import { HumanMessage } from '@langchain/core/messages';
import dotenv from 'dotenv';

dotenv.config();

async function testWebhookHandler() {
  console.log('Testing updated webhook handler with proper state management...\n');
  
  // Test data - webhook only sends phone, message, and contactId
  const webhookData = {
    phone: '+12103593819',
    message: 'hola',
    contactId: '8eSdb9ZDsXDem9wlED9u' // The real contact ID from our tests
  };
  
  try {
    // Prepare input following MessagesAnnotation pattern
    const input = {
      messages: [new HumanMessage({
        content: JSON.stringify(webhookData)
      })],
      contactId: webhookData.contactId,
      phone: webhookData.phone
    };
    
    console.log('Invoking webhook handler with:', {
      contactId: webhookData.contactId,
      phone: webhookData.phone,
      message: webhookData.message
    });
    
    // Invoke the graph with proper configuration
    const result = await graph.invoke(input, {
      configurable: {
        contactId: webhookData.contactId,
        phone: webhookData.phone
      },
      recursionLimit: 30
    });
    
    console.log('\n✅ Webhook handler completed successfully');
    console.log('Result state:', {
      messageCount: result.messages?.length,
      contactId: result.contactId,
      phone: result.phone,
      leadInfo: result.leadInfo
    });
    
    // Display the last message (AI response)
    if (result.messages?.length > 0) {
      const lastMessage = result.messages[result.messages.length - 1];
      console.log('\nLast message:', lastMessage);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testWebhookHandler();