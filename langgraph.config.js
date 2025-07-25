// LangGraph Platform Configuration
module.exports = {
  // Graph definition
  graphs: {
    sales_agent: {
      path: "./agents/salesAgent.js",
      entrypoint: "createSalesAgent"
    }
  },

  // API Configuration
  api: {
    path: "./api/langgraph-api.js",
    routes: {
      "/webhook/meta-lead": {
        method: "POST",
        handler: "handleWebhook"
      },
      "/health": {
        method: "GET", 
        handler: "healthCheck"
      }
    }
  },

  // Dependencies
  dependencies: {
    "@langchain/core": "^0.3.66",
    "@langchain/langgraph": "^0.3.11",
    "@langchain/openai": "^0.6.3",
    "axios": "^1.11.0",
    "express": "^5.1.0"
  },

  // Environment variables (will be set in LangGraph Platform)
  env: {
    OPENAI_API_KEY: {
      description: "OpenAI API key for GPT-4",
      required: true
    },
    GHL_API_KEY: {
      description: "GoHighLevel API key",
      required: true
    },
    GHL_LOCATION_ID: {
      description: "GoHighLevel location ID",
      required: true
    },
    GHL_CALENDAR_ID: {
      description: "GoHighLevel calendar ID",
      required: true
    },
    LANGSMITH_API_KEY: {
      description: "LangSmith API key for tracing",
      required: true
    },
    LANGSMITH_PROJECT: {
      description: "LangSmith project name",
      default: "outlet-media-bot"
    },
    LANGCHAIN_TRACING_V2: {
      description: "Enable LangChain tracing",
      default: "true"
    }
  },

  // Deployment settings
  deployment: {
    name: "outlet-media-sales-bot",
    description: "Sales qualification bot for Meta ads leads via GHL webhooks",
    runtime: "nodejs18",
    memory: 512,
    timeout: 30,
    instances: {
      min: 1,
      max: 10
    }
  }
};