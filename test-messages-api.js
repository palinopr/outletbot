import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const CONVERSATION_ID = 'pxlD9IHbeYp8RMrMtwsb';

async function testMessagesAPI() {
  console.log('🔍 Testing Messages API with Correct Version\n');
  
  // Test with the correct version header
  console.log('1. Testing with Version: 2021-04-15');
  try {
    const response = await axios.get(
      `https://services.leadconnectorhq.com/conversations/${CONVERSATION_ID}/messages`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-04-15' // Correct version for messages endpoint
        },
        params: {
          limit: 20,
          type: 'TYPE_WHATSAPP,TYPE_SMS' // Get both WhatsApp and SMS
        }
      }
    );
    
    console.log('✅ Success! Response:');
    console.log(`   Last Message ID: ${response.data.lastMessageId}`);
    console.log(`   Next Page: ${response.data.nextPage}`);
    console.log(`   Messages Count: ${response.data.messages?.length || 0}\n`);
    
    if (response.data.messages && response.data.messages.length > 0) {
      console.log('Messages found:');
      response.data.messages.forEach((msg, index) => {
        console.log(`\n${index + 1}. Message:`);
        console.log(`   ID: ${msg.id}`);
        console.log(`   Type: ${msg.messageType}`);
        console.log(`   Direction: ${msg.direction}`);
        console.log(`   Status: ${msg.status}`);
        console.log(`   Body: "${(msg.body || '').substring(0, 80)}..."`);
        console.log(`   Date: ${msg.dateAdded}`);
        console.log(`   Attachments: ${msg.attachments?.length || 0}`);
        if (msg.meta) {
          console.log(`   Source: ${msg.meta.source || 'N/A'}`);
        }
      });
    }
    
  } catch (error) {
    console.log('❌ Error:', error.response?.status, error.response?.statusText);
    if (error.response?.data) {
      console.log('   Details:', error.response.data);
    }
  }

  // Test with our current version to compare
  console.log('\n\n2. Testing with Version: 2021-07-28 (our current version)');
  try {
    const response = await axios.get(
      `https://services.leadconnectorhq.com/conversations/${CONVERSATION_ID}/messages`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28' // Our current version
        },
        params: {
          limit: 20
        }
      }
    );
    
    console.log('Response with 2021-07-28:', response.data);
    
  } catch (error) {
    console.log('❌ Error with 2021-07-28:', error.response?.status);
  }
}

testMessagesAPI().catch(console.error);