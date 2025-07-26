#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

// Test the fixed sales agent
console.log('Testing fixed sales agent...\n');

import { salesAgentInvoke } from './agents/salesAgentFixed.js';
import { GHLService } from './services/ghlService.js';
import ConversationManager from './services/conversationManager.js';

const ghlService = new GHLService(process.env.GHL_API_KEY, process.env.GHL_LOCATION_ID);
const conversationManager = new ConversationManager(ghlService);

const contactId = '54sJIGTtwmR89Qc5JeEt';

// Get conversation state
const conversationState = await conversationManager.getConversationState(contactId, null, '+13054870475');

console.log('Conversation state:', {
  messageCount: conversationState.messages.length,
  leadName: conversationState.leadName,
  leadBudget: conversationState.leadBudget
});

// Create messages array like webhook does
const agentMessages = [
  ...conversationState.messages,
  { role: 'human', content: 'Hola, soy Carlos' }
];

try {
  console.log('\nInvoking fixed sales agent...');
  const result = await salesAgentInvoke({
    messages: agentMessages,
    leadInfo: {
      name: conversationState.leadName,
      problem: conversationState.leadProblem,
      goal: conversationState.leadGoal,
      budget: conversationState.leadBudget,
      email: conversationState.leadEmail,
      phone: '+13054870475'
    },
    contactId,
    conversationId: conversationState.conversationId
  }, {
    configurable: {
      ghlService,
      calendarId: process.env.GHL_CALENDAR_ID,
      contactId
    },
    runId: crypto.randomUUID()
  });
  
  console.log('\n✅ SUCCESS! Agent completed without errors');
  console.log('- Messages:', result.messages?.length);
  console.log('- Last message:', result.messages?.[result.messages.length - 1]?.content?.substring(0, 100));
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  if (error.message.includes('tool_calls')) {
    console.error('\nThis is the tool_calls error we need to fix!');
  }
}