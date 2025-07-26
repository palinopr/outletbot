import { Client } from 'langsmith';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const client = new Client({
  apiKey: process.env.LANGSMITH_API_KEY,
  apiUrl: "https://api.smith.langchain.com"
});

async function debugTrace(traceId) {
  console.log(`🔍 Fetching trace: ${traceId}\n`);
  
  const runs = [];
  try {
    for await (const run of client.listRuns({traceId: traceId})) {
      runs.push(run);
    }
    
    console.log(`📊 Total runs found: ${runs.length}\n`);
    
    // Sort runs by start time
    runs.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    
    // Analyze each run
    runs.forEach((run, index) => {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🏃 Run ${index + 1}/${runs.length}: ${run.name}`);
      console.log(`${'='.repeat(80)}`);
      console.log(`ID: ${run.id}`);
      console.log(`Status: ${run.status}`);
      console.log(`Start: ${new Date(run.start_time).toISOString()}`);
      
      if (run.error) {
        console.log(`\n❌ ERROR: ${run.error}`);
      }
      
      // Show inputs
      if (run.inputs) {
        console.log(`\n📥 INPUTS:`);
        console.log(JSON.stringify(run.inputs, null, 2));
      }
      
      // Analyze tool calls and responses
      if (run.outputs?.messages) {
        console.log(`\n📤 OUTPUTS (${run.outputs.messages.length} messages):`);
        
        run.outputs.messages.forEach((msg, msgIndex) => {
          console.log(`\n  Message ${msgIndex + 1}:`);
          
          // Tool calls
          if (msg.kwargs?.tool_calls) {
            msg.kwargs.tool_calls.forEach((toolCall, tcIndex) => {
              console.log(`\n  📞 TOOL CALL ${tcIndex + 1}: ${toolCall.name}`);
              console.log(`    ID: ${toolCall.id}`);
              console.log(`    Arguments:`);
              console.log(JSON.stringify(toolCall.args, null, 6).split('\n').map(line => '      ' + line).join('\n'));
            });
          }
          
          // Tool responses
          if (msg.kwargs?.name) {
            console.log(`\n  🔧 TOOL RESPONSE: ${msg.kwargs.name}`);
            console.log(`    Content: ${msg.kwargs.content}`);
          }
          
          // Regular messages
          if (msg.kwargs?.content && !msg.kwargs?.name && !msg.kwargs?.tool_calls) {
            console.log(`\n  💬 AI MESSAGE:`);
            console.log(`    ${msg.kwargs.content}`);
          }
        });
      }
      
      // Check for any nested runs
      if (run.child_run_ids && run.child_run_ids.length > 0) {
        console.log(`\n👶 Child runs: ${run.child_run_ids.length}`);
      }
    });
    
    // Summary analysis
    console.log(`\n\n${'='.repeat(80)}`);
    console.log(`📊 TRACE SUMMARY`);
    console.log(`${'='.repeat(80)}`);
    
    // Count tool calls by type
    const toolCallCounts = {};
    runs.forEach(run => {
      if (run.outputs?.messages) {
        run.outputs.messages.forEach(msg => {
          if (msg.kwargs?.tool_calls) {
            msg.kwargs.tool_calls.forEach(tc => {
              toolCallCounts[tc.name] = (toolCallCounts[tc.name] || 0) + 1;
            });
          }
        });
      }
    });
    
    console.log(`\nTool Call Summary:`);
    Object.entries(toolCallCounts).forEach(([tool, count]) => {
      console.log(`  ${tool}: ${count} calls`);
    });
    
    // Check for errors
    const errorRuns = runs.filter(r => r.error || r.status === 'error');
    if (errorRuns.length > 0) {
      console.log(`\n❌ Errors found in ${errorRuns.length} runs`);
      errorRuns.forEach(run => {
        console.log(`  - ${run.name}: ${run.error}`);
      });
    }
    
    return runs;
  } catch (error) {
    console.error('Error fetching trace:', error);
    throw error;
  }
}

// Execute the debug
debugTrace('1f069b4c-7f1e-667e-a6ad-062fd0c90146')
  .then(() => console.log('\n✅ Debug complete'))
  .catch(console.error);