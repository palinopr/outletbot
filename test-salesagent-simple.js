#!/usr/bin/env node
import 'dotenv/config';
import { salesAgent } from './agents/salesAgent.js';
import { HumanMessage } from '@langchain/core/messages';

console.log('🧪 Testing Sales Agent Directly\n');

// Mock GHL service
const mockGhlService = {
  sendSMS: async (contactId, message) => {
    console.log('✅ GHL sendSMS called!');
    console.log(`   Contact: ${contactId}`);
    console.log(`   Message: ${message}`);
    return { success: true, messageId: 'test-123' };
  },
  getAvailableSlots: async () => {
    return [
      {
        startTime: '2025-01-27T09:00:00-05:00',
        endTime: '2025-01-27T09:30:00-05:00',
        id: 'slot-1'
      },
      {
        startTime: '2025-01-27T10:00:00-05:00',
        endTime: '2025-01-27T10:30:00-05:00',
        id: 'slot-2'
      }
    ];
  }
};

async function testSalesAgent() {
  try {
    console.log('1️⃣ Testing sales agent with simple message...');
    
    const input = {
      messages: [
        new HumanMessage("hola")
      ],
      leadInfo: {},
      contactId: "test-contact-123",
      conversationId: "test-conv-123"
    };
    
    const config = {
      configurable: {
        ghlService: mockGhlService,
        calendarId: 'test-calendar',
        contactId: 'test-contact-123',
        currentLeadInfo: {}
      },
      recursionLimit: 25
    };
    
    console.log('📥 Input:', JSON.stringify(input, null, 2));
    
    const result = await salesAgent(input, config);
    
    console.log('\n📤 Output:');
    console.log(`   Messages: ${result.messages.length}`);
    result.messages.forEach((msg, i) => {
      console.log(`   [${i}] ${msg.constructor.name}: ${msg.content?.substring(0, 100)}...`);
      if (msg.tool_calls?.length > 0) {
        console.log(`      Tool calls: ${msg.tool_calls.map(tc => tc.name).join(', ')}`);
      }
    });
    
    console.log('\n✅ Sales agent test passed');
    
  } catch (error) {
    console.error('\n❌ Error in sales agent:', error.message);
    console.error('Stack:', error.stack);
  }
}

testSalesAgent().catch(console.error);