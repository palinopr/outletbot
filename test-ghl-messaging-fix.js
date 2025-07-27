#!/usr/bin/env node
/**
 * Test script to verify GHL messaging is working after fix
 * Tests both direct invocation and webhook flow
 */

import { config as dotenvConfig } from 'dotenv';
import { salesAgent } from './agents/salesAgent.js';
import { graph as webhookHandler } from './agents/webhookHandler.js';
import { HumanMessage } from '@langchain/core/messages';
import { GHLService } from './services/ghlService.js';

dotenvConfig();

// Mock environment if needed
if (!process.env.OPENAI_API_KEY) {
  console.log('⚠️  No API keys found - using mock mode');
  process.env.OPENAI_API_KEY = 'mock-key';
  process.env.GHL_API_KEY = 'mock-key';
  process.env.GHL_LOCATION_ID = 'mock-location';
  process.env.GHL_CALENDAR_ID = 'mock-calendar';
}

class MockGHLService {
  constructor() {
    this.messagesSent = [];
    this.tagsAdded = [];
    this.notesAdded = [];
  }

  async sendSMS(contactId, message) {
    console.log(`\n📤 [MOCK] GHL sendSMS called:`);
    console.log(`   Contact: ${contactId}`);
    console.log(`   Message: ${message.substring(0, 100)}...`);
    this.messagesSent.push({ contactId, message, timestamp: new Date() });
    return { success: true, messageId: `mock-${Date.now()}` };
  }

  async addTags(contactId, tags) {
    console.log(`\n🏷️  [MOCK] GHL addTags called:`);
    console.log(`   Contact: ${contactId}`);
    console.log(`   Tags: ${tags.join(', ')}`);
    this.tagsAdded.push({ contactId, tags, timestamp: new Date() });
    return { success: true };
  }

  async addNote(contactId, note) {
    console.log(`\n📝 [MOCK] GHL addNote called:`);
    console.log(`   Contact: ${contactId}`);
    console.log(`   Note: ${note.substring(0, 100)}...`);
    this.notesAdded.push({ contactId, note, timestamp: new Date() });
    return { success: true };
  }

  async getConversationHistory(contactId) {
    return {
      messages: [],
      conversationId: 'mock-conv-id'
    };
  }

  getStats() {
    return {
      messagesSent: this.messagesSent.length,
      tagsAdded: this.tagsAdded.length,
      notesAdded: this.notesAdded.length,
      details: {
        messages: this.messagesSent,
        tags: this.tagsAdded,
        notes: this.notesAdded
      }
    };
  }
}

async function testDirectInvocation() {
  console.log('\n' + '='.repeat(70));
  console.log('TEST 1: Direct Sales Agent Invocation');
  console.log('='.repeat(70));

  const mockGHL = new MockGHLService();
  const contactId = 'test-contact-123';

  const state = {
    messages: [new HumanMessage('Hola, soy María y necesito ayuda')],
    leadInfo: {},
    contactId: contactId,
    conversationId: 'test-conv-123'
  };

  try {
    const result = await salesAgent.invoke(state, {
      configurable: {
        ghlService: mockGHL,
        calendarId: 'mock-calendar',
        contactId: contactId,
        thread_id: `test-${Date.now()}`
      },
      recursionLimit: 10
    });

    console.log('\n✅ Agent completed successfully');
    console.log(`Messages in result: ${result.messages?.length || 0}`);
    
    // Check if AI called tools
    const aiMessages = result.messages?.filter(m => m._getType?.() === 'ai' || m.type === 'ai') || [];
    const toolCalls = aiMessages.flatMap(m => m.tool_calls || []);
    console.log(`\nTool calls made: ${toolCalls.length}`);
    toolCalls.forEach(tc => {
      console.log(`  - ${tc.function?.name || tc.name}`);
    });

    const stats = mockGHL.getStats();
    console.log('\n📊 GHL Service Stats:');
    console.log(`  Messages sent: ${stats.messagesSent}`);
    console.log(`  Tags added: ${stats.tagsAdded}`);
    console.log(`  Notes added: ${stats.notesAdded}`);

    return stats.messagesSent > 0;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

async function testWebhookFlow() {
  console.log('\n' + '='.repeat(70));
  console.log('TEST 2: Webhook Handler Flow');
  console.log('='.repeat(70));

  const mockGHL = new MockGHLService();
  const contactId = 'webhook-contact-456';

  const webhookPayload = {
    phone: '+1234567890',
    message: 'Hola, necesito información',
    contactId: contactId,
    conversationId: 'webhook-conv-456'
  };

  const initialState = {
    messages: [new HumanMessage(JSON.stringify(webhookPayload))],
    contactId: contactId,
    phone: webhookPayload.phone
  };

  try {
    const result = await webhookHandler.invoke(initialState, {
      configurable: {
        ghlService: mockGHL,
        calendarId: 'mock-calendar',
        thread_id: `webhook-${Date.now()}`
      },
      recursionLimit: 20
    });

    console.log('\n✅ Webhook handler completed successfully');
    console.log(`Messages in result: ${result.messages?.length || 0}`);

    const stats = mockGHL.getStats();
    console.log('\n📊 GHL Service Stats:');
    console.log(`  Messages sent: ${stats.messagesSent}`);
    console.log(`  Tags added: ${stats.tagsAdded}`);
    console.log(`  Notes added: ${stats.notesAdded}`);

    if (stats.messagesSent > 0) {
      console.log('\n✅ Messages were sent via GHL!');
      stats.details.messages.forEach((msg, idx) => {
        console.log(`\nMessage ${idx + 1}:`);
        console.log(`  Contact: ${msg.contactId}`);
        console.log(`  Content: ${msg.message.substring(0, 100)}...`);
      });
    } else {
      console.log('\n❌ No messages were sent via GHL!');
    }

    return stats.messagesSent > 0;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🧪 GHL Messaging Fix Verification Test');
  console.log('Testing with mock GHL service to verify tool calls\n');

  const results = {
    direct: await testDirectInvocation(),
    webhook: await testWebhookFlow()
  };

  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Direct invocation: ${results.direct ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Webhook flow: ${results.webhook ? '✅ PASS' : '❌ FAIL'}`);

  if (results.direct && results.webhook) {
    console.log('\n🎉 All tests passed! GHL messaging is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the output above for details.');
  }
}

runTests().catch(console.error);