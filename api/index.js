import { handleWebhook, healthCheck } from './langgraphApi.js';

// LangGraph Platform API routes
export default async function handler(req) {
  const { method, url, headers } = req;
  const pathname = new URL(url, `http://${req.headers.host}`).pathname;
  
  console.log(`${method} ${pathname}`);
  
  // Check for X-API-Key header for webhook authentication
  if (pathname === '/webhook' && method === 'POST') {
    // Accept requests with X-API-Key header (from GHL)
    const apiKey = headers['x-api-key'] || headers['X-API-Key'];
    if (apiKey) {
      console.log('Webhook request authenticated with X-API-Key');
      return handleWebhook(req);
    }
    
    // If no API key, check if it's a LangGraph internal request
    if (!apiKey && !headers.authorization) {
      return {
        statusCode: 403,
        body: { error: 'Missing authentication headers' }
      };
    }
    
    return handleWebhook(req);
  }
  
  if (pathname === '/health' && method === 'GET') {
    return healthCheck(req);
  }
  
  // 404 for unknown routes
  return {
    statusCode: 404,
    body: { error: 'Not Found', path: pathname }
  };
}