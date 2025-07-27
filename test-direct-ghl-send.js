#!/usr/bin/env node
/**
 * Test sending message directly to GHL
 */

import { config as dotenvConfig } from 'dotenv';
import { GHLService } from './services/ghlService.js';

dotenvConfig();

const ghlService = new GHLService(
  process.env.GHL_API_KEY,  
  process.env.GHL_LOCATION_ID
);

async function testDirectSend() {
  console.log('🧪 Testing Direct GHL Message Send\n');
  
  const contactId = 'ym8G7K6GSzm8dJDZ6BNo';
  const testMessage = `Test from bot: ${new Date().toLocaleTimeString()}`;
  
  try {
    console.log('Sending message...');
    console.log('Contact ID:', contactId);
    console.log('Message:', testMessage);
    
    const result = await ghlService.sendSMS(contactId, testMessage);
    
    console.log('\n✅ Success!');
    console.log('Result:', result);
    
  } catch (error) {
    console.log('\n❌ Failed to send message');
    console.log('Error:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
  }
}

testDirectSend().catch(console.error);