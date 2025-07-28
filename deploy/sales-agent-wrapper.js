/**
 * Deployment wrapper for sales agent
 * This provides a simplified export that LangGraph Cloud can handle
 */

// Dynamically import the actual agent at runtime
let salesAgentGraph;

async function loadGraph() {
  if (!salesAgentGraph) {
    const module = await import('../agents/salesAgent.js');
    salesAgentGraph = module.graph || module.salesAgent;
  }
  return salesAgentGraph;
}

// Export a simple async function that returns the graph
export default async function getSalesAgent() {
  return await loadGraph();
}

// Also export as named for compatibility
export { getSalesAgent as graph };