#!/usr/bin/env node

/**
 * Live Production Simulation Test
 * Tests the complete system as it would run in production
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import http from 'http';
import { performance } from 'perf_hooks';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Production-like settings
process.env.NODE_ENV = 'production';
process.env.LANGCHAIN_TRACING = 'true';
process.env.LANGSMITH_API_KEY = process.env.LANGSMITH_API_KEY || 'dummy-key';

console.log('🚀 LIVE PRODUCTION SIMULATION TEST');
console.log('==================================\n');

// Test configuration
const TEST_CONFIG = {
  port: 8125,
  timeout: 30000,
  testPhoneNumber: '+1234567890',
  testContactId: 'test-contact-' + Date.now(),
  testConversationId: 'test-conversation-' + Date.now()
};

// Conversation test scenarios
const CONVERSATION_SCENARIOS = [
  {
    name: 'Qualified Lead Flow',
    messages: [
      { text: 'Hola', expectedResponse: 'name request' },
      { text: 'Me llamo Maria', expectedResponse: 'problem inquiry' },
      { text: 'Necesito más clientes para mi negocio', expectedResponse: 'goal inquiry' },
      { text: 'Quiero duplicar mis ventas', expectedResponse: 'budget inquiry' },
      { text: 'Mi presupuesto es $500 al mes', expectedResponse: 'email request' },
      { text: 'maria@business.com', expectedResponse: 'calendar slots' },
      { text: 'El martes a las 3pm', expectedResponse: 'appointment confirmation' }
    ]
  },
  {
    name: 'Under Budget Flow',
    messages: [
      { text: 'Hi', expectedResponse: 'name request' },
      { text: 'John here', expectedResponse: 'problem inquiry' },
      { text: 'Need more customers', expectedResponse: 'goal inquiry' },
      { text: 'Want to grow my business', expectedResponse: 'budget inquiry' },
      { text: 'I can do $200 per month', expectedResponse: 'nurture response' }
    ]
  },
  {
    name: 'Existing Customer Recognition',
    messages: [
      { text: 'Hola soy Maria otra vez', expectedResponse: 'recognition of existing customer' },
      { text: 'Quiero cambiar mi cita', expectedResponse: 'appointment modification flow' }
    ]
  }
];

// Performance metrics
const metrics = {
  requestCount: 0,
  totalResponseTime: 0,
  errors: [],
  successfulFlows: 0,
  failedFlows: 0
};

// Create test server
async function createTestServer() {
  console.log('📦 Loading production modules...\n');
  
  // Import the actual production handler
  const { default: webhookHandler } = await import('./api/langgraph-api.js');
  
  const server = http.createServer(async (req, res) => {
    const startTime = performance.now();
    
    // CORS headers for browser testing
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'healthy',
        uptime: process.uptime(),
        metrics: {
          requests: metrics.requestCount,
          avgResponseTime: metrics.requestCount > 0 
            ? (metrics.totalResponseTime / metrics.requestCount).toFixed(2) + 'ms' 
            : 'N/A',
          errors: metrics.errors.length
        }
      }));
      return;
    }
    
    if (req.url === '/webhook/meta-lead' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          req.body = JSON.parse(body);
          metrics.requestCount++;
          
          console.log(`\n📨 Webhook ${metrics.requestCount}: ${req.body.message}`);
          
          // Call the production handler
          await webhookHandler(req, res);
          
          const responseTime = performance.now() - startTime;
          metrics.totalResponseTime += responseTime;
          
          console.log(`✅ Response sent in ${responseTime.toFixed(2)}ms`);
          
        } catch (error) {
          console.error('❌ Error:', error.message);
          metrics.errors.push({
            time: new Date().toISOString(),
            error: error.message,
            stack: error.stack
          });
          
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }
    
    res.writeHead(404);
    res.end('Not found');
  });
  
  return server;
}

// Run conversation scenario
async function runConversationScenario(scenario, port) {
  console.log(`\n🎭 Running Scenario: ${scenario.name}`);
  console.log('─'.repeat(50));
  
  const conversationId = 'conv-' + Date.now();
  const contactId = 'contact-' + Date.now();
  let success = true;
  
  for (let i = 0; i < scenario.messages.length; i++) {
    const message = scenario.messages[i];
    console.log(`\nStep ${i + 1}/${scenario.messages.length}: "${message.text}"`);
    
    try {
      const response = await sendWebhook({
        type: "InboundMessage",
        locationId: process.env.GHL_LOCATION_ID || "test-location",
        contactId: contactId,
        conversationId: conversationId,
        id: `msg-${Date.now()}-${i}`,
        message: message.text,
        attachments: [],
        phone: TEST_CONFIG.testPhoneNumber
      }, port);
      
      if (response.status === 'success') {
        console.log(`✅ Expected: ${message.expectedResponse}`);
      } else {
        console.log(`❌ Failed: ${response.error}`);
        success = false;
        break;
      }
      
      // Wait between messages to simulate real conversation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      success = false;
      break;
    }
  }
  
  if (success) {
    console.log(`\n✅ Scenario completed successfully!`);
    metrics.successfulFlows++;
  } else {
    console.log(`\n❌ Scenario failed!`);
    metrics.failedFlows++;
  }
  
  return success;
}

// Send webhook request
function sendWebhook(payload, port) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    
    const options = {
      hostname: 'localhost',
      port: port,
      path: '/webhook/meta-lead',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      },
      timeout: TEST_CONFIG.timeout
    };
    
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (res.statusCode === 200) {
            resolve({ status: 'success', data: response });
          } else {
            resolve({ status: 'error', error: response.error || 'Unknown error' });
          }
        } catch (e) {
          resolve({ status: 'error', error: 'Invalid response' });
        }
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Load test with concurrent requests
async function runLoadTest(port) {
  console.log('\n⚡ Running Load Test...');
  console.log('─'.repeat(50));
  
  const concurrentRequests = 5;
  const requests = [];
  
  for (let i = 0; i < concurrentRequests; i++) {
    requests.push(sendWebhook({
      type: "InboundMessage",
      locationId: process.env.GHL_LOCATION_ID || "test-location",
      contactId: `load-test-${i}`,
      conversationId: `load-conv-${i}`,
      id: `load-msg-${i}`,
      message: `Hola from user ${i}`,
      attachments: [],
      phone: `+123456789${i}`
    }, port));
  }
  
  const startTime = performance.now();
  const results = await Promise.allSettled(requests);
  const endTime = performance.now();
  
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  
  console.log(`\n📊 Load Test Results:`);
  console.log(`   Total Requests: ${concurrentRequests}`);
  console.log(`   Successful: ${successful}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total Time: ${(endTime - startTime).toFixed(2)}ms`);
  console.log(`   Avg Time per Request: ${((endTime - startTime) / concurrentRequests).toFixed(2)}ms`);
}

// Main test runner
async function runLiveTests() {
  try {
    // Start server
    const server = await createTestServer();
    
    await new Promise((resolve) => {
      server.listen(TEST_CONFIG.port, () => {
        console.log(`\n✅ Test server running on port ${TEST_CONFIG.port}`);
        console.log(`📍 Webhook URL: http://localhost:${TEST_CONFIG.port}/webhook/meta-lead`);
        console.log(`📍 Health Check: http://localhost:${TEST_CONFIG.port}/health\n`);
        resolve();
      });
    });
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Run conversation scenarios
    for (const scenario of CONVERSATION_SCENARIOS) {
      await runConversationScenario(scenario, TEST_CONFIG.port);
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait between scenarios
    }
    
    // Run load test
    await runLoadTest(TEST_CONFIG.port);
    
    // Final report
    console.log('\n' + '='.repeat(60));
    console.log('📊 LIVE TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Requests: ${metrics.requestCount}`);
    console.log(`Successful Flows: ${metrics.successfulFlows}`);
    console.log(`Failed Flows: ${metrics.failedFlows}`);
    console.log(`Average Response Time: ${metrics.requestCount > 0 ? (metrics.totalResponseTime / metrics.requestCount).toFixed(2) : 'N/A'}ms`);
    console.log(`Errors: ${metrics.errors.length}`);
    
    if (metrics.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      metrics.errors.forEach((err, i) => {
        console.log(`${i + 1}. ${err.time}: ${err.error}`);
      });
    }
    
    console.log('\n🏁 Test complete! Press Ctrl+C to exit.');
    
  } catch (error) {
    console.error('\n❌ Test setup failed:', error);
    process.exit(1);
  }
}

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  metrics.errors.push({
    time: new Date().toISOString(),
    error: 'Unhandled rejection: ' + reason
  });
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  metrics.errors.push({
    time: new Date().toISOString(),
    error: 'Uncaught exception: ' + error.message
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down gracefully...');
  process.exit(0);
});

// Run the tests
console.log('Starting live production simulation...\n');
runLiveTests();