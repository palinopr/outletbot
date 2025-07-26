import { Client } from 'langsmith';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize LangSmith client
const client = new Client({
  apiKey: process.env.LANGSMITH_API_KEY
});

async function analyzeTrace(traceId) {
  try {
    console.log(`\n🔍 Analyzing LangSmith Trace: ${traceId}`);
    console.log('=' . repeat(80));

    // Fetch the main run
    const run = await client.readRun(traceId);
    
    console.log('\n📊 TRACE OVERVIEW:');
    console.log(`- Name: ${run.name}`);
    console.log(`- Status: ${run.status}`);
    console.log(`- Start Time: ${new Date(run.start_time).toISOString()}`);
    console.log(`- End Time: ${run.end_time ? new Date(run.end_time).toISOString() : 'Still running'}`);
    console.log(`- Duration: ${run.end_time ? ((new Date(run.end_time) - new Date(run.start_time)) / 1000).toFixed(2) + 's' : 'N/A'}`);
    console.log(`- Total Tokens: ${run.total_tokens || 0}`);
    console.log(`- Total Cost: $${run.total_cost?.toFixed(4) || '0.0000'}`);
    
    if (run.error) {
      console.log(`\n❌ ERROR: ${run.error}`);
    }

    // Analyze inputs
    console.log('\n📥 INPUTS:');
    if (run.inputs) {
      console.log(JSON.stringify(run.inputs, null, 2));
    }

    // Analyze outputs
    console.log('\n📤 OUTPUTS:');
    if (run.outputs) {
      console.log(JSON.stringify(run.outputs, null, 2));
    }

    // Fetch child runs to understand the flow
    const childRuns = [];
    for await (const childRun of client.listRuns({
      projectName: run.session_id ? undefined : 'outlet-media-bot',
      filter: `eq(parent_run_id, "${traceId}")`
    })) {
      childRuns.push(childRun);
    }

    console.log(`\n🔄 EXECUTION FLOW (${childRuns.length} steps):`);
    
    // Sort child runs by start time
    childRuns.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    // Group runs by type
    const runsByType = {
      tool: [],
      llm: [],
      chain: [],
      other: []
    };

    childRuns.forEach((child, index) => {
      const duration = child.end_time ? 
        ((new Date(child.end_time) - new Date(child.start_time)) / 1000).toFixed(2) : 'N/A';
      
      console.log(`\n${index + 1}. ${child.name}`);
      console.log(`   - Type: ${child.run_type}`);
      console.log(`   - Status: ${child.status}`);
      console.log(`   - Duration: ${duration}s`);
      
      if (child.error) {
        console.log(`   - ❌ Error: ${child.error}`);
      }

      // Categorize runs
      if (child.run_type === 'tool') {
        runsByType.tool.push(child);
        console.log(`   - Tool Input: ${JSON.stringify(child.inputs).substring(0, 100)}...`);
        if (child.outputs) {
          console.log(`   - Tool Output: ${JSON.stringify(child.outputs).substring(0, 100)}...`);
        }
      } else if (child.run_type === 'llm') {
        runsByType.llm.push(child);
        if (child.outputs?.generations?.[0]?.[0]?.text) {
          console.log(`   - LLM Response: ${child.outputs.generations[0][0].text.substring(0, 150)}...`);
        }
      } else if (child.run_type === 'chain') {
        runsByType.chain.push(child);
      } else {
        runsByType.other.push(child);
      }
    });

    // Summary statistics
    console.log('\n📊 EXECUTION SUMMARY:');
    console.log(`- Tool Calls: ${runsByType.tool.length}`);
    console.log(`- LLM Calls: ${runsByType.llm.length}`);
    console.log(`- Chain Calls: ${runsByType.chain.length}`);
    console.log(`- Other: ${runsByType.other.length}`);

    // Analyze tool usage pattern
    if (runsByType.tool.length > 0) {
      console.log('\n🛠️  TOOL USAGE ANALYSIS:');
      const toolCounts = {};
      runsByType.tool.forEach(toolRun => {
        const toolName = toolRun.name;
        toolCounts[toolName] = (toolCounts[toolName] || 0) + 1;
      });
      
      Object.entries(toolCounts).forEach(([tool, count]) => {
        console.log(`- ${tool}: ${count} calls`);
      });
    }

    // Check for specific patterns
    console.log('\n🔍 PATTERN ANALYSIS:');
    
    // Check for extractLeadInfo loops
    const extractLeadInfoCalls = runsByType.tool.filter(r => r.name === 'extractLeadInfo');
    if (extractLeadInfoCalls.length > 3) {
      console.log(`⚠️  WARNING: extractLeadInfo called ${extractLeadInfoCalls.length} times (potential loop)`);
    }

    // Check for duplicate messages
    const sendMessageCalls = runsByType.tool.filter(r => r.name === 'sendGHLMessage');
    if (sendMessageCalls.length > 0) {
      console.log(`- Messages sent: ${sendMessageCalls.length}`);
      
      // Check for duplicate content
      const messageContents = sendMessageCalls
        .map(call => call.inputs?.message || call.inputs?.input?.message)
        .filter(Boolean);
      
      const uniqueMessages = [...new Set(messageContents)];
      if (messageContents.length > uniqueMessages.length) {
        console.log(`⚠️  WARNING: Duplicate messages detected (${messageContents.length} total, ${uniqueMessages.length} unique)`);
      }
    }

    // Check conversation flow
    const hasAppointmentBooked = runsByType.tool.some(r => r.name === 'bookAppointment' && r.status === 'success');
    const hasCalendarFetched = runsByType.tool.some(r => r.name === 'getCalendarSlots');
    
    console.log(`\n✅ CONVERSATION MILESTONES:`);
    console.log(`- Lead Info Extracted: ${extractLeadInfoCalls.length > 0 ? 'Yes' : 'No'}`);
    console.log(`- Calendar Shown: ${hasCalendarFetched ? 'Yes' : 'No'}`);
    console.log(`- Appointment Booked: ${hasAppointmentBooked ? 'Yes' : 'No'}`);

    // Cost analysis
    const totalLLMCost = runsByType.llm.reduce((sum, run) => sum + (run.total_cost || 0), 0);
    console.log(`\n💰 COST BREAKDOWN:`);
    console.log(`- Total LLM Cost: $${totalLLMCost.toFixed(4)}`);
    console.log(`- Average per LLM call: $${runsByType.llm.length > 0 ? (totalLLMCost / runsByType.llm.length).toFixed(4) : '0.0000'}`);

  } catch (error) {
    console.error('Error analyzing trace:', error);
    console.error('Error details:', error.response?.data || error.message);
  }
}

// Run the analysis
const traceId = '1f06a415-0081-608f-adce-537c1ffe8d2a';
analyzeTrace(traceId);