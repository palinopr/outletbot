import { config } from 'dotenv';
import { GHLService } from './services/ghlService.js';
import { ConversationManager } from './services/conversationManager.js';

config();

async function testConversationFlow() {
  console.log('Testing conversation history flow...\n');
  
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );
  
  const conversationManager = new ConversationManager(ghlService);
  
  // Test with real contact ID from GHL
  const testContactId = 'Kdj9FkxZc3yq7d5tyT97'; // Real contact from GHL
  
  try {
    console.log('Step 1: Get or create conversation with phone search...');
    // Use a test phone number (from CLAUDE.md tests)
    const testPhone = '+1234567890';
    const conversation = await ghlService.getOrCreateConversation(testContactId, testPhone);
    console.log('Conversation:', conversation);
    
    if (conversation.id.startsWith('conv_')) {
      console.log('\n⚠️  WARNING: Got mock conversation ID, won\'t be able to fetch messages!');
    }
    
    console.log('\nStep 2: Try to fetch messages with conversation ID...');
    try {
      const messages = await ghlService.getConversationMessages(conversation.id);
      console.log(`Fetched ${messages.length} messages`);
      
      if (messages.length > 0) {
        console.log('\nFirst 3 messages:');
        messages.slice(0, 3).forEach((msg, i) => {
          console.log(`${i + 1}. [${msg.direction}] ${msg.body?.substring(0, 50)}...`);
        });
      }
    } catch (error) {
      console.log('❌ Failed to fetch messages:', error.message);
    }
    
    console.log('\nStep 3: Get full conversation state...');
    const state = await conversationManager.getConversationState(testContactId, conversation.id, testPhone);
    console.log('Full state object:', JSON.stringify(state, null, 2));
    console.log('\nConversation state summary:', {
      conversationId: state.conversationId,
      messageCount: state.messageCount,
      hasHistory: state.messages.length > 0,
      leadInfo: {
        name: state.leadName,
        hasInfo: !!(state.leadName || state.leadProblem || state.leadGoal)
      }
    });
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testConversationFlow();