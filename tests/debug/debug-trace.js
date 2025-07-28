import { Client } from 'langsmith';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

if (!process.env.LANGSMITH_API_KEY) {
  console.error('❌ LANGSMITH_API_KEY not found in environment variables');
  process.exit(1);
}

const client = new Client({
  apiKey: process.env.LANGSMITH_API_KEY,
  apiUrl: "https://api.smith.langchain.com"
});

/**
 * Main trace analysis function with multiple fallback methods
 * @param {string} traceId - The trace or run ID to analyze
 */
async function analyzeTrace(traceId) {
  console.log(`🔍 Trace Analysis: ${traceId}\n`);
  console.log(`🔐 API Key: ${process.env.LANGSMITH_API_KEY.substring(0, 10)}...`);
  console.log(`📡 API URL: https://api.smith.langchain.com\n`);

  // Try different approaches to get trace data
  console.log(`📊 Attempting multiple methods to fetch trace data...\n`);

  // Method 1: Try to get runs with the trace ID
  console.log(`1️⃣ Method 1: Fetching runs by trace ID...`);
  const runs = [];
  let runCount = 0;
  
  try {
    for await (const run of client.listRuns({ traceId: traceId })) {
      runs.push(run);
      runCount++;
      
      // Log first few runs for debugging
      if (runCount <= 3) {
        console.log(`  ✓ Found run ${runCount}: ${run.id.substring(0, 8)}... (${run.run_type})`);
      }
    }
    console.log(`  Total runs found: ${runCount}\n`);
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}\n`);
  }

  // Method 2: Try to fetch by run ID (assuming trace ID might be a run ID)
  console.log(`2️⃣ Method 2: Checking if ID is a run ID...`);
  try {
    const runDetails = await client.readRun(traceId);
    if (runDetails) {
      console.log(`  ✓ Found as run ID!`);
      console.log(`  - Name: ${runDetails.name}`);
      console.log(`  - Type: ${runDetails.run_type}`);
      console.log(`  - Status: ${runDetails.status}`);
      console.log(`  - Trace ID: ${runDetails.trace_id}\n`);
      
      // If it's a run, get the actual trace
      if (runDetails.trace_id && runDetails.trace_id !== traceId) {
        console.log(`  🔄 Fetching actual trace: ${runDetails.trace_id}`);
        return analyzeTrace(runDetails.trace_id);
      }
    }
  } catch (error) {
    console.log(`  ❌ Not a run ID: ${error.message}\n`);
  }

  // Method 3: Try searching with different parameters
  console.log(`3️⃣ Method 3: Searching with relaxed parameters...`);
  try {
    const searchRuns = [];
    let searchCount = 0;
    
    // Try without explicit traceId parameter
    for await (const run of client.listRuns({ limit: 10 })) {
      if (run.trace_id === traceId || run.id === traceId) {
        searchRuns.push(run);
        searchCount++;
        console.log(`  ✓ Found matching run: ${run.id.substring(0, 8)}...`);
      }
    }
    
    if (searchCount > 0) {
      console.log(`  Total matching runs: ${searchCount}\n`);
      runs.push(...searchRuns);
    } else {
      console.log(`  No matching runs found\n`);
    }
  } catch (error) {
    console.log(`  ❌ Search error: ${error.message}\n`);
  }

  // If we found runs, analyze them
  if (runs.length > 0) {
    console.log(`✅ Successfully retrieved ${runs.length} runs. Analyzing...\n`);
    return analyzeRuns(runs, traceId);
  } else {
    console.log(`❌ No runs found for trace ID: ${traceId}\n`);
    console.log(`Troubleshooting tips:`);
    console.log(`1. Verify the trace ID is correct`);
    console.log(`2. Ensure the API key has access to this project`);
    console.log(`3. Check if the trace was created recently (may take time to index)`);
    console.log(`4. Try using a run ID instead of a trace ID`);
  }
}

/**
 * Analyze runs from a trace
 * @param {Array} runs - Array of runs to analyze
 * @param {string} traceId - Original trace ID for reference
 */
async function analyzeRuns(runs, traceId) {
  console.log(`${'='.repeat(80)}`);
  console.log(`📊 TRACE ANALYSIS REPORT`);
  console.log(`Trace ID: ${traceId}`);
  console.log(`Total Runs: ${runs.length}`);
  console.log(`${'='.repeat(80)}\n`);

  // Sort runs by start time
  runs.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  // Analyze each run
  for (const run of runs) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Run: ${run.name}`);
    console.log(`ID: ${run.id}`);
    console.log(`Status: ${run.status}`);
    console.log(`Type: ${run.run_type}`);
    console.log(`Start: ${run.start_time}`);
    
    if (run.error) {
      console.log(`\n❌ ERROR: ${run.error}`);
    }
    
    // Check inputs
    if (run.inputs) {
      console.log(`\n📥 Inputs:`);
      console.log(JSON.stringify(run.inputs, null, 2));
    }
    
    // Check outputs
    if (run.outputs) {
      console.log(`\n📤 Outputs:`);
      
      // Look for tool calls in messages
      if (run.outputs.messages) {
        for (const msg of run.outputs.messages) {
          if (msg.kwargs?.tool_calls) {
            console.log(`\n🔧 Tool Calls Found:`);
            for (const toolCall of msg.kwargs.tool_calls) {
              console.log(`  - Tool: ${toolCall.name}`);
              console.log(`    Args: ${JSON.stringify(toolCall.args, null, 4)}`);
            }
          }
          
          // Check for tool responses
          if (msg.kwargs?.name) {
            console.log(`\n🔨 Tool Response:`);
            console.log(`  - Tool: ${msg.kwargs.name}`);
            console.log(`  - Content: ${msg.kwargs.content}`);
          }
        }
      } else {
        console.log(JSON.stringify(run.outputs, null, 2));
      }
    }
    
    // Check for specific error patterns
    if (run.outputs?.messages) {
      for (const msg of run.outputs.messages) {
        if (msg.kwargs?.content?.includes('400') || 
            msg.kwargs?.content?.includes('401') ||
            msg.kwargs?.content?.includes('404') ||
            msg.kwargs?.content?.includes('500')) {
          console.log(`\n⚠️  HTTP Error detected in response!`);
        }
      }
    }
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('🔍 Analysis Complete\n');
  
  // Look for common patterns
  analyzeCommonIssues(runs);
  
  // Analyze conversation flow
  const flowAnalysis = analyzeConversationFlow(runs);
  console.log('\n📋 Conversation Flow Analysis:');
  console.log(`Steps: ${flowAnalysis.steps.join(' → ')}`);
  console.log(`Flow Correct: ${flowAnalysis.isCorrect ? '✅ Yes' : '❌ No'}`);
  if (flowAnalysis.issues.length > 0) {
    console.log('Issues:');
    flowAnalysis.issues.forEach(issue => console.log(`  - ${issue}`));
  }
  
  // Tool usage statistics
  const toolStats = getToolStats(runs);
  console.log('\n📊 Tool Usage Statistics:');
  Object.entries(toolStats).forEach(([tool, count]) => {
    console.log(`  - ${tool}: ${count} calls`);
  });
}

