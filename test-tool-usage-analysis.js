#!/usr/bin/env node
/**
 * Analyze tool usage patterns to identify unnecessary calls
 */

import { config as dotenvConfig } from 'dotenv';
import { salesAgent } from './agents/salesAgent.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { GHLService } from './services/ghlService.js';

dotenvConfig();

// Enable detailed tracing
process.env.LANGSMITH_TRACING = 'true';
process.env.LANGSMITH_PROJECT = 'tool-usage-analysis';

const ghlService = new GHLService(
  process.env.GHL_API_KEY,  
  process.env.GHL_LOCATION_ID
);

async function analyzeToolUsage(name, state, expectedBehavior) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Scenario: ${name}`);
  console.log(`Expected: ${expectedBehavior}`);
  console.log(`${'='.repeat(60)}`);
  
  const toolCalls = [];
  let totalCalls = 0;
  
  // Hook into tool calls
  const originalInvoke = salesAgent.invoke;
  salesAgent.invoke = async function(input, config) {
    // Track tool calls from messages
    const originalConfigurable = config.configurable || {};
    config.configurable = {
      ...originalConfigurable,
      _toolCallTracker: (toolName, args) => {
        toolCalls.push({ tool: toolName, args });
        totalCalls++;
      }
    };
    
    const result = await originalInvoke.call(this, input, config);
    
    // Count tool calls from result messages
    if (result.messages) {
      result.messages.forEach(msg => {
        if (msg.tool_calls) {
          msg.tool_calls.forEach(call => {
            toolCalls.push({
              tool: call.function.name,
              args: call.function.arguments
            });
            totalCalls++;
          });
        }
      });
    }
    
    return result;
  };
  
  try {
    const result = await salesAgent.invoke(state, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        contactId: state.contactId,
        thread_id: `analysis-${Date.now()}`
      },
      recursionLimit: 20
    });
    
    // Restore original invoke
    salesAgent.invoke = originalInvoke;
    
    // Analyze tool usage
    console.log(`\n📊 Tool Usage Analysis:`);
    console.log(`Total tool calls: ${totalCalls}`);
    
    // Group by tool
    const toolGroups = {};
    toolCalls.forEach(call => {
      if (!toolGroups[call.tool]) {
        toolGroups[call.tool] = 0;
      }
      toolGroups[call.tool]++;
    });
    
    console.log(`\nBreakdown by tool:`);
    Object.entries(toolGroups).forEach(([tool, count]) => {
      console.log(`  - ${tool}: ${count} calls`);
    });
    
    // Check for patterns
    const issues = [];
    
    // Check for duplicate extract_lead_info calls
    if (toolGroups['extract_lead_info'] > 2) {
      issues.push(`⚠️  Excessive extraction calls: ${toolGroups['extract_lead_info']} (should be ≤2)`);
    }
    
    // Check for multiple send_ghl_message without user response
    const messagesSent = toolGroups['send_ghl_message'] || 0;
    const userMessages = state.messages.filter(m => m._getType?.() === 'human' || m.type === 'human').length;
    if (messagesSent > userMessages + 1) {
      issues.push(`⚠️  Too many messages sent: ${messagesSent} for ${userMessages} user messages`);
    }
    
    // Check for calendar calls without full qualification
    if (toolGroups['get_calendar_slots'] && (!result.leadInfo || !result.leadInfo.email)) {
      issues.push(`⚠️  Calendar called without full qualification`);
    }
    
    // Check for update_ghl_contact before extraction
    if (toolGroups['update_ghl_contact'] && !toolGroups['extract_lead_info']) {
      issues.push(`⚠️  GHL updated without extraction`);
    }
    
    if (issues.length > 0) {
      console.log(`\n❌ Issues found:`);
      issues.forEach(issue => console.log(`  ${issue}`));
    } else {
      console.log(`\n✅ Tool usage appears optimal`);
    }
    
    // Calculate estimated cost (rough OpenAI pricing)
    const estimatedCost = totalCalls * 0.002; // Rough estimate per tool call
    console.log(`\n💰 Estimated cost: $${estimatedCost.toFixed(4)}`);
    
    return {
      totalCalls,
      toolGroups,
      issues,
      estimatedCost
    };
    
  } catch (error) {
    console.log('❌ Error:', error.message);
    return null;
  }
}

async function runAnalysis() {
  console.log('🔍 TOOL USAGE ANALYSIS\n');
  
  const scenarios = [
    {
      name: 'Simple Greeting',
      state: {
        messages: [new HumanMessage('Hola')],
        leadInfo: {},
        contactId: `test-greeting-${Date.now()}`,
        conversationId: `conv-greeting-${Date.now()}`
      },
      expected: 'Should extract nothing, send greeting, update GHL'
    },
    {
      name: 'Name Extraction',
      state: {
        messages: [new HumanMessage('Hola, soy Juan')],
        leadInfo: {},
        contactId: `test-name-${Date.now()}`,
        conversationId: `conv-name-${Date.now()}`
      },
      expected: 'Should extract name, send message asking for problem, update GHL'
    },
    {
      name: 'Si Confirmation',
      state: {
        messages: [
          new HumanMessage('Soy Pedro'),
          new AIMessage('¿Tu presupuesto mensual es de $600?'),
          new HumanMessage('si')
        ],
        leadInfo: { name: 'Pedro' },
        contactId: `test-si-${Date.now()}`,
        conversationId: `conv-si-${Date.now()}`
      },
      expected: 'Should extract budget from si, continue flow'
    },
    {
      name: 'Full Qualification',
      state: {
        messages: [
          new HumanMessage('Hola, soy Maria, tengo una tienda, no vendo, quiero vender más, mi presupuesto es $500, maria@test.com')
        ],
        leadInfo: {},
        contactId: `test-full-${Date.now()}`,
        conversationId: `conv-full-${Date.now()}`
      },
      expected: 'Should extract all, get calendar, send slots, update GHL'
    }
  ];
  
  let totalCost = 0;
  const results = [];
  
  for (const scenario of scenarios) {
    const result = await analyzeToolUsage(scenario.name, scenario.state, scenario.expected);
    if (result) {
      totalCost += result.estimatedCost;
      results.push({
        scenario: scenario.name,
        ...result
      });
    }
  }
  
  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(60)}`);
  
  console.log('\nTool usage by scenario:');
  results.forEach(r => {
    console.log(`\n${r.scenario}:`);
    console.log(`  Total calls: ${r.totalCalls}`);
    console.log(`  Issues: ${r.issues.length === 0 ? 'None' : r.issues.join(', ')}`);
    console.log(`  Cost: $${r.estimatedCost.toFixed(4)}`);
  });
  
  console.log(`\n💰 Total estimated cost: $${totalCost.toFixed(4)}`);
  
  // Recommendations
  console.log('\n📋 Recommendations:');
  const allIssues = results.flatMap(r => r.issues);
  if (allIssues.length === 0) {
    console.log('  ✅ Tool usage appears to be optimal');
  } else {
    console.log('  ⚠️  Consider addressing these issues:');
    [...new Set(allIssues)].forEach(issue => {
      console.log(`    - ${issue}`);
    });
  }
}

runAnalysis().catch(console.error);