#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

import { Client } from 'langsmith';

// The webhook_handler child run ID from the previous analysis
const WEBHOOK_HANDLER_ID = '7c526b35-f310-4235-a2a0-4a3af83fa09d';

async function analyzeWebhookHandler() {
  console.log(`🔍 Analyzing webhook_handler child run in detail\n`);
  
  const client = new Client({
    apiKey: process.env.LANGSMITH_API_KEY
  });

  try {
    // Get the webhook_handler run with its child runs
    const run = await client.readRun(WEBHOOK_HANDLER_ID, { loadChildRuns: true });
    
    console.log('=== WEBHOOK HANDLER DETAILS ===');
    console.log(`Name: ${run.name}`);
    console.log(`Status: ${run.status}`);
    console.log(`Duration: ${((new Date(run.end_time) - new Date(run.start_time)) / 1000).toFixed(2)}s`);
    
    // Show inputs
    if (run.inputs) {
      console.log('\n📥 INPUTS:');
      console.log(JSON.stringify(run.inputs, null, 2));
    }
    
    // Show outputs
    if (run.outputs) {
      console.log('\n📤 OUTPUTS:');
      console.log(JSON.stringify(run.outputs, null, 2));
    }
    
    // Analyze child runs
    if (run.child_runs && run.child_runs.length > 0) {
      console.log(`\n\n=== CHILD RUNS (${run.child_runs.length}) ===`);
      
      // Show each child run
      run.child_runs.forEach((childRun, idx) => {
        console.log(`\n${idx + 1}. ${childRun.name}`);
        console.log(`   Type: ${childRun.run_type}`);
        console.log(`   Status: ${childRun.status}`);
        
        if (childRun.error) {
          console.log(`   ❌ ERROR: ${childRun.error}`);
        }
        
        // Show tool calls specifically
        if (childRun.run_type === 'tool') {
          console.log(`   Tool Inputs: ${JSON.stringify(childRun.inputs)}`);
          console.log(`   Tool Outputs: ${JSON.stringify(childRun.outputs)}`);
        }
        
        // Show LLM calls
        if (childRun.run_type === 'llm') {
          console.log(`   Messages: ${childRun.inputs?.messages?.length || 0}`);
          if (childRun.outputs?.generations?.[0]?.[0]?.text) {
            console.log(`   Response: ${childRun.outputs.generations[0][0].text.substring(0, 100)}...`);
          }
        }
      });
      
      // Look for specific patterns
      const salesAgentRuns = run.child_runs.filter(r => r.name.includes('sales') || r.name.includes('Sales'));
      if (salesAgentRuns.length > 0) {
        console.log(`\n\n🤖 Sales Agent Runs: ${salesAgentRuns.length}`);
        salesAgentRuns.forEach(sar => {
          console.log(`\n- ${sar.name}`);
          console.log(`  Status: ${sar.status}`);
          if (sar.error) {
            console.log(`  ❌ Error: ${sar.error}`);
          }
          if (sar.outputs) {
            console.log(`  Outputs: ${JSON.stringify(sar.outputs).substring(0, 200)}...`);
          }
        });
      }
      
      // Look for error patterns
      const errorRuns = run.child_runs.filter(r => r.error || r.status === 'error');
      if (errorRuns.length > 0) {
        console.log(`\n\n⚠️  ERROR RUNS DETECTED: ${errorRuns.length}`);
        errorRuns.forEach(er => {
          console.log(`\n- ${er.name}`);
          console.log(`  Error: ${er.error}`);
          console.log(`  Inputs: ${JSON.stringify(er.inputs)}`);
        });
      }
    }
    
    // Summary
    console.log('\n\n=== ANALYSIS ===');
    if (run.outputs?.messages) {
      const lastMessage = run.outputs.messages[run.outputs.messages.length - 1];
      if (lastMessage?.kwargs?.content?.includes('error')) {
        console.log('❌ The webhook handler returned an error message to the user');
        console.log(`   Message: "${lastMessage.kwargs.content}"`);
        
        // Check if this was a catch block
        if (lastMessage.kwargs.content.includes('Lo siento')) {
          console.log('\n⚠️  This appears to be from a catch block - an exception was thrown');
        }
      }
    }
    
  } catch (error) {
    console.error('Error analyzing webhook handler:', error.message);
  }
}

analyzeWebhookHandler();