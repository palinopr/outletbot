/**
 * Graph exports for LangGraph Cloud
 * This file provides simplified exports that LangGraph CLI can parse
 */

// Import the compiled graphs
import { graph as salesAgentGraph } from '../agents/salesAgent.js';
import { graph as webhookHandlerGraph } from '../agents/webhookHandler.js';

// Export with simple names
export const sales_agent = salesAgentGraph;
export const webhook_handler = webhookHandlerGraph;

// Default export for testing
export default {
  sales_agent: salesAgentGraph,
  webhook_handler: webhookHandlerGraph
};