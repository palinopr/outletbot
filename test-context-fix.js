import { GHLService } from './services/ghlService.js';
import ConversationManager from './services/conversationManager.js';
import dotenv from 'dotenv';

dotenv.config();

// Test the conversation history retrieval
async function testConversationHistory() {
  console.log('🧪 Testing conversation history retrieval...');
  
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );
  
  const conversationManager = new ConversationManager(ghlService);
  
  // Test with the contact from your screenshot
  const contactId = '8eSdb9ZDsXDem9wlED9u';
  const phone = '(305) 487-0475';
  
  try {
    // Test 1: With null conversationId (should find existing)
    console.log('\n1️⃣ Testing with null conversationId...');
    const state1 = await conversationManager.getConversationState(contactId, null, phone);
    console.log(`Found conversation: ${state1.conversationId}`);
    console.log(`Message count: ${state1.messageCount}`);
    
    // Test 2: With string "null" (the bug)
    console.log('\n2️⃣ Testing with string "null"...');
    const state2 = await conversationManager.getConversationState(contactId, "null", phone);
    console.log(`Found conversation: ${state2.conversationId}`);
    console.log(`Message count: ${state2.messageCount}`);
    
    // Test 3: With the actual conversation ID
    if (state1.conversationId) {
      console.log('\n3️⃣ Testing with actual conversationId...');
      const state3 = await conversationManager.getConversationState(contactId, state1.conversationId, phone);
      console.log(`Found conversation: ${state3.conversationId}`);
      console.log(`Message count: ${state3.messageCount}`);
    }
    
    // Show recent messages
    if (state1.messages.length > 0) {
      console.log('\n📝 Recent messages:');
      state1.messages.slice(-5).forEach((msg, idx) => {
        const type = msg._getType() === 'human' ? '👤' : '🤖';
        console.log(`${type} ${msg.content.substring(0, 100)}...`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testConversationHistory();
