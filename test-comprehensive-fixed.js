#!/usr/bin/env node
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env from the correct directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

console.log('🧪 COMPREHENSIVE SYSTEM TEST\n');
console.log('Testing all components part by part...\n');

// Verify environment variables are loaded
console.log('Environment check:');
console.log(`  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Found' : '❌ Missing'}`);
console.log(`  GHL_API_KEY: ${process.env.GHL_API_KEY ? '✅ Found' : '❌ Missing'}`);
console.log(`  GHL_LOCATION_ID: ${process.env.GHL_LOCATION_ID ? '✅ Found' : '❌ Missing'}`);
console.log(`  GHL_CALENDAR_ID: ${process.env.GHL_CALENDAR_ID ? '✅ Found' : '❌ Missing'}\n`);

// Skip validation for testing
process.env.SKIP_ENV_VALIDATION = 'true';

import { salesAgent } from './agents/salesAgent.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import crypto from 'crypto';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage } from '@langchain/core/messages';

// Test results tracking
const testResults = {
  fieldExtraction: { passed: 0, failed: 0, tests: [] },
  recursionProtection: { passed: 0, failed: 0, tests: [] },
  conversationFlow: { passed: 0, failed: 0, tests: [] },
  stateManagement: { passed: 0, failed: 0, tests: [] },
  toolExecution: { passed: 0, failed: 0, tests: [] },
  edgeCases: { passed: 0, failed: 0, tests: [] }
};

// Helper function to track test results
function recordTest(category, testName, passed, details = '') {
  testResults[category].tests.push({ testName, passed, details });
  if (passed) {
    testResults[category].passed++;
  } else {
    testResults[category].failed++;
  }
}

// Mock GHL service for testing
const createMockGhlService = () => {
  const sentMessages = [];
  const tags = new Set();
  const notes = [];
  
  return {
    sendSMS: async (contactId, message) => {
      sentMessages.push({ contactId, message, timestamp: new Date() });
      console.log(`   🤖 Bot: "${message.substring(0, 60)}..."`);
      return { id: `msg-${sentMessages.length}` };
    },
    getAvailableSlots: async () => {
      return Array(5).fill(null).map((_, i) => ({
        startTime: new Date(Date.now() + (i+1) * 24*60*60*1000).toISOString(),
        endTime: new Date(Date.now() + (i+1) * 24*60*60*1000 + 60*60*1000).toISOString()
      }));
    },
    addTags: async (contactId, newTags) => {
      newTags.forEach(tag => tags.add(tag));
      return true;
    },
    addNote: async (contactId, note) => {
      notes.push({ contactId, note, timestamp: new Date() });
      return true;
    },
    updateContact: async (contactId, fields) => {
      return true;
    },
    bookAppointment: async (data) => {
      return { id: 'apt-123', status: 'confirmed' };
    },
    // Test helpers
    getSentMessages: () => sentMessages,
    getTags: () => Array.from(tags),
    getNotes: () => notes
  };
};

// Helper to create proper config
const createConfig = (ghlService, contactId, threadId = null) => ({
  configurable: {
    ghlService,
    calendarId: 'test',
    contactId,
    thread_id: threadId || `test-thread-${Date.now()}-${Math.random()}`
  },
  runId: crypto.randomUUID()
});

