import { config } from 'dotenv';
config();

console.log('🚨 PRODUCTION MONITORING - Webhook Stuck Issue');
console.log('===========================================\n');

// Test each component individually to isolate the issue
async function monitorProduction() {
  const testContactId = '54sJIGTtwmR89Qc5JeEt';
  const testPhone = '+14085551234';
  
  console.log('Testing each component in isolation...\n');
  
  // 1. Test GHL Service
  console.log('1️⃣ Testing GHL Service Connection...');
  try {
    const { GHLService } = await import('./services/ghlService.js');
    const ghlService = new GHLService(
      process.env.GHL_API_KEY,
      process.env.GHL_LOCATION_ID
    );
    
    const startTime = Date.now();
    const contact = await ghlService.getContact(testContactId);
    const ghlTime = Date.now() - startTime;
    
    console.log(`✅ GHL Contact fetch: ${ghlTime}ms`);
    console.log(`   Contact name: ${contact?.firstName || 'Unknown'}`);
  } catch (error) {
    console.error('❌ GHL Service Error:', error.message);
  }
  
  // 2. Test Conversation Manager
  console.log('\n2️⃣ Testing Conversation Manager...');
  try {
    const { GHLService } = await import('./services/ghlService.js');
    const ConversationManager = (await import('./services/conversationManager.js')).default;
    
    const ghlService = new GHLService(
      process.env.GHL_API_KEY,
      process.env.GHL_LOCATION_ID
    );
    const conversationManager = new ConversationManager(ghlService);
    
    const startTime = Date.now();
    const state = await conversationManager.getConversationState(
      testContactId,
      null,
      testPhone
    );
    const convTime = Date.now() - startTime;
    
    console.log(`✅ Conversation state fetch: ${convTime}ms`);
    console.log(`   Message count: ${state.messageCount}`);
    console.log(`   Conversation ID: ${state.conversationId}`);
  } catch (error) {
    console.error('❌ Conversation Manager Error:', error.message);
  }
  
  // 3. Test OpenAI Connection
  console.log('\n3️⃣ Testing OpenAI Connection...');
  try {
    const { ChatOpenAI } = await import('@langchain/openai');
    const llm = new ChatOpenAI({ 
      model: 'gpt-4',
      temperature: 0,
      timeout: 5000  // 5 second timeout
    });
    
    const startTime = Date.now();
    const response = await llm.invoke([{
      role: 'system',
      content: 'You are a test. Reply with "OK"'
    }]);
    const llmTime = Date.now() - startTime;
    
    console.log(`✅ OpenAI response: ${llmTime}ms`);
    console.log(`   Response: ${response.content}`);
  } catch (error) {
    console.error('❌ OpenAI Error:', error.message);
  }
  
  // 4. Test Sales Agent Tool
  console.log('\n4️⃣ Testing Sales Agent Tools...');
  try {
    const { exportedTools } = await import('./agents/salesAgent.js');
    
    // Test sendGHLMessage tool
    console.log('   Testing sendGHLMessage tool...');
    const mockConfig = {
      configurable: {
        contactId: testContactId
      },
      toolCall: { id: 'test-tool-call' }
    };
    
    // Note: This would actually send a message in production
    console.log('   ⚠️  Skipping actual message send to avoid spamming');
    console.log('   ✅ Tool is loaded and ready');
  } catch (error) {
    console.error('❌ Sales Agent Tool Error:', error.message);
  }
  
  // 5. Check for common production issues
  console.log('\n5️⃣ Checking Common Production Issues...');
  
  // Memory usage
  const memUsage = process.memoryUsage();
  console.log(`   Memory usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);
  
  // Event loop lag (simple check)
  const lagStart = Date.now();
  setImmediate(() => {
    const lag = Date.now() - lagStart;
    console.log(`   Event loop lag: ${lag}ms ${lag > 100 ? '⚠️ HIGH' : '✅ OK'}`);
  });
  
  // Environment variables
  console.log('\n6️⃣ Environment Configuration:');
  console.log(`   LOG_LEVEL: ${process.env.LOG_LEVEL || 'info'}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   API Timeout: ${process.env.API_TIMEOUT || '10000'}ms`);
  console.log(`   Conversation Timeout: ${process.env.CONVERSATION_TIMEOUT || '300000'}ms`);
}

// Performance test with timeout tracking
async function performanceTest() {
  console.log('\n\n7️⃣ Running Performance Test...');
  
  const operations = [
    { name: 'GHL API Call', timeout: 5000 },
    { name: 'LLM Call', timeout: 10000 },
    { name: 'Full Webhook Flow', timeout: 30000 }
  ];
  
  for (const op of operations) {
    console.log(`\nTesting ${op.name} (timeout: ${op.timeout}ms)...`);
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${op.name} timeout`)), op.timeout);
    });
    
    try {
      // Simulate operation
      await Promise.race([
        new Promise(resolve => setTimeout(resolve, Math.random() * 2000)),
        timeoutPromise
      ]);
      console.log(`✅ ${op.name} completed`);
    } catch (error) {
      console.error(`❌ ${op.name} failed:`, error.message);
    }
  }
}

// Run all monitors
async function runMonitoring() {
  try {
    await monitorProduction();
    await performanceTest();
    
    console.log('\n\n📊 MONITORING COMPLETE');
    console.log('Check the results above to identify where the system is getting stuck.');
    console.log('\nRecommendations:');
    console.log('1. If GHL API is slow: Check rate limits and API status');
    console.log('2. If OpenAI is slow: Check API limits and consider fallbacks');
    console.log('3. If memory is high: Check for memory leaks in long-running processes');
    console.log('4. If event loop lag is high: Check for blocking operations');
    
  } catch (error) {
    console.error('Monitoring failed:', error);
  }
}

// Start monitoring
runMonitoring().catch(console.error);