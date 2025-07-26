#!/usr/bin/env node
import 'dotenv/config';

console.log('🧪 TESTING LIVE DEPLOYMENT');
console.log('=========================\n');

// Common deployment URL patterns for outlet bot
const possibleUrls = [
  'https://outletbot.us.langgraph.app/webhook/meta-lead',
  'https://outlet-bot.us.langgraph.app/webhook/meta-lead',
  'https://outlet-media-bot.us.langgraph.app/webhook/meta-lead',
  'https://outletbot-prod.us.langgraph.app/webhook/meta-lead'
];

async function testUrl(url) {
  const payload = {
    phone: '+13054870475',
    message: 'Hola, test desde Claude',
    contactId: '54sJIGTtwmR89Qc5JeEt'
  };
  
  try {
    console.log(`Testing: ${url}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      timeout: 10000
    });
    
    if (response.ok) {
      console.log(`✅ SUCCESS! Status: ${response.status}`);
      const data = await response.json();
      console.log('Response received!\n');
      return { url, success: true, data };
    } else {
      console.log(`❌ Failed: ${response.status} ${response.statusText}\n`);
      return { url, success: false, status: response.status };
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}\n`);
    return { url, success: false, error: error.message };
  }
}

async function findDeployment() {
  console.log('Trying common deployment URLs...\n');
  
  for (const url of possibleUrls) {
    const result = await testUrl(url);
    if (result.success) {
      console.log('🎉 FOUND WORKING DEPLOYMENT!');
      console.log(`URL: ${result.url}`);
      console.log('\n📱 Check WhatsApp messages at:');
      console.log('https://app.gohighlevel.com/v2/location/sHFG9Rw6BdGh6d6bfMqG/contacts/detail/54sJIGTtwmR89Qc5JeEt');
      return result;
    }
  }
  
  console.log('Could not find deployment. The URL might be:');
  console.log('- Using a custom subdomain');
  console.log('- In a different region');
  console.log('- Not yet deployed\n');
  console.log('Check your LangGraph dashboard for the exact URL');
}

// Direct test if you mentioned a specific pattern
const directTest = async () => {
  // Based on the GitHub repo name 'outletbot'
  const likelyUrl = 'https://outletbot.us.langgraph.app/webhook/meta-lead';
  
  console.log('📤 Sending test to most likely URL...\n');
  
  const payload = {
    phone: '+13054870475',
    message: `Test ${new Date().toISOString()}: Hola, necesito información`,
    contactId: '54sJIGTtwmR89Qc5JeEt'
  };
  
  try {
    const response = await fetch(likelyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    console.log(`Status: ${response.status}`);
    
    if (response.ok) {
      console.log('✅ Webhook accepted the request!\n');
      console.log('🔍 CHECK FOR BOT RESPONSE:');
      console.log('1. WhatsApp conversation:');
      console.log('   https://app.gohighlevel.com/v2/location/sHFG9Rw6BdGh6d6bfMqG/contacts/detail/54sJIGTtwmR89Qc5JeEt');
      console.log('\n2. LangSmith traces (if configured)');
      console.log('\n3. You should see a Spanish response within 10 seconds');
    } else {
      const text = await response.text();
      console.log('Response:', text.substring(0, 200));
      console.log('\nTrying other URLs...\n');
      await findDeployment();
    }
  } catch (error) {
    console.error('Error:', error.message);
    console.log('\nTrying other URLs...\n');
    await findDeployment();
  }
};

directTest().catch(console.error);