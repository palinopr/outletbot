require('dotenv').config();
const axios = require('axios');

// Test script for local development with LangSmith tracing
const TEST_URL = 'http://localhost:4000/webhook/meta-lead';

// Test conversations
const testConversations = [
  {
    name: "Qualified Lead Test",
    messages: [
      { message: "Hi, I saw your ad on Facebook about marketing services" },
      { message: "My name is John Smith" },
      { message: "We're struggling to get consistent leads for our business" },
      { message: "We want to have a predictable flow of qualified customers" },
      { message: "Our budget is around $500 per month" },
      { message: "john@example.com" },
      { message: "Tomorrow at 2pm works great!" }
    ]
  },
  {
    name: "Unqualified Lead Test",
    messages: [
      { message: "Hello, what do you offer?" },
      { message: "I'm Sarah" },
      { message: "Just looking for some basic social media help" },
      { message: "Want to improve our Instagram presence" },
      { message: "We can only spend about $100-150 monthly" }
    ]
  }
];

// Simulate conversation
async function simulateConversation(conversation, contactId) {
  console.log(`\n🚀 Starting test: ${conversation.name}`);
  console.log(`📱 Contact ID: ${contactId}`);
  console.log('-----------------------------------');
  
  const conversationId = `test-conv-${Date.now()}`;
  
  for (let i = 0; i < conversation.messages.length; i++) {
    const msg = conversation.messages[i];
    
    try {
      console.log(`\n👤 Customer: "${msg.message}"`);
      
      const response = await axios.post(TEST_URL, {
        phone: "+15551234567",
        message: msg.message,
        contactId: contactId,
        conversationId: conversationId
      });
      
      console.log(`🤖 Bot processed successfully`);
      console.log(`✅ Check LangSmith for trace: https://smith.langchain.com`);
      
      // Wait 2 seconds between messages to simulate real conversation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`❌ Error:`, error.response?.data || error.message);
    }
  }
  
  console.log('\n✨ Conversation complete!\n');
}

// Run tests
async function runTests() {
  console.log('🧪 Starting Local Bot Tests with LangSmith Tracing');
  console.log('==================================================');
  console.log(`📊 LangSmith Project: ${process.env.LANGSMITH_PROJECT || 'outlet-media-bot'}`);
  console.log(`🔍 Tracing Enabled: ${process.env.LANGCHAIN_TRACING_V2}`);
  
  // Check if server is running
  try {
    await axios.get('http://localhost:4000/health');
    console.log('✅ Server is running\n');
  } catch (error) {
    console.error('❌ Server is not running! Start with: npm run dev');
    process.exit(1);
  }
  
  // Run test conversations
  for (let i = 0; i < testConversations.length; i++) {
    const contactId = `test-contact-${Date.now()}-${i}`;
    await simulateConversation(testConversations[i], contactId);
    
    if (i < testConversations.length - 1) {
      console.log('⏳ Waiting before next test...\n');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  console.log('\n🎉 All tests complete!');
  console.log('📈 View detailed traces at: https://smith.langchain.com');
  console.log(`🔍 Project: ${process.env.LANGSMITH_PROJECT || 'outlet-media-bot'}`);
}

// Single message test
async function testSingleMessage(message) {
  console.log('📤 Sending single message test...');
  
  try {
    const response = await axios.post(TEST_URL, {
      phone: "+15551234567",
      message: message,
      contactId: `single-test-${Date.now()}`,
      conversationId: `single-conv-${Date.now()}`
    });
    
    console.log('✅ Response:', response.data);
    console.log('📊 Check LangSmith for trace');
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// Command line usage
const args = process.argv.slice(2);

if (args.length > 0) {
  // Single message test: node test-local.js "Your message here"
  testSingleMessage(args.join(' '));
} else {
  // Full conversation tests
  runTests();
}