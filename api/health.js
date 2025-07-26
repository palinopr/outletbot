// Simple health check endpoint
export default async function handler(req, res) {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      hasGHL: !!process.env.GHL_API_KEY,
      hasLocation: !!process.env.GHL_LOCATION_ID,
      hasCalendar: !!process.env.GHL_CALENDAR_ID
    },
    deployment: {
      platform: 'langgraph',
      nodeVersion: process.version
    }
  };
  
  // Test imports
  try {
    await import('../agents/webhookHandler.js');
    health.imports = { webhookHandler: 'ok' };
  } catch (error) {
    health.imports = { webhookHandler: error.message };
  }
  
  res.status(200).json(health);
}