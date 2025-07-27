#!/usr/bin/env node
/**
 * Webhook Flow Tester
 * Simulates production webhook flow locally with full LangSmith tracing
 */

import { config as dotenvConfig } from 'dotenv';
import { graph as webhookHandler } from './agents/webhookHandler.js';
import { HumanMessage } from '@langchain/core/messages';
import { Logger } from './services/logger.js';
import { Client } from 'langsmith/client';
import fs from 'fs/promises';

// Load environment variables
dotenvConfig();

const logger = new Logger('WebhookFlowTester');

class WebhookFlowTester {
  constructor() {
    this.langsmithClient = new Client({
      apiKey: process.env.LANGSMITH_API_KEY,
      apiUrl: process.env.LANGSMITH_ENDPOINT || "https://api.smith.langchain.com"
    });
  }

  /**
   * Simulate a webhook request locally
   */
  async simulateWebhook(webhookData, options = {}) {
    const { 
      projectName = 'Local Testing',
      metadata = {},
      tags = ['local-test']
    } = options;

    logger.info('Simulating webhook', { 
      phone: webhookData.phone,
      messagePreview: webhookData.message?.substring(0, 50) 
    });

    try {
      // Create initial state with webhook payload as message
      const initialState = {
        messages: [new HumanMessage(JSON.stringify(webhookData))],
        contactId: webhookData.contactId,
        phone: webhookData.phone
      };

      // Invoke webhook handler with LangSmith tracing
      const result = await webhookHandler.invoke(initialState, {
        configurable: {
          thread_id: `test-${Date.now()}`,
          checkpoint_ns: 'webhook-test'
        },
        metadata: {
          ...metadata,
          test_type: 'webhook_simulation',
          original_webhook: webhookData
        },
        tags,
        callbacks: [] // LangSmith callbacks will be added automatically
      });

      logger.info('Webhook simulation complete', {
        messagesReturned: result.messages?.length,
        hasLeadInfo: !!result.leadInfo
      });

      return {
        success: true,
        result,
        traceUrl: await this.getTraceUrl()
      };

    } catch (error) {
      logger.error('Webhook simulation failed', { 
        error: error.message,
        stack: error.stack 
      });
      
      return {
        success: false,
        error: error.message,
        traceUrl: await this.getTraceUrl()
      };
    }
  }

  /**
   * Replay a production conversation locally
   */
  async replayProduction(traceId) {
    logger.info('Fetching production trace for replay', { traceId });
    
    try {
      // Fetch the production trace
      const prodTrace = await this.langsmithClient.readRun(traceId);
      
      // Extract webhook data from production inputs
      let webhookData = null;
      
      if (prodTrace.inputs?.messages?.[0]?.content) {
        const firstMessage = prodTrace.inputs.messages[0].content;
        
        // Try to parse as JSON (webhook payload)
        if (typeof firstMessage === 'string' && firstMessage.trim().startsWith('{')) {
          try {
            webhookData = JSON.parse(firstMessage);
          } catch (e) {
            // Not JSON, extract from conversation
            webhookData = {
              message: firstMessage,
              contactId: prodTrace.inputs.contactId,
              phone: prodTrace.inputs.phone
            };
          }
        }
      }
      
      if (!webhookData) {
        throw new Error('Could not extract webhook data from production trace');
      }
      
      logger.info('Replaying production webhook', {
        originalTraceId: traceId,
        webhookData
      });
      
      // Simulate the same webhook locally
      const result = await this.simulateWebhook(webhookData, {
        projectName: 'Production Replay',
        metadata: {
          original_trace_id: traceId,
          replay_timestamp: new Date().toISOString()
        },
        tags: ['production-replay', 'debug']
      });
      
      return {
        ...result,
        originalTraceId: traceId,
        webhookData
      };
      
    } catch (error) {
      logger.error('Production replay failed', { 
        error: error.message,
        traceId 
      });
      throw error;
    }
  }

  /**
   * Run a series of test conversations
   */
  async runTestSuite() {
    const testCases = [
      {
        name: "Complete conversation with all fields",
        webhook: {
          phone: "+1234567890",
          contactId: "test-contact-1",
          conversationId: "test-conv-1",
          message: "Hola, mi nombre es Juan García. Tengo un problema con mi sitio web que no aparece en Google. Mi objetivo es conseguir más clientes. Mi presupuesto es de $500 al mes y mi email es juan@example.com"
        }
      },
      {
        name: "Partial information",
        webhook: {
          phone: "+1234567891",
          contactId: "test-contact-2",
          conversationId: "test-conv-2",
          message: "Hola, soy María y necesito ayuda con marketing"
        }
      },
      {
        name: "Budget below threshold",
        webhook: {
          phone: "+1234567892",
          contactId: "test-contact-3",
          conversationId: "test-conv-3",
          message: "Me llamo Carlos, necesito SEO, quiero más ventas, mi presupuesto es $200"
        }
      },
      {
        name: "Multiple messages flow",
        webhook: {
          phone: "+1234567893",
          contactId: "test-contact-4",
          conversationId: "test-conv-4",
          message: "Hola"
        },
        followUp: [
          "Mi nombre es Ana",
          "Tengo problemas con las redes sociales",
          "Quiero aumentar mi visibilidad online",
          "Puedo invertir $400 mensuales",
          "Mi correo es ana@test.com"
        ]
      }
    ];

    const results = [];
    
    for (const testCase of testCases) {
      logger.info(`Running test: ${testCase.name}`);
      
      // Initial message
      let result = await this.simulateWebhook(testCase.webhook, {
        projectName: 'Test Suite',
        metadata: { test_name: testCase.name },
        tags: ['test-suite', testCase.name.toLowerCase().replace(/\s+/g, '-')]
      });
      
      results.push({
        name: testCase.name,
        initialResult: result
      });
      
      // Follow-up messages if any
      if (testCase.followUp) {
        for (const message of testCase.followUp) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between messages
          
          result = await this.simulateWebhook({
            ...testCase.webhook,
            message
          }, {
            projectName: 'Test Suite',
            metadata: { 
              test_name: testCase.name,
              followup: true 
            }
          });
        }
      }
    }
    
