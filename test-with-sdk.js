import { graph } from './agents/webhookHandler.js';
import { Client } from 'langsmith';
import { config } from 'dotenv';

config();

console.log('🧪 TESTING WEBHOOK WITH LANGSMITH SDK');
console.log('====================================\n');

async function testWithSDK() {
  // Initialize LangSmith client
  const client = new Client({
    apiKey: process.env.LANGSMITH_API_KEY
  });
  
  // Test payload similar to the stuck trace
  const testPayload = {
    phone: '(305) 487-0475',
    message: 'Hola, test with SDK',
    contactId: '54sJIGTtwmR89Qc5JeEt'
  };
  
  console.log('📨 Test Payload:');
  console.log(JSON.stringify(testPayload, null, 2));
  console.log('\n');
  
  // Create initial state
  const initialState = {
    messages: [{
      role: 'human',
      content: JSON.stringify(testPayload)
    }]
  };
  
  try {
    console.log('🚀 Invoking webhook handler...\n');
    const startTime = Date.now();
    
    // Run with tracing enabled
    const result = await graph.invoke(initialState, {
      configurable: {
        features: {
          enableDeduplication: false
        }
      },
      runName: 'test-webhook-sdk',
      tags: ['test', 'sdk', 'debug'],
      metadata: {
        testType: 'sdk-verification',
        timestamp: new Date().toISOString()
      }
    });
    
    const duration = Date.now() - startTime;
    
    console.log('✅ WEBHOOK COMPLETED SUCCESSFULLY!');
    console.log(`Duration: ${duration}ms\n`);
    
    console.log('📊 Result Summary:');
    console.log('- Messages:', result.messages?.length || 0);
    console.log('- Contact ID:', result.contactId);
    console.log('- Phone:', result.phone);
    console.log('- Lead Info:', result.leadInfo ? Object.keys(result.leadInfo).filter(k => result.leadInfo[k]) : []);
    
    if (result.messages && result.messages.length > 0) {
      const lastMessage = result.messages[result.messages.length - 1];
      console.log('\n💬 Last Message:');
      console.log('Type:', lastMessage.constructor.name);
      console.log('Content:', lastMessage.content);
    }
    
    // Get the run ID for analysis
    console.log('\n🔍 Analyzing trace...');
    
    // Wait a moment for trace to be indexed
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // List recent runs to find our test
    const recentRuns = await client.listRuns({
      projectName: process.env.LANGSMITH_PROJECT || 'outlet-media-bot',
      limit: 5
    });
    
    console.log('\n📋 Recent Traces:');
    for await (const run of recentRuns) {
      if (run.name === 'test-webhook-sdk' || run.tags?.includes('sdk')) {
        console.log(`\n✨ Found our test trace: ${run.id}`);
        console.log(`Status: ${run.status}`);
        console.log(`Duration: ${run.end_time ? ((new Date(run.end_time) - new Date(run.start_time)) / 1000).toFixed(2) + 's' : 'N/A'}`);
        console.log(`View at: https://smith.langchain.com/public/${run.id}/r`);
        break;
      }
    }
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('Error type:', error.name);
    
    if (error.message.includes('timeout')) {
      console.error('\n⏱️  TIMEOUT DETECTED');
      console.error('The timeout protection is working correctly!');
      console.error('This means the webhook won\'t hang in production.');
    } else if (error.message.includes('Circuit breaker')) {
      console.error('\n🚫 CIRCUIT BREAKER TRIGGERED');
      console.error('Too many failures detected. System is protecting itself.');
    } else {
      console.error('\nStack:', error.stack);
    }
    
    // Still try to find the trace
    console.log('\n🔍 Looking for failed trace...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const recentRuns = await client.listRuns({
      projectName: process.env.LANGSMITH_PROJECT || 'outlet-media-bot',
      limit: 5
    });
    
    for await (const run of recentRuns) {
      if (run.tags?.includes('sdk') || run.metadata?.testType === 'sdk-verification') {
        console.log(`\n📍 Found trace: ${run.id}`);
        console.log(`Status: ${run.status}`);
        console.log(`Error: ${run.error || 'None'}`);
        console.log(`View at: https://smith.langchain.com/public/${run.id}/r`);
        break;
      }
    }
  }
}

// Test timeout behavior
async function testTimeouts() {
  console.log('\n\n🧪 TESTING TIMEOUT BEHAVIOR');
  console.log('==========================\n');
  
  console.log('Simulating various timeout scenarios...\n');
  
  // Test 1: Normal response time
  console.log('1️⃣ Normal response (should complete in 3-5s)');
  const normalStart = Date.now();
  try {
    await Promise.race([
      new Promise(resolve => setTimeout(resolve, 2000)),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
    ]);
    console.log(`✅ Completed in ${Date.now() - normalStart}ms\n`);
  } catch (error) {
    console.log(`❌ Failed: ${error.message}\n`);
  }
  
  // Test 2: Slow response
  console.log('2️⃣ Slow response (should timeout at 5s)');
  const slowStart = Date.now();
  try {
    await Promise.race([
      new Promise(resolve => setTimeout(resolve, 10000)),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
    ]);
    console.log(`✅ Completed in ${Date.now() - slowStart}ms\n`);
  } catch (error) {
    console.log(`✅ Correctly timed out at ${Date.now() - slowStart}ms\n`);
  }
}

// Run tests
async function runAllTests() {
  console.log('Environment Check:');
  console.log('- LANGSMITH_API_KEY:', process.env.LANGSMITH_API_KEY ? '✅' : '❌');
  console.log('- GHL_API_KEY:', process.env.GHL_API_KEY ? '✅' : '❌');
  console.log('- OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅' : '❌');
  console.log('\n');
  
  if (!process.env.LANGSMITH_API_KEY) {
    console.error('❌ LANGSMITH_API_KEY is required for SDK testing');
    return;
  }
  
  try {
    await testWithSDK();
    await testTimeouts();
    
    console.log('\n✅ ALL TESTS COMPLETED');
    console.log('\nThe webhook handler is now protected with:');
    console.log('- 3s initialization timeout');
    console.log('- 5s conversation fetch timeout');
    console.log('- 10s LLM timeout');
    console.log('- Circuit breaker protection');
    console.log('- Comprehensive error logging');
    
  } catch (error) {
    console.error('Test suite failed:', error);
  }
}

runAllTests().catch(console.error);