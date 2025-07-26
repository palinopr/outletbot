#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

// Trace tool calls in the agent
import { graph } from './agents/salesAgent.js';
import { GHLService } from './services/ghlService.js';

const ghlService = new GHLService(process.env.GHL_API_KEY, process.env.GHL_LOCATION_ID);

// Create simple test messages
const messages = [
  { role: 'human', content: 'Hola' },
  { role: 'assistant', content: 'Hola! ¿Cómo te llamas?' },
  { role: 'human', content: 'Soy Carlos' }
];

console.log('Testing with simple messages...\n');

try {
  const result = await graph.invoke({
    messages: messages,
    leadInfo: {},
    contactId: '54sJIGTtwmR89Qc5JeEt',
    conversationId: 'test'
  }, {
    configurable: {
      ghlService,
      calendarId: process.env.GHL_CALENDAR_ID,
      contactId: '54sJIGTtwmR89Qc5JeEt'
    },
    runId: crypto.randomUUID(),
    // Add callback to trace tool calls
    callbacks: [{
      handleLLMEnd: (output) => {
        console.log('\n🤖 LLM Output:');
        const message = output.generations?.[0]?.[0]?.message;
        if (message) {
          console.log('- Content:', message.content?.substring(0, 100));
          console.log('- Tool calls:', message.tool_calls);
        }
      },
      handleToolStart: (tool, input) => {
        console.log('\n🔧 Tool Start:', tool.name);
        console.log('- Input:', input);
      },
      handleToolEnd: (output) => {
        console.log('\n✅ Tool End:');
        console.log('- Output:', output);
      },
      handleToolError: (error) => {
        console.log('\n❌ Tool Error:', error.message);
      }
    }]
  });
  
  console.log('\n✅ SUCCESS! Final messages:', result.messages.length);
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  if (error.message.includes('tool_calls')) {
    console.error('\nThis is the tool_calls error!');
    console.error('The issue is that tools are returning Command objects instead of plain values.');
  }
}