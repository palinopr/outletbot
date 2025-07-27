#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

import { Client } from 'langsmith';

const TRACE_ID = '1f06a7ac-ce88-6245-9ec9-821839cc6091';

async function analyzeTraceDetails() {
  console.log(`🔍 Analyzing trace ${TRACE_ID} using LangSmith SDK\n`);
  
  const client = new Client({
    apiKey: process.env.LANGSMITH_API_KEY
  });

  try {
    // 1. Get main run details with child runs
    console.log('📊 Fetching run details with child runs...\n');
    const run = await client.readRun(TRACE_ID, { loadChildRuns: true });
    
    // Basic run info
    console.log('=== MAIN RUN DETAILS ===');
    console.log(`Name: ${run.name}`);
    console.log(`Status: ${run.status}`);
    console.log(`Run Type: ${run.run_type}`);
    console.log(`Start Time: ${new Date(run.start_time).toLocaleString()}`);
    console.log(`End Time: ${run.end_time ? new Date(run.end_time).toLocaleString() : 'Still running'}`);
    
    if (run.end_time) {
      const duration = (new Date(run.end_time) - new Date(run.start_time)) / 1000;
      console.log(`Duration: ${duration.toFixed(2)}s`);
    }
    
    // Error details
    if (run.error) {
      console.log('\n❌ ERROR DETECTED:');
      console.log(`Error: ${run.error}`);
    }
    
    // Input details
    if (run.inputs) {
      console.log('\n📥 INPUTS:');
      console.log(JSON.stringify(run.inputs, null, 2));
    }
    
    // Output details
    if (run.outputs) {
      console.log('\n📤 OUTPUTS:');
      console.log(JSON.stringify(run.outputs, null, 2));
    }
    
    // Extra details
    if (run.extra) {
      console.log('\n🔧 EXTRA DATA:');
      console.log(JSON.stringify(run.extra, null, 2));
    }
    
    // Child runs analysis
    if (run.child_runs && run.child_runs.length > 0) {
      console.log(`\n\n=== CHILD RUNS (${run.child_runs.length}) ===`);
      
      // Show all child runs with details
      console.log('\n📋 All Child Runs:');
      run.child_runs.forEach((childRun, idx) => {
        console.log(`\n${idx + 1}. ${childRun.name}`);
        console.log(`   ID: ${childRun.id}`);
        console.log(`   Type: ${childRun.run_type}`);
        console.log(`   Status: ${childRun.status}`);
        if (childRun.error) {
          console.log(`   ❌ Error: ${childRun.error}`);
        }
      });
      
      // Group by run type
      const runTypeGroups = {};
      run.child_runs.forEach(childRun => {
        const type = childRun.run_type || 'unknown';
        if (!runTypeGroups[type]) {
          runTypeGroups[type] = [];
        }
        runTypeGroups[type].push(childRun);
      });
      
      console.log('\n📊 Run Type Distribution:');
      Object.entries(runTypeGroups).forEach(([type, runs]) => {
        console.log(`  ${type}: ${runs.length} runs`);
      });
      
      // Look for errors in child runs
      const errorRuns = run.child_runs.filter(r => r.error || r.status === 'error');
      if (errorRuns.length > 0) {
        console.log(`\n⚠️  Found ${errorRuns.length} child runs with errors:`);
        errorRuns.forEach((errorRun, idx) => {
          console.log(`\n  ${idx + 1}. ${errorRun.name}`);
          console.log(`     ID: ${errorRun.id}`);
          console.log(`     Status: ${errorRun.status}`);
          console.log(`     Error: ${errorRun.error}`);
          console.log(`     Time: ${new Date(errorRun.start_time).toLocaleString()}`);
        });
      }
      
      // Analyze tool calls
      const toolRuns = run.child_runs.filter(r => r.run_type === 'tool');
      if (toolRuns.length > 0) {
        console.log(`\n🔧 Tool Calls (${toolRuns.length}):`);
        
        // Count tool usage
        const toolCounts = {};
        toolRuns.forEach(toolRun => {
          const toolName = toolRun.name || 'unknown';
          toolCounts[toolName] = (toolCounts[toolName] || 0) + 1;
        });
        
        Object.entries(toolCounts)
          .sort((a, b) => b[1] - a[1])
          .forEach(([tool, count]) => {
            console.log(`  ${tool}: ${count} calls`);
          });
        
        // Show details of each tool call
        console.log('\n📋 Tool Call Details:');
        toolRuns.forEach((toolRun, idx) => {
          console.log(`\n  ${idx + 1}. ${toolRun.name}`);
          console.log(`     Status: ${toolRun.status}`);
          
          if (toolRun.inputs) {
            console.log(`     Inputs: ${JSON.stringify(toolRun.inputs).substring(0, 100)}...`);
          }
          
          if (toolRun.outputs) {
            console.log(`     Outputs: ${JSON.stringify(toolRun.outputs).substring(0, 100)}...`);
          }
          
          if (toolRun.error) {
            console.log(`     ❌ Error: ${toolRun.error}`);
          }
          
          const duration = toolRun.end_time ? 
            ((new Date(toolRun.end_time) - new Date(toolRun.start_time)) / 1000).toFixed(2) : 
            'N/A';
          console.log(`     Duration: ${duration}s`);
        });
      }
      
      // Check for long-running operations
      const longRunning = run.child_runs.filter(childRun => {
        if (childRun.end_time) {
          const duration = (new Date(childRun.end_time) - new Date(childRun.start_time)) / 1000;
          return duration > 5; // More than 5 seconds
        }
        return false;
      });
      
      if (longRunning.length > 0) {
        console.log(`\n⏱️  Long-running operations (>5s): ${longRunning.length}`);
        longRunning.forEach(lr => {
          const duration = ((new Date(lr.end_time) - new Date(lr.start_time)) / 1000).toFixed(2);
          console.log(`  - ${lr.name}: ${duration}s`);
        });
      }
      
      // Look for specific patterns
      const extractLeadInfoCalls = toolRuns.filter(r => r.name === 'extractLeadInfo');
      if (extractLeadInfoCalls.length > 0) {
        console.log(`\n🔍 ExtractLeadInfo Analysis:`);
        console.log(`  Total calls: ${extractLeadInfoCalls.length}`);
        
        extractLeadInfoCalls.forEach((call, idx) => {
          console.log(`\n  Call ${idx + 1}:`);
          if (call.outputs?.update?.leadInfo) {
            console.log(`    Extracted: ${JSON.stringify(call.outputs.update.leadInfo)}`);
          }
        });
      }
    }
    
    // 2. Get feedback if any
    console.log('\n\n=== FEEDBACK ===');
    try {
      const feedbacks = await client.listFeedback({ runIds: [TRACE_ID] });
      for await (const feedback of feedbacks) {
        console.log(`Feedback: ${feedback.key} = ${feedback.value}`);
        if (feedback.comment) {
          console.log(`Comment: ${feedback.comment}`);
        }
      }
    } catch (e) {
      console.log('No feedback found or error fetching feedback');
    }
    
    // 3. Summary
    console.log('\n\n=== SUMMARY ===');
    console.log(`Total child runs: ${run.child_runs?.length || 0}`);
    const allErrorRuns = run.child_runs?.filter(r => r.error || r.status === 'error') || [];
    console.log(`Errors: ${allErrorRuns.length}`);
    console.log(`Final status: ${run.status}`);
    
    if (run.status === 'error' || allErrorRuns.length > 0) {
      console.log('\n⚠️  This trace contains errors that may have caused issues');
    }
    
  } catch (error) {
    console.error('Error analyzing trace:', error.message);
    if (error.response?.data) {
      console.error('API Error:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

analyzeTraceDetails();