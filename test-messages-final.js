import { GHLService } from './services/ghlService.js';
import dotenv from 'dotenv';

dotenv.config();

const REAL_CONTACT_ID = '8eSdb9ZDsXDem9wlED9u';
const CONVERSATION_ID = 'pxlD9IHbeYp8RMrMtwsb';

async function testMessagesFinal() {
  console.log('🎉 Testing Message Retrieval - Final Test\n');
  
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );

  console.log('Contact: Jaime Ortiz');
  console.log(`Conversation ID: ${CONVERSATION_ID}\n`);

  try {
    // Get messages using our service
    const messages = await ghlService.getConversationMessages(CONVERSATION_ID);
    
    console.log(`✅ Successfully retrieved ${messages.length} messages!\n`);
    
    if (messages.length > 0) {
      console.log('Recent messages:');
      
      // Show last 10 messages
      const recentMessages = messages.slice(0, 10);
      
      recentMessages.forEach((msg, index) => {
        const direction = msg.direction === 'inbound' ? '👤 Customer' : '🤖 Outbound';
        const time = new Date(msg.dateAdded).toLocaleString();
        
        console.log(`\n${index + 1}. ${direction} (${msg.messageType || msg.type})`);
        console.log(`   "${(msg.body || '').substring(0, 100)}${msg.body?.length > 100 ? '...' : ''}"`);
        console.log(`   Time: ${time}`);
        console.log(`   Status: ${msg.status}`);
        
        if (msg.attachments && msg.attachments.length > 0) {
          console.log(`   Attachments: ${msg.attachments.length}`);
        }
      });
      
      // Summary
      console.log('\n📊 Message Summary:');
      const inbound = messages.filter(m => m.direction === 'inbound').length;
      const outbound = messages.filter(m => m.direction === 'outbound').length;
      const whatsapp = messages.filter(m => m.messageType === 'TYPE_WHATSAPP' || m.messageType === 'WHATSAPP').length;
      const sms = messages.filter(m => m.messageType === 'TYPE_SMS' || m.messageType === 'SMS').length;
      
      console.log(`   Total: ${messages.length} messages`);
      console.log(`   Inbound: ${inbound}`);
      console.log(`   Outbound: ${outbound}`);
      console.log(`   WhatsApp: ${whatsapp}`);
      console.log(`   SMS: ${sms}`);
      
      // Find our test messages
      console.log('\n🔍 Our Test Messages:');
      const testMessages = messages.filter(m => 
        m.body?.includes('Outlet Media Bot') || 
        m.body?.includes('test message')
      );
      
      if (testMessages.length > 0) {
        testMessages.forEach((msg, i) => {
          console.log(`\n   ${i + 1}. "${msg.body}"`);
          console.log(`      Sent: ${new Date(msg.dateAdded).toLocaleString()}`);
        });
      }
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
    if (error.response?.data) {
      console.log('Details:', error.response.data);
    }
  }
}

testMessagesFinal().catch(console.error);