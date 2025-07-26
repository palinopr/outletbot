import { Client } from 'langsmith';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize LangSmith client
const client = new Client({
  apiKey: process.env.LANGSMITH_API_KEY
});

async function analyzeTraceDetailed(traceId) {
  try {
    console.log(`\n🔍 Detailed Analysis of LangSmith Trace: ${traceId}`);
    console.log('=' . repeat(80));

    // Fetch the main run
    const run = await client.readRun(traceId);
    
    console.log('\n📊 MAIN RUN DETAILS:');
    console.log(`- ID: ${run.id}`);
    console.log(`- Name: ${run.name}`);
    console.log(`- Run Type: ${run.run_type}`);
    console.log(`- Status: ${run.status}`);
    console.log(`- Parent Run ID: ${run.parent_run_id || 'None (Root Run)'}`);
    console.log(`- Session/Project ID: ${run.session_id}`);
    console.log(`- Start Time: ${new Date(run.start_time).toISOString()}`);
    console.log(`- End Time: ${run.end_time ? new Date(run.end_time).toISOString() : 'Still running'}`);
    console.log(`- Duration: ${run.end_time ? ((new Date(run.end_time) - new Date(run.start_time)) / 1000).toFixed(2) + 's' : 'N/A'}`);
    
    // Check for errors or special status
    if (run.error) {
      console.log(`\n❌ ERROR DETAILS:`);
      console.log(run.error);
    }

    if (run.events && run.events.length > 0) {
      console.log(`\n📅 EVENTS:`);
      run.events.forEach(event => {
        console.log(`- ${event}`);
      });
    }

    // Extra metadata
    if (run.extra) {
      console.log(`\n📋 EXTRA METADATA:`);
      console.log(JSON.stringify(run.extra, null, 2));
    }

    // Tags
    if (run.tags && run.tags.length > 0) {
      console.log(`\n🏷️  TAGS: ${run.tags.join(', ')}`);
    }

    // Try different methods to get child runs
    console.log('\n🔄 SEARCHING FOR CHILD RUNS...');
    
    // Method 1: List runs with parent_run_id filter
    console.log('\nMethod 1: Using parent_run_id filter');
    let childCount = 0;
    for await (const childRun of client.listRuns({
      filter: `eq(parent_run_id, "${traceId}")`
    })) {
      childCount++;
      console.log(`\nChild ${childCount}: ${childRun.name}`);
      console.log(`- ID: ${childRun.id}`);
      console.log(`- Type: ${childRun.run_type}`);
      console.log(`- Status: ${childRun.status}`);
      
      if (childCount >= 10) {
        console.log('... (showing first 10 children)');
        break;
      }
    }

    if (childCount === 0) {
      console.log('No child runs found with Method 1');
      
      // Method 2: List all runs in the same trace
      console.log('\nMethod 2: Looking for runs in the same trace/session');
      let traceRunCount = 0;
      const startTime = new Date(run.start_time);
      const endTime = run.end_time ? new Date(run.end_time) : new Date();
      
      for await (const traceRun of client.listRuns({
        filter: `and(gte(start_time, "${startTime.toISOString()}"), lte(start_time, "${endTime.toISOString()}"))`
      })) {
        if (traceRun.trace_id === traceId || traceRun.id === traceId) {
          traceRunCount++;
          console.log(`\nTrace Run ${traceRunCount}: ${traceRun.name}`);
          console.log(`- ID: ${traceRun.id}`);
          console.log(`- Type: ${traceRun.run_type}`);
          console.log(`- Parent ID: ${traceRun.parent_run_id || 'None'}`);
          
          if (traceRunCount >= 10) {
            console.log('... (showing first 10 trace runs)');
            break;
          }
        }
      }
      
      if (traceRunCount === 0) {
        console.log('No related runs found in the same time window');
      }
    }

    // Check the outputs more carefully
    console.log('\n📤 OUTPUT ANALYSIS:');
    if (run.outputs) {
      if (run.outputs.messages && Array.isArray(run.outputs.messages)) {
        console.log(`- Output contains ${run.outputs.messages.length} messages`);
        run.outputs.messages.forEach((msg, idx) => {
          console.log(`\n  Message ${idx + 1}:`);
          console.log(`  - Type: ${msg.id?.[2] || msg.type || 'Unknown'}`);
          console.log(`  - Content: ${msg.kwargs?.content || msg.content || 'No content'}`);
          if (msg.kwargs?.tool_calls && msg.kwargs.tool_calls.length > 0) {
            console.log(`  - Tool Calls: ${msg.kwargs.tool_calls.length}`);
          }
        });
      }
      
      if (run.outputs.leadInfo !== undefined) {
        console.log(`\n- Lead Info: ${JSON.stringify(run.outputs.leadInfo)}`);
      }
    }

    // Check for the error message pattern
    const errorMessage = "Lo siento, hubo un error procesando tu mensaje. Por favor intenta de nuevo.";
    if (JSON.stringify(run.outputs).includes(errorMessage)) {
      console.log('\n⚠️  ERROR RESPONSE DETECTED');
      console.log('The agent returned an error message, indicating a processing failure.');
    }

  } catch (error) {
    console.error('Error analyzing trace:', error);
    console.error('Error details:', error.response?.data || error.message);
  }
}

// Run the analysis
const traceId = '1f06a415-0081-608f-adce-537c1ffe8d2a';
analyzeTraceDetailed(traceId);