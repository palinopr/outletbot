/**
 * Monitoring and metrics collection service
 */
import { Logger } from './logger.js';
import { config } from './config.js';

const logger = new Logger('monitoring');

/**
 * Metrics collector for application monitoring
 */
class MetricsCollector {
  constructor() {
    this.metrics = {
      // API metrics
      apiRequests: new Map(),
      apiErrors: new Map(),
      apiLatency: [],
      
      // Business metrics
      conversationsStarted: 0,
      conversationsCompleted: 0,
      qualifiedLeads: 0,
      appointmentsBooked: 0,
      underBudgetLeads: 0,
      
      // Tool execution metrics
      toolExecutions: new Map(),
      toolErrors: new Map(),
      toolLatency: new Map(),
      
      // GHL API metrics
      ghlApiCalls: new Map(),
      ghlApiErrors: new Map(),
      ghlCircuitBreakerTrips: 0,
      
      // System metrics
      memoryUsage: [],
      cpuUsage: [],
      eventLoopDelay: []
    };
    
    // Start periodic metrics collection
    this.startPeriodicCollection();
  }
  
  /**
   * Record API request
   */
  recordApiRequest(endpoint, method, statusCode, latency) {
    const key = `${method} ${endpoint}`;
    
    // Increment request count
    this.metrics.apiRequests.set(key, (this.metrics.apiRequests.get(key) || 0) + 1);
    
    // Record error if applicable
    if (statusCode >= 400) {
      this.metrics.apiErrors.set(key, (this.metrics.apiErrors.get(key) || 0) + 1);
    }
    
    // Record latency (keep last 1000 entries)
    this.metrics.apiLatency.push({ endpoint, method, statusCode, latency, timestamp: Date.now() });
    if (this.metrics.apiLatency.length > 1000) {
      this.metrics.apiLatency.shift();
    }
    
    logger.debug('API request recorded', { endpoint, method, statusCode, latency });
  }
  
  /**
   * Record tool execution
   */
  recordToolExecution(toolName, success, latency, error = null) {
    // Increment execution count
    this.metrics.toolExecutions.set(toolName, (this.metrics.toolExecutions.get(toolName) || 0) + 1);
    
    // Record error if applicable
    if (!success) {
      this.metrics.toolErrors.set(toolName, (this.metrics.toolErrors.get(toolName) || 0) + 1);
    }
    
    // Record latency
    if (!this.metrics.toolLatency.has(toolName)) {
      this.metrics.toolLatency.set(toolName, []);
    }
    const latencies = this.metrics.toolLatency.get(toolName);
    latencies.push({ latency, success, timestamp: Date.now() });
    if (latencies.length > 100) {
      latencies.shift();
    }
    
    logger.debug('Tool execution recorded', { toolName, success, latency, error });
  }
  
  /**
   * Record business metrics
   */
  recordConversationStarted() {
    this.metrics.conversationsStarted++;
  }
  
  recordConversationCompleted() {
    this.metrics.conversationsCompleted++;
  }
  
  recordQualifiedLead() {
    this.metrics.qualifiedLeads++;
  }
  
  recordAppointmentBooked() {
    this.metrics.appointmentsBooked++;
  }
  
  recordUnderBudgetLead() {
    this.metrics.underBudgetLeads++;
  }
  
  /**
   * Record GHL API metrics
   */
  recordGhlApiCall(endpoint, method, success, latency) {
    const key = `${method} ${endpoint}`;
    
    // Increment call count
    this.metrics.ghlApiCalls.set(key, (this.metrics.ghlApiCalls.get(key) || 0) + 1);
    
    // Record error if applicable
    if (!success) {
      this.metrics.ghlApiErrors.set(key, (this.metrics.ghlApiErrors.get(key) || 0) + 1);
    }
  }
  
  recordGhlCircuitBreakerTrip() {
    this.metrics.ghlCircuitBreakerTrips++;
  }
  
