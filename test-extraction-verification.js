#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

console.log('🔍 TESTING FIELD EXTRACTION VERIFICATION\n');

// Set env vars
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
process.env.GHL_API_KEY = process.env.GHL_API_KEY || 'test-key';
process.env.GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || 'test-location';
process.env.GHL_CALENDAR_ID = process.env.GHL_CALENDAR_ID || 'test-calendar';

import { salesAgent } from './agents/salesAgent.js';
import { HumanMessage } from '@langchain/core/messages';
import crypto from 'crypto';

// Test extraction for each field
async function testFieldExtraction() {
  console.log('Testing if fields are being extracted correctly...\n');
  console.log('='.repeat(60));
  
  // Test cases with expected extractions
  const testCases = [
    {
      message: "Hola, soy Maria Garcia",
      expectedField: "name",
      expectedValue: "Maria Garcia"
    },
    {
      message: "tengo una tienda de ropa pero no vendo mucho",
      expectedField: "problem",
      expectedValue: "tienda de ropa pero no vendo mucho"
    },
    {
      message: "quiero duplicar mis ventas este año",
      expectedField: "goal",
      expectedValue: "duplicar mis ventas"
    },
    {
      message: "puedo invertir 600 dolares al mes",
      expectedField: "budget",
      expectedValue: 600
    },
    {
      message: "mi correo es maria@tiendaropa.com",
      expectedField: "email",
      expectedValue: "maria@tiendaropa.com"
    }
  ];
  
  // Track extraction results
  const extractionResults = [];
  let allFieldsExtracted = true;
  
  for (const testCase of testCases) {
    console.log(`\n📋 Testing extraction for: ${testCase.expectedField}`);
    console.log(`   Message: "${testCase.message}"`);
    
    const state = {
      messages: [new HumanMessage(testCase.message)],
      leadInfo: {},
      contactId: `test-extract-${Date.now()}`,
      extractionCount: 0,
      processedMessages: []
    };
    
    let extractedValue = null;
    let botResponse = null;
    
    const mockGhlService = {
      sendSMS: async (contactId, message) => {
        botResponse = message;
        return { id: 'test-msg' };
      },
      getAvailableSlots: async () => [],
      addTags: async () => true,
      addNote: async () => true,
      updateContact: async () => true
    };
    
    try {
      const result = await salesAgent.invoke(state, {
        configurable: {
          ghlService: mockGhlService,
          calendarId: 'test',
          contactId: state.contactId
        },
        runId: crypto.randomUUID()
      });
      
      // Check if field was extracted
      extractedValue = result.leadInfo?.[testCase.expectedField];
      
      const success = !!extractedValue;
      
      console.log(`   ✅ Extraction attempted`);
      console.log(`   📊 Result:`);
      console.log(`      - Expected field: ${testCase.expectedField}`);
      console.log(`      - Extracted value: ${extractedValue || 'NOTHING EXTRACTED ❌'}`);
      console.log(`      - Extraction count: ${result.extractionCount}`);
      console.log(`      - Bot response: "${botResponse?.substring(0, 80)}..."`);
      
      extractionResults.push({
        field: testCase.expectedField,
        message: testCase.message,
        extracted: extractedValue,
        expected: testCase.expectedValue,
        success: success
      });
      
      if (!success) {
        allFieldsExtracted = false;
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      extractionResults.push({
        field: testCase.expectedField,
        message: testCase.message,
        extracted: null,
        expected: testCase.expectedValue,
        success: false,
        error: error.message
      });
      allFieldsExtracted = false;
    }
  }
  
  // Test full conversation flow
  console.log('\n\n' + '='.repeat(60));
  console.log('📋 TESTING FULL CONVERSATION EXTRACTION');
  console.log('='.repeat(60));
  
  let conversationState = {
    messages: [],
    leadInfo: {},
    contactId: `test-full-${Date.now()}`,
    extractionCount: 0,
    processedMessages: []
  };
  
  const fullConversation = [
    "Hola",
    "Soy Carlos Rodriguez",
    "tengo un restaurante mexicano",
    "necesito mas clientes, esta muy vacio",
    "quiero llenar el restaurante todos los dias",
    "puedo gastar como 800 dolares mensuales",
    "carlos@mirestaurante.com"
  ];
  
  const mockGhlFull = {
    sendSMS: async (contactId, message) => {
      console.log(`   🤖 Bot: "${message.substring(0, 60)}..."`);
      return { id: 'test-msg' };
    },
    getAvailableSlots: async () => {
      console.log(`   📅 Calendar slots requested`);
      return Array(5).fill(null).map((_, i) => ({
        startTime: new Date(Date.now() + (i+1) * 24*60*60*1000).toISOString(),
        endTime: new Date(Date.now() + (i+1) * 24*60*60*1000 + 60*60*1000).toISOString()
      }));
    },
    addTags: async () => true,
    addNote: async () => true,
    updateContact: async () => true
  };
  
  for (const msg of fullConversation) {
    console.log(`\n👤 User: "${msg}"`);
    conversationState.messages.push(new HumanMessage(msg));
    
    const result = await salesAgent.invoke(conversationState, {
      configurable: {
        ghlService: mockGhlFull,
        calendarId: 'test',
        contactId: conversationState.contactId
      },
      runId: crypto.randomUUID()
    });
    
    conversationState = {
      messages: result.messages || conversationState.messages,
      leadInfo: result.leadInfo || conversationState.leadInfo,
      extractionCount: result.extractionCount || conversationState.extractionCount,
      processedMessages: result.processedMessages || conversationState.processedMessages
    };
    
    console.log(`   📊 Lead info: ${JSON.stringify(conversationState.leadInfo)}`);
    console.log(`   Extraction count: ${conversationState.extractionCount}`);
  }
  
  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 EXTRACTION VERIFICATION SUMMARY');
  console.log('='.repeat(60));
  
  console.log('\nIndividual field extraction results:');
  extractionResults.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.field}: ${result.extracted || 'NOT EXTRACTED'}`);
  });
  
  console.log('\nFull conversation final state:');
  console.log(`- Name: ${conversationState.leadInfo.name || 'NOT EXTRACTED ❌'}`);
  console.log(`- Problem: ${conversationState.leadInfo.problem || 'NOT EXTRACTED ❌'}`);
  console.log(`- Goal: ${conversationState.leadInfo.goal || 'NOT EXTRACTED ❌'}`);
  console.log(`- Budget: ${conversationState.leadInfo.budget || 'NOT EXTRACTED ❌'}`);
  console.log(`- Email: ${conversationState.leadInfo.email || 'NOT EXTRACTED ❌'}`);
  
  console.log(`\nTotal extraction attempts: ${conversationState.extractionCount}`);
  console.log(`Unique messages processed: ${conversationState.processedMessages.length}`);
  
  if (allFieldsExtracted) {
    console.log('\n✅ All fields are being extracted correctly!');
  } else {
    console.log('\n❌ Some fields are NOT being extracted!');
    console.log('This could be the root cause of the recursion issue.');
  }
  
  // Test the specific problematic scenario
  console.log('\n\n' + '='.repeat(60));
  console.log('📋 TESTING PROBLEMATIC SCENARIO');
  console.log('='.repeat(60));
  
  console.log('\nScenario: User says everything but extraction fails');
  
  const problematicState = {
    messages: [
      new HumanMessage("Hola soy Jaime tengo un negocio de comida necesito mas clientes quiero crecer puedo pagar 500 dolares jaime@negocio.com")
    ],
    leadInfo: {},
    contactId: `test-problematic-${Date.now()}`,
    extractionCount: 0,
    processedMessages: []
  };
  
  console.log('👤 User provides ALL info in one message:');
  console.log('"Hola soy Jaime tengo un negocio de comida necesito mas clientes quiero crecer puedo pagar 500 dolares jaime@negocio.com"');
  
  const result = await salesAgent.invoke(problematicState, {
    configurable: {
      ghlService: mockGhlFull,
      calendarId: 'test',
      contactId: problematicState.contactId
    },
    runId: crypto.randomUUID()
  });
  
  console.log('\nExtraction result:');
  console.log(`- Lead info extracted: ${JSON.stringify(result.leadInfo)}`);
  console.log(`- Fields extracted: ${Object.keys(result.leadInfo || {}).length}`);
  console.log(`- Extraction attempts: ${result.extractionCount}`);
  
  if (Object.keys(result.leadInfo || {}).length === 0) {
    console.log('\n🔴 CRITICAL: No fields extracted even though all info was provided!');
    console.log('This explains why the agent gets stuck in a loop.');
  }
}

// Run the test
testFieldExtraction().catch(console.error);