import { Client } from "langsmith";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Initialize LangSmith client
const client = new Client({
  apiKey: process.env.LANGSMITH_API_KEY,
  apiUrl: "https://api.smith.langchain.com"
});

async function debugTrace(traceId) {
  console.log(`\n🔍 Debugging LangSmith Trace: ${traceId}\n`);

  try {
    // Fetch all runs in this trace
    const runs = [];
    for await (const run of client.listRuns({
      traceId: traceId,
      select: ["id", "name", "run_type", "status", "error", "inputs", "outputs", "start_time", "end_time", "parent_run_id", "extra"]
    })) {
      runs.push(run);
    }

    console.log(`Found ${runs.length} runs in trace\n`);

    // Sort runs by start time to show execution order
    runs.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    // Build a hierarchy map
    const runMap = new Map();
    runs.forEach(run => runMap.set(run.id, run));

    // Find root run(s)
    const rootRuns = runs.filter(run => !run.parent_run_id);

    // Display runs hierarchically
    function displayRun(run, indent = "") {
      const statusEmoji = run.error ? "❌" : "✅";
      const duration = run.end_time ? 
        `${(new Date(run.end_time) - new Date(run.start_time)) / 1000}s` : 
        "pending";

      console.log(`${indent}${statusEmoji} ${run.name} (${run.run_type}) - ${duration}`);
      console.log(`${indent}   ID: ${run.id}`);
      
      if (run.error) {
        console.log(`${indent}   ⚠️  ERROR: ${run.error}`);
      }

      // Show inputs
      if (run.inputs && Object.keys(run.inputs).length > 0) {
        console.log(`${indent}   📥 Inputs:`);
        const inputStr = JSON.stringify(run.inputs, null, 2);
        inputStr.split('\n').forEach(line => {
          console.log(`${indent}      ${line}`);
        });
      }

      // Show outputs
      if (run.outputs && Object.keys(run.outputs).length > 0) {
        console.log(`${indent}   📤 Outputs:`);
        const outputStr = JSON.stringify(run.outputs, null, 2);
        outputStr.split('\n').forEach(line => {
          console.log(`${indent}      ${line}`);
        });
      }

      // Check for specific issues
      if (run.inputs) {
        // Check for hardcoded IDs
        const inputStr = JSON.stringify(run.inputs);
        if (inputStr.includes('8eSdb9ZDsXDem9wlED9u')) {
          console.log(`${indent}   🔍 Found hardcoded contactId: 8eSdb9ZDsXDem9wlED9u`);
        }

        // Check for missing required fields
        if (run.run_type === 'tool' && run.name === 'getCalendarSlots') {
          const required = ['name', 'email', 'phone', 'problem', 'goal', 'budget'];
          const missing = required.filter(field => !run.inputs[field]);
          if (missing.length > 0) {
            console.log(`${indent}   ⚠️  Missing required fields for calendar: ${missing.join(', ')}`);
          }
        }
      }

      // Check for API errors in outputs
      if (run.outputs) {
        const outputStr = JSON.stringify(run.outputs);
        if (outputStr.includes('"status":400') || outputStr.includes('Bad Request')) {
          console.log(`${indent}   🚨 API returned 400 Bad Request`);
        }
        if (outputStr.includes('"status":401') || outputStr.includes('Unauthorized')) {
          console.log(`${indent}   🚨 API returned 401 Unauthorized`);
        }
        if (outputStr.includes('"status":404') || outputStr.includes('Not Found')) {
          console.log(`${indent}   🚨 API returned 404 Not Found`);
        }
        if (outputStr.includes('"status":500') || outputStr.includes('Internal Server Error')) {
          console.log(`${indent}   🚨 API returned 500 Internal Server Error`);
        }
      }

      console.log(); // Empty line for readability

      // Display child runs
      const childRuns = runs.filter(r => r.parent_run_id === run.id);
      childRuns.forEach(child => displayRun(child, indent + "  "));
    }

    // Display from root runs
    rootRuns.forEach(root => displayRun(root));

    // Summary of issues
    console.log("\n📊 TRACE SUMMARY:");
    console.log("================");
    
    const failedRuns = runs.filter(r => r.error);
    console.log(`Total runs: ${runs.length}`);
    console.log(`Failed runs: ${failedRuns.length}`);
    
    if (failedRuns.length > 0) {
      console.log("\n❌ Failed Runs:");
      failedRuns.forEach(run => {
        console.log(`  - ${run.name}: ${run.error}`);
      });
    }

    // Check for common issues
    const hardcodedIdRuns = runs.filter(r => 
      JSON.stringify(r.inputs || {}).includes('8eSdb9ZDsXDem9wlED9u')
    );
    
    if (hardcodedIdRuns.length > 0) {
      console.log("\n⚠️  Runs with hardcoded contactId:");
      hardcodedIdRuns.forEach(run => {
        console.log(`  - ${run.name}`);
      });
    }

    // Check for missing parameters in calendar tool calls
    const calendarRuns = runs.filter(r => r.name === 'getCalendarSlots');
    const calendarRunsWithMissingParams = calendarRuns.filter(run => {
      if (!run.inputs) return true;
      const required = ['name', 'email', 'phone', 'problem', 'goal', 'budget'];
      return required.some(field => !run.inputs[field]);
    });

    if (calendarRunsWithMissingParams.length > 0) {
      console.log("\n⚠️  Calendar tool calls with missing parameters:");
      calendarRunsWithMissingParams.forEach(run => {
        const required = ['name', 'email', 'phone', 'problem', 'goal', 'budget'];
        const missing = required.filter(field => !run.inputs?.[field]);
        console.log(`  - Run ${run.id}: missing ${missing.join(', ')}`);
      });
    }

  } catch (error) {
    console.error("Error fetching trace:", error);
    console.error("Make sure your LANGSMITH_API_KEY is set correctly");
  }
}

// Run the debug script
const traceId = "1f0699c0-c65f-6025-b7aa-ca4078b297df";
debugTrace(traceId);