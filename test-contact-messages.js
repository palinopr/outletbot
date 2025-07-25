import { GHLService } from './services/ghlService.js';
import dotenv from 'dotenv';

dotenv.config();

const REAL_CONTACT_ID = '8eSdb9ZDsXDem9wlED9u';

async function testContactMessages() {
  console.log('🔍 Testing Message History Retrieval\n');
  
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );

  // Test 1: Try to get conversations for the contact
  console.log('1. Fetching conversations for contact...');
  try {
    const conversations = await ghlService.getContactConversations(REAL_CONTACT_ID);
    console.log(`✅ Found ${conversations.length} conversations`);
    
    if (conversations.length > 0) {
      console.log('\nConversations:');
      conversations.forEach((conv, index) => {
        console.log(`\n${index + 1}. Conversation ${conv.id}`);
        console.log(`   Status: ${conv.status}`);
        console.log(`   Type: ${conv.type || 'N/A'}`);
        console.log(`   Last message: ${conv.lastMessageDate || 'N/A'}`);
        console.log(`   Unread: ${conv.unreadCount || 0}`);
      });

      // Test 2: Get messages from first conversation
      const firstConv = conversations[0];
      console.log(`\n2. Fetching messages from conversation ${firstConv.id}...`);
      
      try {
        const messages = await ghlService.getConversationMessages(firstConv.id);
        console.log(`✅ Found ${messages.length} messages\n`);
        
        if (messages.length > 0) {
          console.log('Last 5 messages:');
          messages.slice(0, 5).forEach((msg, i) => {
            console.log(`\n${i + 1}. ${msg.direction === 'inbound' ? '👤 Customer' : '🤖 Bot/Agent'}:`);
            console.log(`   "${msg.body || msg.message || 'No content'}"`.substring(0, 100) + '...');
            console.log(`   Time: ${new Date(msg.dateAdded || msg.createdAt).toLocaleString()}`);
            console.log(`   Type: ${msg.type || msg.messageType || 'text'}`);
            console.log(`   Status: ${msg.status || 'N/A'}`);
          });
        }
      } catch (msgError) {
        console.log('❌ Error getting messages:', msgError.response?.data || msgError.message);
      }
    }
  } catch (error) {
    console.log('❌ Error getting conversations:', error.response?.data || error.message);
    
    // Try alternative endpoints
    console.log('\n3. Trying alternative message endpoints...');
    
    // Try direct messages endpoint
    try {
      const response = await ghlService.axiosInstance.get(
        `/contacts/${REAL_CONTACT_ID}/messages`,
        { headers: ghlService.getHeaders() }
      );
      console.log('✅ Found messages via contact endpoint:', response.data);
    } catch (altError) {
      console.log('❌ Contact messages endpoint failed:', altError.response?.status);
    }

    // Try conversations search
    try {
      const searchResponse = await ghlService.axiosInstance.get(
        `/conversations/search`,
        { 
          headers: ghlService.getHeaders(),
          params: {
            locationId: ghlService.locationId,
            contactId: REAL_CONTACT_ID
          }
        }
      );
      console.log('✅ Found via search:', searchResponse.data);
    } catch (searchError) {
      console.log('❌ Search endpoint failed:', searchError.response?.status);
    }
  }

  // Test 4: Check what messages we've sent
  console.log('\n4. Messages sent during testing:');
  console.log('   - "Hi! This is a test message from the Outlet Media Bot. Testing WhatsApp integration 🚀"');
  console.log('   - Sent at:', new Date().toLocaleString());
  console.log('   - Message IDs: YoMuAoIBlw6GR1HIEtmp, 7p5pNNyQKG0TvIdXjzPo');
}

// Add axios to GHLService for direct API calls
async function patchGHLService() {
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );
  
  // Add axios instance for testing
  ghlService.axiosInstance = {
    get: async (path, config) => {
      const axios = (await import('axios')).default;
      return axios.get(`${ghlService.baseURL}${path}`, config);
    }
  };
  
  return ghlService;
}

// Patch and run
patchGHLService().then(service => {
  Object.assign(GHLService.prototype, { axiosInstance: service.axiosInstance });
  testContactMessages().catch(console.error);
});