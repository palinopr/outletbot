#!/usr/bin/env node
/**
 * Simple single message test to debug issues
 */

import { config as dotenvConfig } from 'dotenv';
import { graph as webhookHandler } from './agents/webhookHandler.js';
import { HumanMessage } from '@langchain/core/messages';

// Load environment variables
dotenvConfig();

// Enable tracing
process.env.LANGSMITH_TRACING = 'true';

async function testSingleMessage() {
  console.log('Testing single message...\n');
  
  const webhookPayload = {
    phone: '+1234567890',
    message: 'Hola',
    contactId: 'test-' + Date.now(),
    conversationId: 'conv-' + Date.now()
  };
  
  console.log('Webhook payload:', webhookPayload);
  
  const state = {
    messages: [new HumanMessage(JSON.stringify(webhookPayload))],
    contactId: webhookPayload.contactId,
    phone: webhookPayload.phone
  };
  
  try {
    console.log('\nInvoking webhook handler...');
    const result = await webhookHandler.invoke(state, {
      configurable: {
        thread_id: webhookPayload.conversationId
      }
    });
    
    console.log('\nResult:');
    console.log('- Success: true');
    console.log('- Messages returned:', result.messages?.length || 0);
    console.log('- Lead info:', JSON.stringify(result.leadInfo || {}));
    console.log('- Contact ID:', result.contactId);
    
    // Find AI response
    const aiMessage = result.messages?.find(m => 
      m._getType?.() === 'ai' || m.type === 'ai' || m._type === 'ai'
    );
    
    if (aiMessage) {
      console.log('\nAI Response:', aiMessage.content);
    } else {
      console.log('\nNo AI response found');
    }
    
  } catch (error) {
    console.error('\nError:', error.message);
    console.error(error.stack);
  }
}

testSingleMessage();