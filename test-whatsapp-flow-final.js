import { graph } from './agents/webhookHandler.js';
import { config } from 'dotenv';

config();

console.log('🚀 FINAL WHATSAPP FLOW TEST');
console.log('===========================\n');

const TEST_CONTACT_ID = '54sJIGTtwmR89Qc5JeEt';

async function testWhatsAppFlow() {
  const payload = {
    phone: '+13054870475',
    message: 'Quiero información sobre marketing digital',
    contactId: TEST_CONTACT_ID
  };
  
  console.log('📨 Test message:', payload.message);
  console.log('Contact:', TEST_CONTACT_ID);
  console.log('');
  
  const state = {
    messages: [{
      role: 'human',
      content: JSON.stringify(payload)
    }]
  };
  
  console.log('⏱️  Processing webhook...\n');
  
  try {
    // Capture console logs to see tool calls
    const originalLog = console.log;
    const toolCalls = [];
    
    // Override console.log to capture specific logs
    console.log = (...args) => {
      const logStr = args.join(' ');
      if (logStr.includes('SEND GHL MESSAGE') || 
          logStr.includes('MESSAGE SENT SUCCESSFULLY') ||
          logStr.includes('sendGHLMessage')) {
        toolCalls.push(logStr);
      }
      originalLog(...args);
    };
    
    const result = await graph.invoke(state, {
      configurable: { 
        features: { enableDeduplication: false } 
      }
    });
    
    // Restore console.log
    console.log = originalLog;
    
    console.log('\n✅ WEBHOOK COMPLETED!\n');
    
    // Extract only NEW messages (not from history)
    const newMessages = [];
    let foundInitialMessage = false;
    
    for (const msg of result.messages || []) {
      // Skip until we find our input message
      if (!foundInitialMessage) {
        if (msg.content === JSON.stringify(payload)) {
          foundInitialMessage = true;
        }
        continue;
      }
      
      // Collect messages after our input
      if (msg.constructor.name === 'AIMessage' && msg.content) {
        newMessages.push(msg.content);
      }
    }
    
    console.log('📤 MESSAGES SENT VIA WHATSAPP:\n');
    
    if (newMessages.length > 0) {
      newMessages.forEach((msg, i) => {
        console.log(`${i + 1}. "${msg}"\n`);
      });
    } else {
      console.log('❌ No new messages found!\n');
    }
    
    console.log('🔍 TOOL CALLS DETECTED:\n');
    toolCalls.forEach(call => {
      if (call.includes('SEND GHL MESSAGE START')) {
        console.log('✓ sendGHLMessage tool was called');
      }
      if (call.includes('MESSAGE SENT SUCCESSFULLY')) {
        console.log('✓ WhatsApp message sent successfully');
      }
    });
    
    console.log('\n📱 VERIFICATION:\n');
    console.log('1. Check GHL conversation at:');
    console.log('   https://app.gohighlevel.com/v2/location/sHFG9Rw6BdGh6d6bfMqG/contacts/detail/54sJIGTtwmR89Qc5JeEt');
    console.log('\n2. You should see in WhatsApp:');
    newMessages.forEach((msg, i) => {
      console.log(`   - ${msg.substring(0, 60)}...`);
    });
    
    console.log('\n3. Check LangSmith trace for:');
    console.log('   - sendGHLMessage tool execution');
    console.log('   - Tool response confirmation');
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
}

testWhatsAppFlow();