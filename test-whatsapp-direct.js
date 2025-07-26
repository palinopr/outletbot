import { GHLService } from './services/ghlService.js';
import { config } from 'dotenv';

config();

console.log('🚀 DIRECT WHATSAPP TEST');
console.log('======================\n');

const TEST_CONTACT_ID = '54sJIGTtwmR89Qc5JeEt';

async function testDirectWhatsApp() {
  try {
    console.log('1️⃣ Creating GHL Service...');
    const ghlService = new GHLService(
      process.env.GHL_API_KEY,
      process.env.GHL_LOCATION_ID
    );
    console.log('✅ Service created\n');
    
    console.log('2️⃣ Getting contact info...');
    const contact = await ghlService.getContact(TEST_CONTACT_ID);
    console.log('✅ Contact:', {
      name: contact?.firstName || 'Unknown',
      phone: contact?.phone
    });
    console.log('');
    
    console.log('3️⃣ Sending WhatsApp message...');
    const timestamp = new Date().toLocaleTimeString();
    const message = `🧪 Test WhatsApp message - ${timestamp}\n\nThis is a test from the Outlet Media Bot to verify WhatsApp integration is working correctly.`;
    
    console.log('Message:', message);
    console.log('');
    
    const result = await ghlService.sendSMS(TEST_CONTACT_ID, message);
    
    console.log('✅ MESSAGE SENT SUCCESSFULLY!');
    console.log('Result:', result);
    console.log('');
    
    console.log('📱 CHECK GHL:');
    console.log('1. Go to: https://app.gohighlevel.com/v2/location/sHFG9Rw6BdGh6d6bfMqG/contacts/detail/54sJIGTtwmR89Qc5JeEt');
    console.log('2. Check WhatsApp conversation');
    console.log('3. You should see the test message with timestamp:', timestamp);
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.response?.data) {
      console.error('API Response:', error.response.data);
    }
    console.error('Stack:', error.stack);
  }
}

// Run test
testDirectWhatsApp().catch(console.error);