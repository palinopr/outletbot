#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

console.log('🔍 TESTING RECURSION LIMIT SCENARIO\n');

// Set env vars if not present
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
process.env.GHL_API_KEY = process.env.GHL_API_KEY || 'test-key';
process.env.GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || 'test-location';
process.env.GHL_CALENDAR_ID = process.env.GHL_CALENDAR_ID || 'test-calendar';

import { salesAgent } from './agents/salesAgent.js';
import { HumanMessage } from '@langchain/core/messages';
import crypto from 'crypto';

// Reproduce the exact scenario from trace 1f06a7ac-ce88-6245-9ec9-821839cc6091
async function testRecursionLimit() {
  console.log('Reproducing recursion limit error from production trace...\n');
  
  // Initial state from the trace - user already had conversation history
  const initialState = {
    messages: [
      new HumanMessage("Hola"),
      new HumanMessage("Q horas tienes?")
    ],
    leadInfo: {
      name: "Jaime",
      problem: null,
      goal: null,
      budget: null,
      phone: "+13054870475"
    },
    contactId: "VY6fEcgnrRaFzVY7PNQz",
    conversationId: "jYGC7hd4L1vv922VdJQ5",
    appointmentBooked: false,
    extractionCount: 0,
    processedMessages: [],
    availableSlots: [],
    ghlUpdated: false,
    lastUpdate: null,
    userInfo: {}
  };
  
  // Mock GHL service that counts tool calls
  let toolCallCounts = {
    sendGHLMessage: 0,
    extractLeadInfo: 0,
    getCalendarSlots: 0,
    updateGHLContact: 0
  };
  
  const mockGhlService = {
    sendSMS: async (contactId, message) => {
      toolCallCounts.sendGHLMessage++;
      console.log(`[${toolCallCounts.sendGHLMessage}] sendGHLMessage called`);
      console.log(`   Message: "${message.substring(0, 50)}..."`);
      return { id: `msg-${toolCallCounts.sendGHLMessage}` };
    },
    getAvailableSlots: async () => {
      toolCallCounts.getCalendarSlots++;
      console.log(`[${toolCallCounts.getCalendarSlots}] getCalendarSlots called`);
      return [];
    },
    addTags: async (contactId, tags) => {
      toolCallCounts.updateGHLContact++;
      console.log(`[${toolCallCounts.updateGHLContact}] addTags called: ${tags.join(', ')}`);
      return true;
    },
    addNote: async (contactId, note) => {
      console.log(`   addNote called: ${note.substring(0, 50)}...`);
      return true;
    },
    updateContact: async () => true
  };
  
  const config = {
    configurable: {
      ghlService: mockGhlService,
      calendarId: process.env.GHL_CALENDAR_ID,
      contactId: initialState.contactId,
      ...initialState
    },
    runId: crypto.randomUUID(),
    recursionLimit: 25  // Default LangGraph limit
  };
  
  console.log('Initial State:');
  console.log('- Messages:', initialState.messages.length);
  console.log('- Lead Name:', initialState.leadInfo.name);
  console.log('- Lead Info Complete:', !!(initialState.leadInfo.name && initialState.leadInfo.problem && initialState.leadInfo.goal && initialState.leadInfo.budget));
  console.log('\n');
  
  try {
    console.log('Invoking sales agent...\n');
    const startTime = Date.now();
    
    const result = await salesAgent.invoke(initialState, config);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Agent completed in ${duration}s`);
    console.log('\nTool Call Summary:');
    Object.entries(toolCallCounts).forEach(([tool, count]) => {
      console.log(`  ${tool}: ${count} calls`);
    });
    
    console.log('\nFinal State:');
    console.log('- Messages:', result.messages?.length || 0);
    console.log('- Lead Info:', JSON.stringify(result.leadInfo));
    
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n❌ ERROR after ${duration}s`);
    console.log(`Error Type: ${error.constructor.name}`);
    console.log(`Error Message: ${error.message}`);
    
    console.log('\nTool Call Summary at Error:');
    Object.entries(toolCallCounts).forEach(([tool, count]) => {
      console.log(`  ${tool}: ${count} calls ${count > 10 ? '⚠️ EXCESSIVE' : ''}`);
    });
    
    // Check if it's the recursion limit error
    if (error.message.includes('Recursion limit')) {
      console.log('\n🔴 RECURSION LIMIT HIT - This matches the production error!');
      console.log('\nPossible Causes:');
      console.log('1. Agent stuck in a loop trying to extract missing info');
      console.log('2. No proper termination condition when info is partially complete');
      console.log('3. Tool calling logic causing infinite loops');
      
      // Analyze the pattern
      if (toolCallCounts.extractLeadInfo > 5) {
        console.log('\n⚠️  extractLeadInfo called excessively - likely stuck trying to extract missing fields');
      }
    }
  }
}

// Test with different recursion limits
async function testWithDifferentLimits() {
  console.log('\n\n=== TESTING WITH DIFFERENT RECURSION LIMITS ===\n');
  
  const limits = [5, 10, 15, 25];
  
  for (const limit of limits) {
    console.log(`\nTesting with recursion limit: ${limit}`);
    console.log('-'.repeat(40));
    
    const state = {
      messages: [new HumanMessage("Hola"), new HumanMessage("Quiero mas clientes")],
      leadInfo: { name: "Maria" },
      contactId: "test-" + Date.now()
    };
    
    let callCount = 0;
    const mockGhl = {
      sendSMS: async () => { 
        callCount++; 
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
        recursionLimit: limit
      });
      
      console.log(`✅ Completed successfully with ${callCount} tool calls`);
    } catch (error) {
      console.log(`❌ Failed at limit ${limit} after ${callCount} tool calls`);
      if (error.message.includes('Recursion limit')) {
        console.log('   Hit recursion limit!');
      }
    }
  }
}

// Run tests
(async () => {
  try {
    await testRecursionLimit();
    await testWithDifferentLimits();
  } catch (error) {
    console.error('Test failed:', error);
  }
})();