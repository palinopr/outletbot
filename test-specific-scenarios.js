#!/usr/bin/env node
/**
 * Test specific scenarios that were previously failing
 */

import { config as dotenvConfig } from 'dotenv';
import { salesAgent } from './agents/salesAgent.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { GHLService } from './services/ghlService.js';

dotenvConfig();

// Enable tracing
process.env.LANGSMITH_TRACING = 'true';
process.env.LANGSMITH_PROJECT = 'test-specific';

const ghlService = new GHLService(
  process.env.GHL_API_KEY,
  process.env.GHL_LOCATION_ID
);

async function testScenario(name, state) {
  console.log(`\n=== Testing: ${name} ===`);
  
  try {
    const result = await salesAgent.invoke(state, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        contactId: state.contactId,
        thread_id: `test-${Date.now()}`
      },
      recursionLimit: 10
    });
    
    const lastAiMessage = result.messages?.filter(m => 
      m._getType?.() === 'ai' || m.type === 'ai' || m.constructor.name === 'AIMessage'
    ).pop();
    
    console.log('Last AI message:', lastAiMessage?.content?.substring(0, 100) + '...');
    console.log('Lead info:', result.leadInfo);
    console.log('✅ Success');
    return true;
  } catch (error) {
    console.log('❌ Error:', error.message);
    return false;
  }
}

async function runTests() {
  let passed = 0;
  let total = 0;
  
  // Test 1: Simple greeting
  total++;
  if (await testScenario('Simple Greeting', {
    messages: [new HumanMessage('Hola')],
    leadInfo: {},
    contactId: `test-1-${Date.now()}`,
    conversationId: `conv-1-${Date.now()}`
  })) passed++;
  
  // Test 2: Si confirmation
  total++;
  if (await testScenario('Si Confirmation', {
    messages: [
      new HumanMessage('Soy Juan'),
      new AIMessage('¿Tu presupuesto mensual es de $500?'),
      new HumanMessage('si')
    ],
    leadInfo: { name: 'Juan' },
    contactId: `test-2-${Date.now()}`,
    conversationId: `conv-2-${Date.now()}`
  })) passed++;
  
  // Test 3: All response
  total++;
  if (await testScenario('All Response', {
    messages: [
      new HumanMessage('Hola'),
      new AIMessage('¡Hola! Soy María. ¿Me podrías compartir tu nombre?'),
      new HumanMessage('Carlos'),
      new AIMessage('Mucho gusto Carlos. ¿Cuál es el principal problema con tu negocio? ¿Qué resultado te gustaría lograr?'),
      new HumanMessage('all')
    ],
    leadInfo: { name: 'Carlos' },
    contactId: `test-3-${Date.now()}`,
    conversationId: `conv-3-${Date.now()}`
  })) passed++;
  
  // Test 4: Complex greeting with info
  total++;
  if (await testScenario('Complex Greeting', {
    messages: [new HumanMessage('Buenos días, necesito ayuda con marketing')],
    leadInfo: {},
    contactId: `test-4-${Date.now()}`,
    conversationId: `conv-4-${Date.now()}`
  })) passed++;
  
  // Test 5: Full qualification
  total++;
  if (await testScenario('Full Qualification', {
    messages: [
      new HumanMessage('Hola, soy María, tengo una tienda online, no vendo nada, quiero vender $10k al mes, mi presupuesto es $800, mi email es maria@shop.com')
    ],
    leadInfo: {},
    contactId: `test-5-${Date.now()}`,
    conversationId: `conv-5-${Date.now()}`
  })) passed++;
  
  console.log(`\n========== RESULTS ==========`);
  console.log(`Total: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${total - passed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
}

runTests().catch(console.error);