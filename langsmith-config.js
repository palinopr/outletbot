// LangSmith configuration for deployment and tracing
const { Client } = require("langsmith");

// Initialize LangSmith client
const initLangSmith = () => {
  // Set up tracing
  process.env.LANGCHAIN_TRACING_V2 = "true";
  process.env.LANGCHAIN_PROJECT = process.env.LANGSMITH_PROJECT || "outlet-media-bot";
  
  // LangSmith API key should be set in environment
  if (!process.env.LANGSMITH_API_KEY) {
    console.warn("Warning: LANGSMITH_API_KEY not set. Tracing will be disabled.");
  }
  
  return new Client({
    apiKey: process.env.LANGSMITH_API_KEY,
    apiUrl: process.env.LANGSMITH_API_URL || "https://api.smith.langchain.com"
  });
};

// Helper to wrap agent calls with tracing
const traceAgent = async (agentName, func, metadata = {}) => {
  const runName = `${agentName}-${Date.now()}`;
  
  try {
    console.log(`Starting trace: ${runName}`);
    const result = await func();
    console.log(`Completed trace: ${runName}`);
    return result;
  } catch (error) {
    console.error(`Error in trace ${runName}:`, error);
    throw error;
  }
};

module.exports = {
  initLangSmith,
  traceAgent
};