import { salesAgent } from './agents/salesAgent.js';
import { HumanMessage } from '@langchain/core/messages';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Save original console.log
const originalLog = console.log;
// Disable agent logging for cleaner output
console.log = () => {};
console.error = () => {};

// Mock GHL service for local testing
const mockGhlService = {
  sendSMS: async (contactId, message) => {
    originalLog(`\n📱 MARÍA (AI): "${message}"`);
    return { success: true };
  },
  
  getAvailableSlots: async () => {
    return [
      { startTime: '2025-07-26T10:00:00-05:00', endTime: '2025-07-26T10:30:00-05:00' },
      { startTime: '2025-07-26T14:00:00-05:00', endTime: '2025-07-26T14:30:00-05:00' },
      { startTime: '2025-07-27T09:00:00-05:00', endTime: '2025-07-27T09:30:00-05:00' },
      { startTime: '2025-07-27T15:00:00-05:00', endTime: '2025-07-27T15:30:00-05:00' },
      { startTime: '2025-07-28T11:00:00-05:00', endTime: '2025-07-28T11:30:00-05:00' }
    ];
  },
  
  bookAppointment: async (calendarId, contactId, details) => {
    originalLog(`\n📅 APPOINTMENT BOOKED: ${details.startTime}`);
    return { id: 'apt-12345', success: true };
  },
  
  addTags: async (contactId, tags) => {
    originalLog(`\n🏷️  TAGS ADDED: ${tags.join(', ')}`);
    return { success: true };
  },
  
  addNote: async (contactId, note) => {
    originalLog(`\n📝 NOTE ADDED`);
    return { success: true };
  },
  
  updateContact: async (contactId, data) => {
    originalLog(`\n👤 CONTACT UPDATED`);
    return { success: true };
  }
};

async function testConversation() {
  originalLog('🚀 Starting LangGraph Sales Agent Local Test\n');
  
  const contactId = 'test-contact-123';
  const conversationId = 'test-conv-456';
  
  // Test conversation flow
  const testMessages = [
    "Hola",
    "Me llamo Juan",
    "Necesito más clientes para mi restaurante",
    "Quiero llenar mi restaurante todos los días",
    "Puedo gastar $500 al mes",
    "Mi email es juan@restaurant.com",
    "El martes a las 2pm está perfecto"
  ];
  
  let messages = [];
  
  for (const userMessage of testMessages) {
    originalLog(`\n👤 USER: "${userMessage}"`);
    
    // Add user message
    messages.push(new HumanMessage(userMessage));
    
    // Restore console temporarily to capture errors
    const tempLog = console.log;
    const tempError = console.error;
    console.log = originalLog;
    console.error = originalLog;
    
    try {
      // Invoke agent
      const result = await salesAgent({
        messages,
        contactId,
        conversationId,
        phone: '+1234567890'
      }, {
        configurable: {
          ghlService: mockGhlService,
          calendarId: 'test-calendar-123',
          contactId
        }
      });
    } catch (error) {
      originalLog(`\n❌ ERROR: ${error.message}`);
    }
    
    // Restore silent logging
    console.log = tempLog;
    console.error = tempError;
    
    // Wait a bit to simulate real conversation
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  originalLog('\n✅ Test completed!');
}

// Run the test
testConversation().catch(console.error);