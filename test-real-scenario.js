import { config } from 'dotenv';
import { graph as webhookHandler } from './agents/webhookHandler.js';
import { GHLService } from './services/ghlService.js';
import { HumanMessage } from '@langchain/core/messages';

config();

async function testRealScenario() {
  console.log('🏆 Testing real-world scenario with actual contact...\n');
  
  // Real contact and conversation IDs from your GHL
  const realContactId = 'Kdj9FkxZc3yq7d5tyT97';
  const realConversationId = 'LZpnjAcARwjbk3F4DTT8';
  const phone = '+13054870475'; // Real phone from the conversation
  
  // Test 1: Initial greeting
  console.log('📱 Test 1: Customer says hello');
  let payload = {
    phone,
    message: 'hola',
    contactId: realContactId,
    conversationId: realConversationId
  };
  
  try {
    let result = await webhookHandler.invoke({
      messages: [new HumanMessage(JSON.stringify(payload))]
    });
    
    console.log('✅ Response:', result.messages[result.messages.length - 1].content.substring(0, 100) + '...\n');
  } catch (error) {
    console.log('❌ Error:', error.message, '\n');
  }
  
  // Test 2: Customer provides name
  console.log('📱 Test 2: Customer provides name');
  payload.message = 'jaime';
  
  try {
    let result = await webhookHandler.invoke({
      messages: [new HumanMessage(JSON.stringify(payload))]
    });
    
    console.log('✅ Response:', result.messages[result.messages.length - 1].content.substring(0, 100) + '...\n');
  } catch (error) {
    console.log('❌ Error:', error.message, '\n');
  }
  
  // Test 3: Customer describes problem
  console.log('📱 Test 3: Customer describes their problem');
  payload.message = 'tengo un restaurante y estoy perdiendo muchos clientes porque no puedo contestar a todos';
  
  try {
    let result = await webhookHandler.invoke({
      messages: [new HumanMessage(JSON.stringify(payload))]
    });
    
    console.log('✅ Response:', result.messages[result.messages.length - 1].content.substring(0, 100) + '...\n');
  } catch (error) {
    console.log('❌ Error:', error.message, '\n');
  }
  
  // Test 4: Customer provides budget (this is where it should recognize context)
  console.log('📱 Test 4: Customer provides budget - CRITICAL TEST');
  payload.message = '500 al mes';
  
  try {
    let result = await webhookHandler.invoke({
      messages: [new HumanMessage(JSON.stringify(payload))]
    });
    
    const response = result.messages[result.messages.length - 1].content;
    console.log('✅ Full Response:', response);
    
    // Analyze response
    console.log('\n📊 Analysis:');
    const analysis = {
      'Remembered Jaime': response.includes('Jaime'),
      'Remembered restaurant': response.toLowerCase().includes('restaurante'),
      'Acknowledged $500 budget': response.includes('500'),
      'Asked for email (budget >$300)': response.toLowerCase().includes('email') || response.toLowerCase().includes('correo'),
      'Did NOT ask for name again': !response.includes('nombre?'),
      'Did NOT ask about business again': !response.includes('tipo de negocio')
    };
    
    Object.entries(analysis).forEach(([check, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${check}`);
    });
    
    const score = Object.values(analysis).filter(v => v).length;
    console.log(`\n🏆 Final Score: ${score}/6`);
    
    if (score >= 4) {
      console.log('✅ SUCCESS: The bot is working correctly!');
    } else {
      console.log('❌ FAIL: The bot needs fixing');
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testRealScenario();