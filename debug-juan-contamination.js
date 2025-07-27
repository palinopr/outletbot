#!/usr/bin/env node
/**
 * Debug where "Juan" is coming from
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import { GHLService } from './services/ghlService.js';
import ConversationManager from './services/conversationManager.js';

const ghlService = new GHLService(
  process.env.GHL_API_KEY,
  process.env.GHL_LOCATION_ID
);

const conversationManager = new ConversationManager(ghlService);

async function debugJuanContamination() {
  console.log('🔍 Debugging "Juan" Contamination\n');
  
  // Use a unique contact ID and phone
  const testContactId = 'debug-juan-' + Date.now();
  const testPhone = '+1' + Date.now().toString().slice(-10); // Unique phone
  
  console.log('📋 Test Details:');
  console.log(`Contact ID: ${testContactId}`);
  console.log(`Phone: ${testPhone} (UNIQUE)`);
  console.log('\n══════════════════════════════════════\n');
  
  try {
    // Step 1: Get conversation state
    console.log('1️⃣ Fetching conversation state...\n');
    
    const state = await conversationManager.getConversationState(
      testContactId,
      null,
      testPhone
    );
    
    console.log('📊 Results:');
    console.log(`Conversation ID: ${state.conversationId}`);
    console.log(`Messages found: ${state.messages.length}`);
    console.log(`Lead name from GHL: ${state.leadName || 'none'}`);
    console.log(`Message count: ${state.messageCount}`);
    
    if (state.messages.length > 0) {
      console.log('\n⚠️  FOUND MESSAGES FOR NEW CONTACT!');
      console.log('This should not happen with a unique phone number.\n');
      
      console.log('Messages:');
      state.messages.forEach((msg, i) => {
        const type = msg.constructor.name;
        const content = msg.content.substring(0, 100);
        console.log(`${i + 1}. [${type}] ${content}...`);
        
        // Check for "Juan"
        if (msg.content.toLowerCase().includes('juan')) {
          console.log('   ❌ FOUND "JUAN" IN THIS MESSAGE!');
        }
      });
    } else {
      console.log('\n✅ No messages found (expected for new contact)');
    }
    
    // Step 2: Check what conversation was found/created
    console.log('\n2️⃣ Checking conversation details...\n');
    
    const conversation = await ghlService.getConversation(state.conversationId);
    if (conversation) {
      console.log('Conversation details:');
      console.log(`- ID: ${conversation.id}`);
      console.log(`- Contact ID: ${conversation.contactId}`);
      console.log(`- Phone: ${conversation.phone}`);
      console.log(`- Created: ${conversation.dateAdded}`);
      console.log(`- Updated: ${conversation.dateUpdated}`);
      
      if (conversation.contactId !== testContactId) {
        console.log(`\n❌ WRONG CONTACT! Expected ${testContactId}, got ${conversation.contactId}`);
      }
    }
    
    // Step 3: Check cache
    console.log('\n3️⃣ Checking conversation cache...\n');
    
    console.log(`Cache size: ${conversationManager.cache.size}`);
    for (const [key, value] of conversationManager.cache.entries()) {
      console.log(`\nCache key: ${key}`);
      console.log(`Contact ID in cache: ${value.state.ghlContactId}`);
      console.log(`Messages in cache: ${value.state.messages?.length || 0}`);
      console.log(`Lead name in cache: ${value.state.leadName || 'none'}`);
      
      // Check if this cache entry contains Juan
      if (value.state.leadName?.toLowerCase().includes('juan') ||
          value.state.messages?.some(m => m.content?.toLowerCase().includes('juan'))) {
        console.log('❌ This cache entry contains "Juan"!');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugJuanContamination().catch(console.error);