#!/usr/bin/env node
/**
 * Test that update_ghl_contact tool is being called
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import { salesAgent } from './agents/salesAgent.js';
import { HumanMessage } from '@langchain/core/messages';
import { GHLService } from './services/ghlService.js';

const ghlService = new GHLService(
  process.env.GHL_API_KEY,
  process.env.GHL_LOCATION_ID
);

// Mock GHL service to track calls
class MockGHLService extends GHLService {
  constructor() {
    super(process.env.GHL_API_KEY, process.env.GHL_LOCATION_ID);
    this.calls = {
      sendSMS: [],
      addTags: [],
      addNote: [],
      updateContact: []
    };
  }

  async sendSMS(contactId, message) {
    console.log(`\n📤 [MOCK] sendSMS called`);
    this.calls.sendSMS.push({ contactId, message });
    return { success: true };
  }

  async addTags(contactId, tags) {
    console.log(`\n🏷️  [MOCK] addTags called: ${tags.join(', ')}`);
    this.calls.addTags.push({ contactId, tags });
    return { success: true };
  }

  async addNote(contactId, note) {
    console.log(`\n📝 [MOCK] addNote called: ${note.substring(0, 60)}...`);
    this.calls.addNote.push({ contactId, note });
    return { success: true };
  }

  async updateContact(contactId, data) {
    console.log(`\n👤 [MOCK] updateContact called:`, JSON.stringify(data, null, 2));
    this.calls.updateContact.push({ contactId, data });
    return { success: true };
  }
}

async function testUpdateToolCalls(scenario) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🧪 ${scenario.name}`);
  console.log(`${'='.repeat(70)}`);

  const mockGHL = new MockGHLService();
  
  const state = {
    messages: [new HumanMessage(scenario.message)],
    leadInfo: {},
    contactId: 'test-contact-123',
    conversationId: 'test-conv-123'
  };

  try {
    console.log('\n🚀 Invoking sales agent...');
    const result = await salesAgent.invoke(state, {
      configurable: {
        ghlService: mockGHL,
        calendarId: process.env.GHL_CALENDAR_ID,
        contactId: state.contactId,
        thread_id: `test-${Date.now()}`
      },
      recursionLimit: 15
    });

    console.log('\n📊 Analysis:');
    
    // Look for update_ghl_contact tool calls
    const updateToolCalls = [];
    result.messages?.forEach((msg, idx) => {
      if (msg.tool_calls?.length > 0) {
        msg.tool_calls.forEach(tc => {
          if (tc.function?.name === 'update_ghl_contact' || tc.name === 'update_ghl_contact') {
            updateToolCalls.push({
              messageIndex: idx,
              args: JSON.parse(tc.function?.arguments || tc.args || '{}')
            });
          }
        });
      }
    });

    console.log(`\nupdate_ghl_contact calls: ${updateToolCalls.length}`);
    updateToolCalls.forEach((tc, idx) => {
      console.log(`\nCall ${idx + 1}:`);
      console.log(`  Tags: ${tc.args.tags?.join(', ') || 'None'}`);
      console.log(`  Notes: ${tc.args.notes ? 'Yes' : 'No'}`);
    });

    // Check mock service calls
    console.log('\n📞 Actual GHL Service Calls:');
    console.log(`  sendSMS: ${mockGHL.calls.sendSMS.length}`);
    console.log(`  addTags: ${mockGHL.calls.addTags.length}`);
    console.log(`  addNote: ${mockGHL.calls.addNote.length}`);
    console.log(`  updateContact: ${mockGHL.calls.updateContact.length}`);

    // Show tags that were added
    if (mockGHL.calls.addTags.length > 0) {
      console.log('\n🏷️  Tags Added:');
      mockGHL.calls.addTags.forEach(call => {
        console.log(`  - ${call.tags.join(', ')}`);
      });
    }

    // Show final lead info
    console.log('\n📋 Final Lead Info:');
    console.log(JSON.stringify(result.leadInfo || {}, null, 2));

    return {
      success: true,
      updateToolCalls: updateToolCalls.length,
      tagsAdded: mockGHL.calls.addTags.length,
      notesAdded: mockGHL.calls.addNote.length,
      leadInfo: result.leadInfo
    };

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🔍 Testing update_ghl_contact Tool Usage\n');

  const scenarios = [
    {
      name: "Under Budget - Should Tag as Nurture",
      message: "Hola, soy Pedro, tengo tienda de ropa, pocas ventas, quiero más clientes, solo puedo $200 al mes, pedro@tienda.com"
    },
    {
      name: "Qualified Lead - Should Tag Appropriately",
      message: "Soy María, restaurante italiano, pocos clientes, necesito marketing, $500 mensual, maria@restaurant.com"
    },
    {
      name: "High Budget - Should Tag as High Value",
      message: "Carlos aquí, agencia de viajes, necesito más reservas online, quiero crecer 10x, $1500 mes, carlos@viajes.mx"
    },
    {
      name: "Partial Info - Should Still Update",
      message: "Me llamo Ana y tengo problemas con mi negocio de flores"
    }
  ];

  const results = [];
  
  for (const scenario of scenarios) {
    const result = await testUpdateToolCalls(scenario);
    results.push({
      ...result,
      scenario: scenario.name
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log(`\n\n${'='.repeat(70)}`);
  console.log('📈 SUMMARY');
  console.log(`${'='.repeat(70)}`);

  results.forEach(r => {
    console.log(`\n${r.scenario}:`);
    console.log(`  Success: ${r.success ? '✅' : '❌'}`);
    console.log(`  update_ghl_contact calls: ${r.updateToolCalls || 0}`);
    console.log(`  Tags added: ${r.tagsAdded || 0}`);
    console.log(`  Notes added: ${r.notesAdded || 0}`);
    if (r.leadInfo?.budget) {
      console.log(`  Budget: $${r.leadInfo.budget}`);
    }
  });

  console.log('\n\n💡 Expected Behaviors:');
  console.log('- Budget < $300: nurture-lead, under-budget tags');
  console.log('- Budget >= $300: qualified-lead, budget-300-plus tags');
  console.log('- Budget >= $1000: high-value-lead tag');
  console.log('- All scenarios should call update_ghl_contact');
}

process.env.SKIP_ENV_VALIDATION = 'true';
runTests().catch(console.error);