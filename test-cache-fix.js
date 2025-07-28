import dotenv from 'dotenv';
import { graph as webhookHandler } from './agents/webhookHandler.js';
import { HumanMessage } from '@langchain/core/messages';

dotenv.config();

async function test() {
  // Test new contact - should get cached response
  const result = await webhookHandler.invoke({
    messages: [new HumanMessage('hola')],
    contactId: 'cache_' + Date.now(),
    phone: '(305) 555-0001'
  });
  
  console.log('Result:', {
    cached: result.cached,
    duplicate: result.duplicate,
    hasMessages: result.messages?.length > 0,
    keys: Object.keys(result)
  });
  
  if (result.cached) {
    console.log('✅ Cache is working\!');
  } else {
    console.log('❌ Cache not working');
  }
}

test().catch(console.error);
