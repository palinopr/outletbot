// Test script to verify context preservation after fixes
import { salesAgent } from './agents/salesAgent.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import dotenv from 'dotenv';

dotenv.config();

console.log('🧪 Testing Context Preservation in Sales Agent\n');
console.log('='.repeat(60));

// Mock GHL service for testing
const mockGhlService = {
  sendSMS: async () => ({ success: true }),
  updateContact: async () => ({ success: true }),
  getAvailableSlots: async () => ({
    "2025-07-29": { slots: ["2025-07-29T09:00:00-04:00"] }
  }),
  bookAppointment: async () => ({ appointmentId: 'test-123' })
};

// Test conversation flow with context
async function testContextPreservation() {
  let currentState = {
    messages: [],
    leadInfo: {},
    contactId: 'test-contact',
    conversationId: 'test-conv'
  };
  
  const config = {
    configurable: {
      ghlService: mockGhlService,
      calendarId: 'test-calendar',
      contactId: 'test-contact'
    }
  };
  
  console.log('\n📋 Step 1: Customer says "Hola"');
  console.log('Current leadInfo:', currentState.leadInfo);
  
  currentState.messages.push(new HumanMessage("Hola"));
  
  let result = await salesAgent(currentState, config);
  console.log('Agent processed Step 1');
  
  // Simulate what the agent should have extracted
  currentState.leadInfo = {};
  
  console.log('\n📋 Step 2: Customer provides name');
  console.log('Current leadInfo:', currentState.leadInfo);
  
  currentState.messages.push(new HumanMessage("Soy Jaime"));
  
  result = await salesAgent(currentState, config);
  console.log('Agent processed Step 2');
  
  // Simulate extracted info
  currentState.leadInfo = { name: "Jaime" };
  
  console.log('\n📋 Step 3: Customer provides problem');
  console.log('Current leadInfo:', currentState.leadInfo);
  
  currentState.messages.push(new HumanMessage("Necesito más clientes para mi restaurante"));
  
  result = await salesAgent(currentState, config);
  console.log('Agent processed Step 3');
  
  // Check if agent recognized existing name
  if (result.messages && result.messages.length > 0) {
    const lastMessage = result.messages[result.messages.length - 1];
    if (lastMessage && lastMessage.content) {
      const messageContent = lastMessage.content.toLowerCase();
      
      if (messageContent.includes('nombre') || messageContent.includes('llamas')) {
        console.log('❌ CONTEXT LOST: Agent asked for name again!');
      } else if (messageContent.includes('jaime')) {
        console.log('✅ CONTEXT PRESERVED: Agent used the name Jaime');
      } else {
        console.log('⚠️  Agent response did not reference known name');
      }
    }
  }
  
  // Continue with more steps to test full context preservation
  currentState.leadInfo = { 
    name: "Jaime", 
    problem: "Necesito más clientes",
    businessType: "restaurante" 
  };
  
  console.log('\n📋 Step 4: Customer provides goal');
  console.log('Current leadInfo:', currentState.leadInfo);
  
  currentState.messages.push(new HumanMessage("Quiero aumentar ventas 50% en 3 meses"));
  
  result = await salesAgent(currentState, config);
  console.log('Agent processed Step 4');
  
  // Check if agent remembers problem
  if (result.messages && result.messages.length > 0) {
    const lastMessage = result.messages[result.messages.length - 1];
    if (lastMessage && lastMessage.content) {
      const messageContent = lastMessage.content.toLowerCase();
      
      if (messageContent.includes('problema') || messageContent.includes('necesitas')) {
        console.log('❌ CONTEXT LOST: Agent asked about problem again!');
      } else if (messageContent.includes('cliente') || messageContent.includes('restaurante')) {
        console.log('✅ CONTEXT PRESERVED: Agent referenced the known problem/business');
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Context Preservation Test Complete\n');
}

// Run the test
testContextPreservation().catch(console.error);