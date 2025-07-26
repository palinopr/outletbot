#!/usr/bin/env node
import 'dotenv/config';
import { GHLService } from './services/ghlService.js';
import { graph } from './agents/webhookHandler.js';
import { Logger } from './services/logger.js';

const logger = new Logger('whatsapp-verify');

console.log('🔍 VERIFYING WHATSAPP MESSAGE SENDING');
console.log('=====================================\n');

const TEST_CONTACT_ID = '54sJIGTtwmR89Qc5JeEt';

async function verifyWhatsAppSending() {
  try {
    // 1. Initialize GHL Service
    console.log('1️⃣ Initializing GHL Service...');
    const ghlService = new GHLService(
      process.env.GHL_API_KEY,
      process.env.GHL_LOCATION_ID
    );
    console.log('✅ GHL Service initialized\n');
    
    // 2. Test direct WhatsApp sending
    console.log('2️⃣ Testing direct WhatsApp message...');
    const testMessage = `Test message from verification script - ${new Date().toISOString()}`;
    
    try {
      const messageResult = await ghlService.sendSMS(TEST_CONTACT_ID, testMessage);
      console.log('✅ WhatsApp message sent successfully!');
      console.log('   Message ID:', messageResult?.id || 'not provided');
      console.log('   Status:', messageResult?.status || 'sent');
    } catch (error) {
      console.error('❌ Direct WhatsApp send failed:', error.message);
      return;
    }
    
    // 3. Get conversation to verify message appears
    console.log('\n3️⃣ Fetching conversation to verify...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s for message to propagate
    
    try {
      const conversations = await ghlService.getConversations(TEST_CONTACT_ID);
      if (conversations && conversations.length > 0) {
        const conversation = conversations[0];
        console.log('✅ Found conversation:', conversation.id);
        
        // Get messages
        const messages = await ghlService.getConversationMessages(conversation.id);
        console.log(`   Total messages: ${messages.length}`);
        
        // Find our test message
        const foundMessage = messages.find(m => 
          m.body?.includes('Test message from verification script')
        );
        
        if (foundMessage) {
          console.log('✅ Test message found in conversation!');
          console.log(`   Sent at: ${new Date(foundMessage.dateAdded).toLocaleString()}`);
        } else {
          console.log('⚠️ Test message not found yet (may still be processing)');
        }
      }
    } catch (error) {
      console.error('❌ Failed to fetch conversation:', error.message);
    }
    
    // 4. Test through webhook flow
    console.log('\n4️⃣ Testing WhatsApp through webhook flow...');
    const webhookPayload = {
      phone: '+13054870475',
      message: 'Test from webhook flow',
      contactId: TEST_CONTACT_ID
    };
    
    const state = {
      messages: [{
        role: 'human',
        content: JSON.stringify(webhookPayload)
      }]
    };
    
    console.log('   Invoking webhook...');
    const startTime = Date.now();
    
    // Capture tool calls
    const originalLog = logger.info.bind(logger);
    const toolCalls = [];
    logger.info = (...args) => {
      const message = args[0];
      if (message?.includes('SEND GHL MESSAGE') || message?.includes('MESSAGE SENT SUCCESSFULLY')) {
        toolCalls.push({ message, data: args[1] });
      }
      originalLog(...args);
    };
    
    try {
      const result = await graph.invoke(state, {
        configurable: { 
          features: { enableDeduplication: false } 
        }
      });
      
      const duration = Date.now() - startTime;
      console.log(`✅ Webhook completed in ${duration}ms`);
      
      // Check for tool calls
      const sendCalls = toolCalls.filter(t => t.message.includes('SEND GHL MESSAGE START'));
      const successCalls = toolCalls.filter(t => t.message.includes('MESSAGE SENT SUCCESSFULLY'));
      
      console.log(`\n   Tool calls detected:`);
      console.log(`   - sendGHLMessage called: ${sendCalls.length} times`);
      console.log(`   - Messages sent successfully: ${successCalls.length} times`);
      
      if (successCalls.length > 0) {
        console.log('\n✅ WhatsApp messages ARE being sent through the webhook flow!');
        successCalls.forEach((call, i) => {
          console.log(`   Message ${i + 1}: Sent to ${call.data?.contactId} in ${call.data?.sendTime}ms`);
        });
      } else {
        console.log('\n⚠️ No successful WhatsApp sends detected in webhook flow');
      }
      
    } catch (error) {
      console.error('❌ Webhook flow failed:', error.message);
    }
    
    // Restore logger
    logger.info = originalLog;
    
    // 5. Summary
    console.log('\n📊 VERIFICATION SUMMARY:');
    console.log('========================');
    console.log('1. GHL Service: ✅ Initialized');
    console.log('2. Direct WhatsApp: ✅ Working');
    console.log('3. Message in conversation: Check GHL manually');
    console.log('4. Webhook flow: Check results above');
    console.log('\n🔗 Verify in GHL:');
    console.log(`   https://app.gohighlevel.com/v2/location/${process.env.GHL_LOCATION_ID}/contacts/detail/${TEST_CONTACT_ID}`);
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    console.error(error.stack);
  }
}

// Check environment variables first
const requiredVars = ['GHL_API_KEY', 'GHL_LOCATION_ID', 'OPENAI_API_KEY'];
const missing = requiredVars.filter(v => !process.env[v]);

if (missing.length > 0) {
  console.error('❌ Missing required environment variables:');
  missing.forEach(v => console.error(`   - ${v}`));
  console.error('\nPlease set these in your .env file');
  process.exit(1);
}

// Run verification
verifyWhatsAppSending().catch(console.error);