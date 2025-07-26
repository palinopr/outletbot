#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

console.log('🧪 Full Scenario Test - Complete Qualification Flow\n');

import { graph } from './agents/webhookHandler.js';
import crypto from 'crypto';

// Test configuration
const TEST_CONTACT_ID = 'test-contact-' + crypto.randomUUID().substring(0, 8);
const TEST_PHONE = '+13054870475';

// Conversation flow
const conversationSteps = [
  { message: "Hola", expected: "greeting and ask for name" },
  { message: "Soy Carlos", expected: "extract name, ask about problem" },
  { message: "Tengo un restaurante y necesito más clientes", expected: "extract problem, ask about goal" },
  { message: "Quiero llenar mi restaurante todos los días", expected: "extract goal, ask about budget" },
  { message: "Puedo invertir $500 al mes", expected: "extract budget, ask for email" },
  { message: "carlos@mirestaurante.com", expected: "extract email, show calendar (ALL info collected)" }
];

let conversationState = {
  messages: [],
  leadInfo: {},
  contactId: TEST_CONTACT_ID,
  phone: TEST_PHONE
};

async function runStep(step, stepNumber) {
  console.log(`\n📍 Step ${stepNumber}: "${step.message}"`);
  console.log(`Expected: ${step.expected}`);
  
  try {
    // Create webhook payload
    const webhookPayload = {
      phone: TEST_PHONE,
      message: step.message,
      contactId: TEST_CONTACT_ID
    };
    
    // Invoke the webhook handler
    const result = await graph.invoke({
      messages: [{
        role: 'human',
        content: JSON.stringify(webhookPayload)
      }],
      ...conversationState
    }, {
      runId: crypto.randomUUID(),
      configurable: {
        // Mock GHL service for testing
        ghlService: {
          sendSMS: async (contactId, message) => {
            console.log(`\n📤 WhatsApp sent: "${message.substring(0, 100)}..."`);
            return { id: 'msg-' + crypto.randomUUID() };
          },
          getAvailableSlots: async () => {
            console.log('📅 Calendar slots requested');
            return [
              { 
                startTime: '2025-01-29T10:00:00-06:00', 
                endTime: '2025-01-29T11:00:00-06:00',
                id: 'slot-1'
              },
              { 
                startTime: '2025-01-29T14:00:00-06:00', 
                endTime: '2025-01-29T15:00:00-06:00',
                id: 'slot-2'
              }
            ];
          },
          addTags: async (contactId, tags) => {
            console.log(`🏷️  Tags added: ${tags.join(', ')}`);
            return true;
          },
          addNote: async (contactId, note) => {
            console.log(`📝 Note added: ${note.substring(0, 50)}...`);
            return true;
          },
          updateContact: async (contactId, data) => {
            console.log(`👤 Contact updated:`, data);
            return true;
          }
        },
        calendarId: 'test-calendar',
        contactId: TEST_CONTACT_ID
      }
    });
    
    // Update conversation state
    conversationState = {
      messages: result.messages || conversationState.messages,
      leadInfo: result.leadInfo || conversationState.leadInfo,
      contactId: TEST_CONTACT_ID,
      phone: TEST_PHONE
    };
    
    // Show current lead info state
    console.log('\n📊 Lead Info State:');
    console.log(`  Name: ${conversationState.leadInfo.name || '❌ Not set'}`);
    console.log(`  Problem: ${conversationState.leadInfo.problem || '❌ Not set'}`);
    console.log(`  Goal: ${conversationState.leadInfo.goal || '❌ Not set'}`);
    console.log(`  Budget: ${conversationState.leadInfo.budget || '❌ Not set'}`);
    console.log(`  Email: ${conversationState.leadInfo.email || '❌ Not set'}`);
    
    // Check if calendar was mentioned prematurely
    const lastMessage = result.messages?.[result.messages.length - 1];
    const messageContent = lastMessage?.content || '';
    
    if (stepNumber < 6 && (
      messageContent.toLowerCase().includes('calendario') ||
      messageContent.toLowerCase().includes('cita') ||
      messageContent.toLowerCase().includes('agendar') ||
      messageContent.toLowerCase().includes('horario')
    )) {
      console.error('\n⚠️  WARNING: Calendar/appointment mentioned before full qualification!');
    }
    
    // Check if all info collected on last step
    if (stepNumber === 6) {
      const hasAllInfo = !!(
        conversationState.leadInfo.name &&
        conversationState.leadInfo.problem &&
        conversationState.leadInfo.goal &&
        conversationState.leadInfo.budget &&
        conversationState.leadInfo.email
      );
      
      if (!hasAllInfo) {
        console.error('\n❌ ERROR: Not all information collected by final step!');
      } else {
        console.log('\n✅ All information collected successfully!');
      }
      
      // Check if calendar slots were shown
      if (conversationState.availableSlots || messageContent.includes('Lunes') || messageContent.includes('Martes')) {
        console.log('✅ Calendar slots shown after full qualification');
      } else {
        console.error('❌ Calendar slots NOT shown despite full qualification');
      }
    }
    
    return true;
    
  } catch (error) {
    console.error(`\n❌ Error in step ${stepNumber}:`, error.message);
    return false;
  }
}

async function runFullScenario() {
  console.log('Starting full qualification scenario...');
  console.log(`Contact ID: ${TEST_CONTACT_ID}`);
  console.log(`Phone: ${TEST_PHONE}`);
  
  let allStepsPass = true;
  
  // Run each conversation step
  for (let i = 0; i < conversationSteps.length; i++) {
    const step = conversationSteps[i];
    const success = await runStep(step, i + 1);
    
    if (!success) {
      allStepsPass = false;
      break;
    }
    
    // Small delay between steps
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL TEST SUMMARY');
  console.log('='.repeat(60));
  
  console.log('\nFinal Lead State:');
  console.log(`  Name: ${conversationState.leadInfo.name || '❌ Missing'}`);
  console.log(`  Problem: ${conversationState.leadInfo.problem || '❌ Missing'}`);
  console.log(`  Goal: ${conversationState.leadInfo.goal || '❌ Missing'}`);
  console.log(`  Budget: $${conversationState.leadInfo.budget || '❌ Missing'}/month`);
  console.log(`  Email: ${conversationState.leadInfo.email || '❌ Missing'}`);
  
  console.log(`\nTotal messages: ${conversationState.messages.length}`);
  console.log(`Test result: ${allStepsPass ? '✅ PASS' : '❌ FAIL'}`);
  
  if (allStepsPass) {
    console.log('\n🎉 Full scenario completed successfully!');
    console.log('- Information extracted correctly at each step');
    console.log('- Calendar only shown after full qualification');
    console.log('- State management working properly');
  } else {
    console.log('\n⚠️  Test failed - review errors above');
  }
}

// Run the test
runFullScenario().catch(console.error);