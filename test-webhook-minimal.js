import { graph } from './agents/webhookHandler.js';
import { config } from 'dotenv';
import { setupTestEnvironment } from './tests/test-setup.js';

config();

// Setup test environment with validation
try {
  setupTestEnvironment();
} catch (error) {
  process.exit(1);
}

console.log('🧪 MINIMAL WEBHOOK TEST');
console.log('=====================\n');

async function minimalWebhookTest() {
  const payload = {
    phone: '+13054870475',
    message: 'Hola test',
    contactId: '54sJIGTtwmR89Qc5JeEt'
  };
  
  console.log('Payload:', payload);
  
  const state = {
    messages: [{
      role: 'human',
      content: JSON.stringify(payload)
    }]
  };
  
  console.log('\nStarting webhook with 20 second timeout...\n');
  
  try {
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT after 20 seconds')), 20000)
    );
    
    const webhook = graph.invoke(state, {
      configurable: { features: { enableDeduplication: false } }
    });
    
    const result = await Promise.race([webhook, timeout]);
    
    console.log('✅ SUCCESS! Webhook completed');
    console.log('Messages returned:', result.messages?.length || 0);
    
    // Show any AI responses
    const aiMessages = result.messages?.filter(m => m.role === 'assistant' || m.constructor.name === 'AIMessage') || [];
    console.log('\nAI responses:', aiMessages.length);
    aiMessages.forEach(msg => {
      console.log('-', msg.content?.substring(0, 100));
    });
    
  } catch (error) {
    console.error('❌ FAILED:', error.message);
    
    if (error.message.includes('TIMEOUT')) {
      console.error('\nThe webhook is hanging. Check:');
      console.error('1. Service initialization (3s timeout should trigger)');
      console.error('2. Conversation fetch (5s timeout should trigger)');
      console.error('3. Agent processing (10s timeout should trigger)');
      console.error('\nRun with LOG_LEVEL=debug to see where it hangs');
    }
  }
}

minimalWebhookTest();