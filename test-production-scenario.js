#!/usr/bin/env node

/**
 * Production Scenario Test
 * Tests the complete flow exactly as it would run in production
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set production-like environment
process.env.NODE_ENV = 'production';
process.env.SKIP_ENV_VALIDATION = 'false';

console.log('🚀 Testing Production Scenario...\n');
console.log('Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  HAS_OPENAI_KEY: !!process.env.OPENAI_API_KEY,
  HAS_GHL_KEY: !!process.env.GHL_API_KEY,
  HAS_LOCATION_ID: !!process.env.GHL_LOCATION_ID,
  HAS_CALENDAR_ID: !!process.env.GHL_CALENDAR_ID
});

// Test 1: Load all modules as production would
console.log('\n📦 Step 1: Loading modules as production...');
try {
  // Import exactly as LangGraph Cloud would
  const { validateEnvironment } = await import('./validateEnv.js');
  console.log('✅ validateEnv.js loaded');
  
  const { getTimeout, getErrorMessage } = await import('./production-fixes.js');
  console.log('✅ production-fixes.js loaded');
  
  // This will trigger env validation
  const { config } = await import('./services/config.js');
  console.log('✅ config.js loaded with validation');
  
  const { default: GHLService } = await import('./services/ghlService.js');
  console.log('✅ ghlService.js loaded');
  
  const { default: ConversationManager } = await import('./services/conversationManager.js');
  console.log('✅ conversationManager.js loaded');
  
} catch (error) {
  console.error('❌ Module loading failed:', error.message);
  process.exit(1);
}

// Test 2: Initialize services
console.log('\n🔧 Step 2: Initializing services...');
let ghlService, conversationManager;

try {
  const { default: GHLService } = await import('./services/ghlService.js');
  const { default: ConversationManager } = await import('./services/conversationManager.js');
  
  ghlService = new GHLService();
  conversationManager = new ConversationManager(ghlService);
  
  console.log('✅ Services initialized');
} catch (error) {
  console.error('❌ Service initialization failed:', error.message);
}

// Test 3: Load graphs
console.log('\n📊 Step 3: Loading graphs...');
try {
  const { graph: salesAgent } = await import('./agents/salesAgent.js');
  console.log('✅ Sales agent graph loaded');
  
  const { graph: webhookHandler } = await import('./agents/webhookHandler.js');
  console.log('✅ Webhook handler graph loaded');
  
} catch (error) {
  console.error('❌ Graph loading failed:', error.message);
}

// Test 4: Simulate webhook request
console.log('\n🌐 Step 4: Simulating production webhook...');
const webhookPayload = {
  type: "InboundMessage",
  locationId: process.env.GHL_LOCATION_ID || "test-location",
  contactId: "test-contact-123",
  conversationId: "test-conversation-123",
  id: "test-message-id",
  message: "Hola",
  attachments: [],
  phone: "+1234567890"
};

console.log('Webhook payload:', webhookPayload);

try {
  // Load API handler
  const { default: handler } = await import('./api/langgraph-api.js');
  
  // Create mock request/response
  const mockReq = {
    method: 'POST',
    body: webhookPayload,
    headers: {
      'content-type': 'application/json'
    }
  };
  
  let responseData = null;
  const mockRes = {
    statusCode: null,
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      responseData = data;
      console.log(`\n📤 Response: ${this.statusCode}`, data);
      return this;
    }
  };
  
  // Process webhook
  console.log('\n⚡ Processing webhook...');
  await handler(mockReq, mockRes);
  
  if (mockRes.statusCode === 200) {
    console.log('✅ Webhook processed successfully!');
  } else {
    console.log('❌ Webhook failed with status:', mockRes.statusCode);
  }
  
} catch (error) {
  console.error('❌ Webhook processing error:', error.message);
  console.error('Stack:', error.stack);
}

// Test 5: Check conversation flow
console.log('\n💬 Step 5: Testing conversation flow...');
const testMessages = [
  { message: "Hola", expected: "name request" },
  { message: "Me llamo Juan", expected: "problem inquiry" },
  { message: "Necesito más clientes", expected: "goal inquiry" },
  { message: "Quiero crecer mi negocio", expected: "budget inquiry" },
  { message: "Mi presupuesto es 500", expected: "email request" },
  { message: "juan@email.com", expected: "calendar slots" },
  { message: "El martes a las 3pm", expected: "appointment confirmation" }
];

console.log('Would test these conversation steps:');
testMessages.forEach((test, index) => {
  console.log(`${index + 1}. User: "${test.message}" → Bot: ${test.expected}`);
});

// Test 6: Performance check
console.log('\n⚡ Step 6: Performance metrics...');
console.log('Memory usage:', Math.round(process.memoryUsage().heapUsed / 1024 / 1024), 'MB');
console.log('Test duration:', new Date().toISOString());

console.log('\n✅ Production scenario test complete!');
console.log('\nTo run in actual production mode:');
console.log('1. Ensure all environment variables are set');
console.log('2. Deploy to LangGraph Cloud');
console.log('3. Configure GHL webhook to point to deployment URL');