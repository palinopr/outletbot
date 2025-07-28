#!/usr/bin/env node
/**
 * LangSmith Trace Viewer
 * Analyzes traces to debug issues
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

const TRACE_IDS = {
  // Known problematic traces
  selfConversation: '1f06b3bc-8e5a-6d3d-aa19-f423acb8dc3c',
  contextContamination: '1f06b412-7aa4-6962-922c-65da2ce33823',
  noResponse: '1f06b149-1474-6632-a410-d17d5656da98',
  
  // Add more traces here as needed
};

async function viewTrace(traceId) {
  console.log('🔍 Trace Viewer\n');
  
  if (!traceId) {
    console.log('Available traces:');
    Object.entries(TRACE_IDS).forEach(([name, id]) => {
      console.log(`  ${name}: ${id}`);
    });
    console.log('\nUsage: node traces/trace-viewer.js <trace-id>');
    console.log('   or: node traces/trace-viewer.js <trace-name>');
    return;
  }
  
  // Check if it's a trace name
  const actualTraceId = TRACE_IDS[traceId] || traceId;
  
  console.log(`📊 Analyzing trace: ${actualTraceId}\n`);
  
  // Analysis categories
  console.log('1️⃣ Message Flow Analysis');
  console.log('   - Check how many messages were processed');
  console.log('   - Verify message types (Human vs AI)');
  console.log('   - Look for duplicate messages\n');
  
  console.log('2️⃣ Tool Call Analysis');
  console.log('   - Count tool invocations');
  console.log('   - Check for infinite loops');
  console.log('   - Verify tool responses\n');
  
  console.log('3️⃣ State Management');
  console.log('   - Check leadInfo updates');
  console.log('   - Verify conversation flow');
  console.log('   - Look for state corruption\n');
  
  console.log('4️⃣ Common Issues to Check:');
  console.log('   ❌ Self-conversation: Agent responding to its own messages');
  console.log('   ❌ Context contamination: Seeing other users\' data');
  console.log('   ❌ Infinite loops: Excessive tool calls');
  console.log('   ❌ No response: Agent fails to send message\n');
  
  console.log('📌 View in LangSmith:');
  console.log(`   https://smith.langchain.com/public/${actualTraceId}/r\n`);
  
  // Known issues for specific traces
  if (actualTraceId === TRACE_IDS.selfConversation) {
    console.log('⚠️  Known Issue: Self-Conversation');
    console.log('   The agent was seeing its own messages as new inputs.');
    console.log('   Fixed by: Only passing current message to agent\n');
  } else if (actualTraceId === TRACE_IDS.contextContamination) {
    console.log('⚠️  Known Issue: Context Contamination');
    console.log('   The agent was seeing "Juan" from another conversation.');
    console.log('   Fixed by: Skipping phone search in GHL\n');
  } else if (actualTraceId === TRACE_IDS.noResponse) {
    console.log('⚠️  Known Issue: No Response Sent');
    console.log('   The agent processed but didn\'t send message to GHL.');
    console.log('   Fixed by: Enforcing tool_choice: "required"\n');
  }
}

// Run the viewer
const traceId = process.argv[2];
viewTrace(traceId).catch(console.error);