  /**
   * Get current metrics summary
   */
  getMetricsSummary() {
    // Calculate API stats
    const totalApiRequests = Array.from(this.metrics.apiRequests.values()).reduce((a, b) => a + b, 0);
    const totalApiErrors = Array.from(this.metrics.apiErrors.values()).reduce((a, b) => a + b, 0);
    const apiErrorRate = totalApiRequests > 0 ? (totalApiErrors / totalApiRequests) * 100 : 0;
    
    // Calculate average latencies
    const recentApiLatencies = this.metrics.apiLatency.slice(-100);
    const avgApiLatency = recentApiLatencies.length > 0
      ? recentApiLatencies.reduce((sum, item) => sum + item.latency, 0) / recentApiLatencies.length
      : 0;
    
    // Calculate tool stats
    const toolStats = {};
    for (const [tool, count] of this.metrics.toolExecutions) {
      const errors = this.metrics.toolErrors.get(tool) || 0;
      const latencies = this.metrics.toolLatency.get(tool) || [];
      const avgLatency = latencies.length > 0
        ? latencies.reduce((sum, item) => sum + item.latency, 0) / latencies.length
        : 0;
      
      toolStats[tool] = {
        executions: count,
        errors,
        errorRate: count > 0 ? (errors / count) * 100 : 0,
        avgLatency: Math.round(avgLatency)
      };
    }
    
    // Calculate business metrics
    const conversionRate = this.metrics.conversationsStarted > 0
      ? (this.metrics.qualifiedLeads / this.metrics.conversationsStarted) * 100
      : 0;
    
    const bookingRate = this.metrics.qualifiedLeads > 0
      ? (this.metrics.appointmentsBooked / this.metrics.qualifiedLeads) * 100
      : 0;
    
    // Get system metrics
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    return {
      timestamp: new Date().toISOString(),
      uptime: Math.round(uptime),
      api: {
        totalRequests: totalApiRequests,
        totalErrors: totalApiErrors,
        errorRate: apiErrorRate.toFixed(2) + '%',
        avgLatency: Math.round(avgApiLatency) + 'ms',
        endpoints: Object.fromEntries(this.metrics.apiRequests)
      },
      business: {
        conversationsStarted: this.metrics.conversationsStarted,
        conversationsCompleted: this.metrics.conversationsCompleted,
        qualifiedLeads: this.metrics.qualifiedLeads,
        appointmentsBooked: this.metrics.appointmentsBooked,
        underBudgetLeads: this.metrics.underBudgetLeads,
        conversionRate: conversionRate.toFixed(2) + '%',
        bookingRate: bookingRate.toFixed(2) + '%'
      },
      tools: toolStats,
      ghl: {
        totalCalls: Array.from(this.metrics.ghlApiCalls.values()).reduce((a, b) => a + b, 0),
        totalErrors: Array.from(this.metrics.ghlApiErrors.values()).reduce((a, b) => a + b, 0),
        circuitBreakerTrips: this.metrics.ghlCircuitBreakerTrips,
        endpoints: Object.fromEntries(this.metrics.ghlApiCalls)
      },
      system: {
        memory: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB'
        }
      }
    };
  }
  
  /**
   * Start periodic collection of system metrics
   */
  startPeriodicCollection() {
    // Collect memory usage every minute
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.metrics.memoryUsage.push({
        timestamp: Date.now(),
        rss: memUsage.rss,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external
      });
      
      // Keep only last hour of data
      const oneHourAgo = Date.now() - 3600000;
      this.metrics.memoryUsage = this.metrics.memoryUsage.filter(m => m.timestamp > oneHourAgo);
    }, 60000);
    
    // Log metrics summary every 5 minutes
    if (config.env === 'production') {
      setInterval(() => {
        const summary = this.getMetricsSummary();
        logger.info('Metrics summary', summary);
      }, 300000);
    }
  }
  
  /**
   * Reset all metrics
   */
  reset() {
    this.metrics.apiRequests.clear();
    this.metrics.apiErrors.clear();
    this.metrics.apiLatency = [];
    this.metrics.conversationsStarted = 0;
    this.metrics.conversationsCompleted = 0;
    this.metrics.qualifiedLeads = 0;
    this.metrics.appointmentsBooked = 0;
    this.metrics.underBudgetLeads = 0;
    this.metrics.toolExecutions.clear();
    this.metrics.toolErrors.clear();
    this.metrics.toolLatency.clear();
    this.metrics.ghlApiCalls.clear();
    this.metrics.ghlApiErrors.clear();
    this.metrics.ghlCircuitBreakerTrips = 0;
    
    logger.info('Metrics reset');
  }
}

// Singleton instance
export const metrics = new MetricsCollector();

/**
 * Express middleware for API metrics
 */
export function metricsMiddleware() {
  return (req, res, next) => {
    const startTime = Date.now();
    
    // Override res.end to capture metrics
    const originalEnd = res.end;
    res.end = function(...args) {
      const latency = Date.now() - startTime;
      metrics.recordApiRequest(req.path, req.method, res.statusCode, latency);
      originalEnd.apply(res, args);
    };
    
    next();
  };
}

/**
 * Metrics endpoint handler
 */
export function metricsHandler(req, res) {
  const summary = metrics.getMetricsSummary();
  res.json(summary);
}

// Export for use in other modules
export default metrics;