#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

// Test the final fix
console.log('Testing final fix for production webhook...\n');

import { graph } from './agents/webhookHandler.js';

const webhookPayload = {
  phone: '+13054870475',
  message: 'Hola, soy Carlos',
  contactId: '54sJIGTtwmR89Qc5JeEt'
};

try {
  console.log('Invoking webhook handler...');
  const result = await graph.invoke({
    messages: [{
      role: 'human',
      content: JSON.stringify(webhookPayload)
    }]
  }, {
    runId: crypto.randomUUID()
  });
  
  console.log('\n✅ SUCCESS! Webhook completed without error');
  console.log('Last message:', result.messages?.[result.messages.length - 1]?.content);
  
  // Check if the error message was returned
  const lastMessage = result.messages?.[result.messages.length - 1]?.content;
  if (lastMessage && lastMessage.includes('Lo siento, hubo un error')) {
    console.error('\n❌ ERROR: Still returning error message to user!');
  } else {
    console.log('\n✅ No error message returned to user - fix working!');
  }
  
} catch (error) {
  console.error('\n❌ Uncaught error:', error.message);
}