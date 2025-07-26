#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

console.log('🧪 Direct Agent Test - State Persistence Check\n');

import { salesAgentInvoke } from './agents/salesAgent.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import crypto from 'crypto';

const TEST_CONTACT_ID = 'test-' + Date.now();

// Mock GHL service
const mockGhlService = {
  sendSMS: async (contactId, message) => {
    console.log(`\n📤 WhatsApp: "${message.substring(0, 100)}..."`);
    return { id: 'msg-' + crypto.randomUUID() };
  },
  getAvailableSlots: async () => {
    console.log('📅 Calendar slots requested');
    return [
      { startTime: '2025-01-29T10:00:00-06:00', endTime: '2025-01-29T11:00:00-06:00' },
      { startTime: '2025-01-29T14:00:00-06:00', endTime: '2025-01-29T15:00:00-06:00' }
    ];
  },
  addTags: async (contactId, tags) => {
    console.log(`🏷️  Tags: ${tags.join(', ')}`);
    return true;
  },
  addNote: async (contactId, note) => {
    console.log(`📝 Note: ${note.substring(0, 50)}...`);
    return true;
  },
  updateContact: async (contactId, data) => {
    console.log(`👤 Contact updated`);
    return true;
  }
};

async function testConversation() {
  // Initialize conversation state
  let state = {
    messages: [],
    leadInfo: {},
    contactId: TEST_CONTACT_ID,
    conversationId: 'test-conv-' + Date.now()
  };
  
  const steps = [
    { user: "Hola", desc: "Greeting" },
    { user: "Soy Carlos", desc: "Name" },
    { user: "Tengo un restaurante y necesito más clientes", desc: "Problem" },
    { user: "Quiero llenar mi restaurante todos los días", desc: "Goal" },
    { user: "Puedo invertir $500 al mes", desc: "Budget" },
    { user: "Mi correo es carlos@mirestaurante.com", desc: "Email" }
  ];
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📍 Step ${i + 1}: ${step.desc}`);
    console.log(`👤 User: "${step.user}"`);
    
    // Add user message to state
    state.messages.push(new HumanMessage(step.user));
    
    try {
      // Call the agent
      const result = await salesAgentInvoke(state, {
        configurable: {
          ghlService: mockGhlService,
          calendarId: 'test-calendar',
          contactId: TEST_CONTACT_ID
        },
        runId: crypto.randomUUID()
      });
      
      // Update state with results
      state = {
        messages: result.messages || state.messages,
        leadInfo: result.leadInfo || state.leadInfo,
        contactId: TEST_CONTACT_ID,
        conversationId: state.conversationId,
        appointmentBooked: result.appointmentBooked || false
      };
      
      // Show lead info state
      console.log('\n📊 Current Lead State:');
      console.log(`  Name: ${state.leadInfo.name || '❌ Not set'}`);
      console.log(`  Problem: ${state.leadInfo.problem || '❌ Not set'}`);
      console.log(`  Goal: ${state.leadInfo.goal || '❌ Not set'}`);
      console.log(`  Budget: ${state.leadInfo.budget ? '$' + state.leadInfo.budget : '❌ Not set'}`);
      console.log(`  Email: ${state.leadInfo.email || '❌ Not set'}`);
      
      // Check if calendar mentioned
      const lastAIMessage = state.messages.filter(m => m.constructor.name === 'AIMessage').pop();
      if (lastAIMessage?.content) {
        const mentions = ['calendario', 'cita', 'agendar', 'horario'];
        const hasMention = mentions.some(word => 
          lastAIMessage.content.toLowerCase().includes(word)
        );
        
        if (hasMention && i < 5) {
          console.error('\n⚠️  Calendar mentioned before full qualification!');
        } else if (hasMention && i === 5) {
          console.log('\n✅ Calendar shown after full qualification');
        }
      }
      
    } catch (error) {
      console.error(`\n❌ Error: ${error.message}`);
      break;
    }
  }
  
  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(60));
  
  const qualified = !!(
    state.leadInfo.name &&
    state.leadInfo.problem &&
    state.leadInfo.goal &&
    state.leadInfo.budget >= 300 &&
    state.leadInfo.email
  );
  
  console.log('\nQualification Status:', qualified ? '✅ QUALIFIED' : '❌ NOT QUALIFIED');
  console.log('Final Lead Info:', state.leadInfo);
  console.log('Total Messages:', state.messages.length);
  console.log('Appointment Booked:', state.appointmentBooked);
}

testConversation().catch(console.error);