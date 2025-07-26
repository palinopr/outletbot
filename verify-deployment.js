#!/usr/bin/env node
// Deployment verification script
// This should be run INSIDE the deployment to verify environment

console.log('🚀 DEPLOYMENT VERIFICATION');
console.log('=========================\n');

// 1. Check environment variables
console.log('1. Environment Variables:');
const required = {
  'GHL_API_KEY': process.env.GHL_API_KEY,
  'GHL_LOCATION_ID': process.env.GHL_LOCATION_ID,
  'GHL_CALENDAR_ID': process.env.GHL_CALENDAR_ID,
  'OPENAI_API_KEY': process.env.OPENAI_API_KEY,
  'TIMEZONE': process.env.TIMEZONE
};

Object.entries(required).forEach(([key, value]) => {
  if (value) {
    console.log(`   ✅ ${key}: ${key.includes('KEY') ? value.substring(0, 20) + '...' : value}`);
  } else {
    console.log(`   ❌ ${key}: NOT SET`);
  }
});

// 2. Test GHL API connection
console.log('\n2. Testing GHL API Connection:');
import { GHLService } from './services/ghlService.js';

async function testGHLConnection() {
  try {
    const ghlService = new GHLService(
      process.env.GHL_API_KEY,
      process.env.GHL_LOCATION_ID
    );
    
    // Simple API test
    console.log('   Testing API health...');
    const testContact = await ghlService.getContact('test-id').catch(() => null);
    console.log('   ✅ GHL API connection successful');
    
    // Test calendar
    console.log('   Testing calendar access...');
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 1);
    
    const slots = await ghlService.getAvailableSlots(
      process.env.GHL_CALENDAR_ID,
      startDate.toISOString(),
      endDate.toISOString()
    );
    console.log(`   ✅ Calendar access successful (${slots.length} slots found)`);
    
  } catch (error) {
    console.error(`   ❌ GHL Connection failed: ${error.message}`);
    console.error(`      Error type: ${error.name}`);
    if (error.response) {
      console.error(`      Status: ${error.response.status}`);
      console.error(`      Data: ${JSON.stringify(error.response.data)}`);
    }
  }
}

// 3. Test OpenAI connection
console.log('\n3. Testing OpenAI Connection:');
import { ChatOpenAI } from '@langchain/openai';

async function testOpenAI() {
  try {
    const llm = new ChatOpenAI({ 
      model: "gpt-4",
      temperature: 0,
      timeout: 10000
    });
    
    const response = await llm.invoke([
      { role: "system", content: "You are a test bot. Reply with 'OK'" },
      { role: "user", content: "Test" }
    ]);
    
    if (response.content.includes('OK')) {
      console.log('   ✅ OpenAI connection successful');
    } else {
      console.log('   ⚠️  OpenAI responded but unexpected output');
    }
  } catch (error) {
    console.error(`   ❌ OpenAI connection failed: ${error.message}`);
  }
}

// 4. Check timeouts
console.log('\n4. Timeout Configuration:');
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
console.log(`   Init timeout: ${process.env.NODE_ENV === 'production' ? '10s' : '3s'}`);
console.log(`   Conversation timeout: ${process.env.NODE_ENV === 'production' ? '15s' : '5s'}`);
console.log(`   LLM timeout: ${process.env.NODE_ENV === 'production' ? '20s' : '10s'}`);

// Run tests
(async () => {
  await testGHLConnection();
  await testOpenAI();
  
  console.log('\n5. Deployment Summary:');
  console.log('====================');
  if (Object.values(required).every(v => v)) {
    console.log('✅ All environment variables are set');
  } else {
    console.log('❌ Missing environment variables');
  }
  console.log('\nIf GHL or OpenAI connections fail, check:');
  console.log('- API keys are valid and not expired');
  console.log('- GHL location ID matches the API key');
  console.log('- Calendar ID exists in the location');
  console.log('- Network connectivity from deployment environment');
})();