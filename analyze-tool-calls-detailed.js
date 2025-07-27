#!/usr/bin/env node
/**
 * Detailed analysis of tool calls in each scenario
 */

import { config as dotenvConfig } from 'dotenv';
import { salesAgent } from './agents/salesAgent.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { GHLService } from './services/ghlService.js';

dotenvConfig();

const ghlService = new GHLService(
  process.env.GHL_API_KEY,  
  process.env.GHL_LOCATION_ID
);

// Intercept console.log to capture tool calls
let toolCallLog = [];
const originalLog = console.log;
const originalInfo = console.info;

function captureToolCalls() {
  toolCallLog = [];
  
  console.log = function(...args) {
    const logStr = args.join(' ');
    
    // Capture tool-related logs
    if (logStr.includes('EXTRACT LEAD INFO') || 
        logStr.includes('SEND GHL MESSAGE') ||
        logStr.includes('UPDATE GHL CONTACT') ||
        logStr.includes('GET CALENDAR SLOTS') ||
        logStr.includes('Tool called:')) {
      toolCallLog.push(logStr);
    }
    
    // Still output to console
    originalLog.apply(console, args);
  };
  
  console.info = function(...args) {
    const logStr = args.join(' ');
    if (logStr.includes('Tool') || logStr.includes('tool')) {
      toolCallLog.push(logStr);
    }
    originalInfo.apply(console, args);
  };
}

function restoreConsole() {
  console.log = originalLog;
  console.info = originalInfo;
}

