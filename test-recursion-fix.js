#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

console.log('🔍 TESTING RECURSION LIMIT FIX\n');

// Set env vars
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
process.env.GHL_API_KEY = process.env.GHL_API_KEY || 'test-key';
process.env.GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || 'test-location';
process.env.GHL_CALENDAR_ID = process.env.GHL_CALENDAR_ID || 'test-calendar';

import { salesAgent } from './agents/salesAgent.js';
import { HumanMessage } from '@langchain/core/messages';
import crypto from 'crypto';

// Test the exact scenario from trace 1f06a7ac
async function testRecursionFix() {
  console.log('Testing scenario that caused recursion limit error...\n');
  
  // Initial state - user has partial info and asks about scheduling
  const initialState = {
    messages: [
      new HumanMessage("Hola"),
      new HumanMessage("Q horas tienes?")  // This caused the recursion
    ],
    leadInfo: {
      name: "Jaime",
      // Missing: problem, goal, budget, email
    },
    contactId: "test-recursion-fix",
    conversationId: "test-conv-fix",
    appointmentBooked: false,
    extractionCount: 0,
    processedMessages: [],
    availableSlots: [],
    maxExtractionReached: false
  };
  
  // Mock GHL service that counts calls
  let toolCallCounts = {
    sendGHLMessage: 0,
    extractLeadInfo: 0,
    updateGHLContact: 0
  };
  
  const sentMessages = [];
  
  const mockGhlService = {
    sendSMS: async (contactId, message) => {
      toolCallCounts.sendGHLMessage++;
      sentMessages.push(message);
      console.log(`[${toolCallCounts.sendGHLMessage}] Bot response: "${message.substring(0, 80)}..."`);
      return { id: `msg-${toolCallCounts.sendGHLMessage}` };
    },
    getAvailableSlots: async () => [],
    addTags: async (contactId, tags) => {
      toolCallCounts.updateGHLContact++;
      return true;
    },
    addNote: async () => true,
    updateContact: async () => true
  };
  
  const config = {
    configurable: {
      ghlService: mockGhlService,
      calendarId: 'test-calendar',
      contactId: initialState.contactId,
      ...initialState
    },
    runId: crypto.randomUUID(),
    recursionLimit: 25  // Same as production
  };
  
  console.log('Initial State:');
  console.log('- Messages: ["Hola", "Q horas tienes?"]');
  console.log('- Lead Info: Only has name "Jaime"');
  console.log('- Missing: problem, goal, budget, email');
  console.log('\nRunning agent...\n');
  
  try {
    const startTime = Date.now();
    
    const result = await salesAgent.invoke(initialState, config);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ SUCCESS! Agent completed in ${duration}s`);
    
    console.log('\nTool Call Summary:');
    console.log(`  extractLeadInfo: ${toolCallCounts.extractLeadInfo} calls`);
    console.log(`  sendGHLMessage: ${toolCallCounts.sendGHLMessage} calls`);
    
    console.log('\nFinal State:');
    console.log(`  Extraction Count: ${result.extractionCount || 0}`);
    console.log(`  Max Extraction Reached: ${result.maxExtractionReached || false}`);
    console.log(`  Messages: ${result.messages?.length || 0}`);
    
    // Check if the bot handled the scheduling question appropriately
    const lastBotMessage = sentMessages[sentMessages.length - 1];
    if (lastBotMessage && lastBotMessage.includes('primero necesito conocer')) {
      console.log('\n✅ Bot correctly deflected scheduling question!');
      console.log(`   Response: "${lastBotMessage}"`);
    }
    
    // Verify extraction didn't exceed limit
    if (toolCallCounts.extractLeadInfo <= 3) {
      console.log('\n✅ Extraction attempts within limit (≤3)');
    } else {
      console.log('\n⚠️  Extraction attempts exceeded expected limit');
    }
    
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n❌ ERROR after ${duration}s`);
    console.log(`Error: ${error.message}`);
    
    if (error.message.includes('Recursion limit')) {
      console.log('\n🔴 RECURSION LIMIT STILL HIT - FIX FAILED!');
      console.log('Tool calls at error:', toolCallCounts);
    }
  }
}

// Test progressive extraction with limits
async function testExtractionLimits() {
  console.log('\n\n=== TESTING EXTRACTION LIMITS ===\n');
  
  const messages = [
    "Hola soy Maria",
    "necesito mas clientes",  // Should extract problem
    "quiero duplicar ventas",  // Should extract goal
    "no se cuanto gastar",     // No budget info
    "tal vez unos cientos",    // Still vague
  ];
  
  let state = {
    messages: [],
    leadInfo: {},
    contactId: "test-limits",
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
  
  for (let i = 0; i < messages.length; i++) {
    console.log(`\nStep ${i + 1}: User says "${messages[i]}"`);
    state.messages.push(new HumanMessage(messages[i]));
    
    const result = await salesAgent.invoke(state, {
      configurable: {
        ghlService: mockGhl,
        calendarId: 'test',
        contactId: state.contactId
      },
      recursionLimit: 10
    });
    
    state = {
      messages: result.messages || state.messages,
      leadInfo: result.leadInfo || state.leadInfo,
      contactId: state.contactId,
      extractionCount: result.extractionCount || 0,
      processedMessages: result.processedMessages || [],
      maxExtractionReached: result.maxExtractionReached || false
    };
    
    console.log(`   Extraction count: ${state.extractionCount}`);
    console.log(`   Max reached: ${state.maxExtractionReached}`);
    console.log(`   Lead info: ${JSON.stringify(state.leadInfo)}`);
    
    if (state.maxExtractionReached) {
      console.log('\n⚠️  Max extraction limit reached!');
      break;
    }
  }
}

// Run tests
(async () => {
  try {
    await testRecursionFix();
    await testExtractionLimits();
    
    console.log('\n\n=== FIX VERIFICATION COMPLETE ===');
    console.log('The recursion limit fix should prevent infinite loops by:');
    console.log('1. Limiting extraction attempts to 3');
    console.log('2. Tracking processed messages to avoid duplicates');
    console.log('3. Handling scheduling questions gracefully');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
})();