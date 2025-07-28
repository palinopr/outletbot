import { Client } from 'langsmith';

// Initialize LangSmith client
const client = new Client({
  apiKey: process.env.LANGSMITH_API_KEY
});

const traceId = process.env.LANGCHAIN_TRACE_ID || '1f06bb79-e546-6703-946f-9b59b39e4a2f';

async function analyzeTrace() {
  console.log(`🔍 Analyzing LangSmith Trace: ${traceId}\n`);
  
  try {
    // Get the run details
    const run = await client.readRun(traceId);
    
    console.log('📊 RUN OVERVIEW');
    console.log('================');
    console.log(`Status: ${run.status}`);
    console.log(`Start Time: ${new Date(run.start_time).toLocaleString()}`);
    console.log(`End Time: ${run.end_time ? new Date(run.end_time).toLocaleString() : 'Still running'}`);
    console.log(`Duration: ${run.end_time ? ((new Date(run.end_time) - new Date(run.start_time)) / 1000).toFixed(2) + 's' : 'N/A'}`);
    console.log(`Total Tokens: ${run.total_tokens || 'N/A'}`);
    console.log(`Total Cost: $${run.total_cost?.toFixed(4) || 'N/A'}`);
    console.log(`Error: ${run.error || 'None'}`);
    
    // Get inputs and outputs
    console.log('\n📥 INPUTS');
    console.log('=========');
    if (run.inputs) {
      console.log(JSON.stringify(run.inputs, null, 2));
    }
    
    console.log('\n📤 OUTPUTS');
    console.log('==========');
    if (run.outputs) {
      console.log(JSON.stringify(run.outputs, null, 2));
    }
    
    // Get child runs (tool calls, LLM calls, etc)
    const childRuns = await client.listRuns({
      projectName: 'outlet-media-bot',
      parentRunId: traceId,
      limit: 100
    });
    
    console.log('\n🔧 TOOL CALLS & LLM CALLS');
    console.log('=========================');
    
    let toolCalls = [];
    let llmCalls = [];
    let totalToolDuration = 0;
    let totalLLMDuration = 0;
    
    for await (const childRun of childRuns) {
      const duration = childRun.end_time ? 
        (new Date(childRun.end_time) - new Date(childRun.start_time)) / 1000 : 0;
      
      if (childRun.run_type === 'tool') {
        toolCalls.push({
          name: childRun.name,
          status: childRun.status,
          duration: duration,
          error: childRun.error,
          inputs: childRun.inputs,
          outputs: childRun.outputs
        });
        totalToolDuration += duration;
      } else if (childRun.run_type === 'llm') {
        llmCalls.push({
          name: childRun.name,
          status: childRun.status,
          duration: duration,
          tokens: childRun.total_tokens,
          cost: childRun.total_cost,
          error: childRun.error
        });
        totalLLMDuration += duration;
      }
    }
    
    console.log(`\nTotal Tool Calls: ${toolCalls.length}`);
    console.log(`Total LLM Calls: ${llmCalls.length}`);
    console.log(`Total Tool Duration: ${totalToolDuration.toFixed(2)}s`);
    console.log(`Total LLM Duration: ${totalLLMDuration.toFixed(2)}s`);
    
    // Show tool call details
    console.log('\n🔨 TOOL CALL DETAILS');
    console.log('====================');
    toolCalls.forEach((tool, idx) => {
      console.log(`\n${idx + 1}. ${tool.name}`);
      console.log(`   Status: ${tool.status}`);
      console.log(`   Duration: ${tool.duration.toFixed(2)}s`);
      if (tool.error) {
        console.log(`   ❌ Error: ${tool.error}`);
      }
      if (tool.inputs) {
        console.log(`   Inputs: ${JSON.stringify(tool.inputs).substring(0, 200)}...`);
      }
      if (tool.outputs) {
        console.log(`   Outputs: ${JSON.stringify(tool.outputs).substring(0, 200)}...`);
      }
    });
    
    // Show LLM call details
    console.log('\n🤖 LLM CALL DETAILS');
    console.log('===================');
    llmCalls.forEach((llm, idx) => {
      console.log(`\n${idx + 1}. ${llm.name}`);
      console.log(`   Status: ${llm.status}`);
      console.log(`   Duration: ${llm.duration.toFixed(2)}s`);
      console.log(`   Tokens: ${llm.tokens || 'N/A'}`);
      console.log(`   Cost: $${llm.cost?.toFixed(4) || 'N/A'}`);
      if (llm.error) {
        console.log(`   ❌ Error: ${llm.error}`);
      }
    });
    
    // Analyze patterns
    console.log('\n📈 ANALYSIS');
    console.log('============');
    
    // Check for repeated tool calls
    const toolCallCounts = {};
    toolCalls.forEach(tool => {
      toolCallCounts[tool.name] = (toolCallCounts[tool.name] || 0) + 1;
    });
    
    console.log('\nTool Call Frequency:');
    Object.entries(toolCallCounts).forEach(([name, count]) => {
      console.log(`  ${name}: ${count} calls`);
      if (count > 3) {
        console.log(`  ⚠️  Warning: ${name} called ${count} times (possible loop)`);
      }
    });
    
    // Check for errors
    const errors = [...toolCalls, ...llmCalls].filter(call => call.error);
    if (errors.length > 0) {
      console.log('\n❌ ERRORS FOUND:');
      errors.forEach(err => {
        console.log(`  - ${err.name}: ${err.error}`);
      });
    }
    
    // Performance summary
    console.log('\n⚡ PERFORMANCE SUMMARY');
    console.log('=====================');
    console.log(`Average Tool Call Duration: ${toolCalls.length > 0 ? (totalToolDuration / toolCalls.length).toFixed(2) : 0}s`);
    console.log(`Average LLM Call Duration: ${llmCalls.length > 0 ? (totalLLMDuration / llmCalls.length).toFixed(2) : 0}s`);
    
    // Check for state loss pattern
    console.log('\n🔍 STATE LOSS CHECK');
    console.log('==================');
    const extractCalls = toolCalls.filter(t => t.name === 'extract_lead_info');
    if (extractCalls.length > 0) {
      console.log(`Found ${extractCalls.length} extract_lead_info calls`);
      extractCalls.forEach((call, idx) => {
        if (call.outputs?.update?.leadInfo) {
          const leadInfo = call.outputs.update.leadInfo;
          console.log(`\nExtraction ${idx + 1}:`);
          console.log(`  Fields: ${Object.keys(leadInfo).filter(k => leadInfo[k]).join(', ')}`);
          
          // Check if fields were lost
          if (idx > 0) {
            const prevCall = extractCalls[idx - 1];
            if (prevCall.outputs?.update?.leadInfo) {
              const prevLeadInfo = prevCall.outputs.update.leadInfo;
              const lostFields = Object.keys(prevLeadInfo).filter(k => 
                prevLeadInfo[k] && !leadInfo[k]
              );
              if (lostFields.length > 0) {
                console.log(`  ❌ FIELDS LOST: ${lostFields.join(', ')}`);
              }
            }
          }
        }
      });
    }
    
  } catch (error) {
    console.error('Error analyzing trace:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Run the analysis
analyzeTrace();