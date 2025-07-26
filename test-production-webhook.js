#!/usr/bin/env node
import 'dotenv/config';

console.log('🚀 TESTING PRODUCTION WEBHOOK');
console.log('=============================\n');

const API_KEY = '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';
const WEBHOOK_URL = 'https://outletbot-a6387ef666a552b8ada595998ba395ea.us.langgraph.app/runs/stream';

async function testWebhook() {
  const payload = {
    assistant_id: 'webhook_handler',
    input: {
      messages: [{
        role: 'human',
        content: JSON.stringify({
          phone: '+13054870475',
          message: 'Hola, me llamo Jaime y necesito ayuda con marketing para mi restaurante',
          contactId: '54sJIGTtwmR89Qc5JeEt'
        })
      }]
    },
    stream_mode: 'values'
  };

  console.log('📤 Sending test message...');
  console.log('Message:', JSON.parse(payload.input.messages[0].content).message);
  console.log('');

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error('❌ Request failed:', response.status, response.statusText);
      return;
    }

    console.log('📨 Streaming response:\n');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let botResponses = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            // Look for AI messages
            if (data.messages) {
              const aiMessages = data.messages.filter(m => m.type === 'ai');
              for (const msg of aiMessages) {
                if (msg.content && !botResponses.includes(msg.content)) {
                  botResponses.push(msg.content);
                  console.log('🤖 Bot:', msg.content);
                }
              }
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }
      }
    }

    console.log('\n📊 Summary:');
    console.log(`Total bot responses: ${botResponses.length}`);
    
    if (botResponses.some(r => r.includes('error') || r.includes('Lo siento'))) {
      console.log('\n⚠️  Bot returned an error message!');
      console.log('This usually means:');
      console.log('1. Service initialization timeout');
      console.log('2. Missing environment variables');
      console.log('3. GHL API connection issues');
      
      console.log('\n🔍 Check deployment logs for:');
      console.log('- "Initialization attempt X failed"');
      console.log('- Specific error messages');
    } else if (botResponses.length > 0) {
      console.log('\n✅ Bot is working correctly!');
      console.log('Check GHL for WhatsApp messages.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Test different scenarios
async function runTests() {
  const testCases = [
    {
      name: 'Simple greeting',
      message: 'Hola'
    },
    {
      name: 'With context',
      message: 'Hola, soy Carlos y tengo un restaurante. Necesito más clientes'
    },
    {
      name: 'Budget qualification',
      message: 'Mi presupuesto es de $500 al mes'
    }
  ];

  for (const test of testCases) {
    console.log(`\n📝 Test: ${test.name}`);
    console.log('─'.repeat(40));
    
    await testWebhook();
    
    // Wait between tests
    await new Promise(r => setTimeout(r, 3000));
  }
}

console.log('🔗 Webhook URL:', WEBHOOK_URL);
console.log('🔑 Using API Key:', API_KEY.substring(0, 20) + '...\n');

testWebhook().catch(console.error);