#!/bin/bash

# LangGraph CLI Deployment Script
# This script handles deployment to LangGraph Platform

set -e  # Exit on error

echo "🚀 LangGraph CLI Deployment Script"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if required environment variables are set
check_env() {
    local var_name=$1
    if [ -z "${!var_name}" ]; then
        echo -e "${RED}❌ Error: $var_name is not set${NC}"
        echo "Please set it in your environment or .env file"
        exit 1
    fi
}

# Load environment variables from .env if it exists
if [ -f .env ]; then
    echo "📋 Loading environment variables from .env"
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check required environment variables
echo -e "\n📋 Checking environment variables..."
check_env "LANGSMITH_API_KEY"
check_env "OPENAI_API_KEY"
check_env "GHL_API_KEY"
check_env "GHL_LOCATION_ID"
check_env "GHL_CALENDAR_ID"

# Set LANGCHAIN_API_KEY from LANGSMITH_API_KEY if not set
export LANGCHAIN_API_KEY=${LANGCHAIN_API_KEY:-$LANGSMITH_API_KEY}

echo -e "${GREEN}✅ All required environment variables are set${NC}"

# Check if langgraph CLI is installed
if ! command -v langgraph &> /dev/null; then
    echo -e "\n${YELLOW}⚠️  LangGraph CLI not found. Installing...${NC}"
    npm install -g @langchain/langgraph-cli
fi

# Parse command line arguments
COMMAND=${1:-deploy}
PROJECT_NAME=${2:-outlet-media-bot}
ENVIRONMENT=${3:-production}

case $COMMAND in
    "build")
        echo -e "\n🔨 Building LangGraph image..."
        langgraph build \
            --config ./langgraph.json \
            -t ${PROJECT_NAME}:latest
        echo -e "${GREEN}✅ Build complete${NC}"
        ;;
        
    "test")
        echo -e "\n🧪 Running local test server..."
        langgraph dev \
            --config ./langgraph.json \
            --port 2024
        ;;
        
    "deploy")
        echo -e "\n🚀 Deploying to LangGraph Platform..."
        echo "Project: $PROJECT_NAME"
        echo "Environment: $ENVIRONMENT"
        
        # First, build the image
        echo -e "\n🔨 Building deployment image..."
        langgraph build \
            --config ./langgraph.json \
            -t ${PROJECT_NAME}:${ENVIRONMENT}
        
        # Deploy to LangGraph Platform
        echo -e "\n☁️  Deploying to cloud..."
        langgraph deploy \
            --config ./langgraph.json \
            --name ${PROJECT_NAME} \
            --env ${ENVIRONMENT}
        
        echo -e "${GREEN}✅ Deployment complete!${NC}"
        
        # Get deployment info
        echo -e "\n📊 Getting deployment info..."
        langgraph deployments list --name ${PROJECT_NAME}
        ;;
        
    "status")
        echo -e "\n📊 Checking deployment status..."
        langgraph deployments list --name ${PROJECT_NAME}
        ;;
        
    "logs")
        echo -e "\n📜 Fetching deployment logs..."
        langgraph deployments logs --name ${PROJECT_NAME} --follow
        ;;
        
    "rollback")
        echo -e "\n⏪ Rolling back deployment..."
        DEPLOYMENT_ID=${2:-}
        if [ -z "$DEPLOYMENT_ID" ]; then
            echo -e "${RED}❌ Error: Please provide deployment ID${NC}"
            echo "Usage: ./deploy.sh rollback <deployment-id>"
            exit 1
        fi
        langgraph deployments rollback --id ${DEPLOYMENT_ID}
        ;;
        
    *)
        echo "Usage: ./deploy.sh [command] [project-name] [environment]"
        echo ""
        echo "Commands:"
        echo "  build    - Build the LangGraph image locally"
        echo "  test     - Run local development server"
        echo "  deploy   - Deploy to LangGraph Platform (default)"
        echo "  status   - Check deployment status"
        echo "  logs     - View deployment logs"
        echo "  rollback - Rollback to previous deployment"
        echo ""
        echo "Examples:"
        echo "  ./deploy.sh build"
        echo "  ./deploy.sh test"
        echo "  ./deploy.sh deploy outlet-media-bot production"
        echo "  ./deploy.sh status"
        echo "  ./deploy.sh logs"
        echo "  ./deploy.sh rollback <deployment-id>"
        exit 1
        ;;
esac

echo -e "\n✨ Done!"