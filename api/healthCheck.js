// Health check endpoint for production monitoring
import { config } from '../services/config.js';
import { Logger } from '../services/logger.js';
import { metrics } from '../services/monitoring.js';

const logger = new Logger('HealthCheck');

// Track service start time
const startTime = Date.now();

// Health check status
let healthStatus = {
  status: 'starting',
  timestamp: new Date().toISOString(),
  uptime: 0,
  version: process.env.npm_package_version || '2.0.1',
  environment: config.env,
  services: {
    ghl: 'unknown',
    openai: 'unknown',
    memory: 'ok'
  },
  memory: {},
  errors: []
};

/**
 * Update health status
 */
export function updateHealthStatus(service, status, error = null) {
  if (service && healthStatus.services.hasOwnProperty(service)) {
    healthStatus.services[service] = status;
  }
  
  if (error) {
    healthStatus.errors.push({
      service,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 10 errors
    if (healthStatus.errors.length > 10) {
      healthStatus.errors = healthStatus.errors.slice(-10);
    }
  }
  
  // Update overall status
  const allOk = Object.values(healthStatus.services).every(s => s === 'ok' || s === 'unknown');
  healthStatus.status = allOk ? 'healthy' : 'unhealthy';
}

/**
 * Get current health status
 */
export function getHealthStatus() {
  // Update dynamic values
  healthStatus.timestamp = new Date().toISOString();
  healthStatus.uptime = Math.floor((Date.now() - startTime) / 1000); // seconds
  
  // Get memory usage
  const memUsage = process.memoryUsage();
  healthStatus.memory = {
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
    rss: Math.round(memUsage.rss / 1024 / 1024), // MB
    external: Math.round(memUsage.external / 1024 / 1024), // MB
    heapPercentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
  };
  
  // Check memory health
  if (healthStatus.memory.heapPercentage > 90) {
    healthStatus.services.memory = 'critical';
  } else if (healthStatus.memory.heapPercentage > 80) {
    healthStatus.services.memory = 'warning';
  } else {
    healthStatus.services.memory = 'ok';
  }
  
  // Get metrics summary
  healthStatus.metrics = {
    totalRequests: metrics.get('webhook.requests') || 0,
    successfulRequests: metrics.get('webhook.success') || 0,
    failedRequests: metrics.get('webhook.error') || 0,
    avgResponseTime: metrics.getAverage('webhook.duration') || 0
  };
  
  return healthStatus;
}

/**
 * Health check handler
 */
export async function healthCheckHandler(req, res) {
  try {
    const health = getHealthStatus();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    logger.debug('Health check requested', {
      status: health.status,
      uptime: health.uptime
    });
    
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check error', { error: error.message });
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Liveness probe handler (simple check)
 */
export async function livenessHandler(req, res) {
  res.status(200).json({ 
    status: 'alive',
    timestamp: new Date().toISOString()
  });
}

/**
 * Readiness probe handler (checks dependencies)
 */
export async function readinessHandler(req, res) {
  try {
    // Check if all critical services are ready
    const health = getHealthStatus();
    const isReady = health.services.ghl !== 'error' && 
                   health.services.openai !== 'error' &&
                   health.services.memory !== 'critical';
    
    if (isReady) {
      res.status(200).json({ 
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({ 
        status: 'not ready',
        services: health.services,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Mark as healthy once initialized
setTimeout(() => {
  if (healthStatus.status === 'starting') {
    healthStatus.status = 'healthy';
    logger.info('Health check service initialized');
  }
}, 5000);