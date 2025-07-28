#!/bin/bash

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Run the test
node test-whatsapp-complete.js