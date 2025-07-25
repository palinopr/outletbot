import { config } from 'dotenv';
import { graph as webhookHandler } from './agents/webhookHandler.js';
import { HumanMessage } from '@langchain/core/messages';

config();

async function testFullFlow() {
  console.log('🚀 Testing complete webhook to agent flow...\n');
  
  // Simulate a webhook payload
  const webhookPayload = {
    phone: '+11234567890',
    message: '500 al mes',  // Customer saying their budget
    contactId: 'Kdj9FkxZc3yq7d5tyT97',
    conversationId: 'LZpnjAcARwjbk3F4DTT8'
  };
  
  console.log('📥 Simulating webhook with payload:', webhookPayload);
  console.log('\n--- Expected Behavior ---');
  console.log('Agent should:');
  console.log('1. Recognize this is Jaime from the restaurant');
  console.log('2. Know they already discussed the problem');
  console.log('3. Understand this is the budget response ($500/month)');
  console.log('4. Ask for email since budget is >$300');
  console.log('\n--- Actual Behavior ---\n');
  
  try {
    // Invoke the webhook handler
    const result = await webhookHandler.invoke({
      messages: [new HumanMessage(JSON.stringify(webhookPayload))]
    });
    
    console.log('\n📤 Agent Response:');
    console.log('Total messages returned:', result.messages.length);
    
    // Get the last message (agent's response)
    const lastMessage = result.messages[result.messages.length - 1];
    console.log('\nAgent\'s message:');
    console.log(lastMessage.content);
    
    // Check if agent remembered context
    console.log('\n--- Analysis ---');
    const response = lastMessage.content.toLowerCase();
    
    const checks = {
      'Remembered name (Jaime)': response.includes('jaime'),
      'Remembered business (restaurant)': response.includes('restaurante'),
      'Acknowledged budget ($500)': response.includes('500') || response.includes('presupuesto'),
      'Asked for email': response.includes('email') || response.includes('correo'),
      'Did NOT re-ask name': !response.includes('nombre?') && !response.includes('cómo te llamas'),
      'Did NOT re-ask business': !response.includes('qué tipo de negocio') && !response.includes('cuál es tu negocio'),
      'Did NOT re-ask problem': !response.includes('qué problema') && !response.includes('qué desafío')
    };
    
    console.log('\nContext awareness checks:');
    Object.entries(checks).forEach(([check, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${check}`);
    });
    
    const passedChecks = Object.values(checks).filter(v => v).length;
    console.log(`\n📊 Score: ${passedChecks}/${Object.keys(checks).length} checks passed`);
    
    if (passedChecks >= 5) {
      console.log('✅ SUCCESS: Agent is context-aware and using conversation history properly!');
    } else {
      console.log('❌ FAIL: Agent is not properly using conversation history');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testFullFlow();