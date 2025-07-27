#!/usr/bin/env node
/**
 * Test the exact Juan scenario to ensure no duplicate questions
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import { salesAgent } from './agents/salesAgent.js';
import { HumanMessage } from '@langchain/core/messages';
import { GHLService } from './services/ghlService.js';

const ghlService = new GHLService(
  process.env.GHL_API_KEY,
  process.env.GHL_LOCATION_ID
);

async function testJuanScenario() {
  console.log('🧪 Testing Juan Scenario - No Duplicate Questions\n');
  
  let state = {
    messages: [],
    leadInfo: {},
    contactId: 'test-juan-' + Date.now(),
    conversationId: 'conv-juan-' + Date.now()
  };

  // Juan's exact messages
  const juanMessages = [
    'Hola',
    'Juan', 
    'tengo dificultades para atraer clientes a mi tienda',
    'aumentar mis ventas en un 20% para el próximo trimestre',
    '500',
    'juan@ejemplo.com'
  ];

  const expectedQuestions = {
    name: false,
    problem: false,
    goal: false,
    budget: false,
    email: false
  };

  let duplicateQuestions = [];
  let calendarShown = false;

  for (let i = 0; i < juanMessages.length; i++) {
    const userMessage = juanMessages[i];
    console.log(`\n👤 JUAN: ${userMessage}`);
    
    // Add user message
    state.messages.push(new HumanMessage(userMessage));
    
    try {
      // Invoke agent
      const result = await salesAgent.invoke(state, {
        configurable: {
          ghlService,
          calendarId: process.env.GHL_CALENDAR_ID,
          contactId: state.contactId,
          thread_id: `juan-test-${Date.now()}`
        },
        recursionLimit: 15
      });
      
      // Update state
      state = result;
      
      // Analyze what the agent did
      const newMessages = result.messages.slice(state.messages.length - juanMessages.length);
      
      // Look for messages sent
      for (const msg of newMessages) {
        if (msg.tool_calls?.length > 0) {
          for (const tc of msg.tool_calls) {
            if (tc.function?.name === 'send_ghl_message') {
              const args = JSON.parse(tc.function.arguments);
              const message = args.message;
              console.log(`\n🤖 MARÍA: ${message}`);
              
              // Check for duplicate questions
              const lowerMessage = message.toLowerCase();
              if (lowerMessage.includes('nombre') && expectedQuestions.name) {
                duplicateQuestions.push('Asked for name again!');
              } else if (lowerMessage.includes('nombre')) {
                expectedQuestions.name = true;
              }
              
              if ((lowerMessage.includes('problema') || lowerMessage.includes('enfrentando')) && expectedQuestions.problem) {
                duplicateQuestions.push('Asked for problem again!');
              } else if (lowerMessage.includes('problema') || lowerMessage.includes('enfrentando')) {
                expectedQuestions.problem = true;
              }
              
              if ((lowerMessage.includes('objetivo') || lowerMessage.includes('alcanzar')) && expectedQuestions.goal) {
                duplicateQuestions.push('Asked for goal again!');
              } else if (lowerMessage.includes('objetivo') || lowerMessage.includes('alcanzar')) {
                expectedQuestions.goal = true;
              }
              
              if (lowerMessage.includes('presupuesto') && expectedQuestions.budget) {
                duplicateQuestions.push('Asked for budget again!');
              } else if (lowerMessage.includes('presupuesto')) {
                expectedQuestions.budget = true;
              }
              
              if ((lowerMessage.includes('correo') || lowerMessage.includes('email')) && expectedQuestions.email) {
                duplicateQuestions.push('Asked for email again!');
              } else if (lowerMessage.includes('correo') || lowerMessage.includes('email')) {
                expectedQuestions.email = true;
              }
            }
            
            if (tc.function?.name === 'get_calendar_slots') {
              calendarShown = true;
              console.log('\n📅 CALENDAR SLOTS REQUESTED!');
            }
          }
        }
      }
      
      // Log current lead info
      console.log('\n📋 Current Lead Info:', JSON.stringify(result.leadInfo || {}, null, 2));
      
    } catch (error) {
      console.error('\n❌ Error:', error.message);
      break;
    }
  }

  // Final analysis
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 FINAL ANALYSIS');
  console.log('='.repeat(70));
  
  console.log('\nLead Info Collected:');
  console.log(JSON.stringify(state.leadInfo || {}, null, 2));
  
  console.log('\nQuestions Asked:');
  Object.entries(expectedQuestions).forEach(([field, asked]) => {
    console.log(`  ${field}: ${asked ? '✅' : '❌'}`);
  });
  
  console.log(`\nCalendar Shown: ${calendarShown ? '✅' : '❌'}`);
  
  if (duplicateQuestions.length > 0) {
    console.log('\n❌ DUPLICATE QUESTIONS FOUND:');
    duplicateQuestions.forEach(q => console.log(`  - ${q}`));
  } else {
    console.log('\n✅ No duplicate questions!');
  }
  
  // Check if the bug is fixed
  const hasAllInfo = state.leadInfo?.name && 
                    state.leadInfo?.problem && 
                    state.leadInfo?.goal && 
                    state.leadInfo?.budget >= 300 && 
                    state.leadInfo?.email;
  
  if (hasAllInfo && !calendarShown) {
    console.log('\n❌ BUG STILL EXISTS: Has all info but calendar not shown!');
  } else if (hasAllInfo && calendarShown) {
    console.log('\n✅ BUG FIXED: Calendar shown when all info collected!');
  }
}

process.env.SKIP_ENV_VALIDATION = 'true';
testJuanScenario().catch(console.error);