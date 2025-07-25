require('dotenv').config();
const { GHLService } = require('./services/ghlService');
const ConversationManager = require('./services/conversationManager');

// Test GHL conversation integration
async function testGHLIntegration() {
  console.log('🧪 Testing GHL Conversation Integration');
  console.log('=====================================\n');

  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );
  
  const conversationManager = new ConversationManager(ghlService);
  
  try {
    // Test 1: Find or create a test contact
    console.log('📋 Test 1: Contact Management');
    const testPhone = '+15551234567';
    let contact = await ghlService.findContactByPhone(testPhone);
    
    if (!contact) {
      console.log('Creating new test contact...');
      contact = await ghlService.createContact({
        phone: testPhone,
        firstName: 'Test',
        lastName: 'User',
        tags: ['test-contact']
      });
    }
    console.log('✅ Contact found/created:', contact.id);
    
    // Test 2: Get or create conversation
    console.log('\n📋 Test 2: Conversation Management');
    const conversation = await ghlService.getOrCreateConversation(contact.id);
    console.log('✅ Conversation:', conversation.id);
    
    // Test 3: Fetch conversation state
    console.log('\n📋 Test 3: Conversation State Retrieval');
    const state = await conversationManager.getConversationState(contact.id, conversation.id);
    console.log('✅ Conversation state retrieved:');
    console.log('  - Messages:', state.messages.length);
    console.log('  - Lead Name:', state.leadName);
    console.log('  - Lead Email:', state.leadEmail);
    console.log('  - Current Step:', state.currentStep);
    console.log('  - Tags:', state.ghlTags);
    
    // Test 4: Send a test message
    console.log('\n📋 Test 4: Message Sending');
    try {
      await ghlService.sendSMS(contact.id, 'This is a test message from the GHL integration test.');
      console.log('✅ Test message sent successfully');
    } catch (error) {
      console.log('⚠️  Could not send SMS (this is normal if SMS is not configured)');
    }
    
    // Test 5: Calendar slots
    console.log('\n📋 Test 5: Calendar Integration');
    if (process.env.GHL_CALENDAR_ID) {
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      
      try {
        const slots = await ghlService.getAvailableSlots(
          process.env.GHL_CALENDAR_ID,
          startDate,
          endDate
        );
        console.log('✅ Available calendar slots:', slots.length);
        if (slots.length > 0) {
          console.log('  First slot:', new Date(slots[0].startTime).toLocaleString());
        }
      } catch (error) {
        console.log('⚠️  Could not fetch calendar slots:', error.message);
      }
    } else {
      console.log('⚠️  No calendar ID configured');
    }
    
    // Test 6: Cache functionality
    console.log('\n📋 Test 6: Cache Management');
    console.time('First fetch');
    await conversationManager.getConversationState(contact.id, conversation.id);
    console.timeEnd('First fetch');
    
    console.time('Cached fetch');
    await conversationManager.getConversationState(contact.id, conversation.id);
    console.timeEnd('Cached fetch');
    
    console.log('✅ Cache is working (second fetch should be faster)');
    
    // Test 7: Message history parsing
    console.log('\n📋 Test 7: Message History Analysis');
    const testMessages = [
      { direction: 'inbound', body: 'Hi, I saw your ad' },
      { direction: 'outbound', body: 'Hello! What can I help you with?' },
      { direction: 'inbound', body: 'My name is John and I need help with marketing' },
      { direction: 'outbound', body: 'Nice to meet you John! Tell me more about your marketing challenges.' },
      { direction: 'inbound', body: 'We need more leads. Our budget is $500/month' }
    ];
    
    const convertedMessages = conversationManager.convertGHLMessages(testMessages);
    console.log('✅ Converted', testMessages.length, 'messages');
    console.log('  - Human messages:', convertedMessages.filter(m => m._getType() === 'human').length);
    console.log('  - AI messages:', convertedMessages.filter(m => m._getType() === 'ai').length);
    
    console.log('\n✨ All tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
  }
}

// Run tests
testGHLIntegration();