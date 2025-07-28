// Actual cost analysis based on trace data

const traceData = {
  totalTokens: 4902,
  totalCost: 0.1489,
  inputTokens: 3769,
  outputTokens: 61
};

// Reverse engineer the pricing
const costPerToken = traceData.totalCost / traceData.totalTokens;
const costPer1MTokens = costPerToken * 1_000_000;

console.log('ACTUAL COST ANALYSIS FROM TRACE');
console.log('================================');
console.log(`Total tokens: ${traceData.totalTokens}`);
console.log(`Total cost: $${traceData.totalCost}`);
console.log(`Cost per token: $${costPerToken.toFixed(8)}`);
console.log(`Cost per 1M tokens: $${costPer1MTokens.toFixed(2)}`);

// Current OpenAI GPT-4 pricing (as of Jan 2024)
const actualPricing = {
  'gpt-4-1106': {
    input: 0.01,    // $10 per 1M input tokens
    output: 0.03    // $30 per 1M output tokens
  },
  'gpt-4': {
    input: 0.03,    // $30 per 1M input tokens  
    output: 0.06    // $60 per 1M output tokens
  }
};

console.log('\nBREAKDOWN WITH CURRENT PRICING:');
console.log('================================');

Object.entries(actualPricing).forEach(([model, prices]) => {
  const inputCost = (traceData.inputTokens / 1_000_000) * prices.input * 1000;
  const outputCost = (traceData.outputTokens / 1_000_000) * prices.output * 1000;
  const total = inputCost + outputCost;
  
  console.log(`\n${model}:`);
  console.log(`  Input: ${traceData.inputTokens} tokens × $${prices.input}/1M = $${inputCost.toFixed(4)}`);
  console.log(`  Output: ${traceData.outputTokens} tokens × $${prices.output}/1M = $${outputCost.toFixed(4)}`);
  console.log(`  Expected Total: $${total.toFixed(4)}`);
});

console.log('\nDISCREPANCY ANALYSIS:');
console.log('====================');
console.log(`Trace shows: $${traceData.totalCost}`);
console.log(`GPT-4 should be: $0.1167`);
console.log(`GPT-4-Turbo should be: $0.0396`);

console.log('\nPOSSIBLE EXPLANATIONS:');
console.log('======================');
console.log('1. LangSmith might be using older/higher pricing');
console.log('2. Additional overhead costs included');
console.log('3. Token counting discrepancy');
console.log('4. Using gpt-4-32k model (2x more expensive)');

console.log('\nRECOMMENDATIONS TO REDUCE COST:');
console.log('================================');
console.log('1. IMMEDIATE: Switch to gpt-4-turbo-preview ($0.04 vs $0.15)');
console.log('2. SHORT TERM: Reduce system prompt from 1,100 to 500 tokens');
console.log('3. OPTIMIZATION: Cache system prompt, don\'t repeat it');
console.log('4. FOR SIMPLE TASKS: Use gpt-3.5-turbo ($0.002 per conversation)');

console.log('\nEXAMPLE SAVINGS:');
console.log('================');
const conversationsPerDay = 100;
console.log(`Current: ${conversationsPerDay} conversations × $0.15 = $${(conversationsPerDay * 0.15).toFixed(2)}/day`);
console.log(`With GPT-4-Turbo: ${conversationsPerDay} conversations × $0.04 = $${(conversationsPerDay * 0.04).toFixed(2)}/day`);
console.log(`With GPT-3.5-Turbo: ${conversationsPerDay} conversations × $0.002 = $${(conversationsPerDay * 0.002).toFixed(2)}/day`);

console.log('\nMONTHLY COSTS:');
console.log('==============');
console.log(`Current: $${(conversationsPerDay * 0.15 * 30).toFixed(2)}/month`);
console.log(`With GPT-4-Turbo: $${(conversationsPerDay * 0.04 * 30).toFixed(2)}/month`);
console.log(`With GPT-3.5-Turbo: $${(conversationsPerDay * 0.002 * 30).toFixed(2)}/month`);