# LangGraph GHL Sales Bot

A production-ready sales qualification bot built with LangGraph and GoHighLevel (GHL) integration. This bot handles Meta ads leads through GHL webhooks, conducts natural conversations to qualify leads, and books appointments automatically.

## 🚀 Features

- **Intelligent Sales Conversations**: Uses GPT-4 to conduct human-like sales conversations
- **Lead Qualification**: Collects name, problem, goal, and budget information
- **Automatic Appointment Booking**: Books calendar appointments for qualified leads ($300+/month)
- **GHL Integration**: Full integration with GoHighLevel CRM
- **Real-time Calendar Sync**: Fetches available slots from GHL calendars
- **Smart Tagging**: Automatically tags leads based on qualification status
- **Conversation Memory**: Uses GHL as source of truth for conversation history
- **Production Ready**: Includes security, monitoring, and scaling features

## 🏗️ Architecture

```
Meta Ads → GHL Webhook → LangGraph Agent → Response → GHL SMS
                              ↓
                     Lead Qualification Flow
                              ↓
                    Calendar Booking (if qualified)
```

## 📋 Prerequisites

- Node.js 18+
- GoHighLevel account with API access
- OpenAI API key
- LangSmith account (for monitoring)
- LangGraph Platform account (for deployment)

## 🛠️ Installation

1. Clone the repository:
```bash
git clone https://github.com/palinopr/langgraph-ghl-booking-python.git
cd langgraph-ghl-booking-python
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```env
# Required
OPENAI_API_KEY=sk-proj-...
GHL_API_KEY=pit-...
GHL_LOCATION_ID=your_location_id
GHL_CALENDAR_ID=your_calendar_id

# Optional
PORT=4000
LANGSMITH_API_KEY=lsv2_pt_...
LANGSMITH_PROJECT=outlet-media-bot
LANGCHAIN_TRACING_V2=true
```

## 🚀 Quick Start

### Local Development

1. Start the development server:
```bash
npm run dev
```

2. In another terminal, start ngrok:
```bash
ngrok http 4000
```

3. Configure GHL webhook with your ngrok URL:
```
https://your-ngrok-url.ngrok.io/webhook/meta-lead
```

4. Test with the included script:
```bash
node test-local.js
```

### Production Deployment (LangGraph Platform)

1. Push to GitHub
2. Connect repository to LangGraph Platform
3. Add environment variables
4. Deploy with one click

See [LANGGRAPH_DEPLOYMENT.md](./LANGGRAPH_DEPLOYMENT.md) for detailed instructions.

## 📁 Project Structure

```
├── agents/
│   ├── salesAgent.js         # Core LangGraph agent logic
│   └── tools/
│       └── calendarTool.js   # Calendar booking tools
├── services/
│   ├── ghlService.js         # GoHighLevel API wrapper
│   ├── conversationManager.js # Conversation state management
│   └── redisConversationManager.js # Redis-cached version
├── api/
│   └── langgraph-api.js      # LangGraph Platform handlers
├── index.js                  # Development server
├── index.production.js       # Production server
├── langgraph.config.js       # LangGraph Platform config
└── test-local.js            # Testing script
```

## 🔄 Conversation Flow

1. **Greeting** → Ask for name
2. **Discovery** → Ask about problem/pain point  
3. **Goal Setting** → Ask about desired outcome
4. **Budget Qualification** → Ask about monthly budget
5. **If $300+** → Ask for email → Show calendar slots
6. **If <$300** → Politely decline, tag as "nurture-lead"
7. **Appointment Booking** → Confirm and create in GHL

## 🏷️ Automatic Tags

- `qualified-lead` - Budget $300+
- `budget-300-plus` - High-value lead
- `under-budget` - Budget <$300
- `nurture-lead` - Needs follow-up
- `appointment-scheduled` - Booking confirmed
- `needs-marketing` / `needs-sales` - Based on problem

## 🧪 Testing

### Test GHL Integration:
```bash
node test-ghl-integration.js
```

### Test Single Message:
```bash
node test-local.js "Hi, I saw your ad about marketing services"
```

### Test Full Conversation:
```bash
node test-local.js
```

## 📊 Monitoring

### LangSmith Tracing
- View traces at: https://smith.langchain.com
- Project: outlet-media-bot
- Monitor conversation quality and agent decisions

### Health Check
```bash
curl http://localhost:4000/health
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| OPENAI_API_KEY | OpenAI API key for GPT-4 | Yes |
| GHL_API_KEY | GoHighLevel API key | Yes |
| GHL_LOCATION_ID | GHL location/account ID | Yes |
| GHL_CALENDAR_ID | GHL calendar for bookings | Yes |
| LANGSMITH_API_KEY | LangSmith monitoring | No |
| REDIS_URL | Redis connection for caching | No |
| PORT | Server port (default: 4000) | No |

### GHL Webhook Configuration

1. Go to GHL Settings → Integrations → Webhooks
2. Create new webhook:
   - URL: `https://your-domain.com/webhook/meta-lead`
   - Events: SMS Inbound, Conversation Message
   - Method: POST

### Required GHL Permissions

- Contacts (read/write)
- Conversations (read/write)
- Calendar (read/write)
- SMS (send)
- Tags (write)
- Notes (write)

## 🚀 Deployment Options

### LangGraph Platform (Recommended)
- One-click deployment
- Auto-scaling
- Built-in monitoring
- See [LANGGRAPH_DEPLOYMENT.md](./LANGGRAPH_DEPLOYMENT.md)

### Traditional Cloud
- Heroku: `git push heroku main`
- Railway: `railway up`
- Docker: `docker-compose up -d`
- See [README_PRODUCTION.md](./README_PRODUCTION.md)

## 📈 Production Features

- **Security**: Helmet, CORS, rate limiting
- **Scaling**: Auto-scaling with LangGraph Platform
- **Caching**: Redis support for high performance
- **Monitoring**: LangSmith integration
- **Error Handling**: Graceful error recovery
- **Conversation Persistence**: GHL as source of truth

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with [LangGraph](https://github.com/langchain-ai/langgraph)
- Integrated with [GoHighLevel](https://www.gohighlevel.com/)
- Powered by [OpenAI](https://openai.com/)
- Monitored by [LangSmith](https://smith.langchain.com/)

## 📞 Support

For issues or questions:
- Open an issue on GitHub
- Check [CLAUDE.md](./CLAUDE.md) for technical details
- Review LangSmith traces for debugging