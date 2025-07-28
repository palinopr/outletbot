// Cost Analysis for the trace

const tokenCounts = {
  call1: { prompt: 1214, completion: 17 },   // extract_lead_info
  call2: { prompt: 1242, completion: 43 },   // send_ghl_message  
  call3: { prompt: 1313, completion: 1 }     // final response
};

const pricing = {
  gpt4: {
    input: 0.03,     // $30 per 1M tokens
    output: 0.12     // $120 per 1M tokens
  },
  gpt4Turbo: {
    input: 0.01,     // $10 per 1M tokens
    output: 0.03     // $30 per 1M tokens
  },
  gpt35Turbo: {
    input: 0.0005,   // $0.50 per 1M tokens
    output: 0.0015   // $1.50 per 1M tokens
  }
};

console.log('TOKEN ANALYSIS');
console.log('==============');

let totalPrompt = 0;
let totalCompletion = 0;

Object.entries(tokenCounts).forEach(([call, tokens]) => {
  totalPrompt += tokens.prompt;
  totalCompletion += tokens.completion;
  console.log(`${call}: ${tokens.prompt} prompt + ${tokens.completion} completion = ${tokens.prompt + tokens.completion} total`);
});

console.log(`\nTOTAL: ${totalPrompt} prompt + ${totalCompletion} completion = ${totalPrompt + totalCompletion} tokens`);

console.log('\nCOST BREAKDOWN BY MODEL');
console.log('=======================');

Object.entries(pricing).forEach(([model, prices]) => {
  const promptCost = (totalPrompt / 1_000_000) * prices.input;
  const completionCost = (totalCompletion / 1_000_000) * prices.output;
  const total = promptCost + completionCost;
  
  console.log(`\n${model}:`);
  console.log(`  Prompt cost: $${promptCost.toFixed(4)}`);
  console.log(`  Completion cost: $${completionCost.toFixed(4)}`);
  console.log(`  TOTAL: $${total.toFixed(4)}`);
});

console.log('\nWHY SO EXPENSIVE?');
console.log('=================');
console.log('1. System prompt is 1,100+ tokens (repeated 3 times!)');
console.log('2. Each tool response adds to context');
console.log('3. Previous messages included in each call');
console.log('4. Using GPT-4 (most expensive model)');

console.log('\nCOST REDUCTION STRATEGIES:');
console.log('=========================');
console.log('1. Switch to GPT-4 Turbo: $0.04 instead of $0.15 (73% savings)');
console.log('2. Shorten system prompt: Remove examples, compress instructions');
console.log('3. Use GPT-3.5 for simple tasks: $0.002 per conversation (98% savings)');
console.log('4. Implement prompt caching: Reuse system prompt across calls');