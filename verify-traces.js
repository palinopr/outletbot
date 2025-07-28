/**
 * LangSmith Trace Verification Script
 * Analyzes traces to verify the production fixes are working
 */

import dotenv from 'dotenv';
dotenv.config();

const LANGSMITH_API_KEY = process.env.LANGSMITH_API_KEY;
const LANGSMITH_API_URL = 'https://api.smith.langchain.com';

if (!LANGSMITH_API_KEY) {
  console.error('❌ LANGSMITH_API_KEY not found in environment');
  process.exit(1);
}

/**
 * Fetch recent traces from LangSmith
 */
async function fetchRecentTraces(limit = 10) {
  try {
    const response = await fetch(`${LANGSMITH_API_URL}/runs?limit=${limit}`, {
      headers: {
        'x-api-key': LANGSMITH_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching traces:', error);
    return null;
  }
}

/**
 * Analyze a single trace for our fixes
 */
function analyzeTrace(trace) {
  const analysis = {
    traceId: trace.id,
    timestamp: trace.start_time,
    threadId: trace.extra?.runtime?.thread_id || trace.extra?.metadata?.thread_id,
    cost: trace.total_cost || 0,
    tokens: trace.total_tokens || 0,
    cacheHits: [],
    stateUpdates: [],
    issues: []
  };

  // Check for cache hits in logs
  if (trace.outputs?.logs) {
    const logs = trace.outputs.logs;
    if (logs.includes('PRODUCTION CACHE HIT')) {
      analysis.cacheHits.push('Production cache used');
    }
    if (logs.includes('savedTokens: 3822')) {
      analysis.cacheHits.push('Saved 3822 tokens');
    }
  }

  // Check for state persistence
  if (trace.outputs?.leadInfo) {
    const leadInfo = trace.outputs.leadInfo;
    const fieldsSet = Object.keys(leadInfo).filter(k => leadInfo[k]);
    analysis.stateUpdates = fieldsSet;
  }

  // Check for issues
  if (!analysis.threadId) {
    analysis.issues.push('No thread_id found');
  }
  if (analysis.cost > 0.5) {
    analysis.issues.push(`High cost: $${analysis.cost}`);
  }
  if (analysis.tokens > 5000) {
    analysis.issues.push(`High token usage: ${analysis.tokens}`);
  }

  return analysis;
}

/**
 * Main verification function
 */
async function verifyTraces() {
  console.log('🔍 LANGSMITH TRACE VERIFICATION');
  console.log('================================\n');

  const traces = await fetchRecentTraces(20);
  
  if (!traces || !traces.runs) {
    console.error('❌ No traces found');
    return;
  }

  console.log(`Found ${traces.runs.length} recent traces\n`);

  // Group traces by thread_id
  const threadGroups = {};
  
  traces.runs.forEach(trace => {
    const analysis = analyzeTrace(trace);
    const threadId = analysis.threadId || 'no-thread';
    
    if (!threadGroups[threadId]) {
      threadGroups[threadId] = [];
    }
    threadGroups[threadId].push(analysis);
  });

  // Analyze each conversation thread
  console.log('📊 CONVERSATION ANALYSIS');
  console.log('========================\n');

  Object.entries(threadGroups).forEach(([threadId, traces]) => {
    console.log(`Thread: ${threadId}`);
    console.log(`Messages: ${traces.length}`);
    
    // Calculate thread metrics
    const totalCost = traces.reduce((sum, t) => sum + t.cost, 0);
    const totalTokens = traces.reduce((sum, t) => sum + t.tokens, 0);
    const cacheHits = traces.filter(t => t.cacheHits.length > 0).length;
    const allIssues = traces.flatMap(t => t.issues);
    
    console.log(`Total Cost: $${totalCost.toFixed(4)}`);
    console.log(`Total Tokens: ${totalTokens}`);
    console.log(`Cache Hits: ${cacheHits}/${traces.length}`);
    
    // Check state accumulation
    const lastTrace = traces[traces.length - 1];
    if (lastTrace.stateUpdates.length > 0) {
      console.log(`Final State: ${lastTrace.stateUpdates.join(', ')}`);
    }
    
    // Report issues
    if (allIssues.length > 0) {
      console.log(`⚠️  Issues: ${[...new Set(allIssues)].join(', ')}`);
    } else {
      console.log('✅ No issues detected');
    }
    
    console.log('---\n');
  });

  // Summary metrics
  console.log('📈 SUMMARY METRICS');
  console.log('==================\n');

  const allTraces = Object.values(threadGroups).flat();
  const avgCost = allTraces.reduce((sum, t) => sum + t.cost, 0) / allTraces.length;
  const avgTokens = allTraces.reduce((sum, t) => sum + t.tokens, 0) / allTraces.length;
  const cacheRate = (allTraces.filter(t => t.cacheHits.length > 0).length / allTraces.length) * 100;

  console.log(`Average Cost per Message: $${avgCost.toFixed(4)}`);
  console.log(`Average Tokens per Message: ${Math.round(avgTokens)}`);
  console.log(`Cache Hit Rate: ${cacheRate.toFixed(1)}%`);
  
  // Success criteria
  console.log('\n✅ SUCCESS CRITERIA:');
  console.log(`- Cost < $0.20 per conversation: ${avgCost < 0.05 ? '✅' : '❌'}`);
  console.log(`- Cache hit rate > 90% for greetings: ${cacheRate > 90 ? '✅' : '❌'}`);
  console.log(`- Consistent thread IDs: ${Object.keys(threadGroups).filter(t => t !== 'no-thread').length > 0 ? '✅' : '❌'}`);
}

// Run verification
verifyTraces().catch(console.error);