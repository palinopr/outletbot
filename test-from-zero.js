#!/usr/bin/env node
/**
 * Test From Zero - Mimics a complete production conversation
 * Simulates exactly what happens in LangSmith/production
 */

import { config as dotenvConfig } from 'dotenv';
import { graph as webhookHandler } from './agents/webhookHandler.js';
import { HumanMessage } from '@langchain/core/messages';
import { Logger } from './services/logger.js';
import { Client } from 'langsmith/client';

// Load environment variables
dotenvConfig();

// Enable LangSmith tracing
process.env.LANGSMITH_TRACING = 'true';
process.env.LANGSMITH_PROJECT = process.env.LANGSMITH_PROJECT || 'Test From Zero';

const logger = new Logger('TestFromZero');

class ConversationSimulator {
  constructor() {
    this.langsmithClient = new Client({
      apiKey: process.env.LANGSMITH_API_KEY,
      apiUrl: process.env.LANGSMITH_ENDPOINT || "https://api.smith.langchain.com"
    });
    
    // Simulate a real contact/conversation
    this.contactId = 'test-contact-' + Date.now();
    this.conversationId = 'test-conv-' + Date.now();
    this.phone = '+1234567890';
  }

  /**
   * Send a message as if it came from GHL webhook
   */
  async sendMessage(message) {
    logger.info('📱 Simulating incoming message', { 
      message: message.substring(0, 50) + '...',
      contactId: this.contactId 
    });

    // Create webhook payload exactly like production
    const webhookPayload = {
      phone: this.phone,
      message: message,
      contactId: this.contactId,
      conversationId: this.conversationId,
      type: 'WhatsApp',
      timestamp: new Date().toISOString()
    };

    // Create initial state with webhook as message (like production)
    const state = {
      messages: [new HumanMessage(JSON.stringify(webhookPayload))],
      contactId: this.contactId,
      phone: this.phone
    };

    try {
      // Invoke webhook handler with full tracing
      const result = await webhookHandler.invoke(state, {
        configurable: {
          thread_id: this.conversationId,
          checkpoint_ns: 'test-from-zero'
        },
        metadata: {
          test_scenario: 'from_zero',
          message_content: message,
          simulation_time: new Date().toISOString()
        },
        tags: ['test-from-zero', 'simulation']
      });

      // Extract the AI response
      const aiResponse = this.extractAIResponse(result.messages);
      
      return {
        success: true,
        aiResponse,
        leadInfo: result.leadInfo,
        messages: result.messages
      };

    } catch (error) {
      logger.error('Message processing failed', { 
        error: error.message,
        stack: error.stack 
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract AI response from messages
   */
  extractAIResponse(messages) {
    // Find the last AI message
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg._getType && msg._getType() === 'ai') {
        return msg.content;
      }
      // Also check for type property
      if (msg.type === 'ai' || msg._type === 'ai') {
        return msg.content;
      }
    }
    return null;
  }

  /**
   * Run a complete conversation from zero
   */
  async runCompleteConversation() {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 STARTING CONVERSATION FROM ZERO');
    console.log('='.repeat(80));
    console.log(`Contact ID: ${this.contactId}`);
    console.log(`Conversation ID: ${this.conversationId}`);
    console.log(`Phone: ${this.phone}`);
    console.log(`LangSmith Project: ${process.env.LANGSMITH_PROJECT}`);
    console.log('='.repeat(80) + '\n');

    // Simulate a real conversation flow
    const conversation = [
      { 
        user: "Hola", 
        wait: 2000 
      },
      { 
        user: "Mi nombre es Carlos Mendoza", 
        wait: 3000 
      },
      { 
        user: "Tengo un problema con mi sitio web, no aparece en Google", 
        wait: 3000 
      },
      { 
        user: "Quiero conseguir más clientes para mi negocio", 
        wait: 2000 
      },
      { 
        user: "Mi presupuesto es de $400 mensuales", 
        wait: 2000 
      },
      { 
        user: "Mi email es carlos@example.com", 
        wait: 1000 
      }
    ];

    let cumulativeLeadInfo = {};

    for (const turn of conversation) {
      // Show user message
      console.log(`\n👤 USER: ${turn.user}`);
      
      // Send message and get response
      const result = await this.sendMessage(turn.user);
      
      if (result.success) {
        if (result.aiResponse) {
          console.log(`\n🤖 AGENT: ${result.aiResponse}`);
        }
        
        // Update cumulative lead info
        if (result.leadInfo) {
          // Log what we're getting
          console.log('\n📋 Lead info from result:', JSON.stringify(result.leadInfo));
          
          cumulativeLeadInfo = { ...cumulativeLeadInfo, ...result.leadInfo };
          
          // Show what was extracted
          const newFields = Object.keys(result.leadInfo).filter(
            key => result.leadInfo[key] && result.leadInfo[key] !== cumulativeLeadInfo[key]
          );
          
          if (newFields.length > 0) {
            console.log('📋 New fields extracted:', newFields.map(f => `${f}: ${result.leadInfo[f]}`).join(', '));
          }
        }
      } else {
        console.log(`\n❌ ERROR: ${result.error || 'Unknown error'}`);
      }
      
      // Wait before next message (simulate real conversation pace)
      await new Promise(resolve => setTimeout(resolve, turn.wait));
    }

    // Final summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 CONVERSATION SUMMARY');
    console.log('='.repeat(80));
    console.log('\nFinal Lead Information:');
    console.log(JSON.stringify(cumulativeLeadInfo, null, 2));
    
    // Check if qualified
    const hasAllFields = ['name', 'problem', 'goal', 'budget', 'email'].every(
      field => cumulativeLeadInfo[field]
    );
    
    console.log(`\n✅ Qualified: ${hasAllFields ? 'YES' : 'NO'}`);
    
    if (cumulativeLeadInfo.budget) {
      const budgetAmount = parseInt(cumulativeLeadInfo.budget.replace(/[^0-9]/g, ''));
      console.log(`💰 Budget Check: $${budgetAmount} (${budgetAmount >= 300 ? 'QUALIFIED' : 'UNDER THRESHOLD'})`);
    }

    // Get trace URL
    await this.showTraceInfo();
  }

  /**
   * Test problematic scenarios
   */
  async testProblematicScenarios() {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 TESTING PROBLEMATIC SCENARIOS');
    console.log('='.repeat(80));

    // Test 1: User says "all"
    console.log('\n--- Test 1: User responds with "all" ---');
    
    await this.sendMessage("Hola");
    await new Promise(r => setTimeout(r, 1000));
    
    await this.sendMessage("Mi nombre es Ana");
    await new Promise(r => setTimeout(r, 1000));
    
    const allResult = await this.sendMessage("all");
    console.log('\nResponse to "all":', allResult.aiResponse);
    console.log('Fields extracted:', allResult.leadInfo || 'NONE');

    // Test 2: All info in one message
    console.log('\n--- Test 2: All information in one message ---');
    
    this.contactId = 'test-contact-' + Date.now(); // New contact
    const completeResult = await this.sendMessage(
      "Hola, soy Pedro García, tengo problemas con SEO, quiero más ventas, " +
      "mi presupuesto es $500 mensuales y mi correo es pedro@test.com"
    );
    console.log('\nFields extracted:', completeResult.leadInfo || 'NONE');

    await this.showTraceInfo();
  }

  /**
   * Show LangSmith trace information
   */
  async showTraceInfo() {
    console.log('\n📍 LangSmith Trace Information:');
    
    try {
      // Get recent runs
      const runs = [];
      for await (const run of this.langsmithClient.listRuns({
        projectName: process.env.LANGSMITH_PROJECT,
        limit: 5,
        executionOrder: 1
      })) {
        runs.push(run);
      }
      
      if (runs.length > 0) {
        console.log(`\nRecent traces in project "${process.env.LANGSMITH_PROJECT}":`);
        runs.forEach((run, idx) => {
          console.log(`${idx + 1}. ${run.name} - ${run.id}`);
          console.log(`   Status: ${run.status}`);
          console.log(`   URL: https://smith.langchain.com/public/${run.id}/r`);
        });
      }
    } catch (error) {
      console.log('Could not fetch trace URLs:', error.message);
    }
    
    console.log(`\nView all traces at: https://smith.langchain.com`);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'complete';

  console.log('\n🔧 Test Configuration:');
  console.log('- Environment:', process.env.NODE_ENV || 'development');
  console.log('- LangSmith Tracing:', process.env.LANGSMITH_TRACING);
  console.log('- LangSmith Project:', process.env.LANGSMITH_PROJECT);
  console.log('- Test Mode:', mode);

  const simulator = new ConversationSimulator();

  try {
    if (mode === 'complete') {
      // Run a complete conversation
      await simulator.runCompleteConversation();
      
    } else if (mode === 'problematic') {
      // Test problematic scenarios
      await simulator.testProblematicScenarios();
      
    } else if (mode === 'custom') {
      // Custom message flow
      console.log('\n🎯 Custom Message Mode');
      console.log('Type your messages (or "exit" to quit):\n');
      
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const askQuestion = (prompt) => new Promise(resolve => rl.question(prompt, resolve));
      
      while (true) {
        const message = await askQuestion('\n👤 YOU: ');
        
        if (message.toLowerCase() === 'exit') {
          break;
        }
        
        const result = await simulator.sendMessage(message);
        
        if (result.success && result.aiResponse) {
          console.log(`\n🤖 AGENT: ${result.aiResponse}`);
          
          if (result.leadInfo && Object.keys(result.leadInfo).length > 0) {
            console.log('\n📋 Current Lead Info:', JSON.stringify(result.leadInfo, null, 2));
          }
        } else {
          console.log(`\n❌ ERROR: ${result.error}`);
        }
      }
      
      rl.close();
      await simulator.showTraceInfo();
    }
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Usage instructions
if (process.argv.length < 3) {
  console.log(`
Usage: node test-from-zero.js <mode>

Modes:
  complete      Run a complete conversation from start to finish (default)
  problematic   Test problematic scenarios (like "all" response)
  custom        Interactive mode - type your own messages

Examples:
  node test-from-zero.js complete
  node test-from-zero.js problematic
  node test-from-zero.js custom

This simulates a complete production conversation with full LangSmith tracing.
  `);
}

// Run the test
main();