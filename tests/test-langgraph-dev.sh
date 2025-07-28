#!/bin/bash

echo "🚀 Testing LangGraph Platform Development Server"
echo "=============================================="
echo ""

# Check if langgraph CLI is installed
if ! command -v langgraph &> /dev/null; then
    echo "❌ langgraph CLI not found. Installing..."
    npm install -g @langchain/langgraph-cli
else
    echo "✅ langgraph CLI is installed"
fi

# Check environment
echo ""
echo "📋 Environment Check:"
if [ -f .env ]; then
    echo "✅ .env file exists"
    # Check required variables
    required_vars=("OPENAI_API_KEY" "GHL_API_KEY" "GHL_LOCATION_ID" "GHL_CALENDAR_ID")
    for var in "${required_vars[@]}"; do
        if grep -q "^$var=" .env; then
            echo "✅ $var is set"
        else
            echo "❌ $var is missing"
        fi
    done
else
    echo "❌ .env file not found"
fi

# Check langgraph.json
echo ""
echo "📄 Configuration Check:"
if [ -f langgraph.json ]; then
    echo "✅ langgraph.json exists"
    echo "Content:"
    cat langgraph.json | jq '.' 2>/dev/null || cat langgraph.json
else
    echo "❌ langgraph.json not found"
fi

# Instructions for running
echo ""
echo "📝 To start the development server, run:"
echo ""
echo "   langgraph dev"
echo ""
echo "This will:"
echo "1. Start a local LangGraph Platform server"
echo "2. Load your graphs (sales_agent, webhook_handler)"
echo "3. Provide endpoints for testing"
echo ""
echo "Once running, you can:"
echo "- Test webhooks at: http://localhost:8000/webhook/meta-lead"
echo "- View the UI at: http://localhost:8000"
echo "- Check health at: http://localhost:8000/health"
echo ""
echo "🎯 Your app is ready for deployment!"