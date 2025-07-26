#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

// Debug the message structure causing OpenAI errors
import { GHLService } from './services/ghlService.js';
import ConversationManager from './services/conversationManager.js';

const ghlService = new GHLService(process.env.GHL_API_KEY, process.env.GHL_LOCATION_ID);
const conversationManager = new ConversationManager(ghlService);

const contactId = '54sJIGTtwmR89Qc5JeEt';

// Get conversation state
const conversationState = await conversationManager.getConversationState(contactId, null, '+13054870475');

console.log('Total messages:', conversationState.messages.length);
console.log('\nAnalyzing message structure:\n');

// Check each message for problematic patterns
conversationState.messages.forEach((msg, index) => {
  console.log(`Message ${index + 1}:`);
  console.log('- Type:', msg.constructor.name);
  console.log('- Role:', msg.role || msg._getType());
  console.log('- Content:', msg.content?.substring(0, 50) + '...');
  
  // Check for tool calls
  if (msg.tool_calls && msg.tool_calls.length > 0) {
    console.log('- Tool calls:', msg.tool_calls.map(tc => ({
      id: tc.id,
      name: tc.function?.name
    })));
  }
  
  // Check for tool response
  if (msg.tool_call_id) {
    console.log('- Tool response for:', msg.tool_call_id);
  }
  
  // Additional properties
  if (msg.additional_kwargs) {
    console.log('- Additional kwargs:', Object.keys(msg.additional_kwargs));
  }
  
  console.log('');
});

// Find orphaned tool calls
console.log('\nChecking for orphaned tool calls:');
for (let i = 0; i < conversationState.messages.length; i++) {
  const msg = conversationState.messages[i];
  
  if (msg.tool_calls && msg.tool_calls.length > 0) {
    const nextMsg = conversationState.messages[i + 1];
    
    if (!nextMsg || !nextMsg.tool_call_id) {
      console.log(`❌ ORPHANED TOOL CALL at index ${i}:`);
      console.log('  - Message:', msg.content?.substring(0, 50));
      console.log('  - Tool calls:', msg.tool_calls.map(tc => tc.id));
      
      // Check if any subsequent message has the tool response
      let foundResponse = false;
      for (let j = i + 1; j < conversationState.messages.length; j++) {
        if (conversationState.messages[j].tool_call_id) {
          console.log(`  - Found response at index ${j} (${j - i} messages later)`);
          foundResponse = true;
          break;
        }
      }
      
      if (!foundResponse) {
        console.log('  - NO RESPONSE FOUND - This is the problem!');
      }
    }
  }
}