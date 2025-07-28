#!/bin/bash

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Set test flag to skip validation
export SKIP_ENV_VALIDATION=true

# Run the comprehensive test
node test-comprehensive-system.js