#!/usr/bin/env node
import 'dotenv/config';
import { Client } from 'langsmith';

// Initialize LangSmith client
const client = new Client({
  apiKey: process.env.LANGSMITH_API_KEY,
});

const TRACE_ID = '1f069e31-e8a1-6033-b87f-cdde8e92f69c';

async function debugTrace() {
  console.log('🔍 Debugging LangGraph Trace:', TRACE_ID);
  console.log('=====================================\n');
  
  try {
    // Fetch the run details
    const run = await client.readRun(TRACE_ID);
    
    console.log('📊 Run Overview:');
    console.log('- Name:', run.name);
    console.log('- Status:', run.status);
    console.log('- Start Time:', new Date(run.start_time).toLocaleString());
    console.log('- End Time:', run.end_time ? new Date(run.end_time).toLocaleString() : 'Still running');
    console.log('- Total Tokens:', run.total_tokens || 'N/A');
    console.log('- Error:', run.error || 'None');
    
    // Check for errors
    if (run.error) {
      console.log('\n❌ ERROR FOUND:');
      console.log(run.error);
    }
    
    // Check if this is a webhook handler run
    const isWebhookHandler = run.name === 'webhook_handler' || run.name === 'LangGraph';
    console.log('\n🔄 Graph Type:', isWebhookHandler ? 'Webhook Handler' : 'Sales Agent');
    
    // Analyze inputs and outputs
    console.log('\n📥 Inputs:');
    console.log(JSON.stringify(run.inputs, null, 2));
    
    console.log('\n📤 Outputs:');
    console.log(JSON.stringify(run.outputs, null, 2));
    
    // Fetch child runs to analyze tool calls
    const childRunsIterator = client.listRuns({
      projectName: run.project_name || process.env.LANGCHAIN_PROJECT,
      filter: `eq(parent_run_id, "${TRACE_ID}")`,
      limit: 100
    });
    
    // Convert async iterator to array
    const childRuns = [];
    for await (const run of childRunsIterator) {
      childRuns.push(run);
    }
    
    console.log('\n🔧 Tool Calls Analysis:');
    console.log(`Total child runs: ${childRuns.length}`);
    
    // Analyze tool patterns
    const toolCalls = childRuns.filter(r => r.run_type === 'tool');
    const extractLeadInfoCalls = toolCalls.filter(r => r.name === 'extract_lead_info');
    const sendGHLMessageCalls = toolCalls.filter(r => r.name === 'send_ghl_message');
    
    console.log(`- extract_lead_info calls: ${extractLeadInfoCalls.length}`);
    console.log(`- send_ghl_message calls: ${sendGHLMessageCalls.length}`);
    console.log(`- Total tool calls: ${toolCalls.length}`);
    
    // Check for Command pattern issues
    console.log('\n🔍 Checking Command Pattern Usage:');
    let commandPatternIssues = 0;
    
    for (const toolCall of toolCalls) {
      if (toolCall.outputs) {
        const output = toolCall.outputs;
        
        // Check if tool returned a Command object
        if (!output.update && !output.goto && !output.graph) {
          console.log(`⚠️  Tool '${toolCall.name}' may not be returning Command object properly`);
          console.log(`   Output:`, JSON.stringify(output).substring(0, 100) + '...');
          commandPatternIssues++;
        }
      }
      
      // Check for errors in tool execution
      if (toolCall.error) {
        console.log(`❌ Error in tool '${toolCall.name}':`, toolCall.error);
      }
    }
    
    if (commandPatternIssues === 0) {
      console.log('✅ All tools appear to be using Command pattern correctly');
    }
    
    // Check for state management issues
    console.log('\n🔍 Checking State Management:');
    
    // Look for getCurrentTaskInput errors
    const errorMessages = childRuns
      .filter(r => r.error)
      .map(r => r.error);
    
    const scratchpadErrors = errorMessages.filter(e => 
      e.includes('scratchpad') || e.includes('getCurrentTaskInput')
    );
    
    if (scratchpadErrors.length > 0) {
      console.log('⚠️  Found getCurrentTaskInput/scratchpad errors:', scratchpadErrors.length);
      scratchpadErrors.forEach(e => console.log('   -', e));
    }
    
    // Check for extraction loop issues
    console.log('\n🔍 Checking for Extraction Loops:');
    if (extractLeadInfoCalls.length > 3) {
      console.log(`⚠️  Excessive extraction attempts: ${extractLeadInfoCalls.length} (max should be 3)`);
      console.log('   This indicates the circuit breaker may not be working properly');
    } else {
      console.log('✅ Extraction count within limits');
    }
    
    // Check message flow
    console.log('\n📨 Message Flow Analysis:');
    const inputMessages = run.inputs?.messages || [];
    const outputMessages = run.outputs?.messages || [];
    console.log(`- Input messages: ${inputMessages.length}`);
    console.log(`- Output messages: ${outputMessages.length}`);
    
    // Check for duplicate messages
    if (outputMessages.length > 0) {
      const duplicates = outputMessages.filter((msg, index) => 
        outputMessages.findIndex(m => 
          m.content === msg.content && m.role === msg.role
        ) !== index
      );
      
      if (duplicates.length > 0) {
        console.log(`⚠️  Found ${duplicates.length} duplicate messages in output`);
        duplicates.forEach(d => 
          console.log(`   - "${d.content.substring(0, 50)}..."`)
        );
      }
    }
    
    // Check for rapid-fire message handling
    const timestamps = inputMessages.map(m => m.timestamp || m.created_at).filter(Boolean);
    if (timestamps.length > 1) {
      const timeDiffs = [];
      for (let i = 1; i < timestamps.length; i++) {
        const diff = new Date(timestamps[i]) - new Date(timestamps[i-1]);
        timeDiffs.push(diff);
      }
      
      const rapidMessages = timeDiffs.filter(d => d < 5000).length;
      if (rapidMessages > 0) {
        console.log(`- Found ${rapidMessages} rapid-fire messages (< 5 seconds apart)`);
        console.log('  Should be handled by message consolidator');
      }
    }
    
    // Performance metrics
    console.log('\n📈 Performance Metrics:');
    const duration = run.end_time ? 
      (new Date(run.end_time) - new Date(run.start_time)) / 1000 : 
      'Still running';
    console.log(`- Execution time: ${duration} seconds`);
    console.log(`- Token usage: ${run.total_tokens || 'N/A'}`);
    console.log(`- Cost estimate: $${run.total_cost || 'N/A'}`);
    
    // Recommendations
    console.log('\n💡 Recommendations:');
    
    if (commandPatternIssues > 0) {
      console.log('1. Ensure all tools return Command objects with proper update fields');
    }
    
    if (extractLeadInfoCalls.length > 3) {
      console.log('2. Check circuit breaker implementation in extractLeadInfo tool');
    }
    
    if (scratchpadErrors.length > 0) {
      console.log('3. Verify getCurrentTaskInput is being called within proper context');
    }
    
    if (toolCalls.length > 15) {
      console.log('4. Consider optimizing tool call sequence to reduce costs');
    }
    
    console.log('\n✅ Trace analysis complete!');
    
  } catch (error) {
    console.error('❌ Error analyzing trace:', error.message);
    console.log('\nPossible reasons:');
    console.log('1. Invalid trace ID');
    console.log('2. LANGSMITH_API_KEY not set or invalid');
    console.log('3. Trace not found in your LangSmith project');
  }
}

// Run the debug script
debugTrace();