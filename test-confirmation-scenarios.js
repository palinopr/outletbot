import { tool } from "@langchain/core/tools";
import { Logger } from './services/logger.js';
import { toolResponseCompressor } from './services/toolResponseCompressor.js';
import dotenv from 'dotenv';

dotenv.config();

// Minimal mock for testing the extraction logic
const logger = new Logger('test-confirmations');

async function testConfirmationScenarios() {
  console.log('\n🧪 TESTING CONFIRMATION SCENARIOS\n');
  console.log('='.repeat(80));
  
  // Test scenarios
  const scenarios = [
    {
      name: 'Budget Confirmation with "sí"',
      lastAssistant: '¿Tu presupuesto mensual es de $300?',
      userMessage: 'sí',
      expectedExtraction: { budget: 300 }
    },
    {
      name: 'Budget Confirmation with number',
      lastAssistant: '¿Cuál es tu presupuesto mensual para marketing?',
      userMessage: '500',
      expectedExtraction: { budget: 500 }
    },
    {
      name: 'Budget with dollar sign',
      lastAssistant: '¿Cuánto puedes invertir al mes?',
      userMessage: '$1,200',
      expectedExtraction: { budget: 1200 }
    },
    {
      name: 'Email confirmation',
      lastAssistant: '¿Tu email es juan@example.com?',
      userMessage: 'sí',
      expectedExtraction: { email: 'juan@example.com' }
    },
    {
      name: 'Name confirmation',
      lastAssistant: '¿Te llamas María?',
      userMessage: 'sí',
      expectedExtraction: { name: 'María' }
    },
    {
      name: 'Business type confirmation',
      lastAssistant: '¿Tienes un restaurante?',
      userMessage: 'claro',
      expectedExtraction: { businessType: 'restaurante' }
    },
    {
      name: 'Multiple values in question',
      lastAssistant: 'Perfecto, entonces tu presupuesto es de $800 mensuales, ¿correcto?',
      userMessage: 'exacto',
      expectedExtraction: { budget: 800 }
    },
    {
      name: 'Complex budget question',
      lastAssistant: 'Con $400 al mes podemos empezar. ¿Te parece bien ese presupuesto?',
      userMessage: 'sí',
      expectedExtraction: { budget: 400 }
    },
    {
      name: 'Just "si" with no context',
      lastAssistant: '¿Cómo estás hoy?',
      userMessage: 'si',
      expectedExtraction: null // Should not extract anything
    },
    {
      name: 'Number without budget context',
      lastAssistant: '¿Cuántos años tienes tu negocio?',
      userMessage: '5',
      expectedExtraction: null // Should not extract as budget
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  scenarios.forEach((scenario, idx) => {
    console.log(`\n${idx + 1}. ${scenario.name}`);
    console.log(`   Assistant: "${scenario.lastAssistant}"`);
    console.log(`   User: "${scenario.userMessage}"`);
    
    // Simulate the extraction logic
    const result = simulateExtraction(
      scenario.userMessage,
      scenario.lastAssistant,
      {}
    );
    
    const success = deepEqual(result, scenario.expectedExtraction);
    
    if (success) {
      console.log(`   ✅ PASS - Extracted: ${JSON.stringify(result)}`);
      passed++;
    } else {
      console.log(`   ❌ FAIL - Expected: ${JSON.stringify(scenario.expectedExtraction)}`);
      console.log(`            Got: ${JSON.stringify(result)}`);
      failed++;
    }
  });
  
  console.log('\n' + '='.repeat(80));
  console.log(`RESULTS: ${passed}/${scenarios.length} tests passed (${Math.round(passed/scenarios.length * 100)}%)`);
  console.log('='.repeat(80) + '\n');
}

// Simulate the extraction logic from salesAgent.js
function simulateExtraction(message, lastAssistantQuestion, currentInfo) {
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
  
  // Extract numbers from assistant message
  const numberMatches = lastAssistantQuestion.match(/\$?\d+(?:,\d{3})*(?:\.\d{2})?/g);
  
  const patterns = {
    budget: {
      keywords: ['presupuesto', 'budget', 'mensual', 'al mes', 'por mes', 'mensuales'],
      extract: (numbers) => {
        if (numbers && numbers.length > 0) {
          const amounts = numbers.map(n => parseInt(n.replace(/[$,]/g, '')));
          return Math.max(...amounts);
        }
        return null;
      }
    },
    email: {
      keywords: ['email', 'correo', '@'],
      extract: () => {
        const emailMatch = lastAssistantQuestion.match(/[\w.-]+@[\w.-]+\.\w+/);
        return emailMatch ? emailMatch[0] : null;
      }
    },
    name: {
      keywords: ['llamas', 'nombre', 'eres'],
      extract: () => {
        const namePatterns = [
          /¿(?:te llamas|eres|tu nombre es)\s+([A-Z][a-záéíóú]+)/i,
          /¿([A-Z][a-záéíóú]+)\s+(?:eres tú|verdad)?/i
        ];
        for (const pattern of namePatterns) {
          const match = lastAssistantQuestion.match(pattern);
          if (match) return match[1];
        }
        return null;
      }
    },
    businessType: {
      keywords: ['negocio', 'tienes', 'restaurante', 'tienda', 'salón', 'clínica'],
      extract: () => {
        const types = ['restaurante', 'tienda', 'salón', 'clínica', 'consultorio', 'spa', 'gym'];
        for (const type of types) {
          if (lastAssistantQuestion.toLowerCase().includes(type)) {
            return type;
          }
        }
        return null;
      }
    }
  };
  
  let extractedData = {};
  
  for (const [field, config] of Object.entries(patterns)) {
    const hasKeyword = config.keywords.some(kw => 
      lastAssistantQuestion.toLowerCase().includes(kw)
    );
    
    if (hasKeyword) {
      const value = config.extract(numberMatches);
      if (value !== null) {
        extractedData[field] = value;
      }
    }
  }
  
  return Object.keys(extractedData).length > 0 ? extractedData : null;
}

// Deep equality check
function deepEqual(obj1, obj2) {
  if (obj1 === obj2) return true;
  if (obj1 == null || obj2 == null) return false;
  
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
testConfirmationScenarios().catch(console.error);