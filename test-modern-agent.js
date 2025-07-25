import 'dotenv/config';
import { salesAgent as modernAgent } from './agents/modernSalesAgent.js';
import { createSalesAgent } from './agents/salesAgent.js';
import { GHLService } from './services/ghlService.js';
import { HumanMessage } from '@langchain/core/messages';

// Initialize services
const ghlService = new GHLService(
  process.env.GHL_API_KEY,
  process.env.GHL_LOCATION_ID
);

const classicAgent = createSalesAgent();

// Test scenarios
const testScenarios = [
  {
    name: "Basic Greeting",
    messages: [
      "Hi there!"
    ],
    expectedBehavior: "Should ask for name"
  },
  {
    name: "Full Qualification - Qualified Lead",
    messages: [
      "Hello!",
      "I'm Sarah Johnson",
      "I'm struggling to get new customers for my restaurant",
      "I want to fill my restaurant every night",
      "I can spend about $500 per month",
      "Sure, my email is sarah@restaurant.com"
    ],
    expectedBehavior: "Should offer calendar slots and book appointment"
  },
  {
    name: "Under Budget Lead",
    messages: [
      "Hi",
      "I'm Mike",
      "Need help with marketing",
      "Want more sales",
      "Only have $200/month budget"
    ],
    expectedBehavior: "Should politely decline and tag as nurture lead"
  }
];

// Test runner
async function runTests() {
  console.log("🧪 Testing Modern Agent vs Classic Agent\n");
  
  for (const scenario of testScenarios) {
    console.log(`\n📋 Test Scenario: ${scenario.name}`);
    console.log(`Expected: ${scenario.expectedBehavior}`);
    console.log("─".repeat(50));
    
    // Test both agents
    await testBothAgents(scenario);
    
    console.log("\n" + "═".repeat(50) + "\n");
  }
}

async function testBothAgents(scenario) {
  // Test Classic Agent
  console.log("\n🔷 CLASSIC AGENT:");
  const classicResult = await testClassicAgent(scenario.messages);
  
  // Test Modern Agent
  console.log("\n🔶 MODERN AGENT:");
  const modernResult = await testModernAgent(scenario.messages);
  
  // Compare results
  console.log("\n📊 COMPARISON:");
  compareResults(classicResult, modernResult);
}

async function testClassicAgent(messages) {
  let state = {
    messages: [],
    messageCount: 0,
    ghlConfig: {
      ghlService,
      calendarId: process.env.GHL_CALENDAR_ID
    }
  };
  
  const responses = [];
  
  for (const message of messages) {
    state.messages.push(new HumanMessage(message));
    state.messageCount = state.messages.length;
    
    try {
      const result = await classicAgent.invoke(state);
      const lastMessage = result.messages[result.messages.length - 1];
      console.log(`User: ${message}`);
      console.log(`Agent: ${lastMessage.content}`);
      responses.push(lastMessage.content);
      
      // Update state with result
      state = { ...state, ...result };
    } catch (error) {
      console.error("Classic agent error:", error.message);
    }
  }
  
  return {
    responses,
    finalState: state,
    qualificationComplete: !!(state.leadName && state.leadBudget),
    qualified: state.leadBudget >= 300
  };
}

async function testModernAgent(messages) {
  let conversationMessages = [];
  const responses = [];
  let leadInfo = {};
  
  for (const message of messages) {
    conversationMessages.push({ role: "user", content: message });
    
    try {
      const result = await modernAgent.invoke({
        messages: conversationMessages,
        leadInfo,
        contactId: "test-contact-id"
      }, {
        configurable: {
          ghlService,
          calendarId: process.env.GHL_CALENDAR_ID,
          contactId: "test-contact-id",
          currentLeadInfo: leadInfo
        }
      });
      
      // Get the last AI message
      const aiMessages = result.messages.filter(m => m._getType() === 'ai');
      const lastResponse = aiMessages[aiMessages.length - 1];
      
      console.log(`User: ${message}`);
      console.log(`Agent: ${lastResponse.content}`);
      responses.push(lastResponse.content);
      
      // Extract lead info from tool calls
      const toolCalls = result.messages.filter(m => m.tool_calls?.length > 0);
      for (const tc of toolCalls) {
        if (tc.tool_calls[0]?.name === 'extract_lead_info') {
          const extracted = tc.tool_calls[0].args.result || {};
          leadInfo = { ...leadInfo, ...extracted };
        }
      }
      
      conversationMessages = result.messages;
    } catch (error) {
      console.error("Modern agent error:", error.message);
    }
  }
  
  return {
    responses,
    leadInfo,
    qualificationComplete: !!(leadInfo.name && leadInfo.budget),
    qualified: leadInfo.budget >= 300
  };
}

function compareResults(classic, modern) {
  console.log("\nQualification Complete:");
  console.log(`  Classic: ${classic.qualificationComplete ? '✅' : '❌'}`);
  console.log(`  Modern: ${modern.qualificationComplete ? '✅' : '❌'}`);
  
  console.log("\nLead Qualified (>=$300):");
  console.log(`  Classic: ${classic.qualified ? '✅' : '❌'}`);
  console.log(`  Modern: ${modern.qualified ? '✅' : '❌'}`);
  
  console.log("\nResponse Count:");
  console.log(`  Classic: ${classic.responses.length}`);
  console.log(`  Modern: ${modern.responses.length}`);
  
  // Check if both reached same conclusion
  const sameQualification = classic.qualificationComplete === modern.qualificationComplete;
  const sameQualified = classic.qualified === modern.qualified;
  
  console.log("\n🎯 Result: " + (sameQualification && sameQualified ? "✅ MATCH" : "❌ MISMATCH"));
}

// Performance test
async function performanceTest() {
  console.log("\n⚡ Performance Test\n");
  
  const testMessage = "Hi, I'm John and I need help with marketing. My goal is to get more customers. I have a budget of $500/month.";
  
  // Test Classic
  console.log("Testing Classic Agent...");
  const classicStart = Date.now();
  await classicAgent.invoke({
    messages: [new HumanMessage(testMessage)],
    messageCount: 1,
    ghlConfig: { ghlService, calendarId: process.env.GHL_CALENDAR_ID }
  });
  const classicTime = Date.now() - classicStart;
  
  // Test Modern
  console.log("Testing Modern Agent...");
  const modernStart = Date.now();
  await modernAgent.invoke({
    messages: [{ role: "user", content: testMessage }]
  }, {
    configurable: { ghlService, calendarId: process.env.GHL_CALENDAR_ID }
  });
  const modernTime = Date.now() - modernStart;
  
  console.log("\n📊 Performance Results:");
  console.log(`Classic Agent: ${classicTime}ms`);
  console.log(`Modern Agent: ${modernTime}ms`);
  console.log(`Difference: ${Math.abs(classicTime - modernTime)}ms ${modernTime < classicTime ? '(Modern is faster)' : '(Classic is faster)'}`);
}

// Run tests
async function main() {
  try {
    console.log("🚀 Starting Agent Comparison Tests\n");
    
    // Run functional tests
    await runTests();
    
    // Run performance test
    await performanceTest();
    
    console.log("\n✅ All tests completed!");
  } catch (error) {
    console.error("\n❌ Test error:", error);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { runTests, performanceTest };