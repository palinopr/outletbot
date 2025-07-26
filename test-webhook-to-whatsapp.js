import { graph } from './agents/webhookHandler.js';
import { config } from 'dotenv';

config();

console.log('🚀 TESTING WEBHOOK → WHATSAPP FLOW');
console.log('=================================\n');

const TEST_CONTACT_ID = '54sJIGTtwmR89Qc5JeEt';

async function testWebhookToWhatsApp() {
  // Test messages to trigger different responses
  const testMessages = [
    {
      name: 'Simple greeting',
      payload: {
        phone: '+13054870475',
        message: 'Hola',
        contactId: TEST_CONTACT_ID
      }
    },
    {
      name: 'With name',
      payload: {
        phone: '+13054870475',
        message: 'Hola, me llamo Carlos',
        contactId: TEST_CONTACT_ID
      }
    },
    {
      name: 'Full context',
      payload: {
        phone: '+13054870475',
        message: 'Hola, soy Carlos y necesito ayuda con marketing para mi restaurante',
        contactId: TEST_CONTACT_ID
      }
    }
  ];
  
  // Test one message at a time
  const testCase = testMessages[0]; // Start with simple greeting
  
  console.log(`📨 Test: ${testCase.name}`);
  console.log('Payload:', testCase.payload);
  console.log('');
  
  try {
    // Create webhook state
    const initialState = {
      messages: [{
        role: 'human',
        content: JSON.stringify(testCase.payload)
      }],
      contactId: testCase.payload.contactId,
      phone: testCase.payload.phone
    };
    
    console.log('⏱️  Invoking webhook handler...\n');
    const startTime = Date.now();
    
    // Add timeout to prevent hanging
    const webhookPromise = graph.invoke(initialState, {
      configurable: {
        features: {
          enableDeduplication: false
        }
      },
      runId: `webhook-test-${Date.now()}`
    });
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Webhook timeout after 30 seconds')), 30000);
    });
    
    const result = await Promise.race([webhookPromise, timeoutPromise]);
    
    const duration = Date.now() - startTime;
    
    console.log(`\n✅ WEBHOOK COMPLETED in ${duration}ms!\n`);
    
    // Analyze results
    console.log('📊 RESULTS:\n');
    
    // Count messages
    const initialCount = initialState.messages.length;
    const finalCount = result.messages?.length || 0;
    const newMessages = finalCount - initialCount;
    
    console.log(`Messages: ${initialCount} → ${finalCount} (+${newMessages})\n`);
    
    // Show all messages
    if (result.messages) {
      result.messages.forEach((msg, i) => {
        console.log(`${i + 1}. ${msg.constructor.name}:`);
        if (typeof msg.content === 'string') {
          console.log(`   "${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}"`);
        } else {
          console.log(`   [${typeof msg.content} content]`);
        }
        console.log('');
      });
    }
    
    // Extract bot responses
    const botResponses = [];
    for (let i = initialCount; i < result.messages.length; i++) {
      const msg = result.messages[i];
      if (msg.constructor.name === 'AIMessage' && msg.content) {
        botResponses.push(msg.content);
      }
    }
    
    console.log(`\n💬 BOT RESPONSES (${botResponses.length}):\n`);
    botResponses.forEach((response, i) => {
      console.log(`${i + 1}. "${response}"\n`);
    });
    
    // Show lead info
    if (result.leadInfo) {
      console.log('📋 LEAD INFO EXTRACTED:');
      Object.entries(result.leadInfo).forEach(([key, value]) => {
        if (value && typeof value !== 'object') {
          console.log(`- ${key}: ${value}`);
        }
      });
      console.log('');
    }
    
    console.log('\n🔍 VERIFICATION STEPS:\n');
    console.log('1. Check LangSmith trace for:');
    console.log('   - extractLeadInfo tool calls');
    console.log('   - sendGHLMessage tool calls');
    console.log('   - updateGHLContact tool calls\n');
    
    console.log('2. Check application logs for:');
    console.log('   - "📤 SEND GHL MESSAGE START"');
    console.log('   - "✅ MESSAGE SENT SUCCESSFULLY"\n');
    
    console.log('3. Check GHL conversation:');
    console.log('   URL: https://app.gohighlevel.com/v2/location/sHFG9Rw6BdGh6d6bfMqG/contacts/detail/54sJIGTtwmR89Qc5JeEt');
    console.log('   Should see bot responses in WhatsApp\n');
    
  } catch (error) {
    console.error('\n❌ WEBHOOK FAILED:', error.message);
    
    if (error.message.includes('timeout')) {
      console.error('\n⏱️ The webhook timed out. Possible issues:');
      console.error('- Agent stuck in tool loop');
      console.error('- LLM not responding');
      console.error('- Check logs for last operation');
    } else {
      console.error('\nError details:', error.stack);
    }
  }
}

// Check logs setting
console.log('Log level:', process.env.LOG_LEVEL || 'info');
console.log('To see detailed logs, set LOG_LEVEL=debug\n');

// Run test
testWebhookToWhatsApp().catch(console.error);