import { Client } from 'langsmith';

const client = new Client({
  apiKey: 'ls_e4e17d43a03f481fa25f3a7f97298ff9'
});

async function debugTrace(traceId) {
  console.log(`🔍 Debugging trace: ${traceId}\n`);
  
  try {
    // Try fetching with different filter approaches
    console.log('Attempting to fetch runs with trace_id filter...');
    const runs1 = [];
    for await (const run of client.listRuns({
      filter: { trace_id: traceId }
    })) {
      runs1.push(run);
    }
    console.log(`Found ${runs1.length} runs with trace_id filter`);
    
    // Try with id filter
    console.log('\nAttempting to fetch runs with id filter...');
    const runs2 = [];
    for await (const run of client.listRuns({
      filter: { id: [traceId] }
    })) {
      runs2.push(run);
    }
    console.log(`Found ${runs2.length} runs with id filter`);
    
    // Try without filter to see recent runs
    console.log('\nFetching recent runs to verify API connection...');
    const recentRuns = [];
    let count = 0;
    for await (const run of client.listRuns({ limit: 5 })) {
      recentRuns.push(run);
      count++;
      if (count >= 5) break;
    }
    console.log(`Found ${recentRuns.length} recent runs`);
    
    if (recentRuns.length > 0) {
      console.log('\nRecent run IDs:');
      recentRuns.forEach(run => {
        console.log(`  - ${run.id} (${run.name}) - Status: ${run.status}`);
      });
    }
    
    // Process the runs we found
    const allRuns = [...runs1, ...runs2];
    if (allRuns.length > 0) {
      console.log(`\n\n📊 Analyzing ${allRuns.length} runs...`);
      
      for (const run of allRuns) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📋 Run: ${run.name}`);
        console.log(`   ID: ${run.id}`);
        console.log(`   Status: ${run.status}`);
        console.log(`   Run Type: ${run.run_type}`);
        console.log(`   Start Time: ${run.start_time}`);
        
        if (run.error) {
          console.log(`\n   ❌ ERROR: ${run.error}`);
        }
        
        // Detailed input analysis
        if (run.inputs) {
          console.log(`\n   📥 INPUTS:`);
          console.log(JSON.stringify(run.inputs, null, 2));
        }
        
        // Detailed output analysis
        if (run.outputs) {
          console.log(`\n   📤 OUTPUTS:`);
          
          // Check for messages with tool calls
          if (run.outputs.messages && Array.isArray(run.outputs.messages)) {
            for (let i = 0; i < run.outputs.messages.length; i++) {
              const msg = run.outputs.messages[i];
              
              if (msg.kwargs?.tool_calls) {
                console.log(`\n   🔧 TOOL CALLS (Message ${i}):`);
                for (const toolCall of msg.kwargs.tool_calls) {
                  console.log(`      Tool: ${toolCall.name}`);
                  console.log(`      ID: ${toolCall.id}`);
                  console.log(`      Args:`, JSON.stringify(toolCall.args, null, 8));
                }
              }
              
              if (msg.kwargs?.name) {
                console.log(`\n   🔨 TOOL RESPONSE (Message ${i}):`);
                console.log(`      Tool: ${msg.kwargs.name}`);
                console.log(`      Content: ${msg.kwargs.content}`);
              }
            }
          }
        }
        
        // Check for common issues
        const runStr = JSON.stringify(run);
        const issues = [];
        
        if (runStr.includes('example-contact-id')) issues.push('Hardcoded example-contact-id found');
        if (runStr.includes('400 Bad Request')) issues.push('400 Bad Request error');
        if (runStr.includes('401')) issues.push('401 Authentication error');
        if (runStr.includes('404')) issues.push('404 Not Found error');
        if (runStr.includes('500')) issues.push('500 Server error');
        
        if (issues.length > 0) {
          console.log(`\n   ⚠️  ISSUES DETECTED:`);
          issues.forEach(issue => console.log(`      - ${issue}`));
        }
      }
    } else {
      console.log('\n❌ No runs found for this trace ID');
      console.log('Possible reasons:');
      console.log('  1. The trace ID might be incorrect');
      console.log('  2. The trace might be from a different project');
      console.log('  3. The trace might be too old or not yet indexed');
    }
    
  } catch (error) {
    console.error('\n❌ Error debugging trace:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the debug
debugTrace('1f0699c0-c65f-6025-b7aa-ca4078b297df');