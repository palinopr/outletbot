import { Client } from 'langsmith';
import { config } from 'dotenv';

config();

console.log('🔍 DEBUGGING LANGSMITH TRACE: 1f06a310-3a38-6d11-aa54-86c4ef864f6a');
console.log('=======================================================\n');

async function debugTrace() {
  try {
    // Initialize LangSmith client
    const client = new Client({
      apiKey: process.env.LANGSMITH_API_KEY
    });
    
    // Try the newer trace ID that was mentioned as stuck
    const traceId = '1f06a375-5f3a-6153-a010-fa326d050ad7';
    
    // Get the run details
    console.log('Fetching trace details...\n');
    const run = await client.readRun(traceId);
    
    console.log('📊 TRACE OVERVIEW:');
    console.log('Status:', run.status);
    console.log('Start time:', new Date(run.start_time).toISOString());
    console.log('End time:', run.end_time ? new Date(run.end_time).toISOString() : 'STILL RUNNING/STUCK');
    console.log('Duration:', run.end_time ? `${(new Date(run.end_time) - new Date(run.start_time)) / 1000}s` : 'N/A');
    console.log('Error:', run.error || 'None');
    console.log('Name:', run.name);
    console.log('\n');
    
    // Get more details about the run
    if (run.outputs) {
      console.log('📤 OUTPUTS:');
      console.log(JSON.stringify(run.outputs, null, 2).substring(0, 500) + '...\n');
    }
    
    if (run.inputs) {
      console.log('📥 INPUTS:');
      console.log(JSON.stringify(run.inputs, null, 2).substring(0, 500) + '...\n');
    }
    
    // Get child runs to see the execution flow
    console.log('📋 EXECUTION FLOW:');
    
    // Try different approaches to get child runs
    const childRuns = await client.listRuns({
      projectName: run.session_name || run.project_name,
      filter: `eq(parent_run_id, "${traceId}")`,
      limit: 100
    });
    
    const runs = [];
    for await (const childRun of childRuns) {
      runs.push(childRun);
    }
    
    // Sort by start time
    runs.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    
    console.log(`Found ${runs.length} child operations:\n`);
    
    // Analyze each operation
    let lastSuccessful = null;
    let firstStuck = null;
    
    runs.forEach((childRun, index) => {
      const startTime = new Date(childRun.start_time);
      const endTime = childRun.end_time ? new Date(childRun.end_time) : null;
      const duration = endTime ? (endTime - startTime) / 1000 : 'STUCK';
      
      console.log(`${index + 1}. ${childRun.name}`);
      console.log(`   Status: ${childRun.status}`);
      console.log(`   Duration: ${duration}s`);
      console.log(`   Type: ${childRun.run_type}`);
      
      if (childRun.error) {
        console.log(`   ❌ ERROR: ${childRun.error}`);
      }
      
      if (childRun.outputs) {
        console.log(`   Output preview: ${JSON.stringify(childRun.outputs).substring(0, 100)}...`);
      }
      
      // Track last successful and first stuck
      if (childRun.status === 'success' && endTime) {
        lastSuccessful = childRun;
      } else if (!endTime && !firstStuck) {
        firstStuck = childRun;
      }
      
      console.log('');
    });
    
    // Identify the stuck point
    console.log('\n🚨 ANALYSIS:');
    if (firstStuck) {
      console.log(`STUCK AT: ${firstStuck.name}`);
      console.log(`Started: ${new Date(firstStuck.start_time).toISOString()}`);
      console.log(`Type: ${firstStuck.run_type}`);
      
      if (firstStuck.inputs) {
        console.log('\nInputs to stuck operation:');
        console.log(JSON.stringify(firstStuck.inputs, null, 2));
      }
    }
    
    if (lastSuccessful) {
      console.log(`\nLAST SUCCESSFUL: ${lastSuccessful.name}`);
      console.log(`Completed: ${new Date(lastSuccessful.end_time).toISOString()}`);
    }
    
    // Look for patterns
    console.log('\n🔍 PATTERN ANALYSIS:');
    
    // Check for tool loops
    const toolCalls = runs.filter(r => r.run_type === 'tool');
    const toolCallCounts = {};
    toolCalls.forEach(tc => {
      toolCallCounts[tc.name] = (toolCallCounts[tc.name] || 0) + 1;
    });
    
    console.log('Tool call frequency:');
    Object.entries(toolCallCounts).forEach(([tool, count]) => {
      console.log(`  ${tool}: ${count} calls`);
    });
    
    // Check for long-running operations
    console.log('\nLong-running operations (>5s):');
    runs.forEach(r => {
      if (r.end_time) {
        const duration = (new Date(r.end_time) - new Date(r.start_time)) / 1000;
        if (duration > 5) {
          console.log(`  ${r.name}: ${duration}s`);
        }
      }
    });
    
    // Get the full error if the main run failed
    if (run.error) {
      console.log('\n❌ MAIN RUN ERROR:');
      console.log(run.error);
    }
    
  } catch (error) {
    console.error('Failed to fetch trace:', error.message);
    console.error('\nMake sure LANGSMITH_API_KEY is set in your .env file');
  }
}

// Run the debug
debugTrace().catch(console.error);