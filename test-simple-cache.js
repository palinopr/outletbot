import dotenv from 'dotenv';
import { graph as webhookHandler } from './agents/webhookHandler.js';
import { HumanMessage } from '@langchain/core/messages';

dotenv.config();

async function test() {
  const result = await webhookHandler.invoke({
    messages: [new HumanMessage('hola')],
    contactId: 'test123',
    phone: '(305) 555-0001'
  });
  
  console.log('Result keys:', Object.keys(result));
  console.log('Full result:', JSON.stringify(result, null, 2));
}

test().catch(console.error);
