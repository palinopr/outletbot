import { Client } from 'langsmith';

const client = new Client({
  apiKey: 'ls_e4e17d43a03f481fa25f3a7f97298ff9'
});

async function debugTrace(traceId) {
  console.log(`🔍 Fetching trace: ${traceId}\n`);
  
  try {
    // Fetch runs for this trace
    const runs = [];
    for await (const run of client.listRuns({
      filter: { trace_id: traceId },
      limit: 100
    })) {
      runs.push(run);
    }
    
    console.log(`Found ${runs.length} runs in trace\n`);
    
    // Analyze each run
    for (const run of runs) {
      console.log(`\n📋 Run: ${run.name}`);
      console.log(`   ID: ${run.id}`);
      console.log(`   Status: ${run.status}`);
      console.log(`   Run Type: ${run.run_type}`);
      
      if (run.error) {
        console.log(`   ❌ Error: ${run.error}`);
      }
      
      // Check inputs
      if (run.inputs) {
        console.log(`   📥 Inputs:`, JSON.stringify(run.inputs, null, 2).substring(0, 500));
      }
      
      // Check outputs
      if (run.outputs) {
        console.log(`   📤 Outputs:`, JSON.stringify(run.outputs, null, 2).substring(0, 500));
        
        // Look for tool calls in outputs
        if (run.outputs.messages) {
          for (const msg of run.outputs.messages) {
            if (msg.kwargs?.tool_calls) {
              console.log(`\n   🔧 Tool Calls Found:`);
              for (const toolCall of msg.kwargs.tool_calls) {
                console.log(`      - Tool: ${toolCall.name}`);
                console.log(`        Args:`, JSON.stringify(toolCall.args, null, 2));
              }
            }
            
            // Check for tool responses
            if (msg.kwargs?.name) {
              console.log(`\n   🔨 Tool Response:`);
              console.log(`      - Tool: ${msg.kwargs.name}`);
              console.log(`      - Content: ${msg.kwargs.content?.substring(0, 200)}...`);
            }
          }
        }
      }
      
      // Check for specific error patterns
      if (run.outputs?.messages) {
        for (const msg of run.outputs.messages) {
          if (msg.kwargs?.content?.includes('400') || 
              msg.kwargs?.content?.includes('404') ||
              msg.kwargs?.content?.includes('401') ||
              msg.kwargs?.content?.includes('500')) {
            console.log(`\n   ⚠️  HTTP Error Found in Output!`);
          }
        }
      }
    }
    
    // Look for hardcoded IDs
    console.log(`\n\n🔍 Checking for hardcoded IDs...`);
    for (const run of runs) {
      const runStr = JSON.stringify(run);
      if (runStr.includes('example-contact-id') || 
          runStr.includes('test-contact-id') ||
          runStr.includes('dummy-')) {
        console.log(`   ⚠️  Found hardcoded ID in run: ${run.name}`);
      }
    }
    
  } catch (error) {
    console.error('Error debugging trace:', error);
  }
}

// Run the debug
debugTrace('1f0699c0-c65f-6025-b7aa-ca4078b297df');