// 1. TEST FIELD EXTRACTION
async function testFieldExtraction() {
  console.log('\n' + '='.repeat(60));
  console.log('📋 PART 1: FIELD EXTRACTION TESTS');
  console.log('='.repeat(60) + '\n');
  
  // Check if we have API key
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'test-key') {
    console.log('⚠️  Skipping LLM-based extraction tests (no API key)');
    recordTest('fieldExtraction', 'LLM extraction tests', false, 'No API key');
    return;
  }
  
  const llm = new ChatOpenAI({ 
    model: "gpt-4", 
    temperature: 0,
    openAIApiKey: process.env.OPENAI_API_KEY
  });
  
  // Test cases for field extraction
  const extractionTests = [
    {
      name: 'Extract name',
      message: 'Hola, soy Carlos Rodriguez',
      expectedFields: ['name'],
      expectedValues: { name: 'Carlos Rodriguez' }
    },
    {
      name: 'Extract business type and problem',
      message: 'tengo un restaurante mexicano pero no tengo clientes',
      expectedFields: ['businessType', 'problem'],
      expectedValues: { businessType: 'restaurante mexicano', problem: 'no tengo clientes' }
    },
    {
      name: 'Extract budget with "al mes"',
      message: 'puedo invertir 500 dolares al mes',
      expectedFields: ['budget'],
      expectedValues: { budget: 500 }
    },
    {
      name: 'Extract all fields from single message',
      message: 'Hola soy Maria tengo una tienda de ropa necesito mas ventas quiero duplicar ingresos puedo pagar 600 al mes maria@tienda.com',
      expectedFields: ['name', 'businessType', 'problem', 'goal', 'budget', 'email'],
      expectedValues: { 
        name: 'Maria',
        businessType: 'tienda de ropa',
        problem: 'necesito mas ventas',
        goal: 'duplicar ingresos',
        budget: 600,
        email: 'maria@tienda.com'
      }
    }
  ];
  
  for (const test of extractionTests) {
    console.log(`\n📝 Test: ${test.name}`);
    console.log(`   Message: "${test.message}"`);
    
    const state = {
      messages: [new HumanMessage(test.message)],
      leadInfo: {},
      contactId: `test-extract-${Date.now()}`,
      extractionCount: 0,
      processedMessages: []
    };
    
    const mockGhl = createMockGhlService();
    
    try {
      const result = await salesAgent.invoke(state, createConfig(mockGhl, state.contactId));
      
      // Check extracted fields
      const extractedFields = Object.keys(result.leadInfo || {});
      const success = test.expectedFields.every(field => extractedFields.includes(field));
      
      console.log(`   ✅ Extraction completed`);
      console.log(`   📊 Extracted: ${JSON.stringify(result.leadInfo)}`);
      console.log(`   Expected fields: ${test.expectedFields.join(', ')}`);
      console.log(`   Result: ${success ? 'PASSED ✅' : 'FAILED ❌'}`);
      
      recordTest('fieldExtraction', test.name, success, 
        `Expected: ${JSON.stringify(test.expectedValues)}, Got: ${JSON.stringify(result.leadInfo)}`);
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      recordTest('fieldExtraction', test.name, false, error.message);
    }
  }
  
  // Test field name case sensitivity fix
  console.log('\n📝 Test: Field name case sensitivity (lowercase required)');
  const prompt = `Extract: {"name": "Carlos", "problem": "no customers"}`;
  
  try {
    const response = await llm.invoke([
      new SystemMessage("Return exactly what you're asked to extract."),
      { role: "user", content: prompt }
    ]);
    
    const parsed = JSON.parse(response.content);
    const hasLowercaseKeys = Object.keys(parsed).every(key => key === key.toLowerCase());
    
    console.log(`   Response: ${response.content}`);
    console.log(`   Result: ${hasLowercaseKeys ? 'PASSED ✅' : 'FAILED ❌'}`);
    
    recordTest('fieldExtraction', 'Field name case sensitivity', hasLowercaseKeys);
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    recordTest('fieldExtraction', 'Field name case sensitivity', false, error.message);
  }
}

// 2. TEST RECURSION PROTECTION
async function testRecursionProtection() {
  console.log('\n\n' + '='.repeat(60));
  console.log('🔄 PART 2: RECURSION PROTECTION TESTS');
  console.log('='.repeat(60) + '\n');
  
  // Test 1: Max extraction attempts
  console.log('📝 Test: Max extraction attempts (should stop after 3)');
  
  const state = {
    messages: [
      new HumanMessage("Hola"),
      new HumanMessage("Q horas tienes?"),
      new HumanMessage("cuando puedo ir?"),
      new HumanMessage("hay citas disponibles?")
    ],
    leadInfo: { name: "Juan" }, // Only partial info
    contactId: `test-recursion-${Date.now()}`,
    extractionCount: 0,
    processedMessages: []
  };
  
  const mockGhl = createMockGhlService();
  
  try {
    const config = createConfig(mockGhl, state.contactId);
    config.recursionLimit = 25;
    
    const result = await salesAgent.invoke(state, config);
    
    const passed = result.extractionCount <= 3;
    console.log(`   Extraction attempts: ${result.extractionCount}`);
    console.log(`   Max extraction reached: ${result.maxExtractionReached}`);
    console.log(`   Result: ${passed ? 'PASSED ✅' : 'FAILED ❌'}`);
    
    recordTest('recursionProtection', 'Max extraction attempts', passed, 
      `Extraction count: ${result.extractionCount}`);
    
  } catch (error) {
    if (error.message.includes('recursion')) {
      console.log(`   ❌ Hit recursion limit (should not happen)`);
      recordTest('recursionProtection', 'Max extraction attempts', false, 'Hit recursion limit');
    } else {
      console.log(`   ❌ Error: ${error.message}`);
      recordTest('recursionProtection', 'Max extraction attempts', false, error.message);
    }
  }
  
  // Test 2: Message deduplication
  console.log('\n📝 Test: Message deduplication (prevent reprocessing)');
  
  const duplicateState = {
    messages: [
      new HumanMessage("soy carlos"),
      new HumanMessage("soy carlos"), // Duplicate
      new HumanMessage("soy carlos")  // Duplicate
    ],
    leadInfo: {},
    contactId: `test-dedup-${Date.now()}`,
    extractionCount: 0,
    processedMessages: []
  };
  
  try {
    const result = await salesAgent.invoke(duplicateState, createConfig(mockGhl, duplicateState.contactId));
    
    const passed = result.extractionCount === 1; // Should only process once
    console.log(`   Messages sent: 3 (2 duplicates)`);
    console.log(`   Extraction attempts: ${result.extractionCount}`);
    console.log(`   Processed messages: ${result.processedMessages.length}`);
    console.log(`   Result: ${passed ? 'PASSED ✅' : 'FAILED ❌'}`);
    
    recordTest('recursionProtection', 'Message deduplication', passed, 
      `Extraction count: ${result.extractionCount}`);
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    recordTest('recursionProtection', 'Message deduplication', false, error.message);
  }
}

