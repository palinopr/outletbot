/**
 * Debug Helper for Webhook Flow
 * Provides detailed logging and inspection tools for debugging
 * 
 * @module debug-helper
 */

import { inspect } from 'util';

// Color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

/**
 * Log a debug header
 */
export function logHeader(title) {
  console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.blue}${colors.bright}${title}${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}\n`);
}

/**
 * Log a section header
 */
export function logSection(title) {
  console.log(`\n${colors.cyan}--- ${title} ---${colors.reset}\n`);
}

/**
 * Log step information
 */
export function logStep(step, description) {
  console.log(`${colors.yellow}Step ${step}:${colors.reset} ${description}`);
}

/**
 * Log success message
 */
export function logSuccess(message) {
  console.log(`${colors.green}✓ ${message}${colors.reset}`);
}

/**
 * Log error message
 */
export function logError(message, error = null) {
  console.log(`${colors.red}✗ ${message}${colors.reset}`);
  if (error) {
    console.log(`${colors.red}  Error: ${error.message || error}${colors.reset}`);
    if (error.stack && process.env.DEBUG === 'true') {
      console.log(`${colors.dim}${error.stack}${colors.reset}`);
    }
  }
}

/**
 * Log warning message
 */
export function logWarning(message) {
  console.log(`${colors.yellow}⚠ ${message}${colors.reset}`);
}

/**
 * Log info message
 */
export function logInfo(message) {
  console.log(`${colors.blue}ℹ ${message}${colors.reset}`);
}

/**
 * Log webhook payload
 */
export function logWebhookPayload(payload) {
  logSection('Webhook Payload');
  console.log(inspect(payload, { colors: true, depth: null }));
}

/**
 * Log graph state
 */
export function logGraphState(state) {
  logSection('Graph State');
  console.log(`Next nodes: ${colors.cyan}${state.next || 'None'}${colors.reset}`);
  console.log(`Tasks: ${colors.cyan}${state.tasks?.length || 0}${colors.reset}`);
  
  if (state.values) {
    console.log('\nState values:');
    console.log(inspect(state.values, { colors: true, depth: 2 }));
  }
}

/**
 * Log tool execution
 */
export function logToolExecution(toolName, input, output) {
  console.log(`\n${colors.magenta}Tool: ${toolName}${colors.reset}`);
  console.log('Input:', inspect(input, { colors: true, depth: 2 }));
  
  if (output) {
    console.log('Output:', inspect(output, { colors: true, depth: 2 }));
  }
}

/**
 * Log message flow
 */
export function logMessageFlow(messages) {
  logSection('Message Flow');
  
  messages.forEach((msg, index) => {
    const role = msg.role || msg._getType?.() || 'unknown';
    const preview = msg.content ? 
      msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '') : 
      'No content';
    
    console.log(`${index + 1}. [${colors.cyan}${role}${colors.reset}] ${preview}`);
    
    if (msg.tool_calls) {
      msg.tool_calls.forEach(tc => {
        console.log(`   ${colors.magenta}→ Tool: ${tc.name}${colors.reset}`);
      });
    }
  });
}

/**
 * Log stream chunk
 */
export function logStreamChunk(chunk) {
  console.log(`\n${colors.dim}[Stream Update]${colors.reset}`);
  console.log(inspect(chunk, { colors: true, depth: 2 }));
}

/**
 * Log lead information
 */
export function logLeadInfo(leadInfo) {
  logSection('Lead Information');
  
  const fields = [
    { key: 'name', label: 'Name' },
    { key: 'businessType', label: 'Business' },
    { key: 'problem', label: 'Problem' },
    { key: 'goal', label: 'Goal' },
    { key: 'budget', label: 'Budget' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' }
  ];
  
  fields.forEach(({ key, label }) => {
    const value = leadInfo[key];
    const status = value ? colors.green : colors.yellow;
    console.log(`${label}: ${status}${value || 'Not collected'}${colors.reset}`);
  });
  
  // Qualification status
  if (leadInfo.budget) {
    const qualified = leadInfo.budget >= 300;
    const status = qualified ? colors.green : colors.red;
    console.log(`\nQualification: ${status}${qualified ? 'QUALIFIED' : 'NOT QUALIFIED'}${colors.reset}`);
  }
}

/**
 * Log GHL API call
 */
export function logGHLCall(method, endpoint, data = null) {
  console.log(`\n${colors.blue}GHL API Call:${colors.reset}`);
  console.log(`${method} ${endpoint}`);
  
  if (data) {
    console.log('Data:', inspect(data, { colors: true, depth: 2 }));
  }
}

/**
 * Create a timer for performance tracking
 */
export function createTimer(name) {
  const start = Date.now();
  
  return {
    end: () => {
      const duration = Date.now() - start;
      console.log(`${colors.dim}${name} took ${duration}ms${colors.reset}`);
      return duration;
    }
  };
}

/**
 * Log test summary
 */
export function logTestSummary(results) {
  logHeader('TEST SUMMARY');
  
  let passed = 0;
  let failed = 0;
  let total = 0;
  
  results.forEach(result => {
    total++;
    if (result.success || result.status === 'pass') {
      passed++;
      logSuccess(result.name || result.scenario);
    } else {
      failed++;
      logError(result.name || result.scenario, result.error);
    }
  });
  
  console.log(`\n${colors.bright}Total: ${total}${colors.reset}`);
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  
  const successRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  const rateColor = successRate >= 80 ? colors.green : successRate >= 50 ? colors.yellow : colors.red;
  console.log(`${rateColor}Success Rate: ${successRate}%${colors.reset}`);
}

/**
 * Debug webhook handler execution
 */
export async function debugWebhookExecution(graph, input, config) {
  logHeader('WEBHOOK EXECUTION DEBUG');
  
  // Log input
  logSection('Input');
  console.log(inspect(input, { colors: true, depth: 3 }));
  
  // Log config
  logSection('Configuration');
  console.log(inspect(config, { colors: true, depth: 2 }));
  
  // Stream execution with detailed logging
  logSection('Execution Stream');
  const timer = createTimer('Total execution');
  
  try {
    const stream = await graph.stream(input, config);
    let stepCount = 0;
    
    for await (const chunk of stream) {
      stepCount++;
      console.log(`\n${colors.bright}=== Update ${stepCount} ===${colors.reset}`);
      
      // Log each node update
      for (const [node, update] of Object.entries(chunk)) {
        console.log(`${colors.cyan}Node: ${node}${colors.reset}`);
        
        if (update.messages) {
          logMessageFlow(update.messages);
        }
        
        if (update.leadInfo) {
          logLeadInfo(update.leadInfo);
        }
      }
    }
    
    timer.end();
    
    // Get final state
    const finalState = await graph.getState(config);
    logGraphState(finalState);
    
    return finalState;
    
  } catch (error) {
    timer.end();
    logError('Execution failed', error);
    throw error;
  }
}

/**
 * Monitor conversation in real-time
 */
export async function monitorConversation(conversationManager, contactId, interval = 5000) {
  logHeader('CONVERSATION MONITOR');
  logInfo(`Monitoring conversation for contact: ${contactId}`);
  logInfo(`Refresh interval: ${interval}ms`);
  logInfo('Press Ctrl+C to stop\n');
  
  let lastMessageCount = 0;
  
  const monitor = setInterval(async () => {
    try {
      const state = await conversationManager.getConversationState(contactId);
      const messageCount = state.messages.length;
      
      if (messageCount > lastMessageCount) {
        logSuccess(`New messages detected! (${messageCount - lastMessageCount} new)`);
        
        // Show new messages
        const newMessages = state.messages.slice(lastMessageCount);
        newMessages.forEach(msg => {
          const role = msg.role || 'unknown';
          const preview = msg.content?.substring(0, 100) || 'No content';
          console.log(`  [${colors.cyan}${role}${colors.reset}] ${preview}`);
        });
        
        lastMessageCount = messageCount;
      } else {
        console.log(`${colors.dim}No new messages (Total: ${messageCount})${colors.reset}`);
      }
      
    } catch (error) {
      logError('Monitor error', error);
    }
  }, interval);
  
  // Handle cleanup
  process.on('SIGINT', () => {
    clearInterval(monitor);
    console.log('\n\nMonitoring stopped.');
    process.exit(0);
  });
}

export default {
  logHeader,
  logSection,
  logStep,
  logSuccess,
  logError,
  logWarning,
  logInfo,
  logWebhookPayload,
  logGraphState,
  logToolExecution,
  logMessageFlow,
  logStreamChunk,
  logLeadInfo,
  logGHLCall,
  createTimer,
  logTestSummary,
  debugWebhookExecution,
  monitorConversation
};