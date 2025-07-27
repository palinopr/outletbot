#!/usr/bin/env node
/**
 * Simple Sales Agent Tester
 * Direct testing of the sales agent with specific scenarios
 */

import { config as dotenvConfig } from 'dotenv';
import { salesAgent } from './agents/salesAgent.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { GHLService } from './services/ghlService.js';
import { Logger } from './services/logger.js';

// Load environment variables
dotenvConfig();

const logger = new Logger('SalesAgentTester');

async function testSalesAgent() {
  // Initialize GHL service
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );

  // Test scenarios
  const scenarios = [
    {
      name: "All information in one message",
      messages: [
        "Hola, mi nombre es Juan García. Tengo un problema con mi sitio web que no aparece en Google. Mi objetivo es conseguir más clientes. Mi presupuesto es de $500 al mes y mi email es juan@example.com"
      ]
    },
    {
      name: "Information spread across messages",
      messages: [
        "Hola",
        "Mi nombre es María López",
        "Necesito ayuda con marketing digital",
        "Quiero aumentar mis ventas online",
        "Puedo invertir $400 mensuales",
        "Mi correo es maria@test.com"
      ]
    },
    {
      name: "Testing 'all' response",
      messages: [
        "Hola",
        "Soy Carlos",
        "all"
      ]
    }
  ];

  for (const scenario of scenarios) {
    console.log('\n' + '='.repeat(80));
    console.log(`SCENARIO: ${scenario.name}`);
    console.log('='.repeat(80) + '\n');

    const messages = [];
    let state = {
      messages: [],
      leadInfo: {},
      contactId: `test-${Date.now()}`,
      conversationId: `conv-${Date.now()}`
    };

    for (const message of scenario.messages) {
      console.log(`\n👤 USER: ${message}`);
      
      // Add user message
      messages.push(new HumanMessage(message));
      state.messages = messages;

      try {
        // Invoke sales agent
        const result = await salesAgent.invoke(state, {
          configurable: {
            ghlService,
            calendarId: process.env.GHL_CALENDAR_ID,
            contactId: state.contactId,
            thread_id: `test-${scenario.name}-${Date.now()}`
          }
        });

        // Get the last AI message
        const lastMessage = result.messages[result.messages.length - 1];
        if (lastMessage && lastMessage._getType() === 'ai') {
          console.log(`\n🤖 AGENT: ${lastMessage.content}`);
          messages.push(lastMessage);
        }

        // Update state with results
        state = {
          ...state,
          ...result,
          messages
        };

        // Show extracted fields
        if (result.leadInfo && Object.keys(result.leadInfo).length > 0) {
          console.log('\n📋 Extracted Fields:');
          console.log(JSON.stringify(result.leadInfo, null, 2));
        }

      } catch (error) {
        console.error(`\n❌ ERROR: ${error.message}`);
        logger.error('Agent invocation failed', { 
          error: error.message,
          stack: error.stack 
        });
      }

      // Small delay between messages
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n📊 Final Lead Info:');
    console.log(JSON.stringify(state.leadInfo || {}, null, 2));
  }
}

// Run the test
async function main() {
  try {
    console.log('🚀 Starting Sales Agent Tests...\n');
    console.log('Environment:', process.env.NODE_ENV || 'development');
    console.log('LangSmith Project:', process.env.LANGSMITH_PROJECT || 'default');
    console.log('LangSmith Tracing:', process.env.LANGSMITH_TRACING || 'false');
    
    await testSalesAgent();
    
    console.log('\n✅ Tests completed!');
    console.log('\nCheck LangSmith for traces: https://smith.langchain.com');
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}