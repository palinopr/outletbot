#!/usr/bin/env node
/**
 * Analyze trace 1f06b149-1474-6632-a410-d17d5656da98
 * Contact: ym8G7K6GSzm8dJDZ6BNo
 */

import { Client } from "langsmith";
import { config as dotenvConfig } from 'dotenv';
import fs from 'fs';

dotenvConfig();

const TRACE_ID = '1f06b149-1474-6632-a410-d17d5656da98';

async function analyzeTrace() {
  console.log(`🔍 Analyzing Trace: ${TRACE_ID}`);
  console.log(`📞 Contact: ym8G7K6GSzm8dJDZ6BNo`);
  console.log('=' .repeat(70));
  
  const client = new Client({
    apiKey: process.env.LANGSMITH_API_KEY
  });

  try {
    // Get the run
    const run = await client.readRun(TRACE_ID);
    
    console.log('\n📊 Trace Overview:');
    console.log(`- Name: ${run.name}`);
    console.log(`- Status: ${run.status}`);
    console.log(`- Start: ${new Date(run.start_time).toLocaleString()}`);
    console.log(`- Duration: ${run.end_time ? ((new Date(run.end_time) - new Date(run.start_time)) / 1000).toFixed(2) : 'N/A'}s`);
    console.log(`- Error: ${run.error || 'None'}`);
    
    // Get inputs
    console.log('\n📥 Input:');
    if (run.inputs?.messages) {
      run.inputs.messages.forEach((msg, idx) => {
        console.log(`  ${idx + 1}. [${msg.type || msg._type}] ${msg.content?.substring(0, 100)}...`);
      });
    }
    console.log('\n  Lead Info:', JSON.stringify(run.inputs?.leadInfo || {}, null, 2));
    
    // Get outputs
    console.log('\n📤 Output:');
    if (run.outputs?.messages) {
      console.log(`  Total messages: ${run.outputs.messages.length}`);
      const lastMessages = run.outputs.messages.slice(-3);
      lastMessages.forEach((msg, idx) => {
        console.log(`  ${idx + 1}. [${msg.type || msg._type}] ${msg.content?.substring(0, 100)}...`);
      });
    }
    console.log('\n  Final Lead Info:', JSON.stringify(run.outputs?.leadInfo || {}, null, 2));
    
    // Analyze child runs (tool calls)
    console.log('\n🔧 Tool Calls:');
    const childRuns = await client.listRuns({
      projectName: run.project_name,
      filter: `eq(parent_run_id, "${TRACE_ID}")`,
      limit: 50
    });
    
    const toolCalls = [];
    for await (const childRun of childRuns) {
      if (childRun.run_type === 'tool') {
        toolCalls.push({
          name: childRun.name,
          status: childRun.status,
          duration: childRun.end_time ? ((new Date(childRun.end_time) - new Date(childRun.start_time)) / 1000).toFixed(2) : 'N/A',
          inputs: childRun.inputs,
          outputs: childRun.outputs,
          error: childRun.error
        });
      }
    }
    
    if (toolCalls.length === 0) {
      console.log('  ❌ No tool calls found - This is the problem!');
    } else {
      toolCalls.forEach((tool, idx) => {
        console.log(`  ${idx + 1}. ${tool.name} (${tool.status}) - ${tool.duration}s`);
        if (tool.error) {
          console.log(`     ❌ Error: ${tool.error}`);
        }
      });
    }
    
    // Check for specific issues
    console.log('\n⚠️  Issues Analysis:');
    
    const issues = [];
    
    if (toolCalls.length === 0) {
      issues.push('No tool calls executed - agent may not be processing correctly');
    }
    
    if (!run.outputs?.leadInfo || Object.keys(run.outputs.leadInfo).length === 0) {
      issues.push('No lead information extracted');
    }
    
    if (run.error) {
      issues.push(`Execution error: ${run.error}`);
    }
    
    // Check if messages were sent
    const sendMessageCalls = toolCalls.filter(t => t.name === 'send_ghl_message');
    if (sendMessageCalls.length === 0) {
      issues.push('No messages sent to customer');
    }
    
    if (issues.length === 0) {
      console.log('  ✅ No obvious issues found');
    } else {
      issues.forEach(issue => console.log(`  - ${issue}`));
    }
    
    // Save detailed analysis
    const analysis = {
      traceId: TRACE_ID,
      contactId: 'ym8G7K6GSzm8dJDZ6BNo',
      timestamp: new Date().toISOString(),
      overview: {
        name: run.name,
        status: run.status,
        duration: run.end_time ? ((new Date(run.end_time) - new Date(run.start_time)) / 1000).toFixed(2) : 'N/A',
        error: run.error
      },
      inputs: run.inputs,
      outputs: run.outputs,
      toolCalls,
      issues
    };
    
    fs.writeFileSync(
      `trace-analysis-${TRACE_ID.substring(0, 8)}.json`,
      JSON.stringify(analysis, null, 2)
    );
    
    console.log(`\n💾 Detailed analysis saved to trace-analysis-${TRACE_ID.substring(0, 8)}.json`);
    
  } catch (error) {
    console.error('Error analyzing trace:', error);
  }
}

analyzeTrace().catch(console.error);