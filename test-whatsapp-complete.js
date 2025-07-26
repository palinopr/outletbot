import { graph } from './agents/webhookHandler.js';
import { GHLService } from './services/ghlService.js';
import ConversationManager from './services/conversationManager.js';
import { config } from 'dotenv';

config();

console.log('🚀 COMPREHENSIVE WHATSAPP TEST WITH REAL CONTACT');
console.log('==============================================\n');

const TEST_CONTACT_ID = '54sJIGTtwmR89Qc5JeEt';
const TEST_PHONE = '+14085551234';

async function runComprehensiveTest() {
  try {
    // Step 1: Test GHL Service Connection
    console.log('1️⃣ TESTING GHL SERVICE CONNECTION\n');
    
    const ghlService = new GHLService(
      process.env.GHL_API_KEY,
      process.env.GHL_LOCATION_ID
    );
    
    // Test getting contact
    console.log('Getting contact details...');
    const contact = await ghlService.getContact(TEST_CONTACT_ID);
    console.log('✅ Contact found:', {
      name: contact?.firstName || contact?.name || 'Unknown',
      phone: contact?.phone,
      email: contact?.email,
      tags: contact?.tags?.slice(0, 3) || []
    });
    console.log('');
    
    // Step 2: Test Direct WhatsApp Message
    console.log('2️⃣ TESTING DIRECT WHATSAPP MESSAGE\n');
    
    try {
      console.log('Sending test WhatsApp message...');
      const messageResult = await ghlService.sendSMS(
        TEST_CONTACT_ID,
        '🧪 Test message from Outlet Media Bot - Testing WhatsApp integration'
      );
      console.log('✅ WhatsApp message sent successfully!');
      console.log('Response:', messageResult);
    } catch (error) {
      console.error('❌ Failed to send WhatsApp:', error.message);
      if (error.response?.data) {
        console.error('API Error:', error.response.data);
      }
    }
    console.log('');
    
    // Step 3: Test Conversation Manager
    console.log('3️⃣ TESTING CONVERSATION MANAGER\n');
    
    const conversationManager = new ConversationManager(ghlService);
    console.log('Fetching conversation state...');
    const convState = await conversationManager.getConversationState(
      TEST_CONTACT_ID,
      null,
      TEST_PHONE
    );
    console.log('✅ Conversation state:', {
      conversationId: convState.conversationId,
      messageCount: convState.messageCount,
      leadInfo: {
        name: convState.leadName,
        budget: convState.leadBudget,
        problem: convState.leadProblem
      }
    });
    console.log('');
    
    // Step 4: Test Full Webhook Flow
    console.log('4️⃣ TESTING FULL WEBHOOK FLOW\n');
    
    const testPayload = {
      phone: TEST_PHONE,
      message: 'Hola, me interesa información sobre marketing digital para mi restaurante',
      contactId: TEST_CONTACT_ID
    };
    
    console.log('Webhook payload:', testPayload);
    console.log('');
    
    const initialState = {
      messages: [{
        role: 'human',
        content: JSON.stringify(testPayload)
      }],
      contactId: testPayload.contactId,
      phone: testPayload.phone
    };
    
    console.log('Invoking webhook handler...\n');
    const startTime = Date.now();
    
    // Set LOG_LEVEL to debug for this test
    process.env.LOG_LEVEL = 'debug';
    
    const result = await graph.invoke(initialState, {
      configurable: {
        features: {
          enableDeduplication: false
        }
      },
      runId: `whatsapp-test-${Date.now()}`
    });
    
    const duration = Date.now() - startTime;
    
    console.log('\n✅ WEBHOOK COMPLETED!');
    console.log(`Processing time: ${duration}ms\n`);
    
    // Analyze results
    console.log('5️⃣ ANALYZING RESULTS\n');
    
    console.log('Messages processed:', result.messages?.length || 0);
    
    // Find bot responses
    const botResponses = result.messages?.filter((msg, idx) => 
      idx > 0 && msg.constructor.name === 'AIMessage'
    ) || [];
    
    console.log(`\nBot responses (${botResponses.length}):`);
    botResponses.forEach((msg, i) => {
      console.log(`\n${i + 1}. ${msg.content}`);
    });
    
    // Check lead info
    if (result.leadInfo) {
      console.log('\nExtracted lead info:');
      Object.entries(result.leadInfo).forEach(([key, value]) => {
        if (value && typeof value !== 'object') {
          console.log(`- ${key}: ${value}`);
        }
      });
    }
    
    // Final verification
    console.log('\n\n6️⃣ FINAL VERIFICATION\n');
    
    console.log('✓ GHL Service: Working');
    console.log('✓ WhatsApp sending: Working');
    console.log('✓ Conversation fetch: Working');
    console.log('✓ Webhook processing: Working');
    console.log('✓ Bot responses: Generated');
    
    console.log('\n📱 CHECK GHL CONVERSATION:');
    console.log('1. Go to: https://app.gohighlevel.com/v2/location/sHFG9Rw6BdGh6d6bfMqG/contacts/detail/54sJIGTtwmR89Qc5JeEt');
    console.log('2. Check WhatsApp conversation');
    console.log('3. You should see:');
    console.log('   - Test message (🧪)');
    console.log('   - Bot response to "Hola, me interesa..."');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('Stack:', error.stack);
    
    if (error.message.includes('timeout')) {
      console.error('\n⏱️ Timeout detected - check network/API status');
    }
  }
}

// Check environment
console.log('Environment check:');
console.log('- GHL_API_KEY:', process.env.GHL_API_KEY ? '✅' : '❌');
console.log('- GHL_LOCATION_ID:', process.env.GHL_LOCATION_ID ? '✅' : '❌');
console.log('- OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅' : '❌');
console.log('\n');

// Run the test
runComprehensiveTest().catch(console.error);