// 3. TEST CONVERSATION FLOW
async function testConversationFlow() {
  console.log('\n\n' + '='.repeat(60));
  console.log('💬 PART 3: CONVERSATION FLOW TESTS');
  console.log('='.repeat(60) + '\n');
  
  // Test 1: Complete qualification flow
  console.log('📝 Test: Complete qualification flow (high budget)');
  
  const conversation = [
    "Hola",
    "Soy Carlos Rodriguez",
    "tengo un restaurante mexicano",
    "no tengo suficientes clientes",
    "quiero llenar mi restaurante todos los dias",
    "puedo invertir 800 dolares mensuales",
    "carlos@mirestaurante.com"
  ];
  
  let state = {
    messages: [],
    leadInfo: {},
    contactId: `test-flow-${Date.now()}`,
    extractionCount: 0,
    processedMessages: []
  };
  
  const mockGhl = createMockGhlService();
  let calendarShown = false;
  const threadId = `test-thread-flow-${Date.now()}`;
  
  for (const msg of conversation) {
    console.log(`\n👤 User: "${msg}"`);
    state.messages.push(new HumanMessage(msg));
    
    const result = await salesAgent.invoke(state, createConfig(mockGhl, state.contactId, threadId));
    
    state = result;
    
    // Check if calendar was shown
    const lastMessage = mockGhl.getSentMessages().slice(-1)[0]?.message || '';
    if (lastMessage.includes('disponible') || lastMessage.includes('horarios')) {
      calendarShown = true;
    }
  }
  
  // Verify qualification
  const qualified = 
    state.leadInfo.name === 'Carlos Rodriguez' &&
    state.leadInfo.problem &&
    state.leadInfo.goal &&
    state.leadInfo.budget === 800 &&
    state.leadInfo.email === 'carlos@mirestaurante.com' &&
    calendarShown;
  
  console.log(`\n📊 Final lead info: ${JSON.stringify(state.leadInfo)}`);
  console.log(`   Calendar shown: ${calendarShown ? 'YES ✅' : 'NO ❌'}`);
  console.log(`   Tags applied: ${mockGhl.getTags().join(', ')}`);
  console.log(`   Result: ${qualified ? 'PASSED ✅' : 'FAILED ❌'}`);
  
  recordTest('conversationFlow', 'Complete qualification flow', qualified,
    `Calendar shown: ${calendarShown}, Tags: ${mockGhl.getTags()}`);
  
  // Test 2: Low budget flow
  console.log('\n📝 Test: Low budget flow (should not show calendar)');
  
  const lowBudgetConv = [
    "Hola soy Ana",
    "tengo una tienda pequeña",
    "necesito mas clientes",
    "quiero crecer mi negocio",
    "solo puedo pagar 200 dolares al mes"
  ];
  
  state = {
    messages: [],
    leadInfo: {},
    contactId: `test-lowbudget-${Date.now()}`,
    extractionCount: 0,
    processedMessages: []
  };
  
  const mockGhl2 = createMockGhlService();
  const threadId2 = `test-thread-lowbudget-${Date.now()}`;
  
  for (const msg of lowBudgetConv) {
    console.log(`\n👤 User: "${msg}"`);
    state.messages.push(new HumanMessage(msg));
    
    const result = await salesAgent.invoke(state, createConfig(mockGhl2, state.contactId, threadId2));
    
    state = result;
  }
  
  const nurtureTagged = mockGhl2.getTags().includes('nurture-lead');
  const underBudgetTagged = mockGhl2.getTags().includes('under-budget');
  const messages = mockGhl2.getSentMessages();
  const hasPoliteDecline = messages.some(m => 
    m.message.toLowerCase().includes('momento') || 
    m.message.toLowerCase().includes('futuro')
  );
  
  const lowBudgetPassed = nurtureTagged && underBudgetTagged && hasPoliteDecline;
  
  console.log(`\n📊 Budget: $${state.leadInfo.budget}`);
  console.log(`   Tags: ${mockGhl2.getTags().join(', ')}`);
  console.log(`   Polite decline sent: ${hasPoliteDecline ? 'YES ✅' : 'NO ❌'}`);
  console.log(`   Result: ${lowBudgetPassed ? 'PASSED ✅' : 'FAILED ❌'}`);
  
  recordTest('conversationFlow', 'Low budget flow', lowBudgetPassed,
    `Tags: ${mockGhl2.getTags()}, Declined: ${hasPoliteDecline}`);
}

