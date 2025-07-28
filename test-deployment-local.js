#!/usr/bin/env node

/**
 * Local Deployment Test Script
 * Simulates LangGraph Cloud deployment environment to catch errors locally
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Testing deployment locally (simulating LangGraph Cloud)...\n');

// Check for required files
const requiredFiles = [
  'production-fixes.js',
  'validateEnv.js',
  'agents/salesAgent.js',
  'agents/webhookHandler.js',
  'api/langgraph-api.js',
  'services/config.js',
  'services/ghlService.js',
  'services/conversationManager.js'
];

console.log('📁 Checking required files...');
let missingFiles = [];
for (const file of requiredFiles) {
  try {
    await import(path.join(__dirname, file));
    console.log(`✅ ${file}`);
  } catch (error) {
    console.log(`❌ ${file} - ${error.message}`);
    missingFiles.push(file);
  }
}

if (missingFiles.length > 0) {
  console.error('\n❌ Missing files:', missingFiles);
  process.exit(1);
}

console.log('\n📦 Testing graph imports...');

// Test importing graphs as LangGraph would
try {
  const { graph: salesAgent } = await import('./agents/salesAgent.js');
  console.log('✅ Sales agent graph loaded');
} catch (error) {
  console.error('❌ Failed to load sales agent:', error.message);
}

try {
  const { graph: webhookHandler } = await import('./agents/webhookHandler.js');
  console.log('✅ Webhook handler graph loaded');
} catch (error) {
  console.error('❌ Failed to load webhook handler:', error.message);
}

// Test API handler
console.log('\n🔌 Testing API handler...');
try {
  const handler = await import('./api/langgraph-api.js');
  console.log('✅ API handler loaded');
  
  // Simulate a webhook request
  const mockReq = {
    method: 'POST',
    body: {
      phone: '+1234567890',
      message: 'Test message',
      contactId: 'test-123',
      conversationId: 'conv-123'
    },
    headers: {}
  };
  
  const mockRes = {
    status: (code) => ({
      json: (data) => {
        console.log(`✅ Mock webhook response: ${code}`, data);
      }
    })
  };
  
  // Set required env vars for test
  process.env.SKIP_ENV_VALIDATION = 'true';
  
  console.log('📤 Sending mock webhook...');
  await handler.default(mockReq, mockRes);
  
} catch (error) {
  console.error('❌ API handler error:', error.message);
  console.error(error.stack);
}

console.log('\n🧪 Deployment test complete!');
console.log('\nTo test with real environment variables:');
console.log('1. Set all required env vars in .env');
console.log('2. Run: SKIP_ENV_VALIDATION=false node test-deployment-local.js');