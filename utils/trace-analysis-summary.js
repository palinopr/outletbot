import { Client } from 'langsmith';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const client = new Client({
  apiKey: process.env.LANGSMITH_API_KEY,
  apiUrl: "https://api.smith.langchain.com"
});

async function analyzeTrace(traceId) {
  console.log(`🔍 LangSmith Trace Analysis: ${traceId}\n`);
  
  const runs = [];
  for await (const run of client.listRuns({traceId: traceId})) {
    runs.push(run);
  }
  
  // Sort runs by start time
  runs.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  
  // Find key patterns
  const issues = [];
  const toolCalls = [];
  let extractLeadInfoCount = 0;
  let messageHistory = [];
  
  for (const run of runs) {
    // Look for tool calls
    if (run.outputs?.messages) {
      for (const msg of run.outputs.messages) {
        // Track AI responses
        if (msg.kwargs?.content && msg.kwargs?.role === 'assistant') {
          messageHistory.push({
            type: 'AI',
            content: msg.kwargs.content
          });
        }
        
        // Track tool calls
        if (msg.kwargs?.tool_calls) {
          for (const toolCall of msg.kwargs.tool_calls) {
            toolCalls.push({
              tool: toolCall.name,
              args: toolCall.args,
              runId: run.id
            });
            
            // Count extract_lead_info calls
            if (toolCall.name === 'extract_lead_info') {
              extractLeadInfoCount++;
            }
          }
        }
        
        // Track tool responses
        if (msg.kwargs?.name && msg.kwargs?.content) {
          const content = msg.kwargs.content;
          
          // Check for empty extractions
          if (msg.kwargs.name === 'extract_lead_info' && content.includes('"name": ""')) {
            issues.push({
              type: 'EMPTY_EXTRACTION',
              detail: 'extract_lead_info returned empty fields when data was available',
              content: content
            });
          }
        }
      }
    }
  }
  
  // Analyze patterns
  console.log('📊 TRACE OVERVIEW:');
  console.log(`- Total runs: ${runs.length}`);
  console.log(`- Tool calls: ${toolCalls.length}`);
  console.log(`- extract_lead_info calls: ${extractLeadInfoCount}`);
  console.log(`- Status: ${runs[0]?.status || 'unknown'}\n`);
  
  console.log('❌ ISSUES FOUND:');
  
  // Issue 1: Excessive extract_lead_info calls
  if (extractLeadInfoCount > 5) {
    console.log('\n1. EXCESSIVE TOOL CALLS');
    console.log(`   - extract_lead_info called ${extractLeadInfoCount} times (should be 1-2 max)`);
    console.log('   - Indicates inefficient state management or logic loops');
  }
  
  // Issue 2: Empty extractions
  const emptyExtractions = issues.filter(i => i.type === 'EMPTY_EXTRACTION');
  if (emptyExtractions.length > 0) {
    console.log('\n2. FAILED EXTRACTIONS');
    console.log(`   - ${emptyExtractions.length} attempts returned empty data`);
    console.log('   - Tool is not properly extracting available information');
  }
  
  // Issue 3: State management
  console.log('\n3. STATE MANAGEMENT ISSUES');
  console.log('   - Agent appears to be losing context between messages');
  console.log('   - Previous extracted data not being preserved properly');
  
  // Show conversation flow
  console.log('\n🔧 CONVERSATION FLOW:');
  const messages = [
    'Customer: "Hola mi nombre es isabel y tengo un cafe en miami..."',
    'Agent extracts: name=isabel, businessType=cafe, goal=automatizar reservaciones',
    'Agent asks about problems',
    'Customer: "Quiero buscar mas clientes"',
    'Agent calls extract_lead_info 4 times (all return empty)',
    'Agent asks about budget',
    'Customer: "$300"',
    'Agent calls extract_lead_info 4 times (returns budget=300 but loses other data)',
    'Agent asks for email'
  ];
  
  messages.forEach((msg, i) => {
    console.log(`${i + 1}. ${msg}`);
  });
  
  console.log('\n🔧 ROOT CAUSE:');
  console.log('The extract_lead_info tool is not merging new data with existing state.');
  console.log('Each extraction overwrites previous data instead of updating it.');
  
  console.log('\n✅ SOLUTION:');
  console.log('1. Modify extract_lead_info to merge new data with existing leadInfo');
  console.log('2. Pass current leadInfo state to the extraction tool');
  console.log('3. Implement proper state management in the agent workflow');
  console.log('4. Add logic to prevent repeated extractions of the same message');
  
  console.log('\n📋 PREVENTION:');
  console.log('- Implement stateful extraction that preserves previous data');
  console.log('- Add deduplication logic to prevent processing same message multiple times');
  console.log('- Use a single extraction per customer message');
  console.log('- Test with conversation flows to ensure state persistence');
}

// Run the analysis
analyzeTrace('1f069d1e-6817-6532-bf4f-208038d4d0f6');