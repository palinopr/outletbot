import { handleWebhook, healthCheck } from './langgraphApi.js';

// LangGraph Platform API routes
export default async function handler(req) {
  const { method, url } = req;
  const pathname = new URL(url, `http://${req.headers.host}`).pathname;
  
  console.log(`${method} ${pathname}`);
  
  // Route handling
  if (pathname === '/webhook' && method === 'POST') {
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