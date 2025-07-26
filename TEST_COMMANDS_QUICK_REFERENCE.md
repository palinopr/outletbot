# Quick Test Commands Reference

Copy and paste these commands to test the webhook handlers.

## 🧪 Test Commands

### 1. Simple Test (No Dependencies)
```bash
curl -X POST https://outletbot-a6387ef666a552b8ada595998ba395ea.us.langgraph.app/runs/stream \
  -H "Content-Type: application/json" \
  -H "X-API-Key: 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" \
  -d '{"assistant_id":"simple_webhook","input":{"messages":[{"role":"human","content":"{\"phone\":\"+13054870475\",\"message\":\"test\",\"contactId\":\"54sJIGTtwmR89Qc5JeEt\"}"}]}}' \
  -s | grep -o '"content":"[^"]*"' | tail -1
```

### 2. Environment Check
```bash
curl -X POST https://outletbot-a6387ef666a552b8ada595998ba395ea.us.langgraph.app/runs/stream \
  -H "Content-Type: application/json" \
  -H "X-API-Key: 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" \
  -d '{"assistant_id":"debug_webhook","input":{"messages":[{"role":"human","content":"{\"phone\":\"+13054870475\",\"message\":\"test\",\"contactId\":\"54sJIGTtwmR89Qc5JeEt\"}"}]}}' \
  -s | grep -A100 "DEBUG INFO"
```

### 3. Detailed Debug (Shows Exact Failure)
```bash
curl -X POST https://outletbot-a6387ef666a552b8ada595998ba395ea.us.langgraph.app/runs/stream \
  -H "Content-Type: application/json" \
  -H "X-API-Key: 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" \
  -d '{"assistant_id":"webhook_debug_detailed","input":{"messages":[{"role":"human","content":"{\"phone\":\"+13054870475\",\"message\":\"test\",\"contactId\":\"54sJIGTtwmR89Qc5JeEt\"}"}]}}' \
  -s | grep -E "DEBUG|Error|Success" -A5
```

### 4. Production Webhook (Main Handler)
```bash
curl -X POST https://outletbot-a6387ef666a552b8ada595998ba395ea.us.langgraph.app/runs/stream \
  -H "Content-Type: application/json" \
  -H "X-API-Key: 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" \
  -d '{"assistant_id":"webhook_handler","input":{"messages":[{"role":"human","content":"{\"phone\":\"+13054870475\",\"message\":\"Hola\",\"contactId\":\"54sJIGTtwmR89Qc5JeEt\"}"}]}}' \
  -s | grep -o '"content":"[^"]*"' | tail -1
```

## 🔍 One-Liner Test Sequence

Run all tests in order:
```bash
# Test 1: Simple
echo "1. SIMPLE TEST:" && curl -sX POST https://outletbot-a6387ef666a552b8ada595998ba395ea.us.langgraph.app/runs/stream -H "Content-Type: application/json" -H "X-API-Key: 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" -d '{"assistant_id":"simple_webhook","input":{"messages":[{"role":"human","content":"{\"phone\":\"+13054870475\",\"message\":\"test\",\"contactId\":\"54sJIGTtwmR89Qc5JeEt\"}"}]}}' | grep -o '"content":"[^"]*"' | tail -1 && echo ""

# Test 2: Debug
echo "2. ENV CHECK:" && curl -sX POST https://outletbot-a6387ef666a552b8ada595998ba395ea.us.langgraph.app/runs/stream -H "Content-Type: application/json" -H "X-API-Key: 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" -d '{"assistant_id":"debug_webhook","input":{"messages":[{"role":"human","content":"{\"phone\":\"+13054870475\",\"message\":\"test\",\"contactId\":\"54sJIGTtwmR89Qc5JeEt\"}"}]}}' | grep -o '"hasGHLKey":[^,]*' && echo ""

# Test 3: Main
echo "3. MAIN WEBHOOK:" && curl -sX POST https://outletbot-a6387ef666a552b8ada595998ba395ea.us.langgraph.app/runs/stream -H "Content-Type: application/json" -H "X-API-Key: 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" -d '{"assistant_id":"webhook_handler","input":{"messages":[{"role":"human","content":"{\"phone\":\"+13054870475\",\"message\":\"test\",\"contactId\":\"54sJIGTtwmR89Qc5JeEt\"}"}]}}' | grep -o '"content":"[^"]*"' | tail -1
```

## 📊 Expected Results

| Test | Success Response | Failure Response |
|------|-----------------|------------------|
| simple_webhook | "Hola! Simple webhook is working..." | Connection error |
| debug_webhook | Shows all env vars as true | Missing env vars |
| webhook_debug_detailed | "DEBUG SUCCESS!" with steps | "DEBUG FAILED at step X" |
| webhook_handler | Bot response in Spanish | "Lo siento, hubo un error..." |

## 🛠️ Local Testing

```bash
# Test GHL API directly
node test-ghl-api-direct.js

# Test WhatsApp sending
node verify-whatsapp-sending.js

# Test with minimal webhook
node test-webhook-minimal.js
```

## 🔗 Useful Links

- **GHL Contact**: https://app.gohighlevel.com/v2/location/sHFG9Rw6BdGh6d6bfMqG/contacts/detail/54sJIGTtwmR89Qc5JeEt
- **LangSmith Traces**: https://smith.langchain.com
- **Deployment Dashboard**: Check your LangGraph account