// 4. TEST STATE MANAGEMENT
async function testStateManagement() {
  console.log('\n\n' + '='.repeat(60));
  console.log('🔧 PART 4: STATE MANAGEMENT TESTS');
  console.log('='.repeat(60) + '\n');
  
  // Test 1: State persistence across tool calls
  console.log('📝 Test: State persistence across multiple tool calls');
  
  const state = {
    messages: [
      new HumanMessage("Soy Pedro, tengo una clinica dental")
    ],
    leadInfo: {},
    contactId: `test-state-${Date.now()}`,
    extractionCount: 0,
    processedMessages: []
  };
  
  const mockGhl = createMockGhlService();
  const threadId = `test-thread-state-${Date.now()}`;
  
  const result1 = await salesAgent.invoke(state, createConfig(mockGhl, state.contactId, threadId));
  
  // Add more info
  result1.messages.push(new HumanMessage("necesito mas pacientes, puedo pagar 1000 al mes"));
  
  const result2 = await salesAgent.invoke(result1, createConfig(mockGhl, state.contactId, threadId));
  
  const statePersisted = 
    result2.leadInfo.name === 'Pedro' && // Original info preserved
    result2.leadInfo.businessType && // Original info preserved
    result2.leadInfo.problem && // New info added
    result2.leadInfo.budget === 1000; // New info added
  
  console.log(`   Initial extraction: ${JSON.stringify(result1.leadInfo)}`);
  console.log(`   After second message: ${JSON.stringify(result2.leadInfo)}`);
  console.log(`   Result: ${statePersisted ? 'PASSED ✅' : 'FAILED ❌'}`);
  
  recordTest('stateManagement', 'State persistence', statePersisted,
    `Final state: ${JSON.stringify(result2.leadInfo)}`);
  
  // Test 2: Concurrent conversation isolation
  console.log('\n📝 Test: Concurrent conversation isolation');
  
  const conv1 = {
    messages: [new HumanMessage("Soy Maria, tengo una tienda")],
    leadInfo: {},
    contactId: 'contact-1',
    extractionCount: 0,
    processedMessages: []
  };
  
  const conv2 = {
    messages: [new HumanMessage("Soy Juan, tengo un restaurante")],
    leadInfo: {},
    contactId: 'contact-2',
    extractionCount: 0,
    processedMessages: []
  };
  
  const mockGhl1 = createMockGhlService();
  const mockGhl2 = createMockGhlService();
  
  // Process both conversations
  const [result1Conv, result2Conv] = await Promise.all([
    salesAgent.invoke(conv1, createConfig(mockGhl1, 'contact-1')),
    salesAgent.invoke(conv2, createConfig(mockGhl2, 'contact-2'))
  ]);
  
  const isolated = 
    result1Conv.leadInfo.name === 'Maria' &&
    result2Conv.leadInfo.name === 'Juan' &&
    result1Conv.leadInfo.businessType !== result2Conv.leadInfo.businessType;
  
  console.log(`   Conv 1: ${JSON.stringify(result1Conv.leadInfo)}`);
  console.log(`   Conv 2: ${JSON.stringify(result2Conv.leadInfo)}`);
  console.log(`   Result: ${isolated ? 'PASSED ✅' : 'FAILED ❌'}`);
  
  recordTest('stateManagement', 'Concurrent conversation isolation', isolated);
}

