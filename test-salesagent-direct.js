#!/usr/bin/env node
/**
 * Test sales agent directly to ensure it's working
 */

import { config as dotenvConfig } from 'dotenv';
import { salesAgent } from './agents/salesAgent.js';
import { HumanMessage } from '@langchain/core/messages';
import { GHLService } from './services/ghlService.js';

dotenvConfig();

const ghlService = new GHLService(
  process.env.GHL_API_KEY,  
  process.env.GHL_LOCATION_ID
);

async function testSalesAgent() {
  console.log('🧪 Testing Sales Agent Directly\n');
  
  const testCases = [
    {
      name: 'Simple Hola',
      state: {
        messages: [new HumanMessage('Hola')],
        leadInfo: {},
        contactId: 'test-direct-1',
        conversationId: 'conv-direct-1'
      }
    },
    {
      name: 'Name Introduction',
      state: {
        messages: [new HumanMessage('Soy Carlos')],
        leadInfo: {},
        contactId: 'test-direct-2',
        conversationId: 'conv-direct-2'
      }
    }
  ];
  
  for (const test of testCases) {
    console.log(`\nTesting: ${test.name}`);
    console.log('Input:', test.state.messages[0].content);
    
    try {
      const result = await salesAgent.invoke(test.state, {
        configurable: {
          ghlService,
          calendarId: process.env.GHL_CALENDAR_ID,
          contactId: test.state.contactId,
          thread_id: `direct-test-${Date.now()}`
        },
        recursionLimit: 10
      });
      
      console.log('✅ Success');
      console.log('Output messages:', result.messages?.length || 0);
      
      // Find AI messages with tool calls
      const aiMessages = result.messages?.filter(m => 
        m._getType?.() === 'ai' || 
        m.type === 'ai' || 
        m.constructor.name === 'AIMessage'
      ) || [];
      
      console.log('AI messages:', aiMessages.length);
      
      // Check for tool calls
      let toolCallCount = 0;
      aiMessages.forEach(msg => {
        if (msg.tool_calls?.length > 0) {
          toolCallCount += msg.tool_calls.length;
          msg.tool_calls.forEach(tc => {
            console.log(`  Tool: ${tc.function?.name || tc.name}`);
          });
        }
      });
      
      console.log('Total tool calls:', toolCallCount);
      
      // Check if response was generated
      const lastAi = aiMessages[aiMessages.length - 1];
      if (lastAi?.content) {
        console.log('Response:', lastAi.content.substring(0, 100) + '...');
      } else {
        console.log('❌ No response content generated');
      }
      
      console.log('Lead info:', JSON.stringify(result.leadInfo || {}, null, 2));
      
    } catch (error) {
      console.log('❌ Error:', error.message);
      console.log('Stack:', error.stack);
    }
  }
}

testSalesAgent().catch(console.error);