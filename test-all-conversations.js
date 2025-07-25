import { GHLService } from './services/ghlService.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const REAL_CONTACT_ID = '8eSdb9ZDsXDem9wlED9u';

async function testAllConversations() {
  console.log('🔍 Comprehensive Conversation & Message Test\n');
  
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );

  // Test 1: Get contact details first
  console.log('1. Contact Information:');
  try {
    const contact = await ghlService.getContact(REAL_CONTACT_ID);
    console.log(`   Name: ${contact.firstName} ${contact.lastName || ''}`);
    console.log(`   Phone: ${contact.phone}`);
    console.log(`   Type: ${contact.type || 'N/A'}`);
    console.log(`   Last Activity: ${contact.dateUpdated || 'N/A'}\n`);
  } catch (error) {
    console.log('❌ Error getting contact:', error.response?.data || error.message);
  }

  // Test 2: Search for ALL conversations (not just by contact)
  console.log('2. Searching all conversations in location...');
  try {
    const response = await axios.get(
      `${ghlService.baseURL}/conversations/search`,
      {
        headers: ghlService.getHeaders(),
        params: {
          locationId: ghlService.locationId,
          limit: 20 // Get recent conversations
        }
      }
    );
    
    const allConversations = response.data.conversations || response.data;
    console.log(`   Found ${allConversations.length} total conversations\n`);
    
    // Find conversations related to our contact
    const contactConvs = allConversations.filter(conv => 
      conv.contactId === REAL_CONTACT_ID
    );
    
    console.log(`3. Conversations for Jaime Ortiz: ${contactConvs.length}`);
    
    contactConvs.forEach((conv, index) => {
      console.log(`\n   Conversation ${index + 1}:`);
      console.log(`   - ID: ${conv.id}`);
      console.log(`   - Type: ${conv.type}`);
      console.log(`   - Inbox: ${conv.inbox || 'N/A'}`);
      console.log(`   - Last Message Type: ${conv.lastMessageType || 'N/A'}`);
      console.log(`   - Last Message Body: "${(conv.lastMessageBody || '').substring(0, 50)}..."`);
      console.log(`   - Unread: ${conv.unreadCount || 0}`);
      console.log(`   - Date: ${new Date(conv.dateUpdated || conv.lastMessageDate).toLocaleString()}`);
    });
    
  } catch (error) {
    console.log('❌ Error searching conversations:', error.response?.data || error.message);
  }

  // Test 3: Try different message endpoints
  console.log('\n4. Testing various message endpoints...');
  
  const endpoints = [
    `/conversations/pxlD9IHbeYp8RMrMtwsb/messages`,
    `/contacts/${REAL_CONTACT_ID}/messages`,
    `/conversations/messages?contactId=${REAL_CONTACT_ID}`,
  ];

  for (const endpoint of endpoints) {
    console.log(`\n   Trying: ${endpoint}`);
    try {
      const response = await axios.get(
        `${ghlService.baseURL}${endpoint}`,
        {
          headers: ghlService.getHeaders(),
          params: { limit: 10 }
        }
      );
      
      const data = response.data;
      console.log(`   ✅ Success! Response structure:`);
      console.log(`   - Type: ${typeof data}`);
      console.log(`   - Keys: ${Object.keys(data).join(', ')}`);
      
      // Try to find messages in different formats
      const messages = data.messages || data.data || data.conversations || data;
      if (Array.isArray(messages) && messages.length > 0) {
        console.log(`   - Found ${messages.length} messages`);
        console.log(`   - First message:`, JSON.stringify(messages[0], null, 2).substring(0, 200));
      }
      
    } catch (error) {
      console.log(`   ❌ Failed: ${error.response?.status} ${error.response?.statusText}`);
    }
  }

  // Test 4: Check WhatsApp specific endpoint
  console.log('\n5. Checking WhatsApp conversations...');
  try {
    const response = await axios.get(
      `${ghlService.baseURL}/conversations/search`,
      {
        headers: ghlService.getHeaders(),
        params: {
          locationId: ghlService.locationId,
          contactId: REAL_CONTACT_ID,
          type: 'TYPE_WHATSAPP' // Filter for WhatsApp only
        }
      }
    );
    
    const whatsappConvs = response.data.conversations || response.data;
    console.log(`   Found ${whatsappConvs.length} WhatsApp conversations`);
    
    if (whatsappConvs.length > 0) {
      console.log('   WhatsApp conversations:', whatsappConvs);
    }
    
  } catch (error) {
    console.log('   ❌ WhatsApp search error:', error.response?.status);
  }
}

testAllConversations().catch(console.error);