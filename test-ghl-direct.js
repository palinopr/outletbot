import { GHLService } from './services/ghlService.js';
import { config } from 'dotenv';

config();

console.log('🧪 Testing GHL Service Direct Connection');
console.log('======================================\n');

async function testGHLDirect() {
  const contactId = '54sJIGTtwmR89Qc5JeEt';
  const phone = '(305) 487-0475';
  
  console.log('Environment check:');
  console.log('GHL_API_KEY:', process.env.GHL_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('GHL_LOCATION_ID:', process.env.GHL_LOCATION_ID ? '✅ Set' : '❌ Missing');
  console.log('\n');
  
  try {
    console.log('1️⃣ Creating GHL Service...');
    console.time('serviceCreation');
    const ghlService = new GHLService(
      process.env.GHL_API_KEY,
      process.env.GHL_LOCATION_ID
    );
    console.timeEnd('serviceCreation');
    console.log('✅ Service created\n');
    
    console.log('2️⃣ Testing getContact...');
    console.time('getContact');
    const contact = await ghlService.getContact(contactId);
    console.timeEnd('getContact');
    console.log('✅ Contact:', contact?.firstName || contact?.name || 'Unknown');
    console.log('\n');
    
    console.log('3️⃣ Testing getOrCreateConversation...');
    console.time('getConversation');
    const conversation = await ghlService.getOrCreateConversation(contactId, phone);
    console.timeEnd('getConversation');
    console.log('✅ Conversation ID:', conversation?.id);
    console.log('\n');
    
    if (conversation?.id) {
      console.log('4️⃣ Testing getConversationMessages...');
      console.time('getMessages');
      const messages = await ghlService.getConversationMessages(conversation.id);
      console.timeEnd('getMessages');
      console.log('✅ Messages found:', messages.length);
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n🔍 Connection refused - GHL API might be down');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('\n🔍 Timeout - GHL API is not responding');
    } else if (error.response?.status === 429) {
      console.error('\n🔍 Rate limit exceeded - Too many requests');
    } else if (error.response?.status === 401) {
      console.error('\n🔍 Authentication failed - Check API key');
    }
  }
}

testGHLDirect().catch(console.error);