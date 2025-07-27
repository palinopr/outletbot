#!/usr/bin/env node

import { config as dotenvConfig } from 'dotenv';
import { GHLService } from './services/ghlService.js';

dotenvConfig();

const ghlService = new GHLService(
  process.env.GHL_API_KEY,  
  process.env.GHL_LOCATION_ID
);

async function checkConversation() {
  console.log('🔍 Checking GHL Conversation\n');
  
  try {
    // Try to find conversation by phone
    const phone = '+13054870475';
    console.log('Searching for conversation by phone:', phone);
    
    const response = await ghlService.client.get('/conversations/search', {
      params: {
        locationId: process.env.GHL_LOCATION_ID,
        q: phone.replace(/\D/g, '') // Remove non-digits
      }
    });
    
    if (response.data.conversations && response.data.conversations.length > 0) {
      const conv = response.data.conversations[0];
      console.log('\n✅ Found conversation!');
      console.log('ID:', conv.id);
      console.log('Contact ID:', conv.contactId);
      console.log('Last message:', conv.lastMessageBody?.substring(0, 100) + '...');
      console.log('Last message type:', conv.lastMessageType);
      console.log('Unread:', conv.unreadCount);
      
      // Get messages
      console.log('\n📨 Getting messages...');
      const messages = await ghlService.getConversationMessages(conv.id);
      
      if (messages && messages.length > 0) {
        console.log(`Total messages: ${messages.length}`);
        
        // Count by direction
        const inbound = messages.filter(m => m.direction === 'inbound').length;
        const outbound = messages.filter(m => m.direction === 'outbound').length;
        
        console.log(`Inbound: ${inbound}`);
        console.log(`Outbound: ${outbound}`);
        
        // Show last 3 messages
        console.log('\nLast 3 messages:');
        messages.slice(0, 3).forEach((msg, idx) => {
          console.log(`\n${idx + 1}. [${msg.direction}] ${new Date(msg.dateAdded).toLocaleTimeString()}`);
          console.log(`   ${msg.body?.substring(0, 100)}...`);
        });
      }
    } else {
      console.log('❌ No conversation found');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

checkConversation().catch(console.error);