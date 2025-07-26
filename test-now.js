#!/usr/bin/env node
import fetch from 'node-fetch';

console.log('🧪 TESTING YOUR LIVE DEPLOYMENT');
console.log('==============================\n');

// UPDATE THIS WITH YOUR ACTUAL DEPLOYMENT URL
const DEPLOYMENT_URL = 'https://outletbot-[your-id].us.langgraph.app/webhook/meta-lead';

async function testDeployment() {
  const testCases = [
    {
      name: 'Simple greeting',
      payload: {
        phone: '+13054870475',
        message: 'Hola',
        contactId: '54sJIGTtwmR89Qc5JeEt'
      }
    },
    {
      name: 'With name',
      payload: {
        phone: '+13054870475',
        message: 'Hola, soy Juan',
        contactId: '54sJIGTtwmR89Qc5JeEt'
      }
    },
    {
      name: 'Full context',
      payload: {
        phone: '+13054870475',
        message: 'Necesito ayuda con marketing para mi tienda',
        contactId: '54sJIGTtwmR89Qc5JeEt'
      }
    }
  ];

  console.log('🔗 Webhook URL:', DEPLOYMENT_URL);
  console.log('   (Make sure to update this with your actual URL)\n');

  for (const test of testCases) {
    console.log(`📤 Test: ${test.name}`);
    console.log(`   Message: "${test.payload.message}"`);
    
    try {
      const startTime = Date.now();
      
      const response = await fetch(DEPLOYMENT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(test.payload)
      });

      const duration = Date.now() - startTime;
      
      console.log(`   Status: ${response.status} ${response.statusText}`);
      console.log(`   Time: ${duration}ms`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('   ✅ Success!\n');
        
        // Show response preview
        if (data.messages && data.messages.length > 0) {
          const lastMessage = data.messages[data.messages.length - 1];
          if (lastMessage.content) {
            console.log(`   Bot response: "${lastMessage.content.substring(0, 100)}..."`);
          }
        }
      } else {
        console.log('   ❌ Failed\n');
        const errorText = await response.text();
        console.log('   Error:', errorText.substring(0, 200));
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }
    
    // Wait 2 seconds between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n📱 CHECK RESULTS:');
  console.log('1. WhatsApp messages at:');
  console.log('   https://app.gohighlevel.com/v2/location/sHFG9Rw6BdGh6d6bfMqG/contacts/detail/54sJIGTtwmR89Qc5JeEt');
  console.log('\n2. LangSmith traces at:');
  console.log('   https://smith.langchain.com');
  console.log('\n3. Expected: Bot should respond in Spanish asking for name or next info');
}

// Check if URL was updated
if (DEPLOYMENT_URL.includes('[your-id]')) {
  console.error('❌ ERROR: Please update DEPLOYMENT_URL with your actual deployment URL!');
  console.error('   Look for something like: https://outletbot-abc123.us.langgraph.app/webhook/meta-lead');
  process.exit(1);
}

testDeployment().catch(console.error);