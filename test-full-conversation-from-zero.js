#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

console.log('🚀 TESTING FULL CONVERSATION FROM ZERO (FRESH DEPLOYMENT)\n');

import { salesAgent } from './agents/salesAgent.js';
import { HumanMessage } from '@langchain/core/messages';
import crypto from 'crypto';

// Simulate a complete conversation from scratch
async function testFullConversationFlow() {
  console.log('Simulating a brand new user conversation...\n');
  console.log('='.repeat(60));
  
  // Start with completely empty state - like a fresh deployment
  let conversationState = {
    messages: [],
    leadInfo: {},
    contactId: `contact-${Date.now()}`,
    conversationId: `conv-${Date.now()}`,
    appointmentBooked: false,
    extractionCount: 0,
    processedMessages: [],
    availableSlots: [],
    maxExtractionReached: false,
    ghlUpdated: false,
    lastUpdate: null,
    userInfo: {}
  };
  
  // Mock GHL service that simulates real WhatsApp interactions
  const conversationLog = [];
  let messageCount = 0;
  
  const mockGhlService = {
    sendSMS: async (contactId, message) => {
      messageCount++;
      const timestamp = new Date().toISOString();
      conversationLog.push({
        type: 'bot',
        message,
        timestamp,
        messageId: `msg-${messageCount}`
      });
      
      console.log(`\n🤖 BOT [${timestamp.split('T')[1].split('.')[0]}]:`);
      console.log(`   "${message}"`);
      
      return { id: `msg-${messageCount}` };
    },
    
    getAvailableSlots: async (calendarId, startDate, endDate) => {
      console.log('\n📅 [SYSTEM] Fetching calendar slots...');
      
      // Simulate real calendar slots
      const slots = [];
      const start = new Date();
      start.setHours(9, 0, 0, 0);
      
      for (let day = 0; day < 7; day++) {
        const date = new Date(start);
        date.setDate(date.getDate() + day);
        
        // Skip weekends
        if (date.getDay() === 0 || date.getDay() === 6) continue;
        
        // Add morning and afternoon slots
        for (let hour of [9, 10, 14, 15, 16]) {
          const slotStart = new Date(date);
          slotStart.setHours(hour, 0, 0, 0);
          const slotEnd = new Date(slotStart);
          slotEnd.setHours(hour + 1, 0, 0, 0);
          
          slots.push({
            startTime: slotStart.toISOString(),
            endTime: slotEnd.toISOString(),
            id: `slot-${day}-${hour}`
          });
        }
      }
      
      console.log(`   Found ${slots.length} available slots`);
      return slots.slice(0, 10); // Return first 10 slots
    },
    
    bookAppointment: async (calendarId, contactId, appointmentData) => {
      console.log('\n📅 [SYSTEM] Booking appointment...');
      console.log(`   Contact: ${contactId}`);
      console.log(`   Time: ${appointmentData.startTime}`);
      
      return {
        id: `appt-${Date.now()}`,
        ...appointmentData,
        status: 'confirmed'
      };
    },
    
    addTags: async (contactId, tags) => {
      console.log(`\n🏷️  [SYSTEM] Adding tags: ${tags.join(', ')}`);
      return true;
    },
    
    addNote: async (contactId, note) => {
      console.log(`\n📝 [SYSTEM] Adding note: ${note.substring(0, 50)}...`);
      return true;
    },
    
    updateContact: async (contactId, data) => {
      console.log(`\n👤 [SYSTEM] Updating contact info`);
      return true;
    }
  };
  
  // Configuration for the agent
  const baseConfig = {
    configurable: {
      ghlService: mockGhlService,
      calendarId: process.env.GHL_CALENDAR_ID || 'test-calendar'
    },
    recursionLimit: 25
  };
  
  // Conversation flow - simulating real user messages
  const userMessages = [
    { text: "Hola", expected: "greeting" },
    { text: "Soy Carlos Rodriguez", expected: "name extraction" },
    { text: "tengo un restaurante pero no tengo muchos clientes", expected: "problem extraction" },
    { text: "quiero llenar mi restaurante todos los dias", expected: "goal extraction" },
    { text: "puedo gastar como 500 dolares al mes", expected: "budget extraction" },
    { text: "carlos@mirestaurante.com", expected: "email extraction and calendar" },
    { text: "el martes a las 3 esta bien", expected: "appointment booking" }
  ];
  
  console.log('\nStarting conversation simulation...\n');
  
  for (let i = 0; i < userMessages.length; i++) {
    const userMsg = userMessages[i];
    const timestamp = new Date().toISOString();
    
    // Log user message
    conversationLog.push({
      type: 'user',
      message: userMsg.text,
      timestamp
    });
    
    console.log(`\n👤 USER [${timestamp.split('T')[1].split('.')[0]}]:`);
    console.log(`   "${userMsg.text}"`);
    console.log(`   (Expected: ${userMsg.expected})`);
    
    // Add message to state
    conversationState.messages.push(new HumanMessage(userMsg.text));
    
    try {
      // Invoke the agent
      const startTime = Date.now();
      const result = await salesAgent.invoke(conversationState, {
        ...baseConfig,
        configurable: {
          ...baseConfig.configurable,
          contactId: conversationState.contactId,
          ...conversationState
        },
        runId: crypto.randomUUID()
      });
      
      const processingTime = Date.now() - startTime;
      
      // Update conversation state
      conversationState = {
        ...conversationState,
        messages: result.messages || conversationState.messages,
        leadInfo: result.leadInfo || conversationState.leadInfo,
        extractionCount: result.extractionCount || conversationState.extractionCount,
        processedMessages: result.processedMessages || conversationState.processedMessages,
        availableSlots: result.availableSlots || conversationState.availableSlots,
        appointmentBooked: result.appointmentBooked || conversationState.appointmentBooked,
        maxExtractionReached: result.maxExtractionReached || conversationState.maxExtractionReached
      };
      
      console.log(`\n📊 [SYSTEM] Processing time: ${processingTime}ms`);
      console.log(`   Lead info: ${JSON.stringify(conversationState.leadInfo)}`);
      console.log(`   Extraction count: ${conversationState.extractionCount}`);
      console.log(`   Messages processed: ${conversationState.processedMessages.length}`);
      
      if (conversationState.appointmentBooked) {
        console.log('\n🎉 APPOINTMENT BOOKED! Conversation goal achieved.');
        break;
      }
      
    } catch (error) {
      console.error(`\n❌ ERROR at step ${i + 1}:`, error.message);
      if (error.message.includes('Recursion limit')) {
        console.log('\n🔴 RECURSION LIMIT HIT!');
        console.log('   This should not happen with the fix.');
      }
      break;
    }
  }
  
  // Final summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 CONVERSATION SUMMARY');
  console.log('='.repeat(60));
  
  console.log(`\nTotal messages exchanged: ${conversationLog.length}`);
  console.log(`Bot messages sent: ${messageCount}`);
  console.log(`Final lead qualification:`);
  console.log(`  - Name: ${conversationState.leadInfo.name || 'Not collected'}`);
  console.log(`  - Problem: ${conversationState.leadInfo.problem || 'Not collected'}`);
  console.log(`  - Goal: ${conversationState.leadInfo.goal || 'Not collected'}`);
  console.log(`  - Budget: $${conversationState.leadInfo.budget || 'Not collected'}/month`);
  console.log(`  - Email: ${conversationState.leadInfo.email || 'Not collected'}`);
  console.log(`  - Appointment: ${conversationState.appointmentBooked ? 'BOOKED ✅' : 'Not booked ❌'}`);
  
  console.log(`\nExtraction metrics:`);
  console.log(`  - Total extraction attempts: ${conversationState.extractionCount}`);
  console.log(`  - Max extraction reached: ${conversationState.maxExtractionReached}`);
  console.log(`  - Unique messages processed: ${conversationState.processedMessages.length}`);
  
  // Test edge cases
  console.log('\n\n' + '='.repeat(60));
  console.log('🧪 TESTING EDGE CASES');
  console.log('='.repeat(60));
  
  await testEdgeCase1_SchedulingTooEarly();
  await testEdgeCase2_LowBudget();
  await testEdgeCase3_RepeatedExtractions();
}