    return results;
  }

  /**
   * Get the trace URL for the last run
   */
  async getTraceUrl() {
    // Get the most recent run
    try {
      const runs = await this.langsmithClient.listRuns({
        projectName: process.env.LANGSMITH_PROJECT || 'default',
        limit: 1,
        executionOrder: 1
      });
      
      for await (const run of runs) {
        return `https://smith.langchain.com/public/${run.id}/r`;
      }
    } catch (error) {
      logger.error('Could not get trace URL', { error: error.message });
      return null;
    }
  }

  /**
   * Generate test report
   */
  async generateReport(results, outputPath = './test-report.md') {
    const report = [];
    
    report.push('# Webhook Flow Test Report');
    report.push(`\nGenerated: ${new Date().toISOString()}\n`);
    
    report.push('## Test Summary\n');
    const successful = results.filter(r => r.initialResult.success).length;
    report.push(`- Total tests: ${results.length}`);
    report.push(`- Successful: ${successful}`);
    report.push(`- Failed: ${results.length - successful}\n`);
    
    report.push('## Test Results\n');
    
    for (const result of results) {
      report.push(`### ${result.name}\n`);
      report.push(`- Status: ${result.initialResult.success ? '✅ Success' : '❌ Failed'}`);
      
      if (result.initialResult.traceUrl) {
        report.push(`- [View Trace](${result.initialResult.traceUrl})`);
      }
      
      if (result.initialResult.error) {
        report.push(`- Error: ${result.initialResult.error}`);
      }
      
      if (result.initialResult.result?.leadInfo) {
        report.push('\n**Extracted Fields:**');
        const leadInfo = result.initialResult.result.leadInfo;
        report.push(`- Name: ${leadInfo.name || '❌'}`);
        report.push(`- Problem: ${leadInfo.problem || '❌'}`);
        report.push(`- Goal: ${leadInfo.goal || '❌'}`);
        report.push(`- Budget: ${leadInfo.budget || '❌'}`);
        report.push(`- Email: ${leadInfo.email || '❌'}`);
      }
      
      report.push('');
    }
    
    const content = report.join('\n');
    await fs.writeFile(outputPath, content, 'utf8');
    logger.info('Test report saved', { path: outputPath });
    
    return content;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command) {
    console.log(`
Usage: node test-webhook-flow.js <command> [options]

Commands:
  test-single <phone> <message> <contactId>   Test a single webhook
  replay <trace-id>                           Replay a production trace locally
  test-suite                                  Run full test suite
  
Examples:
  node test-webhook-flow.js test-single "+1234567890" "Hola, soy Juan" "contact-123"
  node test-webhook-flow.js replay 1f06a7ac-ce88-6245-9ec9-821839cc6091
  node test-webhook-flow.js test-suite
    `);
    process.exit(1);
  }
  
  const tester = new WebhookFlowTester();
  
  try {
    if (command === 'test-single') {
      const [phone, message, contactId] = args.slice(1);
      
      if (!phone || !message || !contactId) {
        console.error('Phone, message, and contactId required');
        process.exit(1);
      }
      
      const result = await tester.simulateWebhook({
        phone,
        message,
        contactId,
        conversationId: `test-${Date.now()}`
      });
      
      console.log('\n📊 Test Result:');
      console.log(JSON.stringify(result, null, 2));
      
    } else if (command === 'replay') {
      const traceId = args[1];
      
      if (!traceId) {
        console.error('Trace ID required');
        process.exit(1);
      }
      
      const result = await tester.replayProduction(traceId);
      
      console.log('\n📊 Replay Result:');
      console.log(JSON.stringify(result, null, 2));
      
    } else if (command === 'test-suite') {
      console.log('Running test suite...\n');
      
      const results = await tester.runTestSuite();
      const report = await tester.generateReport(results);
      
      console.log(report);
      console.log('\n✅ Test suite complete. Report saved to test-report.md');
    }
    
  } catch (error) {
    logger.error('Command failed', { error: error.message });
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { WebhookFlowTester };