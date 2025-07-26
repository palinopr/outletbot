#!/usr/bin/env node
// Quick test to run in deployment console
console.log('Testing deployment initialization...\n');

// Set production environment
process.env.NODE_ENV = 'production';

// Test 1: Environment variables
console.log('1. Environment Variables:');
['GHL_API_KEY', 'GHL_LOCATION_ID', 'GHL_CALENDAR_ID', 'OPENAI_API_KEY'].forEach(key => {
  console.log(`   ${key}: ${process.env[key] ? '✓ SET' : '✗ MISSING'}`);
});

// Test 2: Import and initialize services
console.log('\n2. Service Initialization:');
async function testInit() {
  try {
    console.log('   Importing GHLService...');
    const { GHLService } = await import('./services/ghlService.js');
    console.log('   ✓ Import successful');
    
    console.log('   Creating GHL instance...');
    const ghl = new GHLService(
      process.env.GHL_API_KEY,
      process.env.GHL_LOCATION_ID
    );
    console.log('   ✓ GHL Service created');
    
    console.log('   Testing API call...');
    const start = Date.now();
    try {
      // Test with a simple call that should fail gracefully
      await ghl.getContact('test-id').catch(() => null);
      console.log(`   ✓ API call completed in ${Date.now() - start}ms`);
    } catch (error) {
      console.log(`   ✗ API call failed: ${error.message}`);
    }
    
  } catch (error) {
    console.error(`   ✗ Service init failed: ${error.message}`);
    console.error(`   Error type: ${error.constructor.name}`);
    if (error.stack) {
      console.error('   Stack:', error.stack.split('\n')[1]);
    }
  }
}

// Test 3: Webhook handler import
console.log('\n3. Webhook Handler:');
async function testWebhook() {
  try {
    console.log('   Importing webhook handler...');
    const { graph } = await import('./agents/webhookHandler.js');
    console.log('   ✓ Webhook handler imported');
    console.log(`   Graph type: ${graph.constructor.name}`);
  } catch (error) {
    console.error(`   ✗ Import failed: ${error.message}`);
  }
}

// Run tests
(async () => {
  await testInit();
  await testWebhook();
  console.log('\nDeployment test complete.');
})();