#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

// Debug why webhook returns error after successful processing
console.log('Testing webhook result handling...\n');

import { salesAgentInvoke } from './agents/salesAgent.js';
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
  console.log('\nInvoking sales agent...');
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
    runId: 'debug-' + Date.now()
  });
  
  console.log('\n✅ Result received:');
  console.log('- Type:', typeof result);
  console.log('- Keys:', Object.keys(result));
  console.log('- Messages:', result.messages?.length);
  console.log('- Last message:', result.messages?.[result.messages.length - 1]);
  console.log('- Appointment booked:', result.appointmentBooked);
  console.log('- Lead info:', result.leadInfo);
  
  // Check if result structure matches what webhook expects
  if (!result || !result.messages) {
    console.error('\n❌ ERROR: Result structure invalid!');
    console.error('Expected: { messages: [...], leadInfo: {...} }');
    console.error('Got:', result);
  }
  
} catch (error) {
  console.error('\n❌ Error in salesAgentInvoke:', error.message);
  console.error('Stack:', error.stack);
}