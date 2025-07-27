#!/usr/bin/env node
/**
 * Verify if bot messages are in GHL
 */

import { config as dotenvConfig } from 'dotenv';
import { GHLService } from './services/ghlService.js';

dotenvConfig();

const ghlService = new GHLService(
  process.env.GHL_API_KEY,  
  process.env.GHL_LOCATION_ID
);

async function verifyMessages() {
  console.log('🔍 Verifying GHL WhatsApp Messages\n');
  
  try {
    // Get contact
    const contactId = 'ym8G7K6GSzm8dJDZ6BNo';
    console.log('1. Getting contact info...');
    const contact = await ghlService.getContact(contactId);
    console.log(`Contact: ${contact.firstName || contact.name}`);
    console.log(`Phone: ${contact.phone}`);
    
    // Get conversation
    const conversationId = contact.lastMessageBody?.conversationId;
    if (!conversationId) {
      console.log('❌ No conversation found');
      return;
    }
    
    console.log(`\n2. Found conversation: ${conversationId}`);
    
    // Get messages
    console.log('\n3. Getting conversation messages...');
    const messages = await ghlService.getConversationMessages(conversationId);
    
    if (!messages || messages.length === 0) {
      console.log('❌ No messages found');
      return;
    }
    
    console.log(`✅ Found ${messages.length} messages\n`);
    
    // Analyze messages
    const inbound = messages.filter(m => m.direction === 'inbound');
    const outbound = messages.filter(m => m.direction === 'outbound');
    
    console.log(`📥 Inbound (customer): ${inbound.length}`);
    console.log(`📤 Outbound (bot/agent): ${outbound.length}`);
    
    // Show recent outbound messages
    console.log('\n📤 Recent Bot Messages (last 5):');
    console.log('=' .repeat(60));
    
    outbound.slice(0, 5).forEach((msg, idx) => {
      const time = new Date(msg.dateAdded).toLocaleString();
      console.log(`\n${idx + 1}. Sent at: ${time}`);
      console.log(`   Type: ${msg.type}`);
      console.log(`   Status: ${msg.status}`);
      console.log(`   Body: ${msg.body?.substring(0, 150)}...`);
    });
    
    // Check if bot messages match test patterns
    console.log('\n\n4. Checking for bot message patterns...');
    const botPatterns = [
      '¡Hola! Soy María',
      'Mucho gusto',
      '¿Podrías contarme',
      'presupuesto mensual',
      'horarios disponibles'
    ];
    
    botPatterns.forEach(pattern => {
      const found = outbound.some(m => m.body?.includes(pattern));
      console.log(`${found ? '✅' : '❌'} Pattern "${pattern}"`);
    });
    
    // Summary
    console.log('\n\n📊 Summary:');
    if (outbound.length > 0) {
      console.log('✅ Bot IS sending messages to GHL successfully!');
      console.log(`✅ Total bot messages sent: ${outbound.length}`);
      const lastSent = new Date(outbound[0].dateAdded);
      const minutesAgo = Math.floor((Date.now() - lastSent) / 1000 / 60);
      console.log(`✅ Last message sent: ${minutesAgo} minutes ago`);
    } else {
      console.log('❌ No bot messages found in conversation');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

verifyMessages().catch(console.error);