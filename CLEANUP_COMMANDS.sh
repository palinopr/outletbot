#!/bin/bash

# Manual Cleanup Commands for outlet-media-bot
# Run these commands from the project root: /Users/jaimeortiz/outlet-media-bot

echo "Starting cleanup of outlet-media-bot..."

# 1. Remove temporary directory
echo "Removing temporary files..."
rm -rf temp-repo

# 2. Remove GitHub helper files
rm -f GITHUB_REPLACE_INSTRUCTIONS.md
rm -f replace-github-repo.sh

# 3. Remove shell scripts
rm -f cleanup.sh
rm -f start-local.sh

# 4. Remove redundant documentation
echo "Removing redundant documentation..."
rm -f DEPLOYMENT.md
rm -f LOCAL_DEPLOYMENT.md  
rm -f ghl-webhook-setup.md
rm -f ghl-webhook-template.json
rm -f PRODUCTION_SETUP.md

# 5. Remove duplicate configurations
echo "Removing duplicate configurations..."
rm -f langgraph.json
rm -f docker-compose.yml

# 6. Remove cleanup helper files
rm -f PROJECT_CLEANUP.md
rm -f FILES_TO_DELETE.txt
rm -f CLEANUP_COMMANDS.sh

# 7. Optional: Remove if not needed
# rm -f ecosystem.config.js  # Remove if not using PM2
# rm -f index.production.js  # Remove if using single index.js
# rm -f services/redisConversationManager.js  # Remove if not using Redis
# rm -f README_PRODUCTION.md  # Remove if content merged to README

echo "Cleanup complete!"
echo ""
echo "Remaining structure:"
ls -la | grep -v node_modules | grep -v "^\."