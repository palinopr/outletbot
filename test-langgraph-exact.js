#!/usr/bin/env node

/**
 * Exact LangGraph Cloud Environment Test
 * This simulates the EXACT module resolution used in LangGraph Cloud
 */

import { createServer } from 'http';
import { parse } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';
import { symlink, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Setting up EXACT LangGraph Cloud environment...\n');

// Create /deps/outletbot symlink to simulate cloud structure
async function setupEnvironment() {
  const depsDir = '/tmp/deps';
  const outletbotPath = '/tmp/deps/outletbot';
  
  try {
    // Create /deps directory
    if (!existsSync(depsDir)) {
      await mkdir(depsDir, { recursive: true });
    }
    
    // Remove existing symlink if exists
    if (existsSync(outletbotPath)) {
      const { unlinkSync } = await import('fs');
      unlinkSync(outletbotPath);
    }
    
    // Create symlink from current directory to /deps/outletbot
    await symlink(__dirname, outletbotPath, 'dir');
    console.log(`✅ Created symlink: ${outletbotPath} -> ${__dirname}`);
    
    // Update NODE_PATH to include the symlinked location
    process.env.NODE_PATH = `${outletbotPath}/node_modules:${outletbotPath}:${process.env.NODE_PATH || ''}`;
    
    // Re-initialize module paths
    require('module').Module._initPaths();
    
    return outletbotPath;
  } catch (error) {
    console.error('❌ Failed to setup environment:', error.message);
    throw error;
  }
}

// Test loading modules from /deps/outletbot path
async function testModuleLoading(basePath) {
  console.log('\n📦 Testing module loading from cloud paths...\n');
  
  const testImports = [
    `${basePath}/production-fixes.js`,
    `${basePath}/validateEnv.js`,
    `${basePath}/services/config.js`,
    `${basePath}/services/ghlService.js`,
    `${basePath}/agents/salesAgent.js`,
    `${basePath}/agents/webhookHandler.js`,
    `${basePath}/api/langgraph-api.js`
  ];
  
  for (const importPath of testImports) {
    try {
      // Skip env validation for testing
      process.env.SKIP_ENV_VALIDATION = 'true';
      
      // Use dynamic import to test each module
      const module = await import(`file://${importPath}`);
      console.log(`✅ Loaded: ${importPath.replace(basePath, '/deps/outletbot')}`);
      
      // Check for expected exports
      if (importPath.includes('salesAgent.js')) {
        if (module.graph) {
          console.log('   └─ Found export: graph (sales agent)');
        }
      }
      if (importPath.includes('webhookHandler.js')) {
        if (module.graph) {
          console.log('   └─ Found export: graph (webhook handler)');
        }
      }
    } catch (error) {
      console.log(`❌ Failed: ${importPath.replace(basePath, '/deps/outletbot')}`);
      console.log(`   └─ Error: ${error.message}`);
      
      // If it's a module not found error, show what it was looking for
      if (error.code === 'ERR_MODULE_NOT_FOUND') {
        console.log(`   └─ Looking for: ${error.message.match(/Cannot find module '([^']+)'/)?.[1]}`);
      }
    }
  }
}

// Simulate the exact cloud server
async function startCloudServer(basePath) {
  console.log('\n🌐 Starting cloud simulation server...\n');
  
  // Load graphs using cloud paths
  let graphs = {};
  try {
    const salesAgentModule = await import(`file://${basePath}/agents/salesAgent.js`);
    const webhookModule = await import(`file://${basePath}/agents/webhookHandler.js`);
    
    graphs.salesAgent = salesAgentModule.graph;
    graphs.webhookHandler = webhookModule.graph;
    
    console.log('✅ Graphs loaded successfully');
  } catch (error) {
    console.error('❌ Failed to load graphs:', error.message);
    return;
  }
  
  // Load API handler
  let apiHandler;
  try {
    const apiModule = await import(`file://${basePath}/api/langgraph-api.js`);
    apiHandler = apiModule.default;
    console.log('✅ API handler loaded');
  } catch (error) {
    console.error('❌ Failed to load API handler:', error.message);
    return;
  }
  
  // Create test server
  const server = createServer(async (req, res) => {
    const { pathname } = parse(req.url);
    
    if (pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'ok', 
        environment: 'langgraph-cloud-simulation',
        timestamp: new Date().toISOString() 
      }));
      return;
    }
    
    if (pathname === '/webhook/meta-lead' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          req.body = JSON.parse(body);
          console.log('📨 Webhook received:', req.body);
          
          // Call the API handler
          await apiHandler(req, res);
        } catch (error) {
          console.error('❌ Webhook error:', error.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }
    
    res.writeHead(404);
    res.end('Not found');
  });
  
  // Start server
  const PORT = 8124;
  server.listen(PORT, () => {
    console.log(`\n✅ LangGraph Cloud simulation running!`);
    console.log(`📍 Server: http://localhost:${PORT}`);
    console.log(`📍 Health: http://localhost:${PORT}/health`);
    console.log(`📍 Webhook: http://localhost:${PORT}/webhook/meta-lead`);
    console.log(`\n🧪 Test with:`);
    console.log(`curl -X POST http://localhost:${PORT}/webhook/meta-lead \\`);
    console.log(`  -H 'Content-Type: application/json' \\`);
    console.log(`  -d '{"phone":"+1234567890","message":"Hola","contactId":"test-123"}'`);
    console.log(`\n🛑 Press Ctrl+C to stop`);
  });
}

// Main execution
async function main() {
  try {
    // Setup cloud-like environment
    const basePath = await setupEnvironment();
    
    // Test module loading
    await testModuleLoading(basePath);
    
    // Start server
    await startCloudServer(basePath);
  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    process.exit(1);
  }
}

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down...');
  process.exit(0);
});

// Run
main();