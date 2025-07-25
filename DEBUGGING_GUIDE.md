# Outlet Media Bot - Debugging Guide

## Quick Debugging Commands

### 1. Test Everything (89% Success Rate)
```bash
node tests/test-components.js
```

### 2. Debug a Failed Conversation
```bash
# Get trace ID from LangSmith
node tests/debug-trace.js YOUR_TRACE_ID
```

### 3. Test Webhook Flow
```bash
node tests/test-real-webhook-flow.js
```

### 4. Check Custom Fields
```bash
node tests/test-get-custom-fields.js
```

## Common Issues & Solutions

### Issue: Bot Repeating Questions
**Symptom**: Bot asks for name/info already provided

**Debug Steps**:
1. Check conversation history retrieval:
   ```bash
   node tests/test-webhook-handler.js
   ```
2. Verify contactId is correct in webhook
3. Check if conversation history is being fetched

**Solution**: Ensure webhook sends correct contactId

---

### Issue: Custom Fields Not Saving
**Symptom**: Data not appearing in GHL contact

**Debug Steps**:
1. Get your custom field IDs:
   ```bash
   node tests/test-get-custom-fields.js
   ```
2. Test field updates:
   ```bash
   node tests/test-custom-field-update.js
   ```

**Solution**: Update field mapping in `services/ghlService.js`

---

### Issue: WhatsApp Messages Not Sending
**Symptom**: Bot processes but no message sent

**Debug Steps**:
1. Check component test results:
   ```bash
   node tests/test-components.js
   ```
2. Look for "WhatsApp messaging" test result

**Solution**: 
- Verify GHL WhatsApp integration active
- Check API key permissions
- Ensure correct phone format (+1XXXXXXXXXX)

---

### Issue: Calendar Not Showing
**Symptom**: Bot doesn't show available slots

**Debug Steps**:
1. Test calendar directly:
   ```bash
   # In test-components.js, check "Calendar slots" test
   ```
2. Verify all qualification fields collected

**Solution**:
- Ensure ALL fields collected (name, problem, goal, budget, email)
- Check calendar ID is correct
- Verify calendar has available slots

---

### Issue: Contact Not Found (400 Error)
**Symptom**: Error fetching contact from GHL

**Debug Steps**:
1. Verify contact exists in GHL
2. Check if contactId matches between systems

**Solution**:
- Map webhook contactId to correct GHL contact
- Ensure using correct location ID

---

## Debugging Workflow

### 1. Identify the Issue
- Check LangSmith for trace ID
- Note where in flow it fails

### 2. Run Targeted Test
```bash
# For trace analysis
node tests/debug-trace.js TRACE_ID

# For component issues
node tests/test-components.js

# For webhook issues
node tests/test-webhook-handler.js
```

### 3. Check Logs
- LangSmith traces show full execution
- Console logs show GHL API calls
- Error messages indicate specific issues

### 4. Verify Configuration
- `.env` file has all required keys
- GHL custom field IDs are correct
- Webhook URL is properly configured

---

## Test Data for Manual Testing

### Simulate Full Conversation
```javascript
// Messages to test in order:
"Hola"
"Soy Maria"
"Tengo un restaurante y necesito más clientes"
"Quiero duplicar mis ventas"
"Mi presupuesto es 500 al mes"
"maria@restaurante.com"
"El martes a las 11"
```

### Expected Results
1. Bot greets and asks name
2. Bot acknowledges name, asks problem
3. Bot identifies restaurant, asks goal
4. Bot notes goal, asks budget
5. Bot qualifies lead, asks email
6. Bot shows calendar slots
7. Bot books appointment

---

## Production Monitoring

### Key Metrics to Track
- Response time per message
- Qualification completion rate
- Appointment booking rate
- Error rate by type

### Where to Check
- **LangSmith**: Trace details and errors
- **GHL**: Contact updates and tags
- **Server Logs**: API errors and timeouts

---

## Emergency Fixes

### Bot Not Responding
1. Check LangGraph deployment status
2. Verify API keys are valid
3. Test with `test-components.js`

### All Requests Failing
1. Check GHL API status
2. Verify rate limits not exceeded
3. Test individual components

### Data Not Saving
1. Run custom field test
2. Check field ID mapping
3. Verify API permissions

---

## Support Resources

- **LangSmith Dashboard**: View all traces
- **GHL API Docs**: Check endpoint changes
- **GitHub Issues**: Report bugs
- **Test Suite**: `/tests/` directory