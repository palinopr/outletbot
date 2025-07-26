import { Client } from 'langsmith';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const client = new Client({
  apiKey: process.env.LANGSMITH_API_KEY,
  apiUrl: "https://api.smith.langchain.com"
});

async function debugTraceDeep(traceId) {
  console.log(`🔍 Deep Analysis of trace: ${traceId}\n`);
  
  const runs = [];
  for await (const run of client.listRuns({traceId: traceId})) {
    runs.push(run);
  }
  
  // Sort by start time
  runs.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  
  // Find the main agent run
  const agentRun = runs.find(run => run.name === 'sales_agent' || run.run_type === 'chain');
  
  if (!agentRun) {
    console.log('❌ No agent run found!');
    return;
  }
  
  console.log('📝 CONVERSATION FLOW ANALYSIS:\n');
  
  // Look at the initial message history
  console.log('1️⃣ INITIAL STATE:');
  console.log('Input messages:', JSON.stringify(agentRun.inputs.messages, null, 2));
  
  // Check if there's existing leadInfo in the output
  console.log('\n2️⃣ FINAL LEADINFO STATE:');
  console.log(JSON.stringify(agentRun.outputs.leadInfo, null, 2));
  
  // Analyze the conversation history
  console.log('\n3️⃣ MESSAGE HISTORY IN OUTPUT:');
  if (agentRun.outputs.messages) {
    console.log('Total messages in output:', agentRun.outputs.messages.length);
    
    // Extract human messages
    const humanMessages = agentRun.outputs.messages.filter(msg => 
      msg.role === 'human' || msg.kwargs?.content
    );
    
    console.log('\nHuman Messages Found:');
    humanMessages.forEach((msg, idx) => {
      console.log(`\n  Message ${idx + 1}:`);
      console.log(`  Content: ${msg.content || msg.kwargs?.content}`);
    });
  }
  
  // Look for previous conversation data
  console.log('\n\n4️⃣ LOOKING FOR PREVIOUS CONVERSATION DATA:');
  
  // Check if there's a "Hola" message in the history
  const hasHolaMessage = agentRun.outputs.messages?.some(msg => 
    msg.kwargs?.content === 'Hola'
  );
  
  console.log(`Found "Hola" message: ${hasHolaMessage}`);
  
  // Check the extract_lead_info calls
  console.log('\n\n5️⃣ EXTRACT_LEAD_INFO ANALYSIS:');
  
  const toolCalls = [];
  agentRun.outputs.messages?.forEach(msg => {
    if (msg.kwargs?.tool_calls) {
      msg.kwargs.tool_calls.forEach(tc => {
        toolCalls.push(tc);
      });
    }
  });
  
  const extractCalls = toolCalls.filter(tc => tc.name === 'extract_lead_info');
  console.log(`Found ${extractCalls.length} extract_lead_info calls`);
  
  extractCalls.forEach((call, idx) => {
    console.log(`\nCall ${idx + 1}:`);
    console.log('Arguments:', JSON.stringify(call.args, null, 2));
  });
  
  // Check what currentInfo was passed
  console.log('\n\n6️⃣ CURRENTINFO PASSED TO EXTRACT:');
  if (extractCalls.length > 0) {
    const currentInfo = extractCalls[0].args.currentInfo;
    console.log('Was empty:', Object.values(currentInfo).every(val => val === '' || val === 0));
    console.log('CurrentInfo:', JSON.stringify(currentInfo, null, 2));
  }
  
  // Check for context issues
  console.log('\n\n7️⃣ CONTEXT ISSUES DETECTED:');
  
  const issues = [];
  
  // Issue 1: Check if leadInfo has name but extract was called with empty currentInfo
  if (agentRun.outputs.leadInfo?.name && extractCalls.length > 0) {
    const firstExtract = extractCalls[0];
    if (firstExtract.args.currentInfo.name === '') {
      issues.push('❌ LeadInfo has name "' + agentRun.outputs.leadInfo.name + '" but extract_lead_info was called with empty currentInfo.name');
    }
  }
  
  // Issue 2: Check if there are previous messages but agent acts like it's first contact
  if (hasHolaMessage && toolCalls.some(tc => tc.name === 'send_ghl_message' && tc.args.message.includes('¿podrías decirme tu nombre'))) {
    issues.push('❌ Agent asked for name despite previous "Hola" message in history');
  }
  
  // Issue 3: Check if agent is ignoring existing leadInfo
  if (agentRun.outputs.leadInfo?.name) {
    const sendCalls = toolCalls.filter(tc => tc.name === 'send_ghl_message');
    const askedForName = sendCalls.some(tc => tc.args.message.includes('nombre'));
    if (askedForName) {
      issues.push('❌ Agent asked for name despite leadInfo already having name: ' + agentRun.outputs.leadInfo.name);
    }
  }
  
  if (issues.length > 0) {
    console.log('\nIssues found:');
    issues.forEach(issue => console.log(issue));
  } else {
    console.log('✅ No obvious context issues detected');
  }
  
  // Check message ordering
  console.log('\n\n8️⃣ MESSAGE ORDERING:');
  console.log('Messages in order:');
  agentRun.outputs.messages?.forEach((msg, idx) => {
    const type = msg.role || msg.id?.[2] || 'unknown';
    const content = msg.content || msg.kwargs?.content || 
                   (msg.kwargs?.tool_calls ? `[Tool calls: ${msg.kwargs.tool_calls.map(tc => tc.name).join(', ')}]` : '[No content]');
    console.log(`${idx + 1}. ${type}: ${content.substring(0, 100)}...`);
  });
}

// Run the deep analysis
debugTraceDeep('1f069bcc-9e0b-6a75-9e96-1e1332243273');