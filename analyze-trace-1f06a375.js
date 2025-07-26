// Analyze trace: 1f06a375-5f3a-6153-a010-fa326d050ad7

console.log('🔍 Analyzing Trace: 1f06a375-5f3a-6153-a010-fa326d050ad7');
console.log('================================================\n');

console.log('This trace is from the LIVE production environment where messages are getting stuck.\n');

console.log('Based on our logging system, check for these patterns in LangSmith:\n');

console.log('1. WEBHOOK FLOW CHECKPOINTS:');
console.log('   - 🔍 WEBHOOK HANDLER START');
console.log('   - 📋 Webhook data extracted');
console.log('   - ✅ WEBHOOK VALIDATION PASSED');
console.log('   - 🔄 FETCHING CONVERSATION STATE');
console.log('   - ✅ CONVERSATION STATE FETCHED');
console.log('   - 📦 PREPARING AGENT INVOCATION');
console.log('   - 🤖 INVOKING SALES AGENT');
console.log('   - ✅ AGENT RESPONSE RECEIVED');
console.log('   - ✅ WEBHOOK PROCESSED SUCCESSFULLY\n');

console.log('2. POTENTIAL STUCK POINTS:');
console.log('   a) Between "FETCHING CONVERSATION STATE" and "CONVERSATION STATE FETCHED"');
console.log('      → GHL API timeout or connection issue');
console.log('   b) Between "INVOKING SALES AGENT" and "AGENT RESPONSE RECEIVED"');
console.log('      → Agent stuck in tool loop or LLM timeout');
console.log('   c) No "WEBHOOK HANDLER START" log');
console.log('      → Webhook not reaching the handler\n');

console.log('3. TOOL EXECUTION PATTERNS TO CHECK:');
console.log('   - 🔍 EXTRACT LEAD INFO START → Should complete quickly');
console.log('   - 📤 SEND GHL MESSAGE START → Should show "MESSAGE SENT SUCCESSFULLY"');
console.log('   - Look for repeated tool calls (loops)\n');

console.log('4. ERROR PATTERNS:');
console.log('   - ❌ CONVERSATION FETCH FAILED');
console.log('   - ❌ AGENT ERROR');
console.log('   - ❌ NO CONTACT ID');
console.log('   - Timeout errors\n');

console.log('5. TIMING ANALYSIS:');
console.log('   - Normal webhook processing: 2-5 seconds');
console.log('   - With calendar fetch: 3-8 seconds');
console.log('   - If >10 seconds: Something is stuck\n');

console.log('IMMEDIATE ACTIONS:');
console.log('1. Check LangSmith trace: https://smith.langchain.com/public/1f06a375-5f3a-6153-a010-fa326d050ad7/r');
console.log('2. Look for the last successful log before getting stuck');
console.log('3. Check if tools are being called repeatedly');
console.log('4. Verify GHL API responses are coming back\n');

console.log('COMMON PRODUCTION ISSUES:');
console.log('- GHL rate limiting causing timeouts');
console.log('- Network connectivity to GHL API');
console.log('- LLM API timeouts under load');
console.log('- Memory/CPU constraints causing slowdowns');
console.log('- Tool loops from edge case inputs\n');