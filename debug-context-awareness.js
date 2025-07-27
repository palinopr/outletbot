#!/usr/bin/env node
/**
 * Debug why agent re-asks for information already collected
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

async function simulateJuanConversation() {
  console.log('🔍 Simulating Juan\'s Conversation\n');
  
  // Start with empty state
  let state = {
    messages: [],
    leadInfo: {},
    contactId: 'test-juan-' + Date.now(),
    conversationId: 'conv-juan-' + Date.now()
  };

  // Messages from Juan's conversation
  const conversation = [
    { role: 'user', message: 'Hola' },
    { role: 'user', message: 'Juan' },
    { role: 'user', message: 'tengo dificultades para atraer clientes a mi tienda' },
    { role: 'user', message: 'aumentar mis ventas en un 20% para el próximo trimestre' },
    { role: 'user', message: '500' },
    { role: 'user', message: 'juan@ejemplo.com' }
  ];

  for (const turn of conversation) {
    console.log(`\n👤 JUAN: ${turn.message}`);
    
    // Add message to state
    state.messages.push(new HumanMessage(turn.message));
    
    // Log current lead info BEFORE invoking
    console.log('\n📋 Lead Info BEFORE invoke:');
    console.log(JSON.stringify(state.leadInfo, null, 2));
    
    try {
      // Invoke agent
      const result = await salesAgent.invoke(state, {
        configurable: {
          ghlService,
          calendarId: process.env.GHL_CALENDAR_ID,
          contactId: state.contactId,
          thread_id: `debug-juan-${Date.now()}`
        },
        recursionLimit: 20
      });
      
      // Update state
      state = result;
      
      // Log lead info AFTER invoke
      console.log('\n📋 Lead Info AFTER invoke:');
      console.log(JSON.stringify(state.leadInfo || {}, null, 2));
      
      // Check what was collected
      const hasAllFields = state.leadInfo?.name && 
                          state.leadInfo?.problem && 
                          state.leadInfo?.goal && 
                          state.leadInfo?.budget >= 300 && 
                          state.leadInfo?.email;
      
      console.log(`\n✅ All fields collected: ${hasAllFields}`);
      console.log(`Calendar shown: ${state.calendarShown || false}`);
      console.log(`All fields collected flag: ${state.allFieldsCollected || false}`);
      
      // Find AI responses
      const newMessages = result.messages.slice(state.messages.length - 1);
      const aiWithTools = newMessages.find(m => 
        m.tool_calls?.some(tc => tc.function?.name === 'send_ghl_message')
      );
      
      if (aiWithTools) {
        const sendCall = aiWithTools.tool_calls.find(tc => 
          tc.function?.name === 'send_ghl_message'
        );
        if (sendCall) {
          const args = JSON.parse(sendCall.function.arguments);
          console.log(`\n🤖 MARÍA: ${args.message}`);
        }
      }
      
      // Check for calendar tool call
      const calendarCalled = newMessages.some(m =>
        m.tool_calls?.some(tc => tc.function?.name === 'get_calendar_slots')
      );
      
      if (calendarCalled) {
        console.log('\n📅 CALENDAR SLOTS REQUESTED!');
      }
      
      if (hasAllFields && !calendarCalled) {
        console.log('\n❌ ERROR: Has all fields but calendar not shown!');
      }
      
    } catch (error) {
      console.error('\n❌ Error:', error.message);
      break;
    }
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n\n📊 FINAL ANALYSIS:');
  console.log('Lead Info:', JSON.stringify(state.leadInfo || {}, null, 2));
  console.log('Messages sent:', state.messages.length);
  
  // Check for duplicate questions
  const messages = state.messages.map(m => m.content || '');
  const problemQuestions = messages.filter(m => 
    m.includes('problema') || m.includes('enfrentando')
  );
  const goalQuestions = messages.filter(m => 
    m.includes('objetivo') || m.includes('alcanzar')
  );
  
  console.log(`\nProblem asked ${problemQuestions.length} times`);
  console.log(`Goal asked ${goalQuestions.length} times`);
  
  if (problemQuestions.length > 1 || goalQuestions.length > 1) {
    console.log('\n❌ DUPLICATE QUESTIONS DETECTED!');
  }
}

process.env.SKIP_ENV_VALIDATION = 'true';
simulateJuanConversation().catch(console.error);