/**
 * Analyze common issues in tool calls
 * @param {Array} runs - Array of runs to analyze
 */
function analyzeCommonIssues(runs) {
  console.log('\n📋 Common Issues Analysis:');
  
  const issues = [];
  
  for (const run of runs) {
    // Check for hardcoded IDs
    if (run.outputs?.messages) {
      for (const msg of run.outputs.messages) {
        if (msg.kwargs?.tool_calls) {
          for (const toolCall of msg.kwargs.tool_calls) {
            const argsStr = JSON.stringify(toolCall.args);
            
            // Check for example/hardcoded IDs
            if (argsStr.includes('example-contact-id') || 
                argsStr.includes('test-contact-id') ||
                argsStr.includes('dummy-')) {
              issues.push({
                type: 'HARDCODED_ID',
                tool: toolCall.name,
                detail: 'Using example/hardcoded ID instead of dynamic value',
                args: toolCall.args
              });
            }
            
            // Check for missing required fields
            if (toolCall.name === 'getCalendarSlots' && 
                (!toolCall.args.contactId || !toolCall.args.locationId || !toolCall.args.calendarId)) {
              issues.push({
                type: 'MISSING_PARAMS',
                tool: toolCall.name,
                detail: 'Missing required parameters',
                args: toolCall.args
              });
            }
          }
        }
      }
    }
  }
  
  // Print issues
  if (issues.length > 0) {
    console.log('\n❌ Issues Found:');
    issues.forEach((issue, i) => {
      console.log(`\n${i + 1}. ${issue.type}`);
      console.log(`   Tool: ${issue.tool}`);
      console.log(`   Detail: ${issue.detail}`);
      console.log(`   Args: ${JSON.stringify(issue.args, null, 2)}`);
    });
  } else {
    console.log('\n✅ No obvious issues found in tool calls');
  }
}

