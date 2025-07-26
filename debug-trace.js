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
  for await (const run of client.listRuns({traceId: traceId})) {
    runs.push(run);
  }
  
  console.log(`Found ${runs.length} runs in trace\n`);
  
  // Sort runs by start time to see the flow
  runs.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  
  // Find the main agent run
  const agentRun = runs.find(run => run.name === 'sales_agent' || run.run_type === 'chain');
  
  if (agentRun) {
    console.log('🤖 AGENT RUN ANALYSIS:');
    console.log(`Status: ${agentRun.status}`);
    console.log(`Error: ${agentRun.error || 'None'}`);
    
    // Check inputs
    console.log('\n📥 INPUTS:');
    console.log(JSON.stringify(agentRun.inputs, null, 2));
    
    // Check outputs
    console.log('\n📤 OUTPUTS:');
    console.log(JSON.stringify(agentRun.outputs, null, 2));
    
    // Look for tool calls in the outputs
    if (agentRun.outputs?.messages) {
      console.log('\n🔧 TOOL CALLS:');
      agentRun.outputs.messages.forEach((msg, idx) => {
        if (msg.kwargs?.tool_calls) {
          console.log(`\nMessage ${idx}:`);
          msg.kwargs.tool_calls.forEach(tool => {
            console.log(`  Tool: ${tool.name}`);
            console.log(`  Args: ${JSON.stringify(tool.args, null, 2)}`);
          });
        }
      });
    }
  }
  
  // Look for tool execution runs
  console.log('\n\n🛠️ TOOL EXECUTIONS:');
  const toolRuns = runs.filter(run => run.run_type === 'tool');
  
  toolRuns.forEach(toolRun => {
    console.log(`\nTool: ${toolRun.name}`);
    console.log(`Status: ${toolRun.status}`);
    console.log(`Inputs: ${JSON.stringify(toolRun.inputs, null, 2)}`);
    console.log(`Outputs: ${JSON.stringify(toolRun.outputs, null, 2)}`);
    if (toolRun.error) {
      console.log(`Error: ${toolRun.error}`);
    }
  });
  
  // Check for context/state issues
  console.log('\n\n🧠 CONTEXT ANALYSIS:');
  
  // Look for extractLeadInfo calls to see what's being captured
  const extractCalls = toolRuns.filter(run => run.name === 'extractLeadInfo');
  console.log(`\nFound ${extractCalls.length} extractLeadInfo calls:`);
  
  extractCalls.forEach((call, idx) => {
    console.log(`\nCall ${idx + 1}:`);
    console.log(`Input message: ${call.inputs?.message}`);
    console.log(`Extracted info: ${JSON.stringify(call.outputs, null, 2)}`);
  });
  
  // Look for sendGHLMessage calls to see what's being sent
  const sendCalls = toolRuns.filter(run => run.name === 'sendGHLMessage');
  console.log(`\n\nFound ${sendCalls.length} sendGHLMessage calls:`);
  
  sendCalls.forEach((call, idx) => {
    console.log(`\nMessage ${idx + 1}:`);
    console.log(`Content: ${call.inputs?.message}`);
    console.log(`LeadInfo at time: ${JSON.stringify(call.inputs?.leadInfo, null, 2)}`);
  });
}

// Run the debug
debugTrace('1f069bcc-9e0b-6a75-9e96-1e1332243273');