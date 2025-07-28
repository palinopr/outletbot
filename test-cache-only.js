import dotenv from 'dotenv';
import { graph as webhookHandler } from './agents/webhookHandler.js';
import { HumanMessage } from '@langchain/core/messages';

dotenv.config();

async function testCache() {
  console.log('Testing cache functionality...\n');
  
  const testContactId = 'cache_test_' + Date.now();
  const testConversationId = 'conv_cache_' + Date.now();
  
  console.log('First call (should process):');
  const firstResult = await webhookHandler.invoke({
    messages: [new HumanMessage('hola')],
    contactId: testContactId,
    conversationId: testConversationId,
    phone: '(305) 555-0001',
    threadId: testConversationId
  }, {
    configurable: {
      thread_id: testConversationId,
      contactId: testContactId
    }
  });
  
  console.log('First result:', {
    cached: firstResult.cached,
    hasCachedFlag: 'cached' in firstResult,
    keys: Object.keys(firstResult)
  });
  
  console.log('\nSecond call (should be cached):');
  const secondResult = await webhookHandler.invoke({
    messages: [new HumanMessage('hola')],
    contactId: testContactId,
    conversationId: testConversationId,
    phone: '(305) 555-0001',
    threadId: testConversationId
  }, {
    configurable: {
      thread_id: testConversationId,
      contactId: testContactId
    }
  });
  
  console.log('Second result:', {
    cached: secondResult.cached,
    hasCachedFlag: 'cached' in secondResult,
    keys: Object.keys(secondResult)
  });
}

testCache().catch(console.error);
