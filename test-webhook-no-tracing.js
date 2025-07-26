#!/usr/bin/env node
import 'dotenv/config';

// Disable LangSmith tracing for this test
delete process.env.LANGCHAIN_TRACING_V2;
delete process.env.LANGSMITH_API_KEY;
delete process.env.LANGCHAIN_PROJECT;

console.log('🧪 WEBHOOK TEST (No LangSmith Tracing)');
console.log('======================================\n');

// Now import after disabling tracing
const { graph } = await import('./agents/webhookHandler.js');

async function testWithoutTracing() {
  const payload = {
    phone: '+13054870475',
    message: 'Test sin tracing',
    contactId: '54sJIGTtwmR89Qc5JeEt'
  };
  
  console.log('📨 Payload:', payload);
  console.log('🚫 LangSmith tracing: DISABLED\n');
  
  const state = {
    messages: [{
      role: 'human',
      content: JSON.stringify(payload)
    }]
  };
  
  try {
    console.log('⏱️  Processing...\n');
    const startTime = Date.now();
    
    const result = await graph.invoke(state, {
      configurable: { 
        features: { enableDeduplication: false }
      },
      // Ensure we have a valid runId
      runId: crypto.randomUUID()
    });
    
    const duration = Date.now() - startTime;
    console.log(`✅ SUCCESS in ${duration}ms`);
    console.log('Messages returned:', result.messages?.length || 0);
    
    // Extract new AI responses
    const aiResponses = [];
    let foundPayload = false;
    
    for (const msg of result.messages || []) {
      if (!foundPayload && msg.content === JSON.stringify(payload)) {
        foundPayload = true;
        continue;
      }
      if (foundPayload && (msg.role === 'assistant' || msg.constructor.name === 'AIMessage')) {
        aiResponses.push(msg.content);
      }
    }
    
    console.log('\n💬 Bot responses:');
    aiResponses.forEach((resp, i) => {
      console.log(`${i + 1}. "${resp}"`);
    });
    
    console.log('\n✅ Test completed without LangSmith errors!');
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (!error.message.includes('multipart') && !error.message.includes('no-trace-id')) {
      console.log('\n✅ No LangSmith errors - this is a different issue');
    }
  }
}

// Check environment
const requiredVars = ['OPENAI_API_KEY', 'GHL_API_KEY', 'GHL_LOCATION_ID', 'GHL_CALENDAR_ID'];
const missing = requiredVars.filter(v => !process.env[v]);

if (missing.length > 0) {
  console.error('❌ Missing required environment variables:');
  missing.forEach(v => console.error(`   - ${v}`));
  process.exit(1);
}

testWithoutTracing().catch(console.error);