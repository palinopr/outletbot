#!/bin/bash
cd /Users/jaimeortiz/outlet-media-bot

# Remove all empty files first
find . -type f -empty -delete

# Remove specific files
rm -f GITHUB_REPLACE_INSTRUCTIONS.md
rm -f replace-github-repo.sh  
rm -f cleanup.sh
rm -f start-local.sh
rm -f DEPLOYMENT.md
rm -f LOCAL_DEPLOYMENT.md
rm -f ghl-webhook-setup.md
rm -f ghl-webhook-template.json
rm -f PRODUCTION_SETUP.md
rm -f langgraph.json
rm -f docker-compose.yml
rm -f PROJECT_CLEANUP.md
rm -f FILES_TO_DELETE.txt
rm -f CLEANUP_COMMANDS.sh
rm -f final_cleanup.sh

# Remove temp directory
rm -rf temp-repo

echo "Cleanup complete!"