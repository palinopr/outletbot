# CLI Deployment Guide for LangGraph

## Quick Deploy via GitHub (Recommended)

### 1. Set GitHub Secrets
Go to your GitHub repository → Settings → Secrets and add:
- `LANGSMITH_API_KEY`
- `OPENAI_API_KEY`
- `GHL_API_KEY`
- `GHL_LOCATION_ID`
- `GHL_CALENDAR_ID`
- `LANGCHAIN_PROJECT_ID` (optional)

### 2. Deploy via GitHub Actions

```bash
# Install GitHub CLI if not already installed
brew install gh  # macOS
# or: https://cli.github.com/

# Authenticate with GitHub
gh auth login

# Trigger deployment from CLI
gh workflow run deploy-langgraph.yml

# Or push to main branch (triggers automatic deployment)
git add .
git commit -m "Deploy to LangGraph"
git push origin main
```

### 3. Monitor Deployment

```bash
# Watch the workflow in real-time
gh run watch

# View logs
gh run view --log

# List recent workflow runs
gh run list
```

## Direct CLI Deployment

### Option 1: Using the deploy script

```bash
# Make executable
chmod +x deploy.sh

# Deploy
./deploy.sh deploy outlet-media-bot production

# Check status
./deploy.sh status

# View logs
./deploy.sh logs
```

### Option 2: Manual commands

```bash
# Install CLI
npm install -g @langchain/langgraph-cli

# Login to LangSmith
export LANGCHAIN_API_KEY=your-langsmith-api-key
langgraph auth login

# Build
langgraph build --config ./langgraph.json -t outlet-media-bot

# Deploy
langgraph deploy --config ./langgraph.json --name outlet-media-bot

# Get deployment URL
langgraph deployments list --name outlet-media-bot
```

## Webhook URL
After deployment, your webhook URL will be:
```
https://[deployment-id].langgraph.app/runs/stream
```

Use the `webhook_handler` graph endpoint for processing webhooks.