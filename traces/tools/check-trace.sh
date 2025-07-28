#!/bin/bash

# Set environment variables
export LANGSMITH_API_KEY="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"
export LANGSMITH_PROJECT="outlet-media-bot"
export LANGSMITH_TRACING="true"

# Run trace debugger
node debug-trace-langsmith.js fetch $1