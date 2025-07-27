#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

console.log('🧪 COMPONENT SYSTEM TEST\n');

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

// Helper function
function test(name, condition, details = '') {
  const passed = !!condition;
  results.tests.push({ name, passed, details });
  if (passed) results.passed++;
  else results.failed++;
  
  console.log(`✅ ${name}: ${passed ? 'PASSED' : 'FAILED'}`);
  if (!passed && details) console.log(`   Details: ${details}`);
}

// 1. Test extraction prompt fix
console.log('\n📋 TESTING EXTRACTION PROMPT FIX');
console.log('='.repeat(50));

import { readFileSync } from 'fs';
const salesAgentCode = readFileSync('./agents/salesAgent.js', 'utf-8');

// Check for lowercase field names in prompt
test('Extraction prompt requests lowercase fields', 
  salesAgentCode.includes('using LOWERCASE field names') || 
  salesAgentCode.includes('Return ONLY a JSON object with any new/updated fields using LOWERCASE field names'));

// Check field mapping
test('Field names are lowercase in prompt',
  salesAgentCode.includes('name (person\'s name)') &&
  salesAgentCode.includes('businessType (restaurant'));

// Check budget instructions
test('Budget extraction instructions present',
  salesAgentCode.includes('Look for numbers with "mes"'));

// Check email extraction
test('Email extraction pattern present',
  salesAgentCode.includes('email (email address)') ||
  salesAgentCode.includes('email address'));

// 2. Test recursion protection
console.log('\n📋 TESTING RECURSION PROTECTION');
console.log('='.repeat(50));

test('MAX_EXTRACTION_ATTEMPTS defined',
  salesAgentCode.includes('MAX_EXTRACTION_ATTEMPTS = 3'));

test('Extraction count tracking',
  salesAgentCode.includes('extractionCount') &&
  salesAgentCode.includes('maxExtractionReached'));

test('Message deduplication implemented',
  salesAgentCode.includes('processedMessages') &&
  salesAgentCode.includes('createHash'));

// 3. Test state management
console.log('\n📋 TESTING STATE MANAGEMENT');
console.log('='.repeat(50));

test('State annotation properly defined',
  salesAgentCode.includes('AgentStateAnnotation = Annotation.Root'));

test('No global state variables',
  !salesAgentCode.match(/^(let|var)\s+\w+\s*=\s*[^(]/gm));

test('Proper state reducers',
  salesAgentCode.includes('reducer:') &&
  salesAgentCode.includes('default:'));

// 4. Test tool structure
console.log('\n📋 TESTING TOOL STRUCTURE');
console.log('='.repeat(50));

const commandCount = (salesAgentCode.match(/return new Command\(/g) || []).length;
test('All tools return Command objects',
  commandCount >= 6,
  `Found ${commandCount} Command returns (expected >= 6)`);

test('Tools use Zod validation',
  salesAgentCode.includes('z.object') &&
  salesAgentCode.includes('z.string()'));

const toolCount = (salesAgentCode.match(/tool\(/g) || []).length;
test('Has all 6 tools',
  toolCount >= 6,
  `Found ${toolCount} tools`);

// 5. Test conversation termination
console.log('\n📋 TESTING CONVERSATION TERMINATION');
console.log('='.repeat(50));

test('Appointment booking terminates conversation',
  salesAgentCode.includes('appointmentBooked: true') &&
  salesAgentCode.includes('goto: "END"'));

test('Has conditional edges (or equivalent termination)',
  salesAgentCode.includes('goto: "END"') ||
  salesAgentCode.includes('conditionalEdges'));

// 6. Test GHL integration
console.log('\n📋 TESTING GHL INTEGRATION');
console.log('='.repeat(50));

const ghlServiceCode = readFileSync('./services/ghlService.js', 'utf-8');

test('Uses correct WhatsApp message type',
  ghlServiceCode.includes('type: \'WhatsApp\''));

// Check for Version header in different formats
const hasVersionHeader = 
  ghlServiceCode.includes("'Version': '2021-07-28'") ||
  ghlServiceCode.includes('"Version": "2021-07-28"') ||
  ghlServiceCode.includes("Version: '2021-07-28'") ||
  ghlServiceCode.includes('Version: "2021-07-28"');

test('Includes required Version header',
  hasVersionHeader,
  `Searching for Version header in getHeaders method`);

test('Handles nested message structure',
  ghlServiceCode.includes('messages.messages') ||
  ghlServiceCode.includes('data.messages.messages'));

// 7. Test specific fixes
console.log('\n📋 TESTING SPECIFIC FIXES');
console.log('='.repeat(50));

// Check if the extraction prompt has the fix
const extractPromptMatch = salesAgentCode.match(/Extract any NEW information[\s\S]*?Do NOT include fields/);
if (extractPromptMatch) {
  test('Extraction prompt includes lowercase instruction',
    extractPromptMatch[0].includes('LOWERCASE') ||
    extractPromptMatch[0].includes('lowercase'));
}

// Check system prompt
const systemPromptMatch = salesAgentCode.match(/const systemPrompt = `[\s\S]*?`/);
if (systemPromptMatch) {
  test('System prompt is concise',
    systemPromptMatch[0].length < 2000,
    `System prompt length: ${systemPromptMatch[0].length} chars`);
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('📊 TEST SUMMARY');
console.log('='.repeat(50));
console.log(`\nTotal Tests: ${results.passed + results.failed}`);
console.log(`Passed: ${results.passed}`);
console.log(`Failed: ${results.failed}`);
console.log(`Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

if (results.failed > 0) {
  console.log('\n❌ Failed Tests:');
  results.tests
    .filter(t => !t.passed)
    .forEach(t => console.log(`  - ${t.name}: ${t.details || 'No details'}`));
}

// Critical checks
console.log('\n🔍 CRITICAL FIXES VERIFIED:');
const criticalFixes = [
  {
    name: 'Field extraction lowercase fix',
    verified: results.tests.find(t => t.name.includes('lowercase') && t.passed)
  },
  {
    name: 'Recursion protection',
    verified: results.tests.filter(t => t.name.includes('recursion') || 
                                       t.name.includes('MAX_EXTRACTION'))
                            .every(t => t.passed)
  },
  {
    name: 'State management',
    verified: results.tests.filter(t => t.name.includes('state') || 
                                       t.name.includes('State'))
                            .every(t => t.passed)
  },
  {
    name: 'Command objects',
    verified: results.tests.find(t => t.name.includes('Command objects'))?.passed
  }
];

criticalFixes.forEach(fix => {
  console.log(`  ${fix.name}: ${fix.verified ? 'YES ✅' : 'NO ❌'}`);
});

if (results.failed === 0) {
  console.log('\n🎉 ALL TESTS PASSED! System components are properly configured.');
} else {
  console.log('\n⚠️  Some tests failed. Review the implementation.');
}

// Save results
import { writeFileSync } from 'fs';
writeFileSync('test-components-results.json', JSON.stringify({
  timestamp: new Date().toISOString(),
  results: results,
  criticalFixes: criticalFixes
}, null, 2));

console.log('\n📄 Results saved to test-components-results.json');