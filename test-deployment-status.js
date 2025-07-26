#!/usr/bin/env node

console.log('🔍 CHECKING DEPLOYMENT STATUS');
console.log('============================\n');

const API_KEY = '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';
const BASE_URL = 'https://outletbot-a6387ef666a552b8ada595998ba395ea.us.langgraph.app';

async function checkDeployment() {
  // Test 1: Check if deployment is responding
  console.log('1. Testing deployment health...');
  const start = Date.now();
  
  try {
    const response = await fetch(`${BASE_URL}/runs/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({
        assistant_id: 'webhook_handler',
        input: {
          messages: [{
            role: 'human',
            content: '{"phone": "+13054870475", "message": "test", "contactId": "54sJIGTtwmR89Qc5JeEt"}'
          }]
        },
        stream_mode: 'values'
      })
    });
    
    const responseTime = Date.now() - start;
    console.log(`   Response time: ${responseTime}ms`);
    console.log(`   Status: ${response.status}`);
    
    if (responseTime > 10000) {
      console.log('   ⚠️  Response took longer than 10s - old timeout might still be active');
    }
    
  } catch (error) {
    console.error('   ❌ Error:', error.message);
  }
  
  console.log('\n2. Deployment Information:');
  console.log('   URL:', BASE_URL);
  console.log('   Last push to GitHub: ~5 minutes ago');
  console.log('   Changes: Increased timeouts to 30s');
  
  console.log('\n3. Required Actions:');
  console.log('   ✅ Code is pushed to GitHub');
  console.log('   ⏳ Need to redeploy in LangGraph dashboard');
  console.log('   📝 Steps to redeploy:');
  console.log('      1. Go to LangGraph deployment dashboard');
  console.log('      2. Click "New Revision" or "Redeploy"');
  console.log('      3. Select "main" branch');
  console.log('      4. Deploy with the new code');
  console.log('      5. Wait for deployment to complete');
  
  console.log('\n4. How to verify new deployment:');
  console.log('   - Check deployment logs for "30s" timeout values');
  console.log('   - Look for "Cold start - initializing services" in logs');
  console.log('   - Response should succeed instead of error message');
}

checkDeployment().catch(console.error);