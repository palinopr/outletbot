#!/usr/bin/env node
/**
 * Quick validation test for webhook handler
 */

import 'dotenv/config';
import { graph } from '../agents/webhookHandler.js';
import { HumanMessage } from '@langchain/core/messages';

console.log('🧪 Webhook Validation Test\n');

// Color codes
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

async function testValidPayload() {
  console.log('1. Testing valid webhook payload...');
  
  const validPayload = {
    phone: '+12145551234',
    message: 'test message',
    contactId: 'test-contact-001'
  };
  
  const input = {
    messages: [new HumanMessage(JSON.stringify(validPayload))],
    contactId: 'test-contact-001',
    phone: '+12145551234'
  };
  
  try {
    const result = await graph.invoke(input);
    if (result.messages && result.messages.length > 0) {
      console.log(`${GREEN}✓ Valid payload accepted${RESET}`);
      return { name: 'Valid Payload', status: 'pass' };
    } else {
      console.log(`${RED}✗ No response from valid payload${RESET}`);
      return { name: 'Valid Payload', status: 'fail', error: 'No response' };
    }
  } catch (error) {
    console.log(`${RED}✗ Valid payload rejected: ${error.message}${RESET}`);
    return { name: 'Valid Payload', status: 'fail', error: error.message };
  }
}

async function testInvalidPayload() {
  console.log('\n2. Testing invalid webhook payload...');
  
  const invalidPayload = {
    message: 'test message'
    // Missing phone and contactId
  };
  
  const input = {
    messages: [new HumanMessage(JSON.stringify(invalidPayload))]
  };
  
  try {
    const result = await graph.invoke(input);
    
    // Check if error message was returned
    const lastMessage = result.messages?.[result.messages.length - 1];
    const content = lastMessage?.content || lastMessage?.kwargs?.content || '';
    
    if (content.includes('error procesando') || content.includes('intenta de nuevo')) {
      console.log(`${GREEN}✓ Invalid payload handled with error message${RESET}`);
      return { name: 'Invalid Payload', status: 'pass' };
    } else {
      console.log(`${RED}✗ Invalid payload was not rejected properly${RESET}`);
      console.log(`  Response: "${content}"`);
      return { name: 'Invalid Payload', status: 'fail', error: 'No error message' };
    }
  } catch (error) {
    console.log(`${RED}✗ Unexpected error: ${error.message}${RESET}`);
    return { name: 'Invalid Payload', status: 'fail', error: error.message };
  }
}

async function main() {
  const results = [];
  
  results.push(await testValidPayload());
  results.push(await testInvalidPayload());
  
  console.log('\n--- Summary ---');
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  
  console.log(`Total: ${results.length}`);
  console.log(`${GREEN}Passed: ${passed}${RESET}`);
  console.log(`${RED}Failed: ${failed}${RESET}`);
  
  process.exit(failed > 0 ? 1 : 0);
}

main();