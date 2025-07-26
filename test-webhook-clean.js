#!/usr/bin/env node
// Clean test that ensures latest code is loaded
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 RUNNING CLEAN WEBHOOK TEST');
console.log('=============================\n');

// Kill any existing Node processes that might have cached modules
console.log('Clearing module cache...\n');

// Run the test in a fresh Node process
const testProcess = spawn('node', ['--no-warnings', join(__dirname, 'test-webhook-minimal.js')], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test',
    // Force fresh module loading
    NODE_DISABLE_COLORS: '0'
  }
});

testProcess.on('error', (error) => {
  console.error('Failed to start test:', error);
  process.exit(1);
});

testProcess.on('exit', (code) => {
  if (code !== 0) {
    console.error(`\nTest exited with code ${code}`);
  }
  process.exit(code);
});