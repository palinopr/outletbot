#!/bin/bash

# Run LangGraph Cloud Environment Locally
# This creates the EXACT environment used in LangGraph Cloud deployments

echo "🚀 Starting LangGraph Cloud Environment Locally..."
echo "================================================"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create a .env file with your API keys"
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed!"
    echo "Please install Docker Desktop from https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Build and run
echo "📦 Building LangGraph environment..."
docker-compose -f docker-compose.langgraph.yml build

echo "🏃 Starting services..."
docker-compose -f docker-compose.langgraph.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 5

# Check health
echo "🏥 Checking service health..."
curl -s http://localhost:8123/health | jq . || echo "Service starting..."

echo ""
echo "✅ LangGraph environment is running!"
echo "================================================"
echo "📍 Webhook URL: http://localhost:8123/webhook/meta-lead"
echo "📍 Health Check: http://localhost:8123/health"
echo ""
echo "🧪 Test with:"
echo "curl -X POST http://localhost:8123/webhook/meta-lead \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"phone\":\"+1234567890\",\"message\":\"Hola\",\"contactId\":\"test-123\",\"conversationId\":\"conv-123\"}'"
echo ""
echo "📋 View logs:"
echo "docker-compose -f docker-compose.langgraph.yml logs -f langgraph"
echo ""
echo "🛑 Stop with:"
echo "docker-compose -f docker-compose.langgraph.yml down"