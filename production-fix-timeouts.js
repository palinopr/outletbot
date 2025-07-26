// Production Fix: Add aggressive timeouts to prevent webhook from getting stuck

console.log('🔧 PRODUCTION FIX: Timeout Configuration');
console.log('=====================================\n');

console.log('Add these timeout configurations to prevent stuck webhooks:\n');

console.log('1. UPDATE webhookHandler.js - Add timeout to conversation fetch:');
console.log(`
  // Line 229 - Update timeout with more aggressive value
  const conversationTimeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Conversation fetch timeout')), 5000); // 5 seconds max
  });
`);

console.log('\n2. UPDATE salesAgent.js - Add timeout to LLM calls:');
console.log(`
  // Line 736 - Update LLM configuration
  const llm = new ChatOpenAI({ 
    model: "gpt-4",
    temperature: 0.7,
    timeout: 10000,  // 10 second timeout
    maxRetries: 2    // Reduce retries
  });
`);

console.log('\n3. UPDATE ghlService.js - Add timeout to API calls:');
console.log(`
  // Add timeout to axios config
  const axiosConfig = {
    timeout: 5000,  // 5 second timeout for all GHL API calls
    headers: {
      'Authorization': \`Bearer \${this.apiKey}\`,
      'Version': '2021-07-28',
      'Content-Type': 'application/json'
    }
  };
`);

console.log('\n4. UPDATE .env for production:');
console.log(`
# Aggressive timeouts for production
API_TIMEOUT=5000              # 5 seconds for API calls
CONVERSATION_TIMEOUT=30000    # 30 seconds total conversation timeout
MAX_RETRIES=2                 # Reduce retries to fail fast
ENABLE_CIRCUIT_BREAKER=true   # Enable circuit breaker
`);

console.log('\n5. Add circuit breaker pattern to webhookHandler.js:');
console.log(`
// Add at top of file
const circuitBreaker = {
  failures: 0,
  lastFailure: 0,
  threshold: 3,
  timeout: 60000,  // 1 minute cooldown
  
  isOpen() {
    if (this.failures >= this.threshold) {
      const timeSinceLastFailure = Date.now() - this.lastFailure;
      if (timeSinceLastFailure < this.timeout) {
        return true;  // Circuit is open, reject requests
      }
      // Reset after cooldown
      this.failures = 0;
    }
    return false;
  },
  
  recordSuccess() {
    this.failures = 0;
  },
  
  recordFailure() {
    this.failures++;
    this.lastFailure = Date.now();
  }
};

// In webhookHandlerNode, check circuit breaker first
if (circuitBreaker.isOpen()) {
  logger.error('Circuit breaker OPEN - too many failures');
  return {
    messages: [...state.messages, new AIMessage('Sistema temporalmente no disponible. Intenta en unos minutos.')],
    contactId: state.contactId,
    phone: state.phone
  };
}
`);

console.log('\n6. Add health check endpoint:');
console.log(`
// Add to your API
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {}
  };
  
  // Check GHL
  try {
    const start = Date.now();
    await ghlService.getContact('test');
    health.checks.ghl = { status: 'ok', responseTime: Date.now() - start };
  } catch (error) {
    health.checks.ghl = { status: 'error', error: error.message };
    health.status = 'degraded';
  }
  
  // Check OpenAI
  try {
    const start = Date.now();
    await llm.invoke([{ role: 'system', content: 'test' }]);
    health.checks.openai = { status: 'ok', responseTime: Date.now() - start };
  } catch (error) {
    health.checks.openai = { status: 'error', error: error.message };
    health.status = 'degraded';
  }
  
  res.status(health.status === 'ok' ? 200 : 503).json(health);
});
`);

console.log('\n7. IMMEDIATE PRODUCTION CHANGES:');
console.log('   a) Reduce all timeouts to fail fast');
console.log('   b) Add circuit breaker to prevent cascade failures');
console.log('   c) Implement health checks for monitoring');
console.log('   d) Add more aggressive error handling');
console.log('   e) Log all timeout occurrences for analysis\n');

console.log('These changes will prevent the webhook from getting stuck and provide');
console.log('better visibility into what component is causing the delays.');