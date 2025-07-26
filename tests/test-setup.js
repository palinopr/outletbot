#!/usr/bin/env node
import 'dotenv/config';
import { validateEnvironment } from '../validateEnv.js';

// Test setup with better error handling
export function setupTestEnvironment() {
  console.log('🔧 Setting up test environment...\n');
  
  // Check for .env file
  const fs = await import('fs');
  const path = await import('path');
  const envPath = path.join(process.cwd(), '.env');
  
  if (!fs.existsSync(envPath)) {
    console.error('❌ No .env file found!');
    console.error('\nTo run tests, you need to:');
    console.error('1. Copy .env.test to .env:');
    console.error('   cp .env.test .env');
    console.error('2. Fill in your actual API keys in .env');
    console.error('3. Run tests again\n');
    process.exit(1);
  }
  
  // Validate environment variables
  try {
    validateEnvironment();
  } catch (error) {
    console.error('\n📋 Example .env file:');
    console.error('------------------------');
    console.error('OPENAI_API_KEY=sk-...');
    console.error('GHL_API_KEY=your-ghl-api-key');
    console.error('GHL_LOCATION_ID=your-location-id');
    console.error('GHL_CALENDAR_ID=your-calendar-id');
    console.error('------------------------\n');
    process.exit(1);
  }
  
  // Set test timeouts to prevent hanging
  if (!process.env.CONVERSATION_TIMEOUT) {
    process.env.CONVERSATION_TIMEOUT = '10000';
  }
  if (!process.env.LLM_TIMEOUT) {
    process.env.LLM_TIMEOUT = '5000';
  }
  
  console.log('✅ Test environment ready\n');
}

// Run setup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupTestEnvironment();
}