async function analyzeScenario(name, state) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 Analyzing: ${name}`);
  console.log(`${'='.repeat(70)}`);
  
  captureToolCalls();
  
  try {
    const startTime = Date.now();
    
    const result = await salesAgent.invoke(state, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        contactId: state.contactId,
        thread_id: `analysis-${Date.now()}`
      },
      recursionLimit: 20
    });
    
    const duration = Date.now() - startTime;
    
    restoreConsole();
    
    // Analyze captured tool calls
    console.log('\n🔧 Tool Calls Sequence:');
    
    const toolCounts = {
      extract_lead_info: 0,
      send_ghl_message: 0,
      update_ghl_contact: 0,
      get_calendar_slots: 0,
      parse_time_selection: 0,
      book_appointment: 0
    };
    
    // Count actual tool calls from messages
    let toolSequence = [];
    if (result.messages) {
      result.messages.forEach((msg, idx) => {
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          msg.tool_calls.forEach(call => {
            const toolName = call.function.name;
            toolCounts[toolName] = (toolCounts[toolName] || 0) + 1;
            toolSequence.push(`${idx + 1}. ${toolName}`);
          });
        }
      });
    }
    
    // Display sequence
    if (toolSequence.length > 0) {
      toolSequence.forEach(seq => console.log(`  ${seq}`));
    } else {
      console.log('  No tool calls detected');
    }
    
    // Calculate metrics
    const totalTools = Object.values(toolCounts).reduce((a, b) => a + b, 0);
    const userMessages = state.messages.filter(m => 
      m._getType?.() === 'human' || m.type === 'human'
    ).length;
    
    console.log('\n📈 Metrics:');
    console.log(`  - User messages: ${userMessages}`);
    console.log(`  - Total tool calls: ${totalTools}`);
    console.log(`  - Tools per user message: ${(totalTools / userMessages).toFixed(2)}`);
    console.log(`  - Execution time: ${(duration / 1000).toFixed(2)}s`);
    
    // Tool breakdown
    console.log('\n📊 Tool Usage Breakdown:');
    Object.entries(toolCounts).forEach(([tool, count]) => {
      if (count > 0) {
        console.log(`  - ${tool}: ${count}`);
      }
    });
    
    // Check for inefficiencies
    console.log('\n⚠️  Efficiency Analysis:');
    const issues = [];
    
    if (toolCounts.extract_lead_info > 2) {
      issues.push(`Excessive extraction: ${toolCounts.extract_lead_info} calls (should be ≤2)`);
    }
    
    if (toolCounts.send_ghl_message > userMessages + 1) {
      issues.push(`Too many messages: ${toolCounts.send_ghl_message} sent for ${userMessages} user messages`);
    }
    
    if (toolCounts.update_ghl_contact > 2) {
      issues.push(`Excessive GHL updates: ${toolCounts.update_ghl_contact} (should be ≤2)`);
    }
    
    // Check if extraction happens before sending
    const extractBeforeSend = toolSequence.some((seq, idx) => 
      seq.includes('extract_lead_info') && 
      toolSequence[idx + 1]?.includes('send_ghl_message')
    );
    
    if (!extractBeforeSend && userMessages > 0) {
      issues.push('Not extracting before sending responses');
    }
    
    if (issues.length === 0) {
      console.log('  ✅ Tool usage appears optimal');
    } else {
      issues.forEach(issue => console.log(`  ❌ ${issue}`));
    }
    
    // Cost estimate (rough)
    const costPerTool = 0.002; // $0.002 per tool call estimate
    const estimatedCost = totalTools * costPerTool;
    console.log(`\n💰 Estimated cost: $${estimatedCost.toFixed(4)}`);
    
    return {
      name,
      totalTools,
      toolCounts,
      duration,
      estimatedCost,
      issues
    };
    
  } catch (error) {
    restoreConsole();
    console.log('❌ Error:', error.message);
    return null;
  }
}

async function runDetailedAnalysis() {
  console.log('🔍 DETAILED TOOL USAGE ANALYSIS');
  console.log('Analyzing real tool call patterns...\n');
  
  const scenarios = [
    {
      name: 'Scenario 1: Simple Greeting',
      state: {
        messages: [new HumanMessage('Hola')],
        leadInfo: {},
        contactId: `test-1-${Date.now()}`,
        conversationId: `conv-1-${Date.now()}`
      }
    },
    {
      name: 'Scenario 2: Name Only',
      state: {
        messages: [new HumanMessage('Soy Carlos')],
        leadInfo: {},
        contactId: `test-2-${Date.now()}`,
        conversationId: `conv-2-${Date.now()}`
      }
    },
    {
      name: 'Scenario 3: Complex Info',
      state: {
        messages: [new HumanMessage('Hola, soy Ana, tengo problemas con ventas')],
        leadInfo: {},
        contactId: `test-3-${Date.now()}`,
        conversationId: `conv-3-${Date.now()}`
      }
    },
    {
      name: 'Scenario 4: Budget Confirmation',
      state: {
        messages: [
          new HumanMessage('Soy Luis'),
          new AIMessage('¿Cuál es tu presupuesto mensual para marketing?'),
          new HumanMessage('$500')
        ],
        leadInfo: { name: 'Luis' },
        contactId: `test-4-${Date.now()}`,
        conversationId: `conv-4-${Date.now()}`
      }
    },
    {
      name: 'Scenario 5: Full Qualification',
      state: {
        messages: [
          new HumanMessage('Soy Roberto, restaurante sin clientes, quiero llenar el lugar, $800 al mes, roberto@rest.com')
        ],
        leadInfo: {},
        contactId: `test-5-${Date.now()}`,
        conversationId: `conv-5-${Date.now()}`
      }
    }
  ];
  
  const results = [];
  
  for (const scenario of scenarios) {
    const result = await analyzeScenario(scenario.name, scenario.state);
    if (result) {
      results.push(result);
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary Report
  console.log(`\n\n${'='.repeat(70)}`);
  console.log('📊 SUMMARY REPORT');
  console.log(`${'='.repeat(70)}`);
  
  const totalCost = results.reduce((sum, r) => sum + r.estimatedCost, 0);
  const totalCalls = results.reduce((sum, r) => sum + r.totalTools, 0);
  const avgCallsPerScenario = totalCalls / results.length;
  
  console.log(`\n📈 Overall Metrics:`);
  console.log(`  - Scenarios analyzed: ${results.length}`);
  console.log(`  - Total tool calls: ${totalCalls}`);
  console.log(`  - Average calls per scenario: ${avgCallsPerScenario.toFixed(2)}`);
  console.log(`  - Total estimated cost: $${totalCost.toFixed(4)}`);
  console.log(`  - Average cost per scenario: $${(totalCost / results.length).toFixed(4)}`);
  
  console.log(`\n🔧 Tool Usage Summary:`);
  const aggregatedTools = {};
  results.forEach(r => {
    Object.entries(r.toolCounts).forEach(([tool, count]) => {
      aggregatedTools[tool] = (aggregatedTools[tool] || 0) + count;
    });
  });
  
  Object.entries(aggregatedTools)
    .sort(([, a], [, b]) => b - a)
    .forEach(([tool, count]) => {
      if (count > 0) {
        console.log(`  - ${tool}: ${count} total (${(count / results.length).toFixed(2)} avg)`);
      }
    });
  
  console.log(`\n⚠️  Issues Summary:`);
  const allIssues = results.flatMap(r => r.issues);
  if (allIssues.length === 0) {
    console.log('  ✅ No efficiency issues detected');
  } else {
    const issueCounts = {};
    allIssues.forEach(issue => {
      const key = issue.split(':')[0];
      issueCounts[key] = (issueCounts[key] || 0) + 1;
    });
    
    Object.entries(issueCounts).forEach(([issue, count]) => {
      console.log(`  - ${issue}: ${count} scenarios affected`);
    });
  }
  
  console.log(`\n💡 Optimization Recommendations:`);
  if (avgCallsPerScenario > 5) {
    console.log('  - Consider reducing tool calls per interaction');
  }
  if (aggregatedTools.extract_lead_info > results.length * 1.5) {
    console.log('  - Optimize extraction to avoid redundant calls');
  }
  if (aggregatedTools.update_ghl_contact > results.length * 1.5) {
    console.log('  - Batch GHL updates to reduce API calls');
  }
}

runDetailedAnalysis().catch(console.error);