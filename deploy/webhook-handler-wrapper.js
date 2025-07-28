/**
 * Deployment wrapper for webhook handler
 * This provides a simplified export that LangGraph Cloud can handle
 */

// Dynamically import the actual handler at runtime
let webhookHandlerGraph;

async function loadGraph() {
  if (!webhookHandlerGraph) {
    const module = await import('../agents/webhookHandler.js');
    webhookHandlerGraph = module.graph || module.webhookHandler;
  }
  return webhookHandlerGraph;
}

// Export a simple async function that returns the graph
export default async function getWebhookHandler() {
  return await loadGraph();
}

// Also export as named for compatibility
export { getWebhookHandler as graph };