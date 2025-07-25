import { GHLService } from './services/ghlService.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const CONVERSATION_ID = 'pxlD9IHbeYp8RMrMtwsb';

async function testConversationDetails() {
  console.log('🔍 Deep Dive into Conversation Messages\n');
  
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );

  console.log(`Conversation ID: ${CONVERSATION_ID}\n`);

  // Test different parameters for message retrieval
  const paramSets = [
    { limit: 100 },
    { limit: 100, type: 'TYPE_WHATSAPP' },
    { limit: 100, lastMessageId: null },
    { limit: 100, sort: 'desc' },
    { limit: 100, includeDeleted: true }
  ];

  for (const params of paramSets) {
    console.log(`\nTesting with params:`, JSON.stringify(params));
    
    try {
      const response = await axios.get(
        `${ghlService.baseURL}/conversations/${CONVERSATION_ID}/messages`,
        {
          headers: ghlService.getHeaders(),
          params
        }
      );
      
      const messages = response.data.messages || [];
      console.log(`✅ Found ${messages.length} messages`);
      
      if (messages.length > 0) {
        console.log('\nFirst 3 messages:');
        messages.slice(0, 3).forEach((msg, i) => {
          console.log(`\n${i + 1}. Message Details:`);
          console.log(`   ID: ${msg.id || msg.messageId}`);
          console.log(`   Body: "${(msg.body || msg.message || '').substring(0, 60)}..."`);
          console.log(`   Direction: ${msg.direction}`);
          console.log(`   Type: ${msg.type || msg.messageType}`);
          console.log(`   Status: ${msg.status}`);
          console.log(`   Date: ${new Date(msg.dateAdded || msg.createdAt).toLocaleString()}`);
        });
        break; // Found messages, stop trying
      }
    } catch (error) {
      console.log(`❌ Error:`, error.response?.data || error.message);
    }
  }

  // Also check conversation details
  console.log('\n\nConversation Full Details:');
  try {
    const convResponse = await axios.get(
      `${ghlService.baseURL}/conversations/${CONVERSATION_ID}`,
      { headers: ghlService.getHeaders() }
    );
    
    console.log('Conversation data:', JSON.stringify(convResponse.data, null, 2));
  } catch (error) {
    console.log('❌ Error getting conversation:', error.response?.status);
  }
}

testConversationDetails().catch(console.error);