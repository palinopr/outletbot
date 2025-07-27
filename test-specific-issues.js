#!/usr/bin/env node
/**
 * Test specific issues found in comprehensive test
 */

import { config as dotenvConfig } from 'dotenv';
import { salesAgent } from './agents/salesAgent.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { GHLService } from './services/ghlService.js';

dotenvConfig();

// Enable tracing
process.env.LANGSMITH_TRACING = 'true';
process.env.LANGSMITH_PROJECT = 'specific-issues-test';

async function testSpecificIssue(name, state, expectedBehavior) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Testing: ${name}`);
  console.log(`Expected: ${expectedBehavior}`);
  console.log(`${'='.repeat(50)}`);
  
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );

  try {
    const result = await salesAgent.invoke(state, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        contactId: state.contactId,
        thread_id: `test-${Date.now()}`
      }
    });

    // Get last AI message
    const lastAi = result.messages?.filter(m => 
      m._getType?.() === 'ai' || m.type === 'ai'
    ).pop();
    
    console.log('\nBot response:', lastAi?.content || 'No response');
    console.log('\nExtracted fields:', result.leadInfo);
    console.log('Tool calls:', lastAi?.tool_calls?.map(tc => tc.name) || []);
    
    return result;
    
  } catch (error) {
    console.error('Error:', error.message);
    return null;
  }
}

async function runTests() {
  console.log('🔍 Testing Specific Issues Found in Comprehensive Test\n');
  
  // Test 1: Bot Introduction
  await testSpecificIssue(
    'Bot Introduction Check',
    {
      messages: [new HumanMessage('Hola')],
      leadInfo: {},
      contactId: 'test-intro-' + Date.now(),
      conversationId: 'conv-intro-' + Date.now()
    },
    'Bot should say "Soy María" and ask for name'
  );
  
  // Test 2: "All" Response Context
  await testSpecificIssue(
    '"All" Response with Context',
    {
      messages: [
        new HumanMessage('Hola'),
        new AIMessage('¡Hola! Soy María. ¿Me podrías compartir tu nombre?'),
        new HumanMessage('Carlos'),
        new AIMessage('Mucho gusto Carlos. ¿Cuál es el principal problema con tu negocio? ¿Qué resultado te gustaría lograr?'),
        new HumanMessage('all')
      ],
      leadInfo: { name: 'Carlos' },
      contactId: 'test-all-' + Date.now(),
      conversationId: 'conv-all-' + Date.now()
    },
    'Bot should understand "all" refers to previous questions'
  );
  
  // Test 3: Calendar Display Trigger
  await testSpecificIssue(
    'Calendar Display with All Fields',
    {
      messages: [
        new HumanMessage('Mi email es test@example.com')
      ],
      leadInfo: {
        name: 'Test User',
        problem: 'No sales',
        goal: 'More sales',
        budget: '$500',
        phone: '+1234567890'
      },
      contactId: 'test-calendar-' + Date.now(),
      conversationId: 'conv-calendar-' + Date.now()
    },
    'Bot should call getCalendarSlots and show availability'
  );
  
  // Test 4: Yes Confirmation
  await testSpecificIssue(
    'Yes Confirmation for Budget',
    {
      messages: [
        new HumanMessage('Soy Juan'),
        new AIMessage('Mucho gusto Juan. ¿Tu presupuesto mensual es de $500?'),
        new HumanMessage('si')
      ],
      leadInfo: { name: 'Juan' },
      contactId: 'test-yes-' + Date.now(),
      conversationId: 'conv-yes-' + Date.now()
    },
    'Bot should extract budget: $500 from confirmation'
  );
  
  // Test 5: Direct Tool Call Check
  console.log('\n\n📊 DIRECT TOOL ANALYSIS');
  console.log('Checking if tools are properly configured...\n');
  
  // Check salesAgent configuration
  console.log('Sales Agent Tools:', Object.keys(salesAgent.nodes || {}));
  
  console.log('\n✅ Tests completed!');
  console.log('Check traces at: https://smith.langchain.com');
}

runTests().catch(console.error);