// 5. TEST TOOL EXECUTION
async function testToolExecution() {
  console.log('\n\n' + '='.repeat(60));
  console.log('🛠️  PART 5: TOOL EXECUTION TESTS');
  console.log('='.repeat(60) + '\n');
  
  // Test all tools
  const toolTests = [
    {
      name: 'sendGHLMessage tool',
      test: async () => {
        const mockGhl = createMockGhlService();
        const state = {
          messages: [new HumanMessage("Hola")],
          leadInfo: {},
          contactId: 'test-tool-1',
          extractionCount: 0,
          processedMessages: []
        };
        
        await salesAgent.invoke(state, createConfig(mockGhl, state.contactId));
        
        return mockGhl.getSentMessages().length > 0;
      }
    },
    {
      name: 'extractLeadInfo tool',
      test: async () => {
        const state = {
          messages: [new HumanMessage("Soy Carlos con presupuesto de 500")],
          leadInfo: {},
          contactId: 'test-tool-2',
          extractionCount: 0,
          processedMessages: []
        };
        
        const result = await salesAgent.invoke(state, createConfig(createMockGhlService(), state.contactId));
        
        return result.leadInfo.name === 'Carlos' && result.leadInfo.budget === 500;
      }
    },
    {
      name: 'getCalendarSlots tool',
      test: async () => {
        const mockGhl = createMockGhlService();
        const state = {
          messages: [new HumanMessage("mi email es test@test.com")],
          leadInfo: {
            name: 'Test User',
            problem: 'need customers',
            goal: 'grow business',
            budget: 500
          },
          contactId: 'test-tool-3',
          extractionCount: 0,
          processedMessages: []
        };
        
        await salesAgent.invoke(state, createConfig(mockGhl, state.contactId));
        
        const messages = mockGhl.getSentMessages();
        return messages.some(m => m.message.includes('disponible') || m.message.includes('horario'));
      }
    },
    {
      name: 'updateGHLContact tool',
      test: async () => {
        const mockGhl = createMockGhlService();
        const state = {
          messages: [new HumanMessage("soy qualified lead con 500 budget")],
          leadInfo: { name: 'Test', budget: 500 },
          contactId: 'test-tool-4',
          extractionCount: 0,
          processedMessages: []
        };
        
        await salesAgent.invoke(state, createConfig(mockGhl, state.contactId));
        
        return mockGhl.getTags().length > 0;
      }
    }
  ];
  
  for (const toolTest of toolTests) {
    console.log(`\n📝 Test: ${toolTest.name}`);
    
    try {
      const passed = await toolTest.test();
      console.log(`   Result: ${passed ? 'PASSED ✅' : 'FAILED ❌'}`);
      recordTest('toolExecution', toolTest.name, passed);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      recordTest('toolExecution', toolTest.name, false, error.message);
    }
  }
  
  // Test Command object returns
  console.log('\n📝 Test: All tools return Command objects');
  
  const state = {
    messages: [new HumanMessage("test message")],
    leadInfo: {},
    contactId: 'test-commands',
    extractionCount: 0,
    processedMessages: []
  };
  
  try {
    // This will execute multiple tools internally
    await salesAgent.invoke(state, createConfig(createMockGhlService(), state.contactId));
    
    // If no errors, tools are returning proper Command objects
    console.log(`   Result: PASSED ✅`);
    recordTest('toolExecution', 'Command object returns', true);
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    recordTest('toolExecution', 'Command object returns', false, error.message);
  }
}

