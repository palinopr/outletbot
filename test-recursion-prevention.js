#!/usr/bin/env node
/**
 * Test to verify recursion prevention when calendar is shown
 */

// Set mock environment variables to bypass check
process.env.OPENAI_API_KEY = 'mock-key';
process.env.GHL_API_KEY = 'mock-key';
process.env.GHL_LOCATION_ID = 'mock-location';
process.env.GHL_CALENDAR_ID = 'mock-calendar';

import { salesAgent } from './agents/salesAgent.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

// Mock the GHL service to avoid needing real API keys
const mockGHLService = {
  sendMessage: async () => ({ id: 'mock-message-id' }),
  getAvailableSlots: async () => [
    { startTime: '2025-01-29T15:00:00', endTime: '2025-01-29T15:30:00' },
    { startTime: '2025-01-30T16:00:00', endTime: '2025-01-30T16:30:00' }
  ],
  updateContact: async () => ({}),
  addTags: async () => ({}),
  addNote: async () => ({})
};

async function testRecursionPrevention() {
  console.log('🧪 Testing Recursion Prevention with Calendar Shown\n');
  
  // Test state with calendar shown
  const testState = {
    messages: [
      new HumanMessage('Hola, soy Roberto, tengo un restaurante, no tengo clientes, quiero llenar el lugar, mi presupuesto es $800, mi email es roberto@rest.com'),
      new AIMessage('¡Perfecto Roberto! He verificado tu información y tienes todo lo necesario para comenzar. Aquí están los horarios disponibles:\n\n1. Lunes 3pm\n2. Martes 4pm\n\n¿Cuál prefieres?')
    ],
    leadInfo: {
      name: 'Roberto',
      problem: 'no tengo clientes',
      goal: 'llenar el lugar',
      budget: 800,
      email: 'roberto@rest.com'
    },
    calendarShown: true,  // This should prevent further processing
    contactId: 'test-recursion-prevention',
    conversationId: 'conv-recursion-test'
  };
  
  console.log('📊 Test State:');
  console.log('- Calendar Shown:', testState.calendarShown);
  console.log('- Lead Info Collected:', Object.keys(testState.leadInfo).length === 5);
  console.log('- Messages:', testState.messages.length);
  
  try {
    // Check if shouldContinue function exists and works
    if (salesAgent.shouldContinue) {
      const shouldContinue = salesAgent.shouldContinue(testState);
      console.log('\n✅ shouldContinue() returned:', shouldContinue);
      console.log('Expected: false (agent should stop when calendar is shown)');
      
      if (!shouldContinue) {
        console.log('\n🎉 SUCCESS: Agent correctly stops when calendar is shown!');
        return true;
      } else {
        console.log('\n❌ FAILED: Agent did not stop when calendar was shown');
        return false;
      }
    } else {
      console.log('\n⚠️  WARNING: shouldContinue function not found on agent');
      console.log('Testing with actual invocation...');
      
      // Try invoking with low recursion limit
      const result = await salesAgent.invoke(testState, {
        configurable: {
          ghlService: mockGHLService,
          calendarId: 'test-calendar',
          thread_id: 'test-thread'
        },
        recursionLimit: 5  // Low limit to catch recursion quickly
      });
      
      console.log('\n📋 Result:');
      console.log('- Messages added:', result.messages.length - testState.messages.length);
      console.log('- Calendar still shown:', result.calendarShown);
      
      if (result.messages.length === testState.messages.length) {
        console.log('\n🎉 SUCCESS: Agent did not add new messages when calendar was shown!');
        return true;
      } else {
        console.log('\n⚠️  Agent added messages after calendar was shown');
        return false;
      }
    }
  } catch (error) {
    if (error.message.includes('recursion')) {
      console.log('\n❌ FAILED: Hit recursion limit - prevention not working');
      return false;
    }
    console.log('\n❌ Error:', error.message);
    return false;
  }
}

// Run test
testRecursionPrevention()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test error:', error);
    process.exit(1);
  });