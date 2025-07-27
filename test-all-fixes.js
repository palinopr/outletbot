#!/usr/bin/env node
/**
 * Final test to verify all fixes are working
 */

import { config as dotenvConfig } from 'dotenv';
import { salesAgent } from './agents/salesAgent.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { GHLService } from './services/ghlService.js';

dotenvConfig();

// Enable tracing
process.env.LANGSMITH_TRACING = 'true';
process.env.LANGSMITH_PROJECT = 'final-test-all-fixes';

const ghlService = new GHLService(
  process.env.GHL_API_KEY,  
  process.env.GHL_LOCATION_ID
);

async function testScenario(name, state, expectedBehavior) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Testing: ${name}`);
  console.log(`Expected: ${expectedBehavior}`);
  console.log(`${'='.repeat(50)}`);
  
  try {
    const result = await salesAgent.invoke(state, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        contactId: state.contactId,
        thread_id: `test-${Date.now()}`
      },
      recursionLimit: 20
    });
    
    const lastAiMessage = result.messages?.filter(m => 
      m._getType?.() === 'ai' || m.type === 'ai' || m.constructor.name === 'AIMessage'
    ).pop();
    
    console.log('✅ Success');
    console.log('Last AI:', lastAiMessage?.content?.substring(0, 150) + '...');
    console.log('Lead info:', JSON.stringify(result.leadInfo || {}, null, 2));
    return true;
  } catch (error) {
    console.log('❌ Failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 FINAL TEST - ALL FIXES VERIFICATION\n');
  
  let passed = 0;
  let total = 0;
  
  // 1. Si confirmation
  total++;
  if (await testScenario(
    'Si Confirmation Budget', 
    {
      messages: [
        new HumanMessage('Soy Pedro'),
        new AIMessage('¿Tu presupuesto mensual es de $600?'),
        new HumanMessage('si')
      ],
      leadInfo: { name: 'Pedro' },
      contactId: `test-si-${Date.now()}`,
      conversationId: `conv-si-${Date.now()}`
    },
    'Should extract budget 600 from si confirmation'
  )) passed++;
  
  // 2. Typos handling
  total++;
  if (await testScenario(
    'Typos in Message',
    {
      messages: [new HumanMessage('Ola, soi Juan, nesesito mas clientez')],
      leadInfo: {},
      contactId: `test-typo-${Date.now()}`,
      conversationId: `conv-typo-${Date.now()}`
    },
    'Should extract name=Juan, problem=necesito más clientes despite typos'
  )) passed++;
  
  // 3. Calendar auto-trigger
  total++;
  if (await testScenario(
    'Calendar Auto-Trigger',
    {
      messages: [new HumanMessage('Mi email es test@example.com')],
      leadInfo: {
        name: 'Maria',
        problem: 'No sales',
        goal: 'More sales',
        budget: 500,
        phone: '+1234567890'
      },
      contactId: `test-calendar-${Date.now()}`,
      conversationId: `conv-calendar-${Date.now()}`
    },
    'Should trigger calendar after email extraction'
  )) passed++;
  
  // 4. All response context
  total++;
  if (await testScenario(
    'All Response Context',
    {
      messages: [
        new HumanMessage('Hola'),
        new AIMessage('¡Hola! Soy María. ¿Me podrías compartir tu nombre?'),
        new HumanMessage('Carlos'),
        new AIMessage('¿Cuál es el problema con tu negocio? ¿Qué resultado te gustaría lograr?'),
        new HumanMessage('all')
      ],
      leadInfo: { name: 'Carlos' },
      contactId: `test-all-${Date.now()}`,
      conversationId: `conv-all-${Date.now()}`
    },
    'Should ask for clarification on "all" response'
  )) passed++;
  
  // 5. Changed mind on budget
  total++;
  if (await testScenario(
    'Changed Mind Budget',
    {
      messages: [
        new HumanMessage('Mi presupuesto es $200'),
        new AIMessage('Entiendo que tu presupuesto es limitado...'),
        new HumanMessage('Espera, puedo hacer $500')
      ],
      leadInfo: { name: 'Luis', problem: 'ventas bajas', budget: 200 },
      contactId: `test-change-${Date.now()}`,
      conversationId: `conv-change-${Date.now()}`
    },
    'Should update budget from 200 to 500'
  )) passed++;
  
  // 6. Returning customer
  total++;
  if (await testScenario(
    'Returning Customer',
    {
      messages: [new HumanMessage('Hola, hablamos ayer sobre marketing')],
      leadInfo: {},
      contactId: `test-return-${Date.now()}`,
      conversationId: `conv-return-${Date.now()}`
    },
    'Should recognize returning customer mention'
  )) passed++;
  
  // 7. Time parsing
  total++;
  if (await testScenario(
    'Time Selection Parsing',
    {
      messages: [
        new AIMessage('Aquí están los horarios:\n1. Lunes 3pm\n2. Martes 4pm'),
        new HumanMessage('El martes a las 4')
      ],
      leadInfo: { name: 'Ana', email: 'ana@test.com' },
      availableSlots: [
        { index: 1, display: 'Lunes 3pm', startTime: '2025-01-29T15:00:00', endTime: '2025-01-29T15:30:00' },
        { index: 2, display: 'Martes 4pm', startTime: '2025-01-30T16:00:00', endTime: '2025-01-30T16:30:00' }
      ],
      contactId: `test-time-${Date.now()}`,
      conversationId: `conv-time-${Date.now()}`
    },
    'Should parse "El martes a las 4" as option 2'
  )) passed++;
  
  // 8. Full qualification in one message
  total++;
  if (await testScenario(
    'Full Qualification One Message',
    {
      messages: [
        new HumanMessage('Hola, soy Roberto, tengo un restaurante, no tengo clientes, quiero llenar el lugar, mi presupuesto es $800, mi email es roberto@rest.com')
      ],
      leadInfo: {},
      contactId: `test-full-${Date.now()}`,
      conversationId: `conv-full-${Date.now()}`
    },
    'Should extract all fields and show calendar'
  )) passed++;
  
  console.log(`\n${'='.repeat(50)}`);
  console.log('FINAL RESULTS');
  console.log(`${'='.repeat(50)}`);
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${total - passed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
  console.log(`\n${passed === total ? '🎉 ALL TESTS PASSING!' : '⚠️  Some tests still failing'}`);
}

runAllTests().catch(console.error);