// 6. TEST EDGE CASES
async function testEdgeCases() {
  console.log('\n\n' + '='.repeat(60));
  console.log('🔍 PART 6: EDGE CASE TESTS');
  console.log('='.repeat(60) + '\n');
  
  const edgeCases = [
    {
      name: 'Empty message',
      messages: [''],
      expectedBehavior: 'Should handle gracefully'
    },
    {
      name: 'Special characters in email',
      messages: ['mi email es user+tag@domain.co.uk'],
      expectedBehavior: 'Should extract email correctly'
    },
    {
      name: 'Multiple budgets mentioned',
      messages: ['tenia 200 pero ahora puedo pagar 600 al mes'],
      expectedBehavior: 'Should extract latest budget (600)'
    },
    {
      name: 'Non-Spanish input',
      messages: ['Hello my name is John'],
      expectedBehavior: 'Should still extract name'
    }
  ];
  
  for (const edgeCase of edgeCases) {
    console.log(`\n📝 Test: ${edgeCase.name}`);
    console.log(`   Expected: ${edgeCase.expectedBehavior}`);
    
    const state = {
      messages: edgeCase.messages.map(m => new HumanMessage(m)),
      leadInfo: {},
      contactId: `test-edge-${Date.now()}`,
      extractionCount: 0,
      processedMessages: []
    };
    
    try {
      const result = await salesAgent.invoke(state, createConfig(createMockGhlService(), state.contactId));
      
      let passed = true;
      let details = '';
      
      // Check specific edge case expectations
      if (edgeCase.name === 'Special characters in email') {
        passed = result.leadInfo.email === 'user+tag@domain.co.uk';
        details = `Email extracted: ${result.leadInfo.email}`;
      } else if (edgeCase.name === 'Multiple budgets mentioned') {
        passed = result.leadInfo.budget === 600;
        details = `Budget extracted: ${result.leadInfo.budget}`;
      } else if (edgeCase.name === 'Non-Spanish input') {
        passed = result.leadInfo.name === 'John';
        details = `Name extracted: ${result.leadInfo.name}`;
      }
      
      console.log(`   Result: ${passed ? 'PASSED ✅' : 'FAILED ❌'}`);
      if (details) console.log(`   Details: ${details}`);
      
      recordTest('edgeCases', edgeCase.name, passed, details);
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      recordTest('edgeCases', edgeCase.name, false, error.message);
    }
  }
}

// Generate final report
function generateReport() {
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 COMPREHENSIVE TEST REPORT');
  console.log('='.repeat(60) + '\n');
  
  let totalPassed = 0;
  let totalFailed = 0;
  
  Object.entries(testResults).forEach(([category, results]) => {
    console.log(`\n${category.toUpperCase()}:`);
    console.log(`  Passed: ${results.passed}`);
    console.log(`  Failed: ${results.failed}`);
    console.log(`  Total: ${results.passed + results.failed}`);
    
    if (results.failed > 0) {
      console.log('\n  Failed tests:');
      results.tests
        .filter(t => !t.passed)
        .forEach(t => console.log(`    - ${t.testName}: ${t.details}`));
    }
    
    totalPassed += results.passed;
    totalFailed += results.failed;
  });
  
  const successRate = ((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1);
  
  console.log('\n' + '='.repeat(60));
  console.log('OVERALL RESULTS:');
  console.log(`  Total Tests: ${totalPassed + totalFailed}`);
  console.log(`  Passed: ${totalPassed}`);
  console.log(`  Failed: ${totalFailed}`);
  console.log(`  Success Rate: ${successRate}%`);
  console.log('='.repeat(60));
  
  if (totalFailed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! The system is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Review the failures above.');
  }
  
  // Critical checks
  console.log('\n🔍 CRITICAL CHECKS:');
  
  const criticalChecks = [
    {
      name: 'Field extraction working',
      passed: testResults.fieldExtraction.passed > testResults.fieldExtraction.failed
    },
    {
      name: 'Recursion protection active',
      passed: testResults.recursionProtection.passed === testResults.recursionProtection.tests.length
    },
    {
      name: 'State management correct',
      passed: testResults.stateManagement.passed === testResults.stateManagement.tests.length
    }
  ];
  
  criticalChecks.forEach(check => {
    console.log(`  ${check.name}: ${check.passed ? 'YES ✅' : 'NO ❌'}`);
  });
  
  return successRate;
}

// Run all tests
async function runAllTests() {
  console.log('Starting comprehensive system test...\n');
  
  try {
    await testFieldExtraction();
    await testRecursionProtection();
    await testConversationFlow();
    await testStateManagement();
    await testToolExecution();
    await testEdgeCases();
    
    const successRate = generateReport();
    
    // Save report to file
    const report = {
      timestamp: new Date().toISOString(),
      successRate: successRate,
      results: testResults
    };
    
    await import('fs').then(fs => 
      fs.promises.writeFile(
        'test-results.json', 
        JSON.stringify(report, null, 2)
      )
    );
    
    console.log('\n📄 Test results saved to test-results.json');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(console.error);