#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

import { Client } from 'langsmith';

const client = new Client({
  apiKey: process.env.LANGSMITH_API_KEY
});

async function analyzeTrace() {
  const traceId = '1f06a726-1ad2-66b8-8afb-8f05212f1e9d';
  
  console.log(`\n🔍 Analyzing trace: ${traceId}`);
  console.log('Looking for calendar display issues...\n');
  
  try {
    // Get the main trace
    const run = await client.readRun(traceId);
    console.log('📊 Trace Overview:');
    console.log(`- Name: ${run.name}`);
    console.log(`- Status: ${run.status}`);
    console.log(`- Start: ${new Date(run.start_time).toISOString()}`);
    console.log(`- Duration: ${run.end_time ? ((new Date(run.end_time) - new Date(run.start_time)) / 1000).toFixed(2) + 's' : 'Still running'}`);
    
    if (run.error) {
      console.log(`\n❌ Error: ${run.error}`);
    }
    
    // Check inputs
    if (run.inputs) {
      console.log('\n📥 Inputs:');
      if (run.inputs.messages) {
        run.inputs.messages.forEach((msg, idx) => {
          console.log(`  ${idx + 1}. [${msg.type || msg.role}] ${msg.content?.substring(0, 100)}...`);
        });
      }
    }
    
    // Get child runs to see tool calls
    const childRuns = [];
    for await (const childRun of client.listRuns({
      projectName: 'default',
      filter: `eq(parent_run_id, "${traceId}")`
    })) {
      childRuns.push(childRun);
    }
    
    console.log(`\n🛠️  Found ${childRuns.length} child runs (tool calls)`);
    
    // Look for calendar-related tool calls
    const calendarCalls = childRuns.filter(run => 
      run.name === 'get_calendar_slots' || 
      run.name === 'getCalendarSlots' ||
      run.name?.includes('calendar')
    );
    
    if (calendarCalls.length > 0) {
      console.log(`\n📅 Calendar Tool Calls Found: ${calendarCalls.length}`);
      for (const call of calendarCalls) {
        console.log(`\n  Tool: ${call.name}`);
        console.log(`  Status: ${call.status}`);
        console.log(`  Time: ${new Date(call.start_time).toISOString()}`);
        
        if (call.inputs) {
          console.log('  Inputs:', JSON.stringify(call.inputs, null, 2));
        }
        
        if (call.outputs) {
          console.log('  Output:', JSON.stringify(call.outputs, null, 2).substring(0, 500) + '...');
        }
        
        if (call.error) {
          console.log('  Error:', call.error);
        }
      }
    }
    
    // Look for state information
    console.log('\n📊 Looking for lead qualification state...');
    
    const extractCalls = childRuns.filter(run => 
      run.name === 'extract_lead_info' || 
      run.name === 'extractLeadInfo'
    );
    
    if (extractCalls.length > 0) {
      console.log(`\nExtraction calls: ${extractCalls.length}`);
      const lastExtract = extractCalls[extractCalls.length - 1];
      if (lastExtract.outputs) {
        console.log('Last extracted info:', JSON.stringify(lastExtract.outputs, null, 2));
      }
    }
    
    // Check final outputs
    if (run.outputs) {
      console.log('\n📤 Final Outputs:');
      if (run.outputs.messages) {
        const lastMessages = run.outputs.messages.slice(-3);
        lastMessages.forEach((msg, idx) => {
          console.log(`\n  Message ${idx + 1}:`);
          console.log(`  Role: ${msg.type || msg.role}`);
          console.log(`  Content: ${msg.content}`);
          if (msg.tool_calls) {
            console.log(`  Tool Calls: ${msg.tool_calls.map(tc => tc.name).join(', ')}`);
          }
        });
      }
      
      if (run.outputs.leadInfo) {
        console.log('\n  Lead Info State:');
        console.log(`  - Name: ${run.outputs.leadInfo.name || 'Not set'}`);
        console.log(`  - Problem: ${run.outputs.leadInfo.problem || 'Not set'}`);
        console.log(`  - Goal: ${run.outputs.leadInfo.goal || 'Not set'}`);
        console.log(`  - Budget: ${run.outputs.leadInfo.budget || 'Not set'}`);
        console.log(`  - Email: ${run.outputs.leadInfo.email || 'Not set'}`);
      }
    }
    
    // Look for send message calls
    const messageCalls = childRuns.filter(run => 
      run.name === 'send_ghl_message' || 
      run.name === 'sendGHLMessage'
    );
    
    if (messageCalls.length > 0) {
      console.log(`\n💬 Messages Sent: ${messageCalls.length}`);
      messageCalls.forEach((call, idx) => {
        if (call.inputs?.message) {
          console.log(`\n  Message ${idx + 1}: "${call.inputs.message.substring(0, 100)}..."`);
        }
      });
    }
    
  } catch (error) {
    console.error('Error analyzing trace:', error);
  }
}

analyzeTrace();