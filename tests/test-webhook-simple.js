#!/usr/bin/env node
/**
 * Simple test for webhook handler
 */

import 'dotenv/config';
import { graph } from '../agents/webhookHandler.js';
import { HumanMessage } from '@langchain/core/messages';

console.log('🧪 Simple Webhook Test\n');

async function testSimpleWebhook() {
  const webhookPayload = {
    phone: '+12145551234',
    message: 'hola',
    contactId: 'test-contact-001'
  };
  
  const input = {
    messages: [new HumanMessage(JSON.stringify(webhookPayload))],
    contactId: 'test-contact-001',
    phone: '+12145551234'
  };
  
  try {
    console.log('Invoking webhook handler...');
    const result = await graph.invoke(input);
    
    console.log('\nResult:', JSON.stringify(result, null, 2));
    
    if (result.messages && result.messages.length > 0) {
      console.log('\n✅ Success - Got messages back');
      const assistantMessages = result.messages.filter(m => m.role === 'assistant');
      console.log(`Found ${assistantMessages.length} assistant messages`);
      
      if (assistantMessages.length > 0) {
        console.log('\nLast assistant message:');
        console.log(assistantMessages[assistantMessages.length - 1].content);
      }
    } else {
      console.log('\n❌ No messages returned');
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

testSimpleWebhook();