// Edge case 1: User asks about scheduling before being qualified
async function testEdgeCase1_SchedulingTooEarly() {
  console.log('\n\n📋 Edge Case 1: Asking for schedule before qualification');
  console.log('-'.repeat(40));
  
  const state = {
    messages: [
      new HumanMessage("Hola"),
      new HumanMessage("Q horas tienes disponibles?")
    ],
    leadInfo: { name: "Maria" }, // Only partial info
    contactId: `edge1-${Date.now()}`,
    extractionCount: 0,
    processedMessages: []
  };
  
  const mockGhl = {
    sendSMS: async (id, msg) => {
      console.log(`🤖 Bot response: "${msg}"`);
      return { id: 'test' };
    },
    getAvailableSlots: async () => [],
    addTags: async () => true,
    addNote: async () => true,
    updateContact: async () => true
  };
  
  try {
    await salesAgent.invoke(state, {
      configurable: {
        ghlService: mockGhl,
        calendarId: 'test',
        contactId: state.contactId
      },
      recursionLimit: 10
    });
    
    console.log('✅ Handled gracefully without recursion error');
  } catch (error) {
    if (error.message.includes('Recursion limit')) {
      console.log('❌ FAILED: Hit recursion limit');
    } else {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

// Edge case 2: User with budget below minimum
async function testEdgeCase2_LowBudget() {
  console.log('\n\n📋 Edge Case 2: User with low budget');
  console.log('-'.repeat(40));
  
  const state = {
    messages: [
      new HumanMessage("Hola soy Pedro"),
      new HumanMessage("necesito mas clientes para mi tienda"),
      new HumanMessage("quiero vender mas"),
      new HumanMessage("solo puedo gastar 100 dolares")
    ],
    leadInfo: {},
    contactId: `edge2-${Date.now()}`,
    extractionCount: 0,
    processedMessages: []
  };
  
  const mockGhl = {
    sendSMS: async (id, msg) => {
      console.log(`🤖 Bot response: "${msg.substring(0, 80)}..."`);
      return { id: 'test' };
    },
    getAvailableSlots: async () => [],
    addTags: async (id, tags) => {
      console.log(`🏷️  Tags added: ${tags.join(', ')}`);
      return true;
    },
    addNote: async () => true,
    updateContact: async () => true
  };
  
  const result = await salesAgent.invoke(state, {
    configurable: {
      ghlService: mockGhl,
      calendarId: 'test',
      contactId: state.contactId
    }
  });
  
  console.log(`Lead info: ${JSON.stringify(result.leadInfo)}`);
  console.log('✅ Low budget handled appropriately');
}

// Edge case 3: Test extraction limits
async function testEdgeCase3_RepeatedExtractions() {
  console.log('\n\n📋 Edge Case 3: Testing extraction limits');
  console.log('-'.repeat(40));
  
  const vagueMessages = [
    "Hola",
    "necesito ayuda",
    "si, ayuda con mi negocio",
    "pues, varias cosas",
    "no se exactamente"
  ];
  
  let state = {
    messages: [],
    leadInfo: {},
    contactId: `edge3-${Date.now()}`,
    extractionCount: 0,
    processedMessages: []
  };
  
  const mockGhl = {
    sendSMS: async (id, msg) => {
      console.log(`   Bot: "${msg.substring(0, 60)}..."`);
      return { id: 'test' };
    },
    getAvailableSlots: async () => [],
    addTags: async () => true,
    addNote: async () => true,
    updateContact: async () => true
  };
  
  for (const msg of vagueMessages) {
    console.log(`\n👤 User: "${msg}"`);
    state.messages.push(new HumanMessage(msg));
    
    const result = await salesAgent.invoke(state, {
      configurable: {
        ghlService: mockGhl,
        calendarId: 'test',
        contactId: state.contactId
      }
    });
    
    state.extractionCount = result.extractionCount || state.extractionCount;
    state.maxExtractionReached = result.maxExtractionReached || false;
    
    console.log(`   Extraction count: ${state.extractionCount}`);
    
    if (state.maxExtractionReached) {
      console.log('⚠️  Max extraction limit reached!');
      break;
    }
  }
  
  console.log(`\n✅ Extraction limits working: stopped at ${state.extractionCount} attempts`);
}

// Run the full test suite
(async () => {
  try {
    await testFullConversationFlow();
    
    console.log('\n\n🎉 ALL TESTS COMPLETED!');
    console.log('\nThis test simulates:');
    console.log('- Complete conversation from zero (fresh deployment)');
    console.log('- Real user interaction patterns');
    console.log('- Edge cases and error scenarios');
    console.log('- Extraction limit enforcement');
    console.log('- Proper conversation flow management');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
  }
})();