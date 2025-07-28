import { salesAgentInvoke } from './agents/salesAgent.js';
import { HumanMessage } from '@langchain/core/messages';
import { GHLService } from './services/ghlService.js';
import dotenv from 'dotenv';

dotenv.config();

// Mock GHL Service with calendar slots
class MockGHLService extends GHLService {
  async getAvailableSlots(calendarId, startDate, days) {
    console.log('🎭 Using mock calendar slots for testing');
    
    // Generate mock slots for next 3 days
    const slots = {};
    const now = new Date();
    
    for (let i = 1; i <= 3; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      slots[dateStr] = {
        date: dateStr,
        slots: [
          `${dateStr}T09:00:00-04:00`,
          `${dateStr}T10:00:00-04:00`,
          `${dateStr}T14:00:00-04:00`,
          `${dateStr}T15:00:00-04:00`,
          `${dateStr}T16:00:00-04:00`
        ]
      };
    }
    
    return slots;
  }
  
  async sendSMS(contactId, message) {
    console.log(`\n🤖 María: "${message.substring(0, 100)}..."`);
    return { success: true, messageId: 'mock-' + Date.now() };
  }
}

async function testFullScenarioWithMock() {
  console.log('🎯 TESTING FULL SCENARIO WITH MOCK CALENDAR\n');
  
  const mockGHL = new MockGHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );
  
  // Scenario steps
  const steps = [
    { message: 'hola', expectedInfo: {} },
    { message: 'Carlos', expectedInfo: { name: 'Carlos' } },
    { message: 'tengo un restaurante pero no me llegan clientes', expectedInfo: { problem: 'no me llegan clientes' } },
    { message: 'quiero llenar mi restaurante todos los días', expectedInfo: { goal: 'llenar mi restaurante todos los días' } },
    { message: '500 al mes', expectedInfo: { budget: 500 } },
    { message: 'carlos@mirestaurante.com', expectedInfo: { email: 'carlos@mirestaurante.com' } }
  ];
  
  let currentState = {
    messages: [],
    leadInfo: {},
    contactId: 'test-contact-123',
    conversationId: 'test-conv-123'
  };
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(`\n📱 Step ${i + 1}: Customer says "${step.message}"`);
    
    // Add message to state
    currentState.messages = [new HumanMessage(step.message)];
    
    try {
      const result = await salesAgentInvoke(currentState, {
        configurable: {
          ghlService: mockGHL,
          calendarId: process.env.GHL_CALENDAR_ID,
          contactId: 'test-contact-123'
        }
      });
      
      // Update state with results
      currentState.leadInfo = result.leadInfo || currentState.leadInfo;
      
      // Check what info we collected
      console.log('✅ Lead info collected:', currentState.leadInfo);
      
      // Check if calendar was shown
      const lastMessage = result.messages[result.messages.length - 1];
      if (lastMessage.content?.includes('disponibles') || 
          lastMessage.content?.includes('horarios')) {
        console.log('\n🎉 SUCCESS! Calendar slots shown!');
        break;
      }
      
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
    
    // Small delay between steps
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n📊 Final Summary:');
  console.log('Lead Info:', currentState.leadInfo);
}

testFullScenarioWithMock().catch(console.error);