#!/usr/bin/env node
/**
 * Analyze why no responses are being sent
 */

import { Client } from "langsmith";
import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

const client = new Client({
  apiKey: process.env.LANGSMITH_API_KEY
});

async function analyzeRecentTraces() {
  console.log('🔍 Analyzing recent traces to find why no messages are sent...\n');
  
  // Get recent runs from the real-webhook-test project
  const runs = await client.listRuns({
    projectName: 'real-webhook-test',
    limit: 10,
    filter: 'eq(name, "LangGraph")'
  });
  
  let tracesAnalyzed = 0;
  
  for await (const run of runs) {
    if (tracesAnalyzed >= 3) break;
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Trace: ${run.id}`);
    console.log(`Status: ${run.status}`);
    console.log(`Duration: ${run.end_time ? ((new Date(run.end_time) - new Date(run.start_time)) / 1000).toFixed(2) : 'N/A'}s`);
    
    // Check child runs for sales agent
    const childRuns = await client.listRuns({
      projectName: run.project_name,
      filter: `eq(parent_run_id, "${run.id}")`,
      limit: 50
    });
    
    let salesAgentRun = null;
    let toolCalls = [];
    
    for await (const child of childRuns) {
      if (child.name === 'salesAgentInvoke' || child.name === 'salesAgent') {
        salesAgentRun = child;
      }
      if (child.run_type === 'tool') {
        toolCalls.push({
          name: child.name,
          status: child.status,
          outputs: child.outputs
        });
      }
    }
    
    console.log('\nSales Agent Run:', salesAgentRun ? 'Found' : 'NOT FOUND');
    console.log('Tool Calls:', toolCalls.length);
    
    if (toolCalls.length > 0) {
      console.log('\nTools executed:');
      toolCalls.forEach(tool => {
        console.log(`  - ${tool.name}: ${tool.status}`);
      });
    }
    
    // Check outputs
    if (run.outputs?.messages) {
      const aiMessages = run.outputs.messages.filter(m => 
        m.kwargs?.additional_kwargs?.tool_calls || 
        m.type === 'ai' || 
        m._type === 'ai'
      );
      console.log(`\nAI Messages in output: ${aiMessages.length}`);
      
      if (aiMessages.length === 0) {
        console.log('❌ No AI messages found - This is why no response is sent!');
      }
    }
    
    tracesAnalyzed++;
  }
  
  console.log('\n\n📊 Summary:');
  console.log('The webhook handler is working (extracting messages from JSON)');
  console.log('But the sales agent is not being invoked properly or not generating responses');
  console.log('\nPossible issues:');
  console.log('1. Sales agent not receiving the correct state');
  console.log('2. Tools not being called within sales agent');
  console.log('3. State not being passed correctly between webhook and agent');
}

analyzeRecentTraces().catch(console.error);