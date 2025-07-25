# Outlet Media Bot - Modern LangGraph Sales Agent

A modern sales qualification bot built with LangGraph's `createReactAgent` pattern and GoHighLevel (GHL) integration. This bot handles Meta ads leads through GHL webhooks, conducts natural conversations to qualify leads, and books appointments automatically.

## 🚀 Modern Architecture

Built with the latest LangGraph patterns:
- **createReactAgent**: Modern prebuilt agent pattern
- **Zod-validated Tools**: Type-safe tool definitions
- **Smart Message Routing**: Messages sent via GHL tool, not webhook responses
- **Strict Qualification**: Enforces complete data collection before scheduling

## 🎯 Features

- **Intelligent Sales Conversations**: GPT-4 powered natural conversations
- **Lead Qualification**: Collects name, problem, goal, and budget systematically
- **Smart Budget Filtering**: Only schedules for $300+/month budgets
- **Automatic Appointment Booking**: Real-time calendar integration
- **GHL Full Integration**: Contacts, conversations, calendar, SMS
- **Production Ready**: LangSmith tracing, error handling, scaling

## 📋 Modern Implementation

### Tools (6 Zod-validated)
1. `sendGHLMessage` - Sends all messages via GHL API
2. `extractLeadInfo` - Extracts information from messages
3. `getCalendarSlots` - Fetches slots (with strict validation)
4. `bookAppointment` - Books the appointment
5. `updateGHLContact` - Updates tags and notes
6. `parseTimeSelection` - Parses time selections

### Key Files
```
agents/salesAgent.js           # createReactAgent implementation
agents/webhookHandler.js       # Webhook handler graph
langgraph.json                 # Platform configuration
LANGSMITH_DEPLOYMENT.md        # Deployment guide
```

## 🛠️ Quick Start

1. **Clone & Install**
```bash
git clone https://github.com/palinopr/outletbot.git
cd outlet-media-bot
npm install
```

2. **Configure Environment**
```bash
cp .env.example .env
# Edit .env with your keys
```

3. **Verify Setup**
```bash
node verify-deployment.js
```

4. **Test Locally**
```bash
node test-modern-agent.js
```

## 🚀 Deployment

### LangGraph Platform (Recommended)

```bash
# Install CLI
npm install -g @langchain/langgraph-cli

# Deploy
langgraph deploy --name outlet-media-bot

# Get webhook URL
langgraph deployments list
```

Your webhook URL: `https://[deployment-id].langgraph.app/runs/stream`

### GitHub Auto-Deploy

1. Push to GitHub
2. Connect repo in LangSmith Dashboard
3. Enable auto-deploy
4. Set environment variables

## 📊 Conversation Flow

```
1. Greeting → Ask for name
2. Discovery → Ask about problem
3. Goal Setting → Ask about desired outcome  
4. Budget Qualification → Ask about monthly budget
5. If $300+ → Get email → Show calendar slots → Book
6. If <$300 → Politely decline, tag as nurture
```

## 🔧 Configuration

### Required Environment Variables
```env
OPENAI_API_KEY=sk-...
GHL_API_KEY=your-ghl-api-key
GHL_LOCATION_ID=your-location-id
GHL_CALENDAR_ID=your-calendar-id
LANGSMITH_API_KEY=your-key
LANGSMITH_PROJECT=outlet-media-bot
```

### GHL Webhook Setup
```json
{
  "url": "https://your-deployment.langgraph.app/runs/stream",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json"
  }
}
```

## 📈 Monitoring

- **LangSmith Dashboard**: https://smith.langchain.com
- **Metrics**: Qualification rate, conversion rate, response time
- **Traces**: Full conversation flows with tool usage

## 🧪 Testing

```bash
# Test full conversation flows
node test-modern-agent.js

# Test specific webhook
curl -X POST http://localhost:4000/runs/stream \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+1234567890",
    "message": "Hi, I need help",
    "contactId": "test-123"
  }'
```

## 📚 Documentation

- [LangSmith Deployment Guide](./LANGSMITH_DEPLOYMENT.md)
- [Modern Implementation Details](./MODERN_IMPLEMENTATION_KEY_CHANGES.md)
- [API Documentation](./api/README.md)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Implement with modern patterns
4. Add tests
5. Submit PR

## 📄 License

MIT License - see LICENSE file

## 🆘 Support

- Issues: https://github.com/palinopr/outletbot/issues
- LangSmith Support: support@langchain.com
- Documentation: https://langchain-ai.github.io/langgraphjs/