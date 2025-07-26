#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

// Test the exact production webhook flow
console.log('Testing production webhook with exact GHL format...\n');

// Test 1: Direct webhook handler (what GHL sends)
console.log('1. Testing direct webhook handler:');
const webhookPayload = {
  phone: '+13054870475',
  message: 'Hola, soy Carlos',
  contactId: '54sJIGTtwmR89Qc5JeEt'
};

console.log('Webhook payload:', JSON.stringify(webhookPayload, null, 2));

// Test 2: Show what the webhook expects
console.log('\n2. What LangGraph receives:');
const langGraphPayload = {
  assistant_id: 'webhook_handler',
  input: {
    messages: [{
      role: 'human',
      content: JSON.stringify(webhookPayload)
    }]
  }
};

console.log('LangGraph payload:', JSON.stringify(langGraphPayload, null, 2));

// Test 3: Show the curl command
console.log('\n3. Curl command to test:');
const curlCommand = `curl -X POST https://outletbot-a6387ef666a552b8ada595998ba395ea.us.langgraph.app/runs/stream \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: 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" \\
  -d '${JSON.stringify(langGraphPayload)}'`;

console.log(curlCommand);

// Test 4: Test locally
console.log('\n4. Testing locally...');
import { graph } from './agents/webhookHandler.js';

try {
  const result = await graph.invoke({
    messages: [{
      role: 'human',
      content: JSON.stringify(webhookPayload)
    }]
  }, {
    runId: 'test-' + Date.now()
  });
  
  console.log('\n✅ Local test passed!');
  console.log('Response:', result.messages[result.messages.length - 1].content);
} catch (error) {
  console.error('\n❌ Local test failed:', error.message);
  console.error('Stack:', error.stack);
}