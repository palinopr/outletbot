import { Client } from 'langsmith';
import { config } from 'dotenv';

config();

console.log('🔍 DEEP TRACE ANALYSIS: 1f06a375-5f3a-6153-a010-fa326d050ad7');
console.log('=========================================================\n');

async function deepDebug() {
  try {
    const client = new Client({
      apiKey: process.env.LANGSMITH_API_KEY
    });
    
    const traceId = '1f06a375-5f3a-6153-a010-fa326d050ad7';
    
    // Get ALL runs in the project around this time
    console.log('Fetching all runs in the time window...\n');
    
    const run = await client.readRun(traceId);
    const startTime = new Date(run.start_time);
    const endTime = new Date(startTime.getTime() + 60000); // 1 minute window
    
    console.log('🔍 STUCK RUN DETAILS:');
    console.log('ID:', traceId);
    console.log('Status:', run.status);
    console.log('Started:', startTime.toISOString());
    console.log('Project:', run.session_name || run.project_name);
    console.log('Input:', JSON.stringify(run.inputs));
    console.log('');
    
    // Get all runs in this session
    console.log('📋 LOOKING FOR RELATED RUNS...\n');
    
    const allRuns = await client.listRuns({
      projectName: run.session_name || 'outlet-media-bot',
      startTime: new Date(startTime.getTime() - 10000), // 10 seconds before
      endTime: endTime,
      limit: 100
    });
    
    const runs = [];
    for await (const r of allRuns) {
      runs.push(r);
    }
    
    // Sort by start time
    runs.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    
    console.log(`Found ${runs.length} runs in the time window\n`);
    
    // Find runs that might be related
    const relatedRuns = runs.filter(r => {
      // Check if it's related to our trace
      return r.id === traceId || 
             r.parent_run_id === traceId ||
             (r.start_time >= run.start_time && r.start_time <= endTime.toISOString());
    });
    
    console.log(`Found ${relatedRuns.length} potentially related runs:\n`);
    
    relatedRuns.forEach((r, index) => {
      const duration = r.end_time 
        ? ((new Date(r.end_time) - new Date(r.start_time)) / 1000).toFixed(2)
        : 'RUNNING';
        
      console.log(`${index + 1}. ${r.name}`);
      console.log(`   ID: ${r.id}`);
      console.log(`   Type: ${r.run_type}`);
      console.log(`   Status: ${r.status}`);
      console.log(`   Duration: ${duration}s`);
      console.log(`   Parent: ${r.parent_run_id || 'None'}`);
      
      if (r.error) {
        console.log(`   ❌ ERROR: ${r.error}`);
      }
      
      // Show inputs for pending runs
      if (r.status === 'pending' && r.inputs) {
        console.log(`   📥 Inputs: ${JSON.stringify(r.inputs).substring(0, 200)}...`);
      }
      
      console.log('');
    });
    
    // Analysis
    console.log('\n🚨 DIAGNOSIS:');
    
    const pendingRuns = relatedRuns.filter(r => r.status === 'pending');
    if (pendingRuns.length > 0) {
      console.log(`\n❌ STUCK RUNS (${pendingRuns.length}):`);
      pendingRuns.forEach(r => {
        console.log(`- ${r.name} (${r.run_type}) - Started: ${new Date(r.start_time).toISOString()}`);
      });
    }
    
    // Check the input message
    const inputMessage = JSON.parse(run.inputs.messages[0].content);
    console.log('\n📨 WEBHOOK INPUT:');
    console.log('Phone:', inputMessage.phone);
    console.log('Message:', inputMessage.message);
    console.log('ContactId:', inputMessage.contactId);
    
    console.log('\n🔍 LIKELY ISSUES:');
    console.log('1. The run started but no child runs were created');
    console.log('2. This suggests the webhook handler itself is stuck');
    console.log('3. Possible causes:');
    console.log('   - GHL service initialization failed');
    console.log('   - Conversation manager stuck fetching data');
    console.log('   - Network timeout to GHL API');
    console.log('   - The initialize() function is hanging');
    
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('1. Check if GHL API is responding (rate limits?)');
    console.log('2. The webhook received the message but got stuck before creating child runs');
    console.log('3. Most likely stuck at: conversationManager.getConversationState()');
    console.log('4. Or stuck at: initialize() when creating GHL service');
    
  } catch (error) {
    console.error('Failed:', error.message);
  }
}

deepDebug().catch(console.error);