/**
 * Analyze conversation flow
 * @param {Array} runs - Array of runs to analyze
 * @returns {Object} Flow analysis results
 */
function analyzeConversationFlow(runs) {
  const expectedFlow = ['GREETING', 'DISCOVERY', 'GOAL_SETTING', 'BUDGET_QUALIFICATION', 'EMAIL_COLLECTION', 'APPOINTMENT_BOOKING'];
  const steps = [];
  const issues = [];
  
  // Extract conversation steps from runs
  runs.forEach(run => {
    if (run.inputs?.messages) {
      const lastMsg = run.inputs.messages[run.inputs.messages.length - 1];
      if (lastMsg?.content) {
        const content = lastMsg.content.toLowerCase();
        
        let detectedStep = null;
        if (content.includes('hello') || content.includes('hi ')) {
          detectedStep = 'GREETING';
        } else if (content.includes('problem') || content.includes('struggling')) {
          detectedStep = 'DISCOVERY';
        } else if (content.includes('goal') || content.includes('achieve')) {
          detectedStep = 'GOAL_SETTING';
        } else if (content.includes('budget') || content.includes('invest')) {
          detectedStep = 'BUDGET_QUALIFICATION';
        } else if (content.includes('email')) {
          detectedStep = 'EMAIL_COLLECTION';
        } else if (content.includes('calendar') || content.includes('appointment')) {
          detectedStep = 'APPOINTMENT_BOOKING';
        }
        
        if (detectedStep && !steps.includes(detectedStep)) {
          steps.push(detectedStep);
        }
      }
    }
  });
  
  // Check if flow is correct
  let isCorrect = true;
  for (let i = 0; i < Math.min(expectedFlow.length, steps.length); i++) {
    if (steps[i] !== expectedFlow[i]) {
      isCorrect = false;
      issues.push(`Expected ${expectedFlow[i]} at step ${i + 1}, got ${steps[i]}`);
    }
  }
  
  if (steps.length < expectedFlow.length) {
    issues.push(`Missing steps: ${expectedFlow.slice(steps.length).join(', ')}`);
    isCorrect = false;
  }
  
  return { steps, isCorrect, issues };
}

/**
 * Get tool usage statistics
 * @param {Array} runs - Array of runs
 * @returns {Object} Tool usage counts
 */
function getToolStats(runs) {
  const stats = {};
  
  runs.forEach(run => {
    if (run.outputs?.messages) {
      run.outputs.messages.forEach(msg => {
        if (msg.kwargs?.tool_calls) {
          msg.kwargs.tool_calls.forEach(toolCall => {
            stats[toolCall.name] = (stats[toolCall.name] || 0) + 1;
          });
        }
      });
    }
  });
  
  return stats;
}

// Export functions for reuse
export { analyzeTrace, analyzeRuns, analyzeCommonIssues };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const traceId = process.argv[2];
  if (!traceId) {
    console.error('❌ Please provide a trace ID as argument');
    console.log('Usage: node debug-trace.js <trace-id>');
    process.exit(1);
  }
  
  analyzeTrace(traceId)
    .then(result => {
      console.log('\n✅ Analysis complete');
    })
    .catch(error => {
      console.error('\n❌ Analysis failed:', error.message);
      console.error(error.stack);
    });
}