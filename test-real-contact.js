import { GHLService } from './services/ghlService.js';
import { tools } from './agents/modernSalesAgent.js';
import dotenv from 'dotenv';

dotenv.config();

// Real contact ID from the URL you provided
const REAL_CONTACT_ID = '8eSdb9ZDsXDem9wlED9u';
const LOCATION_ID = 'sHFG9Rw6BdGh6d6bfMqG';

async function testRealContact() {
  console.log('🧪 Testing with REAL GHL Contact\n');
  console.log(`Contact ID: ${REAL_CONTACT_ID}`);
  console.log(`Location ID: ${LOCATION_ID}\n`);

  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    LOCATION_ID
  );

  // Test 1: Get real contact info
  console.log('1. Fetching real contact information...');
  try {
    const contact = await ghlService.getContact(REAL_CONTACT_ID);
    console.log('✅ Contact found!');
    console.log(`   Name: ${contact.firstName || ''} ${contact.lastName || ''}`);
    console.log(`   Phone: ${contact.phone || 'Not set'}`);
    console.log(`   Email: ${contact.email || 'Not set'}`);
    console.log(`   Tags: ${contact.tags?.join(', ') || 'None'}\n`);
  } catch (error) {
    console.log('❌ Error getting contact:', error.response?.data || error.message);
  }

  // Test 2: Send WhatsApp message
  console.log('2. Testing WhatsApp message...');
  try {
    const result = await ghlService.sendSMS(
      REAL_CONTACT_ID, 
      "Hi! This is a test message from the Outlet Media Bot. Testing WhatsApp integration 🚀"
    );
    console.log('✅ WhatsApp message sent successfully!');
    console.log(`   Message ID: ${result.messageId || result.id || 'N/A'}\n`);
  } catch (error) {
    console.log('❌ Error sending WhatsApp:', error.response?.data || error.message);
  }

  // Test 3: Add a test tag
  console.log('3. Adding test tag to contact...');
  try {
    await ghlService.addTags(REAL_CONTACT_ID, ['bot-test-tag']);
    console.log('✅ Tag added successfully!\n');
  } catch (error) {
    console.log('❌ Error adding tag:', error.response?.data || error.message);
  }

  // Test 4: Add a note
  console.log('4. Adding test note...');
  try {
    await ghlService.addNote(
      REAL_CONTACT_ID, 
      `Bot test performed at ${new Date().toLocaleString()}`
    );
    console.log('✅ Note added successfully!\n');
  } catch (error) {
    console.log('❌ Error adding note:', error.response?.data || error.message);
  }

  // Test 5: Get or create conversation
  console.log('5. Getting conversation for contact...');
  try {
    const conversation = await ghlService.getOrCreateConversation(REAL_CONTACT_ID);
    console.log('✅ Conversation retrieved/created!');
    console.log(`   Conversation ID: ${conversation.id}`);
    console.log(`   Status: ${conversation.status || 'N/A'}\n`);

    // Test 6: Get conversation messages
    if (conversation.id) {
      console.log('6. Fetching conversation messages...');
      try {
        const messages = await ghlService.getConversationMessages(conversation.id);
        console.log(`✅ Found ${messages.length} messages in conversation`);
        if (messages.length > 0) {
          console.log('   Last 3 messages:');
          messages.slice(0, 3).forEach((msg, i) => {
            console.log(`   ${i + 1}. ${msg.direction}: ${msg.body?.substring(0, 50)}...`);
          });
        }
      } catch (error) {
        console.log('❌ Error getting messages:', error.response?.data || error.message);
      }
    }
  } catch (error) {
    console.log('❌ Error with conversation:', error.response?.data || error.message);
  }

  // Test 7: Calendar slots (with real calendar ID if available)
  console.log('\n7. Testing calendar slots...');
  const calendarId = process.env.GHL_CALENDAR_ID;
  if (calendarId) {
    try {
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const slots = await ghlService.getAvailableSlots(calendarId, startDate, endDate);
      console.log(`✅ Calendar slots retrieved!`);
      console.log(`   Found ${slots.length} available slots`);
      if (slots.length > 0) {
        console.log('   First 3 slots:');
        slots.slice(0, 3).forEach((slot, i) => {
          const date = new Date(slot.startTime);
          console.log(`   ${i + 1}. ${date.toLocaleString()}`);
        });
      }
    } catch (error) {
      console.log('❌ Calendar error:', error.response?.data || error.message);
      console.log('   This might be due to incorrect calendar ID or endpoint');
    }
  } else {
    console.log('⚠️  No calendar ID configured');
  }

  console.log('\n✅ Real contact tests completed!');
}

// Run the test
testRealContact().catch(console.error);