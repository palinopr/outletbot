import dotenv from 'dotenv';
dotenv.config();

import { graph as webhookHandler } from './agents/webhookHandler.js';
import { HumanMessage } from '@langchain/core/messages';

async function testWebhook() {
  try {
    console.log('🧪 Testing webhook handler...\n');
    
    // Test case 1: Simple greeting
    console.log('Test 1: Simple greeting "hola"');
    const state = {
      messages: [new HumanMessage('hola')],
      contactId: 'test-contact-123',
      phone: '+1234567890'
    };
    
    const result = await webhookHandler.invoke(state, {
      configurable: {
        thread_id: 'test-thread-123',
        contactId: 'test-contact-123',
        phone: '+1234567890'
      }
    });
    
    console.log('✅ Result received:');
    console.log('Messages:', result.messages.length);
    console.log('Last message:', result.messages[result.messages.length - 1]?.content);
    console.log('Cached response used:', result.cached || false);
    console.log('\n---\n');
    
    // Test case 2: Name response
    console.log('Test 2: Name response');
    const state2 = {
      messages: [new HumanMessage('Jaime')],
      contactId: 'test-contact-123',
      phone: '+1234567890'
    };
    
    const result2 = await webhookHandler.invoke(state2, {
      configurable: {
        thread_id: 'test-thread-123',
        contactId: 'test-contact-123',
        phone: '+1234567890'
      }
    });
    
    console.log('✅ Result received:');
    console.log('Messages:', result2.messages.length);
    console.log('Last message:', result2.messages[result2.messages.length - 1]?.content?.substring(0, 100) + '...');
    console.log('Lead info updated:', result2.leadInfo);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testWebhook();