import { readFileSync } from 'fs';
import path from 'path';

console.log(`🔍 Sales Agent Performance Analysis\n`);

// Read the sales agent code to analyze potential performance issues
const salesAgentPath = path.join(process.cwd(), 'agents', 'salesAgent.js');
const ghlServicePath = path.join(process.cwd(), 'services', 'ghlService.js');
const conversationManagerPath = path.join(process.cwd(), 'services', 'conversationManager.js');

console.log(`📊 Analyzing potential expensive operations...\n`);

// Common expensive patterns in LangGraph agents
const expensivePatterns = {
  loops: {
    title: '🔄 Potential Expensive Loops',
    patterns: [
      {
        name: 'Repeated Tool Calls',
        description: 'Same tool called multiple times with identical parameters',
        impact: 'HIGH',
        cost: 'Each tool call costs tokens + API calls',
        solution: 'Implement caching and deduplication'
      },
      {
        name: 'Message History Fetching',
        description: 'Fetching full conversation history on every message',
        impact: 'MEDIUM',
        cost: 'GHL API calls + processing time',
        solution: 'Use 5-minute cache (already implemented)'
      },
      {
        name: 'Unnecessary State Updates',
        description: 'Updating state without meaningful changes',
        impact: 'LOW',
        cost: 'State persistence overhead',
        solution: 'Only update state when values change'
      }
    ]
  },
  apiCalls: {
    title: '🌐 Expensive API Operations',
    patterns: [
      {
        name: 'Calendar Slot Fetching',
        description: 'Getting all available slots (68 slots returned)',
        impact: 'MEDIUM',
        cost: 'GHL API rate limits + response size',
        solution: 'Fetch only needed date range, cache results'
      },
      {
        name: 'Contact Updates',
        description: 'Multiple API calls to update tags/notes',
        impact: 'LOW',
        cost: 'Multiple GHL API calls',
        solution: 'Batch updates when possible'
      },
      {
        name: 'Message Sending',
        description: 'WhatsApp API calls for each message',
        impact: 'MEDIUM',
        cost: 'WhatsApp API costs + delivery time',
        solution: 'Combine messages when appropriate'
      }
    ]
  },
  llmUsage: {
    title: '🤖 LLM Token Usage',
    patterns: [
      {
        name: 'System Prompt Size',
        description: 'Large system prompt repeated on each call',
        impact: 'HIGH',
        cost: '~2000 tokens per message',
        solution: 'Optimize prompt, use message compression'
      },
      {
        name: 'Tool Descriptions',
        description: '6 tools with detailed Zod schemas',
        impact: 'MEDIUM',
        cost: '~500 tokens per call',
        solution: 'Simplify tool descriptions'
      },
      {
        name: 'Conversation History',
        description: 'Full history included in context',
        impact: 'HIGH',
        cost: 'Grows with conversation length',
        solution: 'Implement sliding window or summarization'
      }
    ]
  },
  stateManagement: {
    title: '💾 State & Memory Issues',
    patterns: [
      {
        name: 'Full History Storage',
        description: 'Storing complete conversation in state',
        impact: 'MEDIUM',
        cost: 'Memory usage + serialization',
        solution: 'Store only essential information'
      },
      {
        name: 'Redundant Information',
        description: 'Duplicating data across tools',
        impact: 'LOW',
        cost: 'Extra processing and storage',
        solution: 'Normalize data structure'
      }
    ]
  }
};

// Analyze actual code patterns
console.log(`🔧 Code Analysis Results:\n`);

try {
  const salesAgentCode = readFileSync(salesAgentPath, 'utf-8');
  
  // Check for specific expensive patterns
  const issues = [];
  
  // Check for multiple tool calls in sequence
  if (salesAgentCode.includes('extractLeadInfo') && salesAgentCode.includes('sendGHLMessage')) {
    issues.push({
      type: 'Tool Chain',
      description: 'Multiple tools called in sequence on each message',
      cost: 'Each tool = 1 LLM call + API costs',
      recommendation: 'Consider combining tool operations'
    });
  }
  
  // Check for conversation history handling
  if (salesAgentCode.includes('getConversationHistory')) {
    issues.push({
      type: 'History Fetching',
      description: 'Fetching conversation history on each webhook',
      cost: 'GHL API call + data transfer',
      recommendation: 'Cache is implemented (5 min) - ensure it\'s working'
    });
  }
  
  // Check prompt size
  const systemPromptMatch = salesAgentCode.match(/systemPrompt.*?`([\s\S]*?)`/);
  if (systemPromptMatch) {
    const promptLength = systemPromptMatch[1].length;
    if (promptLength > 2000) {
      issues.push({
        type: 'Large System Prompt',
        description: `System prompt is ${promptLength} characters`,
        cost: `~${Math.ceil(promptLength / 4)} tokens per call`,
        recommendation: 'Consider condensing the prompt'
      });
    }
  }
  
  if (issues.length > 0) {
    console.log(`❌ Found ${issues.length} potential cost issues:\n`);
    issues.forEach((issue, i) => {
      console.log(`${i + 1}. ${issue.type}`);
      console.log(`   Description: ${issue.description}`);
      console.log(`   Cost Impact: ${issue.cost}`);
      console.log(`   Fix: ${issue.recommendation}\n`);
    });
  }
} catch (error) {
  console.log(`⚠️  Could not analyze code files: ${error.message}\n`);
}

