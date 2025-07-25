# Project Cleanup Recommendations

## Essential Files to Keep ✅

### Core Application
- `index.js` - Main server
- `package.json` & `package-lock.json` - Dependencies
- `.env.example` - Environment template
- `.gitignore` - Git ignore rules
- `LICENSE` - MIT License

### Source Code
- `agents/salesAgent.js` - Core bot logic
- `agents/tools/calendarTool.js` - Calendar tools
- `services/ghlService.js` - GHL API wrapper
- `services/conversationManager.js` - Conversation management
- `utils/validateEnv.js` - Environment validation

### Documentation
- `README.md` - Main documentation
- `CLAUDE.md` - Technical details

### LangGraph Deployment
- `langgraph.config.js` - Platform configuration
- `api/langgraph-api.js` - API handlers
- `LANGGRAPH_DEPLOYMENT.md` - Deployment guide

### Testing
- `test-local.js` - Local testing
- `test-ghl-integration.js` - Integration tests

## Files to Remove ❌

### Temporary Files
```bash
rm -rf temp-repo/
rm -f GITHUB_REPLACE_INSTRUCTIONS.md
rm -f replace-github-repo.sh
rm -f cleanup.sh
rm -f start-local.sh
```

### Redundant Documentation
```bash
rm -f DEPLOYMENT.md
rm -f LOCAL_DEPLOYMENT.md
rm -f ghl-webhook-setup.md
rm -f ghl-webhook-template.json
```

### Duplicate Configurations
```bash
rm -f langgraph.json  # Keep langgraph.config.js
rm -f docker-compose.yml  # Keep Dockerfile only
```

### Optional Removals
```bash
# Could merge these into main docs
rm -f PRODUCTION_SETUP.md
rm -f README_PRODUCTION.md

# PM2 config (only if not using PM2)
rm -f ecosystem.config.js

# Production server (could use env checks in main index.js)
rm -f index.production.js
rm -f services/redisConversationManager.js  # Unless using Redis
```

## Simplified Structure

After cleanup, your project would look like:

```
outlet-media-bot/
├── README.md                    # All documentation
├── CLAUDE.md                    # Technical reference
├── LANGGRAPH_DEPLOYMENT.md      # Deployment guide
├── .env.example
├── .gitignore
├── LICENSE
├── package.json
├── package-lock.json
├── index.js                     # Single server file
├── langgraph.config.js          # LangGraph config
├── agents/
│   ├── salesAgent.js
│   └── tools/
│       └── calendarTool.js
├── services/
│   ├── ghlService.js
│   └── conversationManager.js
├── api/
│   └── langgraph-api.js
├── utils/
│   └── validateEnv.js
└── tests/
    ├── test-local.js
    └── test-ghl-integration.js
```

## Commands to Clean Up

Run these commands to clean up:

```bash
# Remove temporary files
rm -rf temp-repo
rm -f GITHUB_REPLACE_INSTRUCTIONS.md replace-github-repo.sh cleanup.sh start-local.sh

# Remove redundant docs
rm -f DEPLOYMENT.md LOCAL_DEPLOYMENT.md ghl-webhook-setup.md ghl-webhook-template.json

# Remove duplicate configs
rm -f langgraph.json docker-compose.yml

# Optional: Merge documentation
# Combine PRODUCTION_SETUP.md and README_PRODUCTION.md into README.md
# Then remove them

# Optional: Simplify to single index.js
# Add environment checks to index.js
# Then remove index.production.js
```

## Benefits of Cleanup

1. **Simpler Structure**: Easier to navigate
2. **Less Confusion**: No duplicate files
3. **Focused Documentation**: All in README.md
4. **Single Entry Point**: One index.js file
5. **Clear Purpose**: Each file has unique role