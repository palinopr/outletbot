import { graph as webhookHandler } from './agents/webhookHandler.js';
import { HumanMessage } from '@langchain/core/messages';
import dotenv from 'dotenv';
import { Logger } from './services/logger.js';

dotenv.config();

const logger = new Logger('test-full-scenario');

// Real contact from GHL
const CONTACT_ID = 'Jf5Hc0JRXrnqCjQGHTEU';
const PHONE = '+13054870475'; // Jaime Ortiz's phone

async function simulateMessage(message, contactId = CONTACT_ID, phone = PHONE) {
  console.log(`\n📱 Customer: "${message}"`);
  
  const state = {
    messages: [new HumanMessage(message)],
    contactId,
    phone
  };
  
  try {
    const result = await webhookHandler.invoke(state, {
      configurable: {
        thread_id: contactId,
        contactId,
        phone,
        locationId: process.env.GHL_LOCATION_ID
      }
    });
    
    const lastMessage = result.messages[result.messages.length - 1];
    console.log(`🤖 María: "${lastMessage.content}"`);
    
    // Return the result for next step
    return {
      success: true,
      leadInfo: result.leadInfo || {},
      response: lastMessage.content
    };
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

async function runFullScenario() {
  console.log('🎯 STARTING FULL QUALIFICATION SCENARIO');
  console.log('Contact ID:', CONTACT_ID);
  console.log('Location ID:', process.env.GHL_LOCATION_ID);
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Scenario: Complete qualification flow
  const steps = [
    { message: 'hola', wait: 1000 },
    { message: 'Carlos', wait: 1000 },
    { message: 'tengo un restaurante pero no me llegan clientes', wait: 1500 },
    { message: 'quiero llenar mi restaurante todos los días', wait: 1500 },
    { message: '500 mensuales', wait: 1500 },
    { message: 'carlos@mirestaurante.com', wait: 2000 },
    { message: 'el martes a las 3', wait: 1000 }
  ];
  
  let currentInfo = {};
  
  for (const step of steps) {
    const result = await simulateMessage(step.message);
    
    if (result.success && result.leadInfo) {
      // Track what info we've collected
      const newFields = [];
      for (const [key, value] of Object.entries(result.leadInfo)) {
        if (value && value !== currentInfo[key]) {
          newFields.push(`${key}: ${value}`);
          currentInfo[key] = value;
        }
      }
      
      if (newFields.length > 0) {
        console.log(`✅ Collected: ${newFields.join(', ')}`);
      }
    }
    
    // Wait before next message (simulate typing)
    await new Promise(resolve => setTimeout(resolve, step.wait));
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 FINAL COLLECTED INFORMATION:');
  console.log(JSON.stringify(currentInfo, null, 2));
  console.log('\n✅ Scenario completed!');
}

// Run the test
runFullScenario().catch(console.error);