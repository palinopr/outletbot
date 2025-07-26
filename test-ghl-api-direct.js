#!/usr/bin/env node
import axios from 'axios';

console.log('🔍 TESTING GHL API DIRECTLY');
console.log('===========================\n');

// Using the exact credentials from your deployment
const GHL_API_KEY = 'pit-21cee867-6a57-4eea-b6fa-2bd4462934d0';
const GHL_LOCATION_ID = 'sHFG9Rw6BdGh6d6bfMqG';
const GHL_CALENDAR_ID = 'eIHCWiTQjE1lTzjdz4xi';
const TEST_CONTACT_ID = '54sJIGTtwmR89Qc5JeEt';

// Create axios instance with GHL configuration
const ghlClient = axios.create({
  baseURL: 'https://services.leadconnectorhq.com',
  headers: {
    'Authorization': `Bearer ${GHL_API_KEY}`,
    'Version': '2021-07-28',
    'Content-Type': 'application/json'
  }
});

async function testGHLConnection() {
  console.log('1. Testing GHL API Connection...\n');
  
  // Test 1: Get Contact
  try {
    console.log('📋 Fetching contact info...');
    const contactResponse = await ghlClient.get(`/contacts/${TEST_CONTACT_ID}`);
    console.log('✅ Contact found!');
    console.log(`   Name: ${contactResponse.data.contact?.firstName || 'N/A'} ${contactResponse.data.contact?.lastName || ''}`);
    console.log(`   Phone: ${contactResponse.data.contact?.phone || 'N/A'}`);
    console.log(`   ID: ${TEST_CONTACT_ID}\n`);
  } catch (error) {
    console.error('❌ Contact fetch failed:', error.response?.data || error.message);
    console.error(`   Status: ${error.response?.status}`);
    console.error(`   API Key: ${GHL_API_KEY.substring(0, 20)}...`);
  }

  // Test 2: Get Calendar Slots
  try {
    console.log('📅 Testing calendar access...');
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7);
    
    const slotsResponse = await ghlClient.get('/calendars/events/slots', {
      params: {
        calendarId: GHL_CALENDAR_ID,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        timezone: 'America/Chicago'
      }
    });
    
    console.log('✅ Calendar access successful!');
    const slots = slotsResponse.data.data || [];
    console.log(`   Found ${slots.length} available slots`);
    if (slots.length > 0 && slots[0].slots) {
      console.log(`   First date with slots: ${Object.keys(slots[0].slots)[0]}`);
    }
  } catch (error) {
    console.error('❌ Calendar fetch failed:', error.response?.data || error.message);
    console.error(`   Calendar ID: ${GHL_CALENDAR_ID}`);
  }

  // Test 3: Send WhatsApp Message
  try {
    console.log('\n💬 Testing WhatsApp message sending...');
    const testMessage = `Test from API check - ${new Date().toLocaleTimeString()}`;
    
    const messageResponse = await ghlClient.post('/conversations/messages', {
      type: 'WhatsApp',
      contactId: TEST_CONTACT_ID,
      message: testMessage
    });
    
    console.log('✅ WhatsApp message sent!');
    console.log(`   Message ID: ${messageResponse.data.messageId}`);
    console.log(`   Status: ${messageResponse.data.status || 'sent'}`);
    console.log(`   Message: "${testMessage}"`);
  } catch (error) {
    console.error('❌ WhatsApp send failed:', error.response?.data || error.message);
  }

  // Test 4: Get Conversations
  try {
    console.log('\n📱 Fetching conversations...');
    const convResponse = await ghlClient.get('/conversations/search', {
      params: {
        contactId: TEST_CONTACT_ID,
        limit: 5
      }
    });
    
    const conversations = convResponse.data.conversations || [];
    console.log(`✅ Found ${conversations.length} conversations`);
    if (conversations.length > 0) {
      console.log(`   Latest: ${conversations[0].lastMessageBody?.substring(0, 50)}...`);
      console.log(`   Type: ${conversations[0].type}`);
    }
  } catch (error) {
    console.error('❌ Conversation fetch failed:', error.response?.data || error.message);
  }
}

async function testLocationAccess() {
  console.log('\n2. Testing Location Access...\n');
  
  try {
    console.log('🏢 Fetching location info...');
    const locationResponse = await ghlClient.get(`/locations/${GHL_LOCATION_ID}`);
    console.log('✅ Location access successful!');
    console.log(`   Name: ${locationResponse.data.location?.name || 'N/A'}`);
    console.log(`   ID: ${GHL_LOCATION_ID}`);
  } catch (error) {
    console.error('❌ Location fetch failed:', error.response?.data || error.message);
    console.error('   This might indicate an API key / Location ID mismatch');
  }
}

// Run all tests
console.log('🔑 Using credentials:');
console.log(`   API Key: ${GHL_API_KEY.substring(0, 30)}...`);
console.log(`   Location: ${GHL_LOCATION_ID}`);
console.log(`   Calendar: ${GHL_CALENDAR_ID}`);
console.log(`   Contact: ${TEST_CONTACT_ID}\n`);

(async () => {
  await testGHLConnection();
  await testLocationAccess();
  
  console.log('\n📊 SUMMARY:');
  console.log('===========');
  console.log('If tests are failing, the issue could be:');
  console.log('1. API key expired or revoked');
  console.log('2. Location ID mismatch');
  console.log('3. Calendar ID invalid');
  console.log('4. Network connectivity from your location');
  console.log('\nCheck GHL conversation for test message:');
  console.log('https://app.gohighlevel.com/v2/location/sHFG9Rw6BdGh6d6bfMqG/contacts/detail/54sJIGTtwmR89Qc5JeEt');
})().catch(console.error);