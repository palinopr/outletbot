import { Logger } from './services/logger.js';
import dotenv from 'dotenv';

dotenv.config();

const logger = new Logger('test-extraction');

// Direct test of the extraction logic
async function testExtractionLogic() {
  console.log('\n🔬 TESTING EXTRACTION LOGIC DIRECTLY\n');
  console.log('='.repeat(80));
  
  // Mock the current state
  const mockCurrentTaskInput = {
    leadInfo: { name: 'Jaime' },
    extractionCount: 0,
    processedMessages: [],
    messages: [
      { _getType: () => 'ai', content: '¿Tu presupuesto mensual es de $500?' },
      { _getType: () => 'human', content: 'sí' }
    ]
  };
  
  // Test cases
  const testCases = [
    {
      name: 'Budget confirmation with "sí"',
      lastAssistant: '¿Tu presupuesto mensual es de $500?',
      userMessage: 'sí',
      currentInfo: {},
      expected: { budget: 500 }
    },
    {
      name: 'Standalone number after budget question',
      lastAssistant: '¿Cuál es tu presupuesto mensual?',
      userMessage: '750',
      currentInfo: {},
      expected: { budget: 750 }
    },
    {
      name: 'Budget with comma',
      lastAssistant: '¿Cuánto puedes invertir al mes?',
      userMessage: '1,200',
      currentInfo: {},
      expected: { budget: 1200 }
    },
    {
      name: 'Email confirmation',
      lastAssistant: '¿Tu email es maria@ejemplo.com?',
      userMessage: 'sí',
      currentInfo: {},
      expected: { email: 'maria@ejemplo.com' }
    },
    {
      name: 'Budget update with "sí"',
      lastAssistant: 'Con $400 mensuales podemos ofrecerte más. ¿Puedes hacer $400?',
      userMessage: 'sí',
      currentInfo: { budget: 200 },
      expected: { budget: 400 }
    },
    {
      name: 'Complex confirmation with multiple values',
      lastAssistant: 'Entonces tu presupuesto es de $800 mensuales y tu email es juan@restaurante.com, ¿correcto?',
      userMessage: 'exacto',
      currentInfo: {},
      expected: { budget: 800, email: 'juan@restaurante.com' }
    },
    {
      name: 'Name confirmation',
      lastAssistant: '¿Te llamas Carlos?',
      userMessage: 'sí',
      currentInfo: {},
      expected: { name: 'Carlos' }
    },
    {
      name: 'Business type confirmation',
      lastAssistant: '¿Tienes una clínica dental?',
      userMessage: 'claro',
      currentInfo: {},
      expected: { businessType: 'clínica' }
    },
    {
      name: 'No extraction - irrelevant "sí"',
      lastAssistant: '¿Te gustaría saber más?',
      userMessage: 'sí',
      currentInfo: {},
      expected: null
    },
    {
      name: 'No extraction - number without budget context',
      lastAssistant: '¿Cuántos años tiene tu negocio?',
      userMessage: '3',
      currentInfo: {},
      expected: null
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of testCases) {
    console.log(`\n${test.name}`);
    console.log(`   Assistant: "${test.lastAssistant}"`);
    console.log(`   User: "${test.userMessage}"`);
    
    // Run extraction logic
    const result = runExtractionLogic(
      test.userMessage,
      test.lastAssistant,
      test.currentInfo
    );
    
    // Check result
    const success = deepEqual(result, test.expected);
    
    if (success) {
      console.log(`   ✅ PASS - Extracted: ${JSON.stringify(result)}`);
      passed++;
    } else {
      console.log(`   ❌ FAIL`);
      console.log(`      Expected: ${JSON.stringify(test.expected)}`);
      console.log(`      Got: ${JSON.stringify(result)}`);
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`RESULTS: ${passed}/${testCases.length} tests passed (${Math.round(passed/testCases.length * 100)}%)`);
  console.log('='.repeat(80));
  
  // Show extraction patterns
  console.log('\n📝 EXTRACTION PATTERNS SUPPORTED:\n');
  console.log('1. Confirmations: sí, yes, claro, por supuesto, correcto, exacto');
  console.log('2. Standalone numbers after budget questions: 500, $1,200');
  console.log('3. Context-aware extraction from assistant questions');
  console.log('4. Multiple field extraction from complex questions');
  console.log('5. Proper handling of irrelevant confirmations\n');
}

// Simulate the extraction logic
function runExtractionLogic(message, lastAssistantQuestion, currentInfo) {
  // Check if message is just a number
  const isJustNumber = /^\$?\d+(?:,\d{3})*(?:\.\d{2})?$/.test(message.trim());
  
  if (isJustNumber) {
    const wasBudgetQuestion = ['presupuesto', 'budget', 'mensual', 'al mes', 'por mes', 'invertir']
      .some(keyword => lastAssistantQuestion.toLowerCase().includes(keyword));
    
    if (wasBudgetQuestion) {
      const budgetAmount = parseInt(message.replace(/[$,]/g, ''));
      return { budget: budgetAmount };
    }
    return null;
  }
  
  // Check for confirmations
  const isConfirmation = /^(si|sí|yes|sí\.|si\.|claro|por supuesto|correcto|exacto|eso es)$/i.test(message.trim());
  
  if (!isConfirmation) return null;
  
  // Extract data based on context
  const extractedData = {};
  
  // Extract numbers
  const numberMatches = lastAssistantQuestion.match(/\$?\d+(?:,\d{3})*(?:\.\d{2})?/g);
  
  // Check for budget
  if (['presupuesto', 'budget', 'mensual', 'al mes', 'por mes', 'mensuales', 'invertir'].some(kw => 
    lastAssistantQuestion.toLowerCase().includes(kw)
  )) {
    if (numberMatches && numberMatches.length > 0) {
      const amounts = numberMatches.map(n => parseInt(n.replace(/[$,]/g, '')));
      extractedData.budget = Math.max(...amounts);
    }
  }
  
  // Check for email
  const emailMatch = lastAssistantQuestion.match(/[\w.-]+@[\w.-]+\.\w+/);
  if (emailMatch && ['email', 'correo', '@'].some(kw => lastAssistantQuestion.toLowerCase().includes(kw))) {
    extractedData.email = emailMatch[0];
  }
  
  // Check for name
  const namePatterns = [
    /¿(?:te llamas|eres|tu nombre es)\s+([A-Z][a-záéíóú]+)/i,
    /¿([A-Z][a-záéíóú]+)\s+(?:eres tú|verdad)?/i
  ];
  
  if (['llamas', 'nombre', 'eres'].some(kw => lastAssistantQuestion.toLowerCase().includes(kw))) {
    for (const pattern of namePatterns) {
      const match = lastAssistantQuestion.match(pattern);
      if (match) {
        extractedData.name = match[1];
        break;
      }
    }
  }
  
  // Check for business type
  const businessTypes = ['restaurante', 'tienda', 'salón', 'clínica', 'consultorio', 'spa', 'gym'];
  if (['negocio', 'tienes'].some(kw => lastAssistantQuestion.toLowerCase().includes(kw))) {
    for (const type of businessTypes) {
      if (lastAssistantQuestion.toLowerCase().includes(type)) {
        extractedData.businessType = type;
        break;
      }
    }
  }
  
  return Object.keys(extractedData).length > 0 ? extractedData : null;
}

// Deep equality check
function deepEqual(obj1, obj2) {
  if (obj1 === obj2) return true;
  if (obj1 == null || obj2 == null) return obj1 === obj2;
  
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (obj1[key] !== obj2[key]) return false;
  }
  
  return true;
}

// Run tests
testExtractionLogic().catch(console.error);