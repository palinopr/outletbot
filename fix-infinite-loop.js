#!/usr/bin/env node
/**
 * Test fix for infinite loop issue
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

async function testInfiniteLoopFix() {
  console.log('🔍 Testing Infinite Loop Fix\n');
  
  // Create a state with ALL info already collected
  const state = {
    messages: [
      new HumanMessage('Hola'),
      { role: 'assistant', content: 'greeting', tool_calls: [{function: {name: 'send_ghl_message', arguments: '{"message":"¡Hola! Soy María"}'}}] },
      new HumanMessage('Juan'),
      { role: 'assistant', content: 'got name', tool_calls: [{function: {name: 'extract_lead_info', arguments: '{"message":"Juan"}'}}] },
      new HumanMessage('tengo problemas con ventas'),
      { role: 'assistant', content: 'got problem', tool_calls: [{function: {name: 'extract_lead_info', arguments: '{"message":"tengo problemas con ventas"}'}}] },
      new HumanMessage('quiero vender más'),
      { role: 'assistant', content: 'got goal', tool_calls: [{function: {name: 'extract_lead_info', arguments: '{"message":"quiero vender más"}'}}] },
      new HumanMessage('500 dolares'),
      { role: 'assistant', content: 'got budget', tool_calls: [{function: {name: 'extract_lead_info', arguments: '{"message":"500 dolares"}'}}] },
      new HumanMessage('juan@test.com')
    ],
    leadInfo: {
      name: 'Juan',
      problem: 'problemas con ventas',
      goal: 'vender más',
      budget: 500,
      email: 'juan@test.com'
    },
    contactId: 'test-fix-' + Date.now(),
    conversationId: 'conv-fix-' + Date.now(),
    allFieldsCollected: true
  };

  console.log('📋 Starting with complete lead info:');
  console.log(JSON.stringify(state.leadInfo, null, 2));
  console.log('\nAll fields collected:', state.allFieldsCollected);
  
  try {
    console.log('\n🚀 Invoking agent with all info already collected...\n');
    
    const result = await salesAgent.invoke(state, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        contactId: state.contactId,
        thread_id: `fix-test-${Date.now()}`
      },
      recursionLimit: 10
    });
    
    // Check what happened
    const newMessages = result.messages.slice(state.messages.length);
    console.log(`\n📊 New messages added: ${newMessages.length}`);
    
    // Look for tool calls
    const toolCalls = [];
    newMessages.forEach(msg => {
      if (msg.tool_calls?.length > 0) {
        msg.tool_calls.forEach(tc => {
          const name = tc.function?.name || tc.name;
          toolCalls.push(name);
          console.log(`\n🔧 Tool called: ${name}`);
          
          if (name === 'send_ghl_message') {
            const args = JSON.parse(tc.function?.arguments || tc.args || '{}');
            console.log(`   Message: "${args.message?.substring(0, 80)}..."`);
          }
        });
      }
    });
    
    // Check if calendar was shown
    const calendarShown = toolCalls.includes('get_calendar_slots');
    const messagesSent = toolCalls.filter(t => t === 'send_ghl_message').length;
    
    console.log('\n📈 Results:');
    console.log(`Calendar shown: ${calendarShown ? '✅' : '❌'}`);
    console.log(`Messages sent: ${messagesSent}`);
    console.log(`Calendar shown state: ${result.calendarShown || false}`);
    
    if (!calendarShown && state.leadInfo.budget >= 300) {
      console.log('\n❌ BUG CONFIRMED: Has all info but calendar not shown!');
      
      // Check what questions were asked
      newMessages.forEach(msg => {
        if (msg.tool_calls?.some(tc => tc.function?.name === 'send_ghl_message')) {
          const tc = msg.tool_calls.find(tc => tc.function?.name === 'send_ghl_message');
          const args = JSON.parse(tc.function.arguments);
          const message = args.message.toLowerCase();
          
          if (message.includes('problema')) {
            console.log('❌ Asked for problem again!');
          }
          if (message.includes('objetivo')) {
            console.log('❌ Asked for goal again!');
          }
          if (message.includes('presupuesto')) {
            console.log('❌ Asked for budget again!');
          }
          if (message.includes('correo')) {
            console.log('❌ Asked for email again!');
          }
        }
      });
    } else if (calendarShown) {
      console.log('\n✅ Fix working! Calendar shown when all info present.');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

process.env.SKIP_ENV_VALIDATION = 'true';
testInfiniteLoopFix().catch(console.error);