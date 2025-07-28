import { graph as webhookHandler } from './agents/webhookHandler.js';
import { HumanMessage } from '@langchain/core/messages';
import dotenv from 'dotenv';

dotenv.config();

// Real contact from GHL
const CONTACT_ID = 'Jf5Hc0JRXrnqCjQGHTEU';
const PHONE = '+13054870475';

async function simulateMessage(message, state = {}) {
  console.log(`\n📱 Customer: "${message}"`);
  
  const webhookState = {
    messages: [new HumanMessage(message)],
    contactId: CONTACT_ID,
    phone: PHONE,
    ...state
  };
  
  try {
    const result = await webhookHandler.invoke(webhookState, {
      configurable: {
        thread_id: CONTACT_ID,
        contactId: CONTACT_ID,
        phone: PHONE,
        locationId: process.env.GHL_LOCATION_ID
      }
    });
    
    const lastMessage = result.messages[result.messages.length - 1];
    const response = lastMessage.content;
    
    console.log(`🤖 María: "${response.substring(0, 200)}${response.length > 200 ? '...' : ''}"`);
    
    // Check if calendar was shown
    if (response.includes('disponibles') || response.includes('horarios')) {
      console.log('\n✅ CALENDAR SHOWN! Counting slots...');
      const slotMatches = response.match(/\d+\./g);
      if (slotMatches) {
        console.log(`Found ${slotMatches.length} time slots`);
      }
    }
    
    return {
      leadInfo: result.leadInfo || {},
      response
    };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { error: error.message };
  }
}

async function testCompleteFlow() {
  console.log('🎯 TESTING COMPLETE QUALIFICATION FLOW');
  console.log('Contact:', CONTACT_ID);
  console.log('Phone:', PHONE);
  console.log('=' .repeat(50));
  
  let currentLeadInfo = {};
  
  // Step 1: Greeting
  console.log('\n📍 Step 1: Greeting');
  await simulateMessage('hola');
  
  // Step 2: Name
  console.log('\n📍 Step 2: Name');
  const step2 = await simulateMessage('Carlos');
  currentLeadInfo = { ...currentLeadInfo, ...step2.leadInfo };
  
  // Step 3: Problem
  console.log('\n📍 Step 3: Problem');
  const step3 = await simulateMessage('tengo un restaurante pero casi no me llegan clientes');
  currentLeadInfo = { ...currentLeadInfo, ...step3.leadInfo };
  
  // Step 4: Goal  
  console.log('\n📍 Step 4: Goal');
  const step4 = await simulateMessage('quiero llenar mi restaurante todos los días');
  currentLeadInfo = { ...currentLeadInfo, ...step4.leadInfo };
  
  // Step 5: Budget
  console.log('\n📍 Step 5: Budget');
  const step5 = await simulateMessage('500 al mes');
  currentLeadInfo = { ...currentLeadInfo, ...step5.leadInfo };
  
  // Step 6: Email - This should trigger calendar
  console.log('\n📍 Step 6: Email (should show calendar)');
  const step6 = await simulateMessage('carlos@mirestaurante.com');
  currentLeadInfo = { ...currentLeadInfo, ...step6.leadInfo };
  
  console.log('\n' + '=' .repeat(50));
  console.log('📊 FINAL SUMMARY');
  console.log('Lead Info Collected:', currentLeadInfo);
  console.log('\n✅ Test completed!');
}

// Run test
testCompleteFlow().catch(console.error);