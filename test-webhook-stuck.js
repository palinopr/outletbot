import { graph } from './agents/webhookHandler.js';
import { config } from 'dotenv';

config();

console.log('🧪 Testing Webhook Flow - Debug Stuck Issues');
console.log('==========================================\n');

// Test with a real webhook payload
async function testWebhookFlow() {
  console.log('1️⃣ Testing with simple message\n');
  
  const testPayload = {
    phone: '+14085551234',
    message: 'Hola, me interesa información sobre sus servicios',
    contactId: '54sJIGTtwmR89Qc5JeEt'  // Real contact ID from user
  };
  
  console.log('📨 Webhook payload:', testPayload);
  
  try {
    console.log('\n2️⃣ Invoking webhook handler...\n');
    
    const startTime = Date.now();
    
    // Create initial state with the webhook payload as a message
    const initialState = {
      messages: [{
        content: JSON.stringify(testPayload),
        role: 'human'
      }],
      contactId: testPayload.contactId,
      phone: testPayload.phone
    };
    
    console.log('Initial state:', {
      messageCount: initialState.messages.length,
      contactId: initialState.contactId,
      phone: initialState.phone
    });
    
    // Set timeout for the test
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Test timeout after 30 seconds')), 30000);
    });
    
    // Run the webhook handler
    const result = await Promise.race([
      graph.invoke(initialState, {
        configurable: {
          features: {
            enableDeduplication: false  // Disable for testing
          }
        },
        runId: `test-${Date.now()}`
      }),
      timeoutPromise
    ]);
    
    const processingTime = Date.now() - startTime;
    
    console.log('\n✅ Webhook processed successfully!');
    console.log('Processing time:', processingTime, 'ms');
    console.log('Result:', {
      messageCount: result.messages?.length || 0,
      hasContactId: !!result.contactId,
      hasPhone: !!result.phone,
      hasLeadInfo: !!result.leadInfo
    });
    
    // Show the last message
    if (result.messages && result.messages.length > 0) {
      const lastMessage = result.messages[result.messages.length - 1];
      console.log('\nLast message:', {
        type: lastMessage.constructor.name,
        content: lastMessage.content?.substring(0, 100) + '...'
      });
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Check for specific error types
    if (error.message.includes('timeout')) {
      console.error('\n⏱️ The webhook handler timed out. Possible causes:');
      console.error('- GHL API is not responding');
      console.error('- Sales agent is stuck in a loop');
      console.error('- Network connectivity issues');
    } else if (error.message.includes('Missing required fields')) {
      console.error('\n📋 Missing required webhook data');
    } else {
      console.error('\n🔍 Unknown error - check logs for details');
    }
  }
}

// Test with minimal payload
async function testMinimalPayload() {
  console.log('\n\n3️⃣ Testing with minimal payload\n');
  
  try {
    const result = await graph.invoke({
      messages: [{
        content: 'Test message',
        role: 'human'
      }]
    });
    
    console.log('Result:', result);
  } catch (error) {
    console.error('Expected error (missing fields):', error.message);
  }
}

// Test conversation manager directly
async function testConversationManager() {
  console.log('\n\n4️⃣ Testing conversation manager directly\n');
  
  try {
    const { GHLService } = await import('./services/ghlService.js');
    const ConversationManager = (await import('./services/conversationManager.js')).default;
    
    const ghlService = new GHLService(
      process.env.GHL_API_KEY,
      process.env.GHL_LOCATION_ID
    );
    
    const conversationManager = new ConversationManager(ghlService);
    
    console.log('Fetching conversation state...');
    const state = await conversationManager.getConversationState(
      '54sJIGTtwmR89Qc5JeEt',
      null,
      '+14085551234'
    );
    
    console.log('Conversation state:', {
      conversationId: state.conversationId,
      messageCount: state.messageCount,
      leadName: state.leadName,
      leadBudget: state.leadBudget
    });
    
  } catch (error) {
    console.error('Conversation manager error:', error.message);
  }
}

// Run all tests
async function runTests() {
  try {
    await testWebhookFlow();
    await testMinimalPayload();
    await testConversationManager();
  } catch (error) {
    console.error('Test suite failed:', error);
  }
}

// Check environment variables
console.log('Environment check:');
console.log('- GHL_API_KEY:', process.env.GHL_API_KEY ? '✅ Set' : '❌ Missing');
console.log('- GHL_LOCATION_ID:', process.env.GHL_LOCATION_ID ? '✅ Set' : '❌ Missing');
console.log('- GHL_CALENDAR_ID:', process.env.GHL_CALENDAR_ID ? '✅ Set' : '❌ Missing');
console.log('- OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing');
console.log('- LOG_LEVEL:', process.env.LOG_LEVEL || 'info');

// Run tests
console.log('\nStarting tests...\n');
runTests().catch(console.error);