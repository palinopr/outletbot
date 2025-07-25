import { Client } from 'langsmith';
import dotenv from 'dotenv';

dotenv.config();

async function debugTrace(traceId) {
  console.log(`🔍 Debugging LangSmith trace: ${traceId}\n`);
  
  const client = new Client({
    apiKey: process.env.LANGSMITH_API_KEY
  });
  
  try {
    // Fetch all runs for this trace
    console.log('Fetching trace runs...');
    const runs = [];
    
    for await (const run of client.listRuns({
      id: [traceId]
    })) {
      runs.push(run);
    }
    
    if (runs.length === 0) {
      console.log('❌ No runs found with that trace ID');
      return;
    }
    
    // Display run details
    for (const run of runs) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`📋 Run Name: ${run.name}`);
      console.log(`🆔 Run ID: ${run.id}`);
      console.log(`🔗 Trace ID: ${run.trace_id}`);
      console.log(`📦 Run Type: ${run.run_type}`);
      console.log(`⏰ Start Time: ${run.start_time}`);
      console.log(`⏱️ End Time: ${run.end_time}`);
      console.log(`⚡ Status: ${run.status}`);
      
      if (run.error) {
        console.log('\n❌ ERROR DETAILS:');
        console.log('Error:', run.error);
      }
      
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
      
      // Show metadata
      if (run.extra?.metadata) {
        console.log('\n📌 METADATA:');
        console.log(JSON.stringify(run.extra.metadata, null, 2));
      }
      
      // Show tags
      if (run.tags && run.tags.length > 0) {
        console.log('\n🏷️ TAGS:', run.tags.join(', '));
      }
      
      // If this is a tool call, show the tool details
      if (run.run_type === 'tool' && run.serialized) {
        console.log('\n🔧 TOOL DETAILS:');
        console.log(`Tool Name: ${run.serialized.name || 'N/A'}`);
      }
      
      console.log('═══════════════════════════════════════════════════════════\n');
    }
    
    // Also try to fetch by trace_id to get all related runs
    console.log('Fetching all runs in this trace...');
    const traceRuns = [];
    
    for await (const run of client.listRuns({
      trace_id: traceId
    })) {
      traceRuns.push(run);
    }
    
    if (traceRuns.length > 1) {
      console.log(`\n📊 Found ${traceRuns.length} total runs in this trace:`);
      
      // Sort by dotted_order to show hierarchy
      traceRuns.sort((a, b) => a.dotted_order.localeCompare(b.dotted_order));
      
      for (const run of traceRuns) {
        const depth = run.dotted_order.split('.').length - 1;
        const indent = '  '.repeat(depth);
        const status = run.error ? '❌' : '✅';
        console.log(`${indent}${status} ${run.name} (${run.run_type}) - ${run.id}`);
        
        if (run.error) {
          console.log(`${indent}   Error: ${run.error}`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error fetching trace:', error);
  }
}

// Run the debug script
const traceId = process.argv[2] || '1f069aa3-4d0e-6419-8939-3dac1bf2836b';
debugTrace(traceId);