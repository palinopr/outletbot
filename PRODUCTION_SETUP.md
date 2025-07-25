# Production Environment Requirements

## 1. Infrastructure

### Hosting Options:
- **AWS EC2/ECS**: Full control, scalable
- **Heroku**: Easy deployment, auto-scaling
- **Railway/Render**: Modern, simple deployment
- **DigitalOcean App Platform**: Cost-effective

### Required Services:
- **Node.js Server**: Your bot application
- **Redis**: Session/conversation storage
- **PostgreSQL/MongoDB**: Permanent data storage
- **Domain + SSL**: For webhook security

## 2. Environment Variables

### Required for Production:
```env
# API Keys
OPENAI_API_KEY=your_key
GHL_API_KEY=your_key
GHL_LOCATION_ID=your_location
GHL_CALENDAR_ID=your_calendar

# Production Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname
REDIS_URL=redis://user:pass@host:6379

# LangSmith Monitoring
LANGSMITH_API_KEY=your_key
LANGSMITH_PROJECT=outlet-media-bot-prod
LANGCHAIN_TRACING_V2=true

# Server Config
NODE_ENV=production
PORT=3000
WEBHOOK_SECRET=random_secret_key

# Security
CORS_ORIGIN=https://your-domain.com
RATE_LIMIT_MAX=100
SESSION_SECRET=random_secret
```

## 3. Code Changes Needed

### A. Add Redis for Conversations
```javascript
// npm install redis
const redis = require('redis');
const client = redis.createClient({ url: process.env.REDIS_URL });

// Replace Map with Redis
async function getConversation(conversationId) {
  const data = await client.get(`conv:${conversationId}`);
  return data ? JSON.parse(data) : null;
}

async function saveConversation(conversationId, state) {
  await client.setex(
    `conv:${conversationId}`, 
    3600, // 1 hour TTL
    JSON.stringify(state)
  );
}
```

### B. Add Database for Analytics
```javascript
// npm install pg
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Store conversation history
async function saveConversationToDB(conversation) {
  await pool.query(`
    INSERT INTO conversations 
    (id, contact_id, lead_name, budget, status, created_at)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [
    conversation.conversationId,
    conversation.ghlContactId,
    conversation.leadName,
    conversation.leadBudget,
    conversation.appointmentScheduled ? 'booked' : 'qualified',
    new Date()
  ]);
}
```

### C. Add Security Middleware
```javascript
// npm install helmet cors express-rate-limit
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX || 100
});

app.use('/webhook', limiter);
```

### D. Add Webhook Verification
```javascript
// Verify webhook comes from GHL
function verifyWebhook(req, res, next) {
  const signature = req.headers['x-ghl-signature'];
  const secret = process.env.WEBHOOK_SECRET;
  
  if (!signature || !verifySignature(req.body, signature, secret)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
}

app.post('/webhook/meta-lead', verifyWebhook, async (req, res) => {
  // existing code
});
```

## 4. Database Schema

### PostgreSQL Schema:
```sql
CREATE TABLE conversations (
  id VARCHAR PRIMARY KEY,
  contact_id VARCHAR NOT NULL,
  lead_name VARCHAR,
  lead_email VARCHAR,
  lead_phone VARCHAR,
  lead_problem TEXT,
  lead_goal TEXT,
  lead_budget DECIMAL,
  status VARCHAR,
  appointment_scheduled BOOLEAN DEFAULT FALSE,
  appointment_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  conversation_id VARCHAR REFERENCES conversations(id),
  role VARCHAR NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE appointments (
  id SERIAL PRIMARY KEY,
  conversation_id VARCHAR REFERENCES conversations(id),
  ghl_appointment_id VARCHAR,
  scheduled_time TIMESTAMP,
  status VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 5. Monitoring & Logging

### Add Production Logging:
```javascript
// npm install winston
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Use logger instead of console.log
logger.info('Webhook received', { contactId, message });
```

### Health Monitoring:
```javascript
app.get('/health', async (req, res) => {
  const checks = {
    server: 'ok',
    redis: await checkRedis(),
    database: await checkDatabase(),
    ghl: await checkGHLConnection(),
    timestamp: new Date()
  };
  
  res.json(checks);
});
```

## 6. Deployment Steps

### 1. Prepare Code:
```bash
# Add production dependencies
npm install --save redis pg helmet cors express-rate-limit winston

# Create production branch
git checkout -b production
git add .
git commit -m "Add production dependencies"
```

### 2. Deploy to Heroku (Example):
```bash
# Install Heroku CLI
heroku create outlet-media-bot

# Add Redis
heroku addons:create heroku-redis:hobby-dev

# Add PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev

# Set environment variables
heroku config:set OPENAI_API_KEY=xxx
heroku config:set GHL_API_KEY=xxx
# ... set all variables

# Deploy
git push heroku production:main
```

### 3. Configure GHL Webhook:
- Update webhook URL to: `https://outlet-media-bot.herokuapp.com/webhook/meta-lead`
- Add webhook secret for verification

## 7. Scaling Considerations

### For High Volume:
1. **Multiple Workers**: Use PM2 cluster mode
2. **Queue System**: Add BullMQ for async processing
3. **Caching**: Cache GHL calendar data
4. **CDN**: Use Cloudflare for DDoS protection

### Cost Optimization:
1. **Auto-scaling**: Scale down during low traffic
2. **Efficient Queries**: Batch GHL API calls
3. **Compression**: Enable gzip
4. **Connection Pooling**: Reuse database connections

## 8. Backup & Recovery

### Daily Backups:
```bash
# Backup script
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
aws s3 cp backup-*.sql s3://your-bucket/backups/
```

### Disaster Recovery:
- Keep 30 days of backups
- Test restore process monthly
- Document recovery procedures

## Total Monthly Cost Estimate:
- **Small (< 1000 conversations/month)**: ~$50-100
- **Medium (< 10k conversations/month)**: ~$200-500
- **Large (< 100k conversations/month)**: ~$1000+