import { Client } from 'langsmith';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const client = new Client({
  apiKey: process.env.LANGSMITH_API_KEY,
  apiUrl: "https://api.smith.langchain.com"
});

async function analyzeToolCalls(traceId) {
  console.log(`🔍 Analyzing tool calls in trace: ${traceId}\n`);
  
  try {
    const runs = [];
    const toolCalls = [];
    
    // Fetch all runs for this trace
    for await (const run of client.listRuns({ traceId: traceId })) {
      runs.push(run);
      
      // Extract tool calls from AI messages
      if (run.outputs?.messages) {
        run.outputs.messages.forEach(msg => {
          if (msg.kwargs?.tool_calls) {
            msg.kwargs.tool_calls.forEach(tc => {
              toolCalls.push({
                runId: run.id,
                runName: run.name,
                time: new Date(run.start_time),
                toolName: tc.name,
                toolId: tc.id,
                args: tc.args,
                messageIndex: run.outputs.messages.indexOf(msg)
              });
            });
          }
        });
      }
    }
    
    console.log(`📊 Total runs: ${runs.length}`);
    console.log(`🔧 Total tool calls: ${toolCalls.length}\n`);
    
    // Filter for send_ghl_message calls
    const sendMessageCalls = toolCalls.filter(tc => 
      tc.toolName === 'send_ghl_message' || tc.toolName === 'sendGHLMessage'
    );
    
    console.log('📨 SEND MESSAGE TOOL CALLS:');
    console.log('=' .repeat(80));
    console.log(`Found ${sendMessageCalls.length} send message tool calls\n`);
    
    sendMessageCalls.forEach((call, idx) => {
      console.log(`${idx + 1}. Tool Call`);
      console.log(`   Time: ${call.time.toISOString()}`);
      console.log(`   Tool ID: ${call.toolId}`);
      console.log(`   Run Name: ${call.runName}`);
      console.log(`   Run ID: ${call.runId}`);
      console.log(`   Message: "${call.args.message || 'N/A'}"`);
      console.log(`   Contact ID: ${call.args.contactId || 'Not specified'}`);
      console.log('');
    });
    
    // Check for duplicate messages
    const messageGroups = {};
    sendMessageCalls.forEach(call => {
      const msg = call.args.message || 'N/A';
      if (!messageGroups[msg]) {
        messageGroups[msg] = [];
      }
      messageGroups[msg].push(call);
    });
    
    console.log('\n🔍 DUPLICATE MESSAGE ANALYSIS:');
    console.log('=' .repeat(80));
    
    for (const [message, calls] of Object.entries(messageGroups)) {
      if (calls.length > 1) {
        console.log(`\n⚠️  DUPLICATE DETECTED!`);
        console.log(`   Message: "${message}"`);
        console.log(`   Called ${calls.length} times:`);
        
        calls.forEach((call, idx) => {
          console.log(`   ${idx + 1}. ${call.time.toISOString()} in run: ${call.runName}`);
        });
      }
    }
    
    // Look for the specific message mentioned
    console.log('\n\n🎯 SEARCHING FOR SPECIFIC MESSAGE:');
    console.log('=' .repeat(80));
    console.log('Looking for: "Martes 29 de julio a las 8:00am"');
    
    const specificMessage = "Martes 29 de julio a las 8:00am";
    const relatedCalls = toolCalls.filter(tc => 
      JSON.stringify(tc.args).includes(specificMessage) ||
      JSON.stringify(tc.args).includes("8:00am") ||
      JSON.stringify(tc.args).includes("Martes")
    );
    
    if (relatedCalls.length > 0) {
      console.log(`\nFound ${relatedCalls.length} related tool calls:`);
      relatedCalls.forEach((call, idx) => {
        console.log(`\n${idx + 1}. ${call.toolName}`);
        console.log(`   Time: ${call.time.toISOString()}`);
        console.log(`   Args: ${JSON.stringify(call.args, null, 2)}`);
      });
    } else {
      console.log('\n❌ No tool calls found with that specific message');
    }
    
    // Check the last few messages to understand context
    console.log('\n\n📝 LAST FEW SEND MESSAGE CALLS:');
    console.log('=' .repeat(80));
    
    const lastFewSends = sendMessageCalls.slice(-5);
    lastFewSends.forEach((call, idx) => {
      console.log(`\n${idx + 1}. Message at ${call.time.toISOString()}`);
      console.log(`   Content: "${call.args.message || 'N/A'}"`);
    });
    
  } catch (error) {
    console.error('❌ Error analyzing trace:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the analysis
analyzeToolCalls('1f069d21-94ce-6de8-8c1f-5c7847068fe2');