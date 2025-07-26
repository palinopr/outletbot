#!/usr/bin/env node

console.log('🧪 TESTING WITHOUT GHL DEPENDENCY');
console.log('=================================\n');

const API_KEY = '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';
const BASE_URL = 'https://outletbot-a6387ef666a552b8ada595998ba395ea.us.langgraph.app';

// Test the sales agent directly (bypassing webhook handler)
async function testSalesAgent() {
  console.log('Testing sales_agent graph (no GHL dependency)...\n');
  
  const payload = {
    assistant_id: 'sales_agent',
    input: {
      messages: [{
        role: 'human',
        content: 'Hola, necesito ayuda con marketing'
      }],
      leadInfo: {},
      contactId: '54sJIGTtwmR89Qc5JeEt'
    },
    stream_mode: 'values'
  };
  
  try {
    const response = await fetch(`${BASE_URL}/runs/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      console.error('❌ Request failed:', response.status);
      return;
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let hasResponse = false;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.messages) {
              const aiMessages = data.messages.filter(m => m.type === 'ai');
              for (const msg of aiMessages) {
                if (msg.content) {
                  console.log('🤖 Bot response:', msg.content);
                  hasResponse = true;
                }
              }
            }
          } catch (e) {}
        }
      }
    }
    
    if (hasResponse) {
      console.log('\n✅ Sales agent is working!');
      console.log('The issue is specifically with webhook_handler initialization.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Test a simple echo endpoint
async function testEcho() {
  console.log('\n\nTesting if any graph works...\n');
  
  // Try webhook handler with minimal input
  const payload = {
    assistant_id: 'webhook_handler',
    input: {
      messages: [{
        role: 'human',
        content: 'test'  // Not JSON, just plain text
      }]
    },
    stream_mode: 'values'
  };
  
  try {
    const response = await fetch(`${BASE_URL}/runs/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify(payload)
    });
    
    console.log('Response status:', response.status);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

(async () => {
  await testSalesAgent();
  await testEcho();
  
  console.log('\n\n📊 DIAGNOSIS:');
  console.log('============');
  console.log('If sales_agent works but webhook_handler fails:');
  console.log('→ GHL service initialization is the problem');
  console.log('\nCheck deployment logs for:');
  console.log('1. Missing environment variables');
  console.log('2. Network errors connecting to GHL');
  console.log('3. Import errors for GHL service');
})();