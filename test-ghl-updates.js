#!/usr/bin/env node
/**
 * Test that agent properly updates GHL with tags, notes, and contact info
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import { graph as webhookHandler } from './agents/webhookHandler.js';
import { HumanMessage } from '@langchain/core/messages';
import { GHLService } from './services/ghlService.js';

const ghlService = new GHLService(
  process.env.GHL_API_KEY,
  process.env.GHL_LOCATION_ID
);

const REAL_CONTACT_ID = 'ym8G7K6GSzm8dJDZ6BNo';
const REAL_PHONE = '(305) 487-0475';

// Track GHL updates
class GHLUpdateTracker {
  constructor() {
    this.updates = {
      tags: [],
      notes: [],
      contactUpdates: [],
      messages: []
    };
    this.originalMethods = {};
  }

  startTracking(ghlService) {
    // Save original methods
    this.originalMethods.addTags = ghlService.addTags.bind(ghlService);
    this.originalMethods.addNote = ghlService.addNote.bind(ghlService);
    this.originalMethods.updateContact = ghlService.updateContact.bind(ghlService);
    this.originalMethods.sendSMS = ghlService.sendSMS.bind(ghlService);

    // Override methods to track calls
    ghlService.addTags = async (contactId, tags) => {
      console.log(`\n🏷️  Adding tags: ${tags.join(', ')}`);
      this.updates.tags.push({ contactId, tags, timestamp: new Date() });
      return this.originalMethods.addTags(contactId, tags);
    };

    ghlService.addNote = async (contactId, note) => {
      console.log(`\n📝 Adding note: ${note.substring(0, 100)}...`);
      this.updates.notes.push({ contactId, note, timestamp: new Date() });
      return this.originalMethods.addNote(contactId, note);
    };

    ghlService.updateContact = async (contactId, data) => {
      console.log(`\n👤 Updating contact:`, JSON.stringify(data, null, 2));
      this.updates.contactUpdates.push({ contactId, data, timestamp: new Date() });
      return this.originalMethods.updateContact(contactId, data);
    };

    ghlService.sendSMS = async (contactId, message) => {
      console.log(`\n💬 Sending message: ${message.substring(0, 80)}...`);
      this.updates.messages.push({ contactId, message, timestamp: new Date() });
      return this.originalMethods.sendSMS(contactId, message);
    };
  }

  stopTracking(ghlService) {
    // Restore original methods
    Object.keys(this.originalMethods).forEach(method => {
      ghlService[method] = this.originalMethods[method];
    });
  }

  getSummary() {
    return {
      totalTags: this.updates.tags.reduce((sum, t) => sum + t.tags.length, 0),
      totalNotes: this.updates.notes.length,
      totalContactUpdates: this.updates.contactUpdates.length,
      totalMessages: this.updates.messages.length,
      details: this.updates
    };
  }
}

async function testScenarioWithTracking(name, webhookPayload) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📱 Testing: ${name}`);
  console.log(`${'='.repeat(80)}`);

  const tracker = new GHLUpdateTracker();
  tracker.startTracking(ghlService);

  try {
    const initialState = {
      messages: [new HumanMessage(JSON.stringify(webhookPayload))],
      contactId: webhookPayload.contactId,
      phone: webhookPayload.phone
    };

    console.log('\n🚀 Invoking webhook handler...');
    const startTime = Date.now();

    const result = await webhookHandler.invoke(initialState, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        thread_id: `test-updates-${Date.now()}`
      },
      recursionLimit: 25
    });

    const duration = Date.now() - startTime;
    console.log(`\n✅ Webhook processed in ${(duration / 1000).toFixed(2)}s`);

    // Get tracking summary
    const summary = tracker.getSummary();
    
    console.log('\n📊 GHL Updates Summary:');
    console.log(`  Tags added: ${summary.totalTags}`);
    if (summary.details.tags.length > 0) {
      summary.details.tags.forEach(t => {
        console.log(`    - ${t.tags.join(', ')}`);
      });
    }
    
    console.log(`  Notes added: ${summary.totalNotes}`);
    if (summary.details.notes.length > 0) {
      summary.details.notes.forEach(n => {
        console.log(`    - ${n.note.substring(0, 60)}...`);
      });
    }
    
    console.log(`  Contact updates: ${summary.totalContactUpdates}`);
    console.log(`  Messages sent: ${summary.totalMessages}`);

    // Check lead info
    if (result.leadInfo) {
      console.log('\n📋 Lead Info Collected:');
      console.log(JSON.stringify(result.leadInfo, null, 2));
    }

    return {
      success: true,
      duration,
      updates: summary,
      leadInfo: result.leadInfo
    };

  } catch (error) {
    console.log('❌ Error:', error.message);
    return {
      success: false,
      error: error.message
    };
  } finally {
    tracker.stopTracking(ghlService);
  }
}

const testScenarios = [
  {
    name: "Under Budget Lead - Should tag as nurture",
    payload: {
      phone: REAL_PHONE,
      message: "Hola, soy Carlos, tengo una tienda, no vendo mucho, quiero más clientes, solo puedo pagar $200 al mes, carlos@test.com",
      contactId: REAL_CONTACT_ID
    }
  },
  {
    name: "Qualified Lead - Should tag appropriately",
    payload: {
      phone: REAL_PHONE,
      message: "Soy Ana, tengo restaurante, pocos clientes, necesito marketing digital, $600 mensual, ana@restaurant.com",
      contactId: REAL_CONTACT_ID
    }
  },
  {
    name: "Partial Info - Should create notes",
    payload: {
      phone: REAL_PHONE,
      message: "Me llamo Diego y tengo problemas con mi negocio",
      contactId: REAL_CONTACT_ID
    }
  },
  {
    name: "Marketing Specific - Should tag needs-marketing",
    payload: {
      phone: REAL_PHONE,
      message: "Soy Laura, tengo spa, necesito más presencia en redes sociales, quiero crecer en Instagram, $400 mes, laura@spa.com",
      contactId: REAL_CONTACT_ID
    }
  },
  {
    name: "Sales Problem - Should tag needs-sales",
    payload: {
      phone: REAL_PHONE,
      message: "José aquí, mi problema es cerrar ventas, tengo clientes pero no compran, necesito vender más, $500, jose@ventas.mx",
      contactId: REAL_CONTACT_ID
    }
  }
];

async function getContactTags(contactId) {
  try {
    const contact = await ghlService.getContact(contactId);
    return contact.tags || [];
  } catch (error) {
    console.log('Could not fetch contact tags:', error.message);
    return [];
  }
}

async function runUpdateTests() {
  console.log('🧪 GHL UPDATE VERIFICATION TEST');
  console.log('Testing tags, notes, and contact updates\n');

  // Get initial tags
  console.log('📌 Getting initial contact tags...');
  const initialTags = await getContactTags(REAL_CONTACT_ID);
  console.log(`Initial tags: ${initialTags.length > 0 ? initialTags.join(', ') : 'None'}`);

  const results = [];

  for (const scenario of testScenarios) {
    const result = await testScenarioWithTracking(scenario.name, scenario.payload);
    results.push({
      ...result,
      scenario: scenario.name
    });
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Final summary
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('📈 FINAL UPDATE SUMMARY');
  console.log(`${'='.repeat(80)}`);

  let totalTags = 0;
  let totalNotes = 0;
  let totalUpdates = 0;
  let totalMessages = 0;

  results.forEach(r => {
    console.log(`\n${r.scenario}:`);
    console.log(`  Status: ${r.success ? '✅' : '❌'}`);
    if (r.success) {
      console.log(`  Tags: ${r.updates.totalTags}`);
      console.log(`  Notes: ${r.updates.totalNotes}`);
      console.log(`  Updates: ${r.updates.totalContactUpdates}`);
      console.log(`  Messages: ${r.updates.totalMessages}`);
      
      totalTags += r.updates.totalTags;
      totalNotes += r.updates.totalNotes;
      totalUpdates += r.updates.totalContactUpdates;
      totalMessages += r.updates.totalMessages;
    }
  });

  console.log('\n📊 Totals:');
  console.log(`  Total tags added: ${totalTags}`);
  console.log(`  Total notes created: ${totalNotes}`);
  console.log(`  Total contact updates: ${totalUpdates}`);
  console.log(`  Total messages sent: ${totalMessages}`);

  // Get final tags
  console.log('\n📌 Getting final contact tags...');
  const finalTags = await getContactTags(REAL_CONTACT_ID);
  console.log(`Final tags: ${finalTags.length > 0 ? finalTags.join(', ') : 'None'}`);
  
  const newTags = finalTags.filter(t => !initialTags.includes(t));
  if (newTags.length > 0) {
    console.log(`New tags added: ${newTags.join(', ')}`);
  }

  // Expected tags check
  console.log('\n✅ Expected Tag Behaviors:');
  console.log('  - Under budget ($200) → "nurture-lead", "under-budget"');
  console.log('  - Qualified ($600) → "qualified-lead", "budget-300-plus"');
  console.log('  - Marketing need → "needs-marketing"');
  console.log('  - Sales problem → "needs-sales"');
  console.log('  - Appointment booked → "appointment-scheduled"');
}

// Run tests
process.env.SKIP_ENV_VALIDATION = 'true';
runUpdateTests().catch(console.error);