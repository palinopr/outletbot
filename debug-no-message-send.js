#!/usr/bin/env node
/**
 * Debug why simple messages don't trigger sendGHLMessage
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

async function debugSimpleMessage() {
  console.log('🔍 Debugging Simple Message Flow\n');
  
  const state = {
    messages: [new HumanMessage('Hola')],
    leadInfo: {},
    contactId: 'ym8G7K6GSzm8dJDZ6BNo',
    conversationId: 'nrVkJFN5Zi0I3vRQx1pO'
  };
  
  console.log('Initial state:', JSON.stringify({
    ...state,
    messages: state.messages.map(m => ({ role: m._getType(), content: m.content }))
  }, null, 2));
  
  try {
    console.log('\n🚀 Invoking sales agent...');
    const result = await salesAgent.invoke(state, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        contactId: state.contactId,
        thread_id: `debug-${Date.now()}`
      },
      recursionLimit: 10
    });
    
    console.log('\n📊 Result analysis:');
    console.log('Total messages:', result.messages?.length);
    
    // Look for tool calls
    const toolCalls = [];
    result.messages?.forEach((msg, idx) => {
      if (msg.tool_calls?.length > 0) {
        msg.tool_calls.forEach(tc => {
          toolCalls.push({
            messageIndex: idx,
            toolName: tc.function?.name || tc.name,
            args: tc.function?.arguments || tc.args
          });
        });
      }
    });
    
    console.log('\n🔧 Tool calls found:', toolCalls.length);
    toolCalls.forEach((tc, idx) => {
      console.log(`\nTool call ${idx + 1}:`);
      console.log(`  Message index: ${tc.messageIndex}`);
      console.log(`  Tool: ${tc.toolName}`);
      console.log(`  Args: ${tc.args}`);
    });
    
    // Check if send_ghl_message was called
    const sendMessageCalls = toolCalls.filter(tc => tc.toolName === 'send_ghl_message');
    
    if (sendMessageCalls.length === 0) {
      console.log('\n❌ No send_ghl_message calls found!');
      console.log('\nLooking for AI response messages...');
      
      result.messages?.forEach((msg, idx) => {
        if (msg._getType?.() === 'ai' && msg.content) {
          console.log(`\nAI Message ${idx}:`);
          console.log(`  Content: ${msg.content.substring(0, 100)}...`);
          console.log(`  Has tool calls: ${!!msg.tool_calls?.length}`);
        }
      });
    } else {
      console.log('\n✅ send_ghl_message was called!');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

async function debugWithConversationHistory() {
  console.log('\n\n' + '='.repeat(70));
  console.log('🔍 Debugging With Conversation History\n');
  
  // Simulate having some history
  const state = {
    messages: [
      new HumanMessage('Hola'),
      { 
        role: 'assistant', 
        content: '¡Hola! Soy María de Outlet Media. Me encantaría conocerte mejor. ¿Cuál es tu nombre?',
        _getType: () => 'ai'
      },
      new HumanMessage('Soy Juan')
    ],
    leadInfo: {},
    contactId: 'ym8G7K6GSzm8dJDZ6BNo',
    conversationId: 'nrVkJFN5Zi0I3vRQx1pO'
  };
  
  console.log('State with history:', {
    messageCount: state.messages.length,
    lastMessage: state.messages[state.messages.length - 1].content
  });
  
  try {
    console.log('\n🚀 Invoking sales agent...');
    const result = await salesAgent.invoke(state, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        contactId: state.contactId,
        thread_id: `debug-history-${Date.now()}`
      },
      recursionLimit: 10
    });
    
    // Check for new messages
    const newMessages = result.messages.slice(state.messages.length);
    console.log('\n📊 New messages added:', newMessages.length);
    
    // Look for tool calls in new messages
    const toolCalls = [];
    newMessages.forEach((msg, idx) => {
      if (msg.tool_calls?.length > 0) {
        msg.tool_calls.forEach(tc => {
          toolCalls.push(tc.function?.name || tc.name);
        });
      }
    });
    
    console.log('Tool calls in new messages:', toolCalls);
    
    const hasSendMessage = toolCalls.includes('send_ghl_message');
    console.log(`\n${hasSendMessage ? '✅' : '❌'} send_ghl_message ${hasSendMessage ? 'was' : 'was NOT'} called`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

async function runDebug() {
  await debugSimpleMessage();
  await debugWithConversationHistory();
  
  console.log('\n' + '='.repeat(70));
  console.log('DEBUG COMPLETE');
  console.log('Check LangSmith traces for detailed execution flow');
}

runDebug().catch(console.error);