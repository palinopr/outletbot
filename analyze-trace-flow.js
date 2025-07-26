import { Client } from 'langsmith';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const client = new Client({
  apiKey: process.env.LANGSMITH_API_KEY,
  apiUrl: "https://api.smith.langchain.com"
});

async function analyzeTraceFlow(traceId) {
  console.log(`🔍 Analyzing trace flow: ${traceId}\n`);
  
  const runs = [];
  try {
    for await (const run of client.listRuns({traceId: traceId})) {
      runs.push(run);
    }
    
    // Sort runs by start time
    runs.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    
    // Track conversation flow
    const conversationFlow = [];
    const toolCalls = [];
    const errors = [];
    
    // Extract key information
    runs.forEach(run => {
      // Look for tool calls
      if (run.outputs?.messages) {
        run.outputs.messages.forEach(msg => {
          // Tool calls
          if (msg.kwargs?.tool_calls) {
            msg.kwargs.tool_calls.forEach(tc => {
              toolCalls.push({
                tool: tc.name,
                args: tc.args,
                time: new Date(run.start_time).toISOString(),
                runName: run.name
              });
              
              // Track conversation flow
              if (tc.name === 'send_ghl_message') {
                conversationFlow.push({
                  type: 'bot',
                  message: tc.args.message,
                  time: new Date(run.start_time).toISOString()
                });
              }
            });
          }
          
          // Tool responses
          if (msg.kwargs?.name === 'extract_lead_info' && msg.kwargs?.content) {
            try {
              const extracted = JSON.parse(msg.kwargs.content);
              if (Object.keys(extracted).length > 0) {
                conversationFlow.push({
                  type: 'extracted',
                  data: extracted,
                  time: new Date(run.start_time).toISOString()
                });
              }
            } catch (e) {}
          }
        });
      }
      
      // Look for human messages
      if (run.inputs?.messages) {
        run.inputs.messages.forEach(msg => {
          if (msg.role === 'human' || msg.kwargs?.content) {
            const content = msg.content || msg.kwargs?.content || '';
            if (content && !content.includes('contactId')) {
              conversationFlow.push({
                type: 'human',
                message: content,
                time: new Date(run.start_time).toISOString()
              });
            }
          }
        });
      }
      
      // Track errors
      if (run.error || run.status === 'error') {
        errors.push({
          runName: run.name,
          error: run.error,
          time: new Date(run.start_time).toISOString()
        });
      }
    });
    
    // Analyze conversation flow
    console.log('📊 CONVERSATION FLOW ANALYSIS\n');
    console.log('Expected 7-step flow:');
    console.log('1. Greeting → Ask for name');
    console.log('2. Get name → Ask about problem');
    console.log('3. Get problem → Ask about goal');
    console.log('4. Get goal → Ask about budget');
    console.log('5. Get budget → Ask for email (if budget >= $300)');
    console.log('6. Get email → Show calendar slots');
    console.log('7. Get time selection → Book appointment\n');
    
    console.log('ACTUAL FLOW:\n');
    
    // Clean up and deduplicate conversation flow
    const cleanFlow = [];
    let lastMessage = '';
    conversationFlow.forEach(item => {
      if (item.type === 'human' && item.message !== lastMessage) {
        cleanFlow.push(item);
        lastMessage = item.message;
      } else if (item.type === 'bot') {
        cleanFlow.push(item);
      } else if (item.type === 'extracted') {
        cleanFlow.push(item);
      }
    });
    
    cleanFlow.forEach((item, index) => {
      if (item.type === 'human') {
        console.log(`👤 Customer: "${item.message}"`);
      } else if (item.type === 'bot') {
        console.log(`🤖 Bot: "${item.message}"`);
      } else if (item.type === 'extracted') {
        console.log(`📝 Extracted: ${JSON.stringify(item.data)}`);
      }
    });
    
    // Analyze tool usage
    console.log('\n\n📊 TOOL USAGE SUMMARY:\n');
    const toolSummary = {};
    toolCalls.forEach(tc => {
      toolSummary[tc.tool] = (toolSummary[tc.tool] || 0) + 1;
    });
    
    Object.entries(toolSummary).forEach(([tool, count]) => {
      console.log(`  ${tool}: ${count} calls`);
    });
    
    // Show detailed tool calls
    console.log('\n📞 DETAILED TOOL CALLS:\n');
    toolCalls.forEach((tc, index) => {
      console.log(`${index + 1}. ${tc.tool}`);
      if (tc.tool === 'send_ghl_message') {
        console.log(`   Message: "${tc.args.message}"`);
      } else if (tc.tool === 'update_ghl_contact') {
        console.log(`   Tags: ${JSON.stringify(tc.args.tags)}`);
        if (tc.args.leadInfo) {
          console.log(`   Lead Info: ${JSON.stringify(tc.args.leadInfo)}`);
        }
      } else if (tc.tool === 'extract_lead_info') {
        console.log(`   Message analyzed: "${tc.args.message}"`);
      }
      console.log('');
    });
    
    // Track what information was collected
    console.log('\n📋 INFORMATION COLLECTED:\n');
    const collectedInfo = {
      name: null,
      problem: null,
      goal: null,
      budget: null,
      email: null
    };
    
    toolCalls.forEach(tc => {
      if (tc.tool === 'update_ghl_contact' && tc.args.leadInfo) {
        Object.assign(collectedInfo, tc.args.leadInfo);
      }
    });
    
    console.log(`✓ Name: ${collectedInfo.name || '❌ Not collected'}`);
    console.log(`✓ Problem: ${collectedInfo.problem || '❌ Not collected'}`);
    console.log(`✓ Goal: ${collectedInfo.goal || '❌ Not collected'}`);
    console.log(`✓ Budget: ${collectedInfo.budget || '❌ Not collected'}`);
    console.log(`✓ Email: ${collectedInfo.email || '❌ Not collected'}`);
    
    // Show errors if any
    if (errors.length > 0) {
      console.log('\n\n❌ ERRORS FOUND:\n');
      errors.forEach(err => {
        console.log(`- ${err.runName}: ${err.error}`);
      });
    }
    
    // Analysis summary
    console.log('\n\n🎯 FLOW ANALYSIS:\n');
    if (collectedInfo.name) {
      console.log('✅ Step 1: Name collected');
    } else {
      console.log('❌ Step 1: Name NOT collected');
    }
    
    const flowSteps = [];
    if (collectedInfo.name) flowSteps.push('name');
    if (collectedInfo.problem) flowSteps.push('problem');
    if (collectedInfo.goal) flowSteps.push('goal');
    if (collectedInfo.budget) flowSteps.push('budget');
    if (collectedInfo.email) flowSteps.push('email');
    
    console.log(`\nProgress: Collected ${flowSteps.length}/5 required fields`);
    console.log(`Fields: ${flowSteps.join(' → ')}`);
    
    if (flowSteps.length < 5) {
      console.log(`\n⚠️  Conversation stopped at step ${flowSteps.length + 1}`);
      console.log(`Next expected: Ask about ${['name', 'problem', 'goal', 'budget', 'email'].find(f => !flowSteps.includes(f))}`);
    }
    
  } catch (error) {
    console.error('Error analyzing trace:', error);
    throw error;
  }
}

// Execute the analysis
analyzeTraceFlow('1f069b4c-7f1e-667e-a6ad-062fd0c90146')
  .then(() => console.log('\n✅ Analysis complete'))
  .catch(console.error);