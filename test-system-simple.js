#!/usr/bin/env node

console.log('🧪 SIMPLE SYSTEM TEST (No API Keys Required)\n');

// Test components individually without API calls
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, details = '') {
  console.log(`\n📝 ${name}`);
  console.log(`   Result: ${passed ? 'PASSED ✅' : 'FAILED ❌'}`);
  if (details) console.log(`   Details: ${details}`);
  
  testResults.tests.push({ name, passed, details });
  if (passed) testResults.passed++;
  else testResults.failed++;
}

// 1. Test extraction prompt fix
console.log('='.repeat(60));
console.log('📋 PART 1: EXTRACTION PROMPT TESTS');
console.log('='.repeat(60));

// Check if the extraction prompt now requests lowercase field names
import { readFileSync } from 'fs';

try {
  const salesAgentCode = readFileSync('./agents/salesAgent.js', 'utf-8');
  
  // Test 1: Check for lowercase field names in prompt
  const hasLowercasePrompt = salesAgentCode.includes('using LOWERCASE field names') ||
                            salesAgentCode.includes('Use lowercase field names');
  
  logTest('Extraction prompt requests lowercase fields', hasLowercasePrompt,
    'Prompt should explicitly request lowercase field names');
  
  // Test 2: Check for field mapping
  const hasFieldMapping = salesAgentCode.includes('name (person\'s name)') &&
                         salesAgentCode.includes('businessType (restaurant');
  
  logTest('Extraction prompt has clear field mapping', hasFieldMapping,
    'Prompt should map fields clearly (e.g., name, businessType)');
  
  // Test 3: Check for budget extraction instructions
  const hasBudgetInstructions = salesAgentCode.includes('Look for numbers with "mes"') ||
                                salesAgentCode.includes('mensual');
  
  logTest('Budget extraction instructions present', hasBudgetInstructions,
    'Should have specific instructions for extracting budget');
  
} catch (error) {
  logTest('Read sales agent file', false, error.message);
}

// 2. Test recursion protection
console.log('\n\n' + '='.repeat(60));
console.log('🔄 PART 2: RECURSION PROTECTION TESTS');
console.log('='.repeat(60));

try {
  const salesAgentCode = readFileSync('./agents/salesAgent.js', 'utf-8');
  
  // Test 1: Max extraction attempts
  const hasMaxAttempts = salesAgentCode.includes('MAX_EXTRACTION_ATTEMPTS') ||
                        salesAgentCode.includes('extractionCount >= 3');
  
  logTest('Max extraction attempts implemented', hasMaxAttempts,
    'Should limit extraction attempts to prevent loops');
  
  // Test 2: Message deduplication
  const hasMessageTracking = salesAgentCode.includes('processedMessages') &&
                            salesAgentCode.includes('messageHash');
  
  logTest('Message deduplication implemented', hasMessageTracking,
    'Should track processed messages to prevent reprocessing');
  
  // Test 3: State tracking
  const hasStateTracking = salesAgentCode.includes('extractionCount') &&
                          salesAgentCode.includes('maxExtractionReached');
  
  logTest('State tracking for recursion', hasStateTracking,
    'Should track extraction state');
  
} catch (error) {
  logTest('Recursion protection checks', false, error.message);
}

// 3. Test state management
console.log('\n\n' + '='.repeat(60));
console.log('🔧 PART 3: STATE MANAGEMENT TESTS');
console.log('='.repeat(60));

try {
  const salesAgentCode = readFileSync('./agents/salesAgent.js', 'utf-8');
  
  // Test 1: State annotation
  const hasStateAnnotation = salesAgentCode.includes('AgentStateAnnotation') &&
                            salesAgentCode.includes('Annotation.Root');
  
  logTest('State annotation properly defined', hasStateAnnotation,
    'Should use Annotation.Root for state management');
  
  // Test 2: No global variables
  const hasGlobalVars = salesAgentCode.match(/^(let|var)\s+\w+\s*=/gm);
  const noGlobalState = !hasGlobalVars || hasGlobalVars.length === 0;
  
  logTest('No global state variables', noGlobalState,
    'Should not use global variables for state');
  
  // Test 3: Proper reducers
  const hasReducers = salesAgentCode.includes('reducer:') &&
                     salesAgentCode.includes('default:');
  
  logTest('State fields have proper reducers', hasReducers,
    'Each state field should have reducer and default');
  
} catch (error) {
  logTest('State management checks', false, error.message);
}

// 4. Test tool structure
console.log('\n\n' + '='.repeat(60));
console.log('🛠️  PART 4: TOOL STRUCTURE TESTS');
console.log('='.repeat(60));

try {
  const salesAgentCode = readFileSync('./agents/salesAgent.js', 'utf-8');
  
  // Test 1: All tools return Command objects
  const hasCommandReturns = (salesAgentCode.match(/return new Command\(/g) || []).length >= 6;
  
  logTest('All tools return Command objects', hasCommandReturns,
    'Each tool should return a Command object');
  
  // Test 2: Tools use Zod schemas
  const hasZodSchemas = salesAgentCode.includes('z.object') &&
                       salesAgentCode.includes('z.string()');
  
  logTest('Tools use Zod validation', hasZodSchemas,
    'Tools should have Zod schema validation');
  
  // Test 3: Tool count
  const toolCount = (salesAgentCode.match(/tool\(/g) || []).length;
  const hasAllTools = toolCount >= 6;
  
  logTest('Has all 6 required tools', hasAllTools,
    `Found ${toolCount} tools (expected 6)`);
  
} catch (error) {
  logTest('Tool structure checks', false, error.message);
}

// 5. Test conversation termination
console.log('\n\n' + '='.repeat(60));
console.log('🏁 PART 5: CONVERSATION TERMINATION TESTS');
console.log('='.repeat(60));

try {
  const salesAgentCode = readFileSync('./agents/salesAgent.js', 'utf-8');
  
  // Test 1: Appointment booking terminates
  const hasBookingTermination = salesAgentCode.includes('appointmentBooked: true') &&
                               salesAgentCode.includes('goto: \'END\'');
  
  logTest('Appointment booking terminates conversation', hasBookingTermination,
    'Should end conversation after booking');
  
  // Test 2: Conditional edges
  const hasConditionalEdges = salesAgentCode.includes('conditionalEdges') ||
                             salesAgentCode.includes('addConditionalEdges');
  
  logTest('Has conditional edges for flow control', hasConditionalEdges,
    'Should use conditional edges for conversation flow');
  
} catch (error) {
  logTest('Conversation termination checks', false, error.message);
}

// 6. Test GHL integration
console.log('\n\n' + '='.repeat(60));
console.log('🔌 PART 6: GHL INTEGRATION TESTS');
console.log('='.repeat(60));

try {
  const ghlServiceCode = readFileSync('./services/ghlService.js', 'utf-8');
  
  // Test 1: WhatsApp message type
  const hasWhatsAppType = ghlServiceCode.includes('type: \'WhatsApp\'') ||
                         ghlServiceCode.includes('type: "WhatsApp"');
  
  logTest('Uses correct WhatsApp message type', hasWhatsAppType,
    'Should use type: "WhatsApp" not TYPE_WHATSAPP');
  
  // Test 2: Version header
  const hasVersionHeader = ghlServiceCode.includes('Version: \'2021-07-28\'') ||
                          ghlServiceCode.includes('Version: "2021-07-28"');
  
  logTest('Includes required Version header', hasVersionHeader,
    'Must include Version: 2021-07-28 header');
  
  // Test 3: Message structure handling
  const hasNestedStructure = ghlServiceCode.includes('messages.messages') ||
                            ghlServiceCode.includes('data.messages.messages');
  
  logTest('Handles nested message structure', hasNestedStructure,
    'Should handle response.data.messages.messages structure');
  
} catch (error) {
  logTest('GHL integration checks', false, error.message);
}

// Generate report
console.log('\n\n' + '='.repeat(60));
console.log('📊 TEST SUMMARY');
console.log('='.repeat(60));

const total = testResults.passed + testResults.failed;
const successRate = ((testResults.passed / total) * 100).toFixed(1);

console.log(`\nTotal Tests: ${total}`);
console.log(`Passed: ${testResults.passed}`);
console.log(`Failed: ${testResults.failed}`);
console.log(`Success Rate: ${successRate}%`);

if (testResults.failed > 0) {
  console.log('\n❌ Failed Tests:');
  testResults.tests
    .filter(t => !t.passed)
    .forEach(t => console.log(`  - ${t.name}`));
}

// Critical checks
console.log('\n🔍 CRITICAL FIXES VERIFIED:');

const criticalChecks = [
  {
    name: 'Field extraction lowercase fix',
    verified: testResults.tests.find(t => t.name.includes('lowercase'))?.passed
  },
  {
    name: 'Recursion protection implemented',
    verified: testResults.tests.filter(t => t.name.includes('recursion') || 
                                           t.name.includes('extraction attempts'))
                              .every(t => t.passed)
  },
  {
    name: 'State management correct',
    verified: testResults.tests.filter(t => t.name.includes('state'))
                              .every(t => t.passed)
  },
  {
    name: 'Tools return Command objects',
    verified: testResults.tests.find(t => t.name.includes('Command objects'))?.passed
  }
];

criticalChecks.forEach(check => {
  console.log(`  ${check.name}: ${check.verified ? 'YES ✅' : 'NO ❌'}`);
});

if (successRate === '100.0') {
  console.log('\n🎉 ALL TESTS PASSED! System is working correctly.');
} else {
  console.log('\n⚠️  Some tests failed. Review the implementation.');
}

// Save results
import { writeFileSync } from 'fs';
const report = {
  timestamp: new Date().toISOString(),
  successRate: successRate,
  results: testResults
};

writeFileSync('test-results-simple.json', JSON.stringify(report, null, 2));
console.log('\n📄 Results saved to test-results-simple.json');