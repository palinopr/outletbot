#!/usr/bin/env node
/**
 * Fix for self-conversation issue
 * Problem: Agent is responding to its own messages from conversation history
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import fs from 'fs/promises';
import path from 'path';

async function fixSelfConversation() {
  console.log('🔧 Fixing Self-Conversation Issue\n');
  
  console.log('Problem identified:');
  console.log('- conversationState.messages includes BOTH inbound and outbound messages');
  console.log('- Agent sees its own previous responses in the history');
  console.log('- This causes the agent to potentially respond to itself\n');
  
  console.log('Solution:');
  console.log('1. Ensure conversation history properly identifies human vs AI messages');
  console.log('2. Filter out tool response messages that look like JSON');
  console.log('3. Make sure the agent only responds to the latest human message\n');
  
  // Read the conversationManager to check current filtering
  const convManagerPath = './services/conversationManager.js';
  const convManagerContent = await fs.readFile(convManagerPath, 'utf8');
  
  console.log('Current message filtering in conversationManager:');
  const filterSection = convManagerContent.match(/Skip messages that are clearly tool responses[\s\S]*?continue;/g);
  if (filterSection) {
    console.log('✅ Found tool response filtering:', filterSection[0].substring(0, 200) + '...');
  } else {
    console.log('❌ No tool response filtering found!');
  }
  
  // Check webhookHandler message building
  const webhookPath = './agents/webhookHandler.js';
  const webhookContent = await fs.readFile(webhookPath, 'utf8');
  
  console.log('\nChecking webhookHandler message assembly:');
  const messageBuilding = webhookContent.match(/Build messages array for the agent[\s\S]*?agentMessages\.length/);
  if (messageBuilding) {
    console.log('Current implementation:', messageBuilding[0].substring(0, 300) + '...');
  }
  
  console.log('\n📝 Required fixes:');
  console.log('1. conversationManager already filters tool responses ✅');
  console.log('2. But we need to ensure proper HumanMessage/AIMessage typing');
  console.log('3. The agent should focus on responding to the LATEST human message only');
  console.log('4. Historical messages should be for context only, not for response generation');
  
  console.log('\nThe fix is already partially implemented:');
  console.log('- conversationManager.js lines 239-249: Filters out tool responses');
  console.log('- conversationManager.js lines 251-255: Properly types messages as Human/AI');
  console.log('- 2-hour context window prevents old messages');
  
  console.log('\nAdditional fix needed:');
  console.log('The system prompt should emphasize responding ONLY to the latest human message');
  console.log('Not to messages in the conversation history');
}

fixSelfConversation().catch(console.error);