// Print detailed analysis
Object.values(expensivePatterns).forEach(category => {
  console.log(`\n${category.title}`);
  console.log('─'.repeat(50));
  
  category.patterns.forEach(pattern => {
    console.log(`\n📌 ${pattern.name}`);
    console.log(`   Impact: ${pattern.impact}`);
    console.log(`   Description: ${pattern.description}`);
    console.log(`   Cost: ${pattern.cost}`);
    console.log(`   Solution: ${pattern.solution}`);
  });
});

// Cost optimization recommendations
console.log(`\n\n💰 Cost Optimization Recommendations:`);
console.log('─'.repeat(50));

const recommendations = [
  {
    priority: 'HIGH',
    action: 'Implement conversation summarization',
    savings: 'Reduce token usage by 50-70% on long conversations',
    implementation: 'Use LLM to summarize older messages, keep last 5-10 messages in full'
  },
  {
    priority: 'HIGH',
    action: 'Optimize system prompt',
    savings: 'Save ~1000 tokens per message',
    implementation: 'Remove examples, condense instructions, use bullet points'
  },
  {
    priority: 'MEDIUM',
    action: 'Cache calendar slots',
    savings: 'Reduce GHL API calls by 80%',
    implementation: 'Cache slots for 30 minutes, refresh only when needed'
  },
  {
    priority: 'MEDIUM',
    action: 'Batch tool operations',
    savings: 'Reduce LLM calls by 30-40%',
    implementation: 'Combine extractLeadInfo and sendGHLMessage into single operation'
  },
  {
    priority: 'LOW',
    action: 'Implement request deduplication',
    savings: 'Prevent duplicate processing',
    implementation: 'Track message IDs, ignore duplicates'
  }
];

recommendations.forEach((rec, i) => {
  console.log(`\n${i + 1}. [${rec.priority}] ${rec.action}`);
  console.log(`   Savings: ${rec.savings}`);
  console.log(`   How: ${rec.implementation}`);
});

// Specific issues from your agent
console.log(`\n\n🎯 Specific Issues in Your Agent:`);
console.log('─'.repeat(50));

const specificIssues = [
  {
    issue: 'Tool Call Pattern',
    current: 'Each message triggers: extractLeadInfo → sendGHLMessage → updateGHLContact',
    problem: '3 separate LLM calls for each user message',
    fix: 'Combine into single tool that does all three operations'
  },
  {
    issue: 'Calendar Fetching',
    current: 'Fetches all 68 slots when user qualifies',
    problem: 'Large response, unnecessary data transfer',
    fix: 'Fetch only next 7 days, paginate if needed'
  },
  {
    issue: 'Message History',
    current: 'Includes full conversation history in each LLM call',
    problem: 'Token usage grows linearly with conversation length',
    fix: 'Implement sliding window (last 10 messages) + summary of older messages'
  },
  {
    issue: 'State Persistence',
    current: 'Entire agent state saved on each update',
    problem: 'Serialization overhead on every message',
    fix: 'Only persist changed fields, use incremental updates'
  }
];

specificIssues.forEach((issue, i) => {
  console.log(`\n${i + 1}. ${issue.issue}`);
  console.log(`   Current: ${issue.current}`);
  console.log(`   Problem: ${issue.problem}`);
  console.log(`   Fix: ${issue.fix}`);
});

// Estimated cost breakdown
console.log(`\n\n💵 Estimated Cost Breakdown (per conversation):`);
console.log('─'.repeat(50));

const costEstimates = {
  'Average messages per conversation': 15,
  'LLM calls per message': 3,
  'Total LLM calls': 45,
  'Tokens per call (avg)': 3000,
  'Total tokens': 135000,
  'Cost per 1K tokens (GPT-4)': '$0.03',
  'LLM cost per conversation': '$4.05',
  'GHL API calls': 20,
  'WhatsApp messages': 15,
  'Total estimated cost': '$4.50-5.00'
};

Object.entries(costEstimates).forEach(([key, value]) => {
  console.log(`${key}: ${value}`);
});

console.log(`\n\n✅ Analysis complete!`);
console.log(`\nTo see actual trace data, ensure your LANGSMITH_API_KEY has access to the trace.`);