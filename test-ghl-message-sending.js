#!/usr/bin/env node
/**
 * Test if messages are actually being sent to GHL
 */

import { config as dotenvConfig } from 'dotenv';
import { GHLService } from './services/ghlService.js';

dotenvConfig();

const ghlService = new GHLService(
  process.env.GHL_API_KEY,  
  process.env.GHL_LOCATION_ID
);

// Real contact to test with
const CONTACT_ID = 'ym8G7K6GSzm8dJDZ6BNo';

async function testGHLMessageSending() {
  console.log('🧪 Testing GHL Message Sending\n');
  
  try {
    // First, get the conversation
    console.log('1. Finding conversation for contact...');
    const conversations = await ghlService.searchConversations('+13054870475');
    
    if (!conversations || conversations.length === 0) {
      console.log('❌ No conversation found');
      return;
    }
    
    const conversationId = conversations[0].id;
    console.log(`✅ Found conversation: ${conversationId}`);
    
    // Get messages before sending
    console.log('\n2. Getting current messages...');
    const messagesBefore = await ghlService.getConversationMessages(conversationId);
    console.log(`Current message count: ${messagesBefore?.length || 0}`);
    
    // Send a test message
    console.log('\n3. Sending test message via GHL...');
    const testMessage = `Test message from bot - ${new Date().toLocaleTimeString()}`;
    
    try {
      const result = await ghlService.sendMessage(conversationId, testMessage);
      console.log('✅ Message sent successfully!');
      console.log('Message ID:', result.id);
      console.log('Message type:', result.type);
      console.log('Message status:', result.status);
      
      // Wait a moment for message to process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Get messages after sending
      console.log('\n4. Verifying message was delivered...');
      const messagesAfter = await ghlService.getConversationMessages(conversationId);
      console.log(`New message count: ${messagesAfter?.length || 0}`);
      
      if (messagesAfter && messagesAfter.length > messagesBefore.length) {
        console.log('✅ Message confirmed in conversation!');
        
        // Find our test message
        const ourMessage = messagesAfter.find(m => m.body === testMessage);
        if (ourMessage) {
          console.log('\nMessage details:');
          console.log('- Body:', ourMessage.body);
          console.log('- Direction:', ourMessage.direction);
          console.log('- Type:', ourMessage.type);
          console.log('- Status:', ourMessage.status);
          console.log('- Created:', new Date(ourMessage.dateAdded).toLocaleString());
        }
      } else {
        console.log('⚠️  Message count unchanged - may take time to appear');
      }
      
    } catch (error) {
      console.log('❌ Failed to send message:', error.message);
      console.log('Error details:', error.response?.data || error);
    }
    
    // Check recent messages from webhook test
    console.log('\n5. Checking recent bot messages...');
    const recentMessages = await ghlService.getConversationMessages(conversationId);
    if (recentMessages && recentMessages.length > 0) {
      console.log(`\nLast 5 messages in conversation:`);
      recentMessages.slice(0, 5).forEach((msg, idx) => {
        console.log(`\n${idx + 1}. [${msg.direction}] ${msg.type}`);
        console.log(`   Time: ${new Date(msg.dateAdded).toLocaleString()}`);
        console.log(`   Body: ${msg.body?.substring(0, 100)}...`);
        console.log(`   Status: ${msg.status}`);
      });
    }
    
  } catch (error) {
    console.error('Test error:', error.message);
  }
}

testGHLMessageSending().catch(console.error);