#!/usr/bin/env node
import 'dotenv/config';
import { salesAgent } from './agents/salesAgent.js';
import { HumanMessage } from '@langchain/core/messages';
import { GHLService } from './services/ghlService.js';

console.log('\n🧪 Testing Full Sales Conversation Flow\n');

// Mock GHL service for testing
const mockGHLService = {
  sendSMS: async (contactId, message) => {
    console.log(`📱 WhatsApp → Customer: ${message}\n`);
    return { success: true, messageId: `msg-${Date.now()}` };
  },
  
  addTags: async (contactId, tags) => {
    console.log(`🏷️  Tags added: ${tags.join(', ')}`);
    return { success: true };
  },
  
  addNote: async (contactId, note) => {
    console.log(`📝 Note added: ${note}`);
    return { success: true };
  },
  
  updateContact: async (contactId, data) => {
    console.log(`👤 Contact updated:`, data);
    return { success: true };
  },
  
  getAvailableSlots: async () => {
    // Return mock calendar slots
    return [
      { startTime: '2025-07-29T09:00:00-05:00', endTime: '2025-07-29T09:30:00-05:00', id: 'slot-1' },
      { startTime: '2025-07-29T14:00:00-05:00', endTime: '2025-07-29T14:30:00-05:00', id: 'slot-2' },
      { startTime: '2025-07-30T10:00:00-05:00', endTime: '2025-07-30T10:30:00-05:00', id: 'slot-3' },
      { startTime: '2025-07-30T16:00:00-05:00', endTime: '2025-07-30T16:30:00-05:00', id: 'slot-4' },
      { startTime: '2025-07-31T11:00:00-05:00', endTime: '2025-07-31T11:30:00-05:00', id: 'slot-5' }
    ];
  },
  
  bookAppointment: async (calendarId, contactId, details) => {
    console.log(`📅 Appointment booked:`, details);
    return { success: true, appointmentId: `apt-${Date.now()}` };
  }
};

// Test conversation flow
async function testConversation() {
  const contactId = 'test-contact-123';
  const conversationSteps = [
    { role: 'human', content: 'Hola, vi su anuncio en Facebook' },
    { role: 'human', content: 'Soy Maria Rodriguez' },
    { role: 'human', content: 'Tengo un restaurante pero no tengo suficientes clientes' },
    { role: 'human', content: 'Quiero llenar mi restaurante todos los días' },
    { role: 'human', content: 'Puedo invertir $500 al mes' },
    { role: 'human', content: 'maria@mirestaurante.com' },
    { role: 'human', content: 'El martes a las 2pm' }
  ];
  
  let messages = [];
  let state = {
    leadInfo: {},
    appointmentBooked: false,
    extractionCount: 0,
    processedMessages: []
  };
  
  console.log('Starting conversation...\n');
  
  for (const step of conversationSteps) {
    console.log(`👤 Customer: ${step.content}`);
    
    messages.push(new HumanMessage(step.content));
    
    try {
      const result = await salesAgent({
        messages: messages,
        leadInfo: state.leadInfo,
        appointmentBooked: state.appointmentBooked,
        extractionCount: state.extractionCount,
        processedMessages: state.processedMessages,
        contactId: contactId
      }, {
        configurable: {
          ghlService: mockGHLService,
          calendarId: 'test-calendar-123',
          contactId: contactId
        },
        recursionLimit: 25
      });
      
      // Update state from result
      if (result.leadInfo) state.leadInfo = result.leadInfo;
      if (result.appointmentBooked !== undefined) state.appointmentBooked = result.appointmentBooked;
      if (result.extractionCount !== undefined) state.extractionCount = result.extractionCount;
      if (result.processedMessages) state.processedMessages = result.processedMessages;
      
      // Update messages
      messages = result.messages;
      
      // Check if appointment was booked
      if (state.appointmentBooked) {
        console.log('\n✅ Appointment successfully booked!');
        break;
      }
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      break;
    }
  }
  
  console.log('\n📊 Final State:');
  console.log('Lead Info:', state.leadInfo);
  console.log('Appointment Booked:', state.appointmentBooked);
  console.log('Extraction Count:', state.extractionCount);
  console.log('Messages Processed:', state.processedMessages.length);
  
  console.log('\n✨ Conversation test completed!');
}

testConversation().catch(console.error);