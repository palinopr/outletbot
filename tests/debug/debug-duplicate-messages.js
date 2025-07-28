import { Client } from 'langsmith';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const client = new Client({
  apiKey: process.env.LANGSMITH_API_KEY,
  apiUrl: "https://api.smith.langchain.com"
});

async function analyzeDuplicateMessages(traceId) {
  console.log(`🔍 Analyzing duplicate messages in trace: ${traceId}\n`);
  
  try {
    const runs = [];
    const messageSends = [];
    const webhookCalls = [];
    
    // Fetch all runs for this trace
    for await (const run of client.listRuns({ traceId: traceId })) {
      runs.push(run);
      
      // Track sendGHLMessage calls
      if (run.name === 'sendGHLMessage' || run.name === 'send_ghl_message') {
        messageSends.push({
          id: run.id,
          name: run.name,
          startTime: new Date(run.start_time),
          status: run.status,
          message: run.inputs?.message || 'N/A',
          contactId: run.inputs?.contactId || 'N/A',
          outputs: run.outputs
        });
      }
      
      // Track webhook handler calls
      if (run.name === 'handleMetaLeadWebhook' || run.name === 'langgraph-api' || run.name === 'webhook') {
        webhookCalls.push({
          id: run.id,
          name: run.name,
          startTime: new Date(run.start_time),
          status: run.status,
          inputs: run.inputs
        });
      }
    }
    
    console.log(`📊 Total runs: ${runs.length}`);
    console.log(`📨 Total message sends: ${messageSends.length}`);
    console.log(`🔗 Total webhook calls: ${webhookCalls.length}\n`);
    
    // Analyze message sends
    if (messageSends.length > 0) {
      console.log('📨 MESSAGE SEND DETAILS:');
      console.log('=' .repeat(80));
      
      const messageGroups = {};
      
      messageSends.forEach((send, idx) => {
        console.log(`\n${idx + 1}. Message Send`);
        console.log(`   Time: ${send.startTime.toISOString()}`);
        console.log(`   Message: "${send.message}"`);
        console.log(`   Contact ID: ${send.contactId}`);
        console.log(`   Status: ${send.status}`);
        
        // Group by message content
        if (!messageGroups[send.message]) {
          messageGroups[send.message] = [];
        }
        messageGroups[send.message].push(send);
      });
      
      // Check for duplicates
      console.log('\n\n🔍 DUPLICATE ANALYSIS:');
      console.log('=' .repeat(80));
      
      let duplicatesFound = false;
      for (const [message, sends] of Object.entries(messageGroups)) {
        if (sends.length > 1) {
          duplicatesFound = true;
          console.log(`\n⚠️  DUPLICATE MESSAGE DETECTED!`);
          console.log(`   Message: "${message}"`);
          console.log(`   Sent ${sends.length} times:`);
          
          sends.forEach((send, idx) => {
            console.log(`   ${idx + 1}. ${send.startTime.toISOString()} - Status: ${send.status}`);
          });
          
          // Calculate time between sends
          if (sends.length > 1) {
            const timeDiffs = [];
            for (let i = 1; i < sends.length; i++) {
              const diff = (sends[i].startTime - sends[i-1].startTime) / 1000;
              timeDiffs.push(diff);
            }
            console.log(`   Time between sends: ${timeDiffs.map(d => d + 's').join(', ')}`);
          }
        }
      }
      
      if (!duplicatesFound) {
        console.log('\n✅ No duplicate messages found');
      }
    }
    
    // Analyze webhook calls
    if (webhookCalls.length > 0) {
      console.log('\n\n🔗 WEBHOOK CALL ANALYSIS:');
      console.log('=' .repeat(80));
      
      webhookCalls.forEach((call, idx) => {
        console.log(`\n${idx + 1}. Webhook Call`);
        console.log(`   Time: ${call.startTime.toISOString()}`);
        console.log(`   Name: ${call.name}`);
        console.log(`   Status: ${call.status}`);
        if (call.inputs?.message) {
          console.log(`   Incoming message: "${call.inputs.message}"`);
        }
      });
      
      if (webhookCalls.length > 1) {
        console.log(`\n⚠️  MULTIPLE WEBHOOK CALLS DETECTED!`);
        console.log(`   This could indicate duplicate webhook processing`);
        
        // Check time between calls
        const timeDiffs = [];
        for (let i = 1; i < webhookCalls.length; i++) {
          const diff = (webhookCalls[i].startTime - webhookCalls[i-1].startTime) / 1000;
          timeDiffs.push(diff);
        }
        console.log(`   Time between calls: ${timeDiffs.map(d => d + 's').join(', ')}`);
      }
    }
    
    // Look for specific patterns
    console.log('\n\n🔎 PATTERN ANALYSIS:');
    console.log('=' .repeat(80));
    
    // Check for tool calls in AI messages
    const aiMessages = runs.filter(r => r.outputs?.messages);
    let totalToolCalls = 0;
    let sendMessageToolCalls = 0;
    
    aiMessages.forEach(run => {
      if (run.outputs.messages) {
        run.outputs.messages.forEach(msg => {
          if (msg.kwargs?.tool_calls) {
            totalToolCalls += msg.kwargs.tool_calls.length;
            msg.kwargs.tool_calls.forEach(tc => {
              if (tc.name === 'send_ghl_message' || tc.name === 'sendGHLMessage') {
                sendMessageToolCalls++;
              }
            });
          }
        });
      }
    });
    
    console.log(`\nTotal tool calls: ${totalToolCalls}`);
    console.log(`Send message tool calls: ${sendMessageToolCalls}`);
    console.log(`Actual message sends: ${messageSends.length}`);
    
    if (sendMessageToolCalls !== messageSends.length) {
      console.log(`\n⚠️  MISMATCH: ${sendMessageToolCalls} tool calls but ${messageSends.length} actual sends`);
    }
    
    // Check for errors
    const errors = runs.filter(r => r.error || r.status === 'error');
    if (errors.length > 0) {
      console.log(`\n\n❌ ERRORS FOUND:`);
      console.log('=' .repeat(80));
      errors.forEach((run, idx) => {
        console.log(`\n${idx + 1}. ${run.name}`);
        console.log(`   Time: ${new Date(run.start_time).toISOString()}`);
        console.log(`   Error: ${run.error || 'Unknown error'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error analyzing trace:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the analysis
analyzeDuplicateMessages('1f069d21-94ce-6de8-8c1f-5c7847068fe2');