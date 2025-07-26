#!/usr/bin/env node
import { Client } from 'langsmith';
import 'dotenv/config';

console.log('🔍 DIAGNOSING PRODUCTION ISSUE');
console.log('==============================\n');

const TRACE_ID = '1f06a415-0081-608f-adce-537c1ffe8d2a';

async function diagnoseIssue() {
  console.log('1. Checking environment variables...');
  const required = ['GHL_API_KEY', 'GHL_LOCATION_ID', 'GHL_CALENDAR_ID', 'OPENAI_API_KEY'];
  const missing = [];
  
  required.forEach(varName => {
    if (process.env[varName]) {
      console.log(`   ✅ ${varName}: Set`);
    } else {
      console.log(`   ❌ ${varName}: MISSING`);
      missing.push(varName);
    }
  });
  
  if (missing.length > 0) {
    console.log('\n⚠️  Missing environment variables detected!');
    console.log('This is likely why the production deployment is failing.\n');
  }
  
  console.log('\n2. Analyzing trace details...');
  
  if (!process.env.LANGSMITH_API_KEY) {
    console.log('   ❌ LANGSMITH_API_KEY not set - cannot fetch trace details');
    return;
  }
  
  try {
    const client = new Client({
      apiKey: process.env.LANGSMITH_API_KEY
    });
    
    const run = await client.readRun(TRACE_ID);
    
    console.log(`   Status: ${run.status}`);
    console.log(`   Duration: ${((run.end_time - run.start_time) / 1000).toFixed(2)}s`);
    console.log(`   Error: ${run.error || 'None'}`);
    console.log(`   Child runs: ${run.child_run_ids?.length || 0}`);
    
    // Check the outputs
    if (run.outputs) {
      console.log('\n3. Analyzing outputs...');
      const messages = run.outputs.messages || [];
      const errorMessages = messages.filter(m => 
        m.content?.includes('error') || 
        m.content?.includes('Lo siento')
      );
      
      if (errorMessages.length > 0) {
        console.log('   ❌ Error message found in output:');
        errorMessages.forEach(msg => {
          console.log(`      "${msg.content}"`);
        });
      }
    }
    
    // Check for specific error patterns
    console.log('\n4. Common production issues:');
    
    if (run.child_run_ids?.length === 0) {
      console.log('   ❌ No child runs - agent never started');
      console.log('      Possible causes:');
      console.log('      - Service initialization timeout (3s might be too short)');
      console.log('      - Missing environment variables');
      console.log('      - Circuit breaker is open');
    }
    
    if (run.error) {
      console.log(`   ❌ Runtime error: ${run.error}`);
    }
    
  } catch (error) {
    console.error('Failed to fetch trace:', error.message);
  }
  
  console.log('\n5. Recommended fixes:');
  console.log('   1. Ensure all environment variables are set in LangGraph deployment:');
  console.log('      - GHL_API_KEY');
  console.log('      - GHL_LOCATION_ID'); 
  console.log('      - GHL_CALENDAR_ID');
  console.log('      - OPENAI_API_KEY');
  console.log('\n   2. Increase initialization timeout from 3s to 10s:');
  console.log('      Line 168 in webhookHandler.js');
  console.log('\n   3. Add better error logging to identify exact failure point');
  console.log('\n   4. Check LangGraph deployment logs for specific errors');
}

diagnoseIssue().catch(console.error);