#!/usr/bin/env node
/**
 * Test the "all" response issue directly
 */

import { config as dotenvConfig } from 'dotenv';
import { salesAgent } from './agents/salesAgent.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { GHLService } from './services/ghlService.js';

// Load environment variables
dotenvConfig();

// Enable tracing
process.env.LANGSMITH_TRACING = 'true';
process.env.LANGSMITH_PROJECT = 'test-all-response';

async function testAllResponse() {
  console.log('Testing "all" response scenario...\n');
  
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );

  // Simulate conversation where user says "all"
  const messages = [
    new HumanMessage("Hola"),
    new AIMessage("¡Hola! Soy María de Outlet Media. ¿Me podrías compartir tu nombre?"),
    new HumanMessage("Mi nombre es Carlos"),
    new AIMessage("Mucho gusto Carlos. ¿En qué puedo ayudarte hoy? ¿Cuál es el principal problema que tienes con tu negocio?"),
    new HumanMessage("all")
  ];

  const state = {
    messages,
    leadInfo: { name: "Carlos", phone: "+1234567890" },
    contactId: `test-all-${Date.now()}`,
    conversationId: `conv-all-${Date.now()}`
  };

  console.log('Initial state:');
  console.log('- Messages:', messages.length);
  console.log('- Lead info:', state.leadInfo);
  console.log('- Last message:', messages[messages.length - 1].content);
  console.log('\nInvoking sales agent...\n');

  try {
    const result = await salesAgent.invoke(state, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        contactId: state.contactId,
        thread_id: `test-all-${Date.now()}`
      }
    });

    console.log('\n=== RESULTS ===');
    console.log('Success: true');
    console.log('Messages returned:', result.messages?.length || 0);
    
    // Find the last AI message
    const lastAiMessage = result.messages?.filter(m => 
      m._getType?.() === 'ai' || m.type === 'ai'
    ).pop();
    
    if (lastAiMessage) {
      console.log('\nAgent response:', lastAiMessage.content);
    }
    
    console.log('\nLead info updated:', JSON.stringify(result.leadInfo, null, 2));
    
    // Check if any fields were extracted from "all"
    const fieldsExtracted = Object.keys(result.leadInfo || {}).filter(
      key => result.leadInfo[key] && !state.leadInfo[key]
    );
    
    console.log('\nFields extracted from "all":', fieldsExtracted.length > 0 ? fieldsExtracted : 'NONE');
    
    // Get LangSmith trace URL
    console.log('\nCheck trace at: https://smith.langchain.com');
    
  } catch (error) {
    console.error('\nError:', error.message);
    console.error(error.stack);
  }
}

// Test with variations of "all"
async function testVariations() {
  const variations = [
    "all",
    "All",
    "ALL",
    "todo",
    "Todo",
    "si todo",
    "si, todo eso",
    "toda la información"
  ];
  
  console.log('\n\nTesting variations of "all"...\n');
  
  for (const variation of variations) {
    console.log(`\nTesting: "${variation}"`);
    
    const messages = [
      new HumanMessage("Hola, necesito ayuda"),
      new AIMessage("¡Hola! ¿Me podrías compartir tu nombre?"),
      new HumanMessage(variation)
    ];
    
    try {
      const ghlService = new GHLService(
        process.env.GHL_API_KEY,
        process.env.GHL_LOCATION_ID
      );
      
      const result = await salesAgent.invoke({
        messages,
        leadInfo: {},
        contactId: `test-${Date.now()}`,
        conversationId: `conv-${Date.now()}`
      }, {
        configurable: {
          ghlService,
          calendarId: process.env.GHL_CALENDAR_ID,
          contactId: `test-${Date.now()}`
        }
      });
      
      const extracted = Object.keys(result.leadInfo || {}).filter(k => result.leadInfo[k]);
      console.log(`Fields extracted: ${extracted.length > 0 ? extracted.join(', ') : 'NONE'}`);
      
    } catch (error) {
      console.log(`Error: ${error.message}`);
    }
    
    // Small delay between tests
    await new Promise(r => setTimeout(r, 1000));
  }
}

// Run tests
async function main() {
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('LangSmith Project:', process.env.LANGSMITH_PROJECT);
  console.log('LangSmith Tracing:', process.env.LANGSMITH_TRACING);
  console.log('\n' + '='.repeat(60) + '\n');
  
  await testAllResponse();
  await testVariations();
  
  console.log('\n✅ Tests completed!');
}

main();