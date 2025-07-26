#!/usr/bin/env node
import { Client } from 'langsmith';

console.log('🔍 ANALYZING DEPLOYMENT TRACE');
console.log('============================\n');

// Latest trace from deployment
const TRACE_ID = '1f06a519-8fa4-652c-8a82-b52103bb045b';

async function analyzeTrace() {
  if (!process.env.LANGSMITH_API_KEY) {
    console.error('Set LANGSMITH_API_KEY to analyze traces');
    return;
  }
  
  try {
    const client = new Client({
      apiKey: process.env.LANGSMITH_API_KEY
    });
    
    const run = await client.readRun(TRACE_ID);
    
    console.log('Trace Details:');
    console.log('-------------');
    console.log(`Status: ${run.status}`);
    console.log(`Duration: ${run.end_time - run.start_time}ms`);
    console.log(`Error: ${run.error || 'None'}`);
    console.log(`Child runs: ${run.child_run_ids?.length || 0}`);
    
    // Check for specific errors
    if (run.error) {
      console.log('\n❌ ERROR FOUND:', run.error);
      
      if (run.error.includes('initialization')) {
        console.log('\nInitialization error - likely causes:');
        console.log('1. Missing environment variables');
        console.log('2. Import errors in deployment');
        console.log('3. Module resolution issues');
      }
    }
    
    // Check outputs
    if (run.outputs?.messages) {
      const errorMsg = run.outputs.messages.find(m => 
        m.content?.includes('error') || m.content?.includes('Lo siento')
      );
      
      if (errorMsg) {
        console.log('\nError message returned:', errorMsg.content);
      }
    }
    
    // Get child runs for more details
    if (run.child_run_ids && run.child_run_ids.length > 0) {
      console.log('\n\nChild Runs:');
      for (const childId of run.child_run_ids.slice(0, 3)) {
        try {
          const child = await client.readRun(childId);
          console.log(`- ${child.name}: ${child.status}`);
          if (child.error) {
            console.log(`  Error: ${child.error}`);
          }
        } catch (e) {
          console.log(`- ${childId}: Unable to fetch`);
        }
      }
    }
    
  } catch (error) {
    console.error('Failed to fetch trace:', error.message);
  }
}

console.log('Trace ID:', TRACE_ID);
console.log('From deployment:', 'd3fc0967-73ba-4531-a5cf-2705d28f4bfa\n');

analyzeTrace().then(() => {
  console.log('\n\nPOSSIBLE ISSUES:');
  console.log('===============');
  console.log('1. Check deployment logs in LangGraph dashboard');
  console.log('2. Look for "Cannot find module" errors');
  console.log('3. Check if all environment variables are set');
  console.log('4. Verify NODE_ENV=production is set');
  console.log('5. Check for network/firewall blocking GHL API');
});