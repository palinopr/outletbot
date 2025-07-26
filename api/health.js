/**
 * Health check endpoint with comprehensive dependency checks
 */
import { ChatOpenAI } from "@langchain/openai";
import { GHLService } from "../services/ghlService.js";
import { Logger } from "../services/logger.js";
import { config } from "../services/config.js";
import { MemorySaver } from "@langchain/langgraph";

const logger = new Logger('health-check');

// Cache health check results to avoid hammering dependencies
let lastHealthCheck = null;
const HEALTH_CHECK_CACHE_TTL = 30000; // 30 seconds

/**
 * Check OpenAI API health
 */
async function checkOpenAI() {
  try {
    const startTime = Date.now();
    const llm = new ChatOpenAI({ 
      model: "gpt-4",
      timeout: 5000,
      maxRetries: 1
    });
    
    // Simple test prompt
    await llm.invoke("Say 'OK'");
    
    return {
      status: 'healthy',
      latency: Date.now() - startTime,
      message: 'OpenAI API is accessible'
    };
  } catch (error) {
    logger.error('OpenAI health check failed', { error: error.message });
    return {
      status: 'unhealthy',
      error: error.message,
      message: 'OpenAI API is not accessible'
    };
  }
}

/**
 * Check GoHighLevel API health
 */
async function checkGHL() {
  try {
    const startTime = Date.now();
    const ghlService = new GHLService(
      process.env.GHL_API_KEY,
      process.env.GHL_LOCATION_ID
    );
    
    // Try to fetch a contact (should return 404 if not found, which is fine)
    try {
      await ghlService.getContact('health-check-test');
    } catch (error) {
      // 404 is expected and healthy
      if (error.response?.status === 404) {
        return {
          status: 'healthy',
          latency: Date.now() - startTime,
          message: 'GHL API is accessible'
        };
      }
      throw error;
    }
    
    return {
      status: 'healthy',
      latency: Date.now() - startTime,
      message: 'GHL API is accessible'
    };
  } catch (error) {
    logger.error('GHL health check failed', { error: error.message });
    return {
      status: 'unhealthy',
      error: error.message,
      message: 'GHL API is not accessible',
      circuitBreaker: error.message.includes('Circuit breaker') ? 'open' : 'closed'
    };
  }
}

/**
 * Check LangGraph checkpointer health
 */
async function checkCheckpointer() {
  try {
    const startTime = Date.now();
    const checkpointer = new MemorySaver();
    
    // Test write
    const testConfig = {
      configurable: {
        thread_id: "health-check",
        checkpoint_ns: ""
      }
    };
    
    const testCheckpoint = {
      v: 1,
      ts: new Date().toISOString(),
      id: "health-check-test",
      channel_values: { test: "ok" },
      channel_versions: { test: 1 },
      versions_seen: {},
      pending_sends: []
    };
    
    await checkpointer.put(testConfig, testCheckpoint, {}, {});
    
    // Test read
    const retrieved = await checkpointer.get({ configurable: { thread_id: "health-check" } });
    
    if (!retrieved) {
      throw new Error('Failed to retrieve test checkpoint');
    }
    
    return {
      status: 'healthy',
      latency: Date.now() - startTime,
      message: 'Checkpointer is functional'
    };
  } catch (error) {
    logger.error('Checkpointer health check failed', { error: error.message });
    return {
      status: 'unhealthy',
      error: error.message,
      message: 'Checkpointer is not functional'
    };
  }
}

/**
 * Check environment configuration
 */
function checkEnvironment() {
  const required = [
    'OPENAI_API_KEY',
    'GHL_API_KEY',
    'GHL_LOCATION_ID',
    'GHL_CALENDAR_ID'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    return {
      status: 'unhealthy',
      missing,
      message: 'Missing required environment variables'
    };
  }
  
  return {
    status: 'healthy',
    message: 'All required environment variables are set'
  };
}

/**
 * Get system metrics
 */
function getSystemMetrics() {
  const used = process.memoryUsage();
  const uptime = process.uptime();
  
  return {
    memory: {
      rss: Math.round(used.rss / 1024 / 1024) + ' MB',
      heapTotal: Math.round(used.heapTotal / 1024 / 1024) + ' MB',
      heapUsed: Math.round(used.heapUsed / 1024 / 1024) + ' MB',
      external: Math.round(used.external / 1024 / 1024) + ' MB'
    },
    uptime: {
      seconds: Math.round(uptime),
      formatted: formatUptime(uptime)
    },
    nodeVersion: process.version,
    platform: process.platform,
    pid: process.pid
  };
}

/**
 * Format uptime in human-readable format
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
}

/**
 * Main health check handler
 */
export default async function healthHandler(req, res) {
  // Basic health check (always returns 200)
  if (req.url === '/health' || req.url === '/healthz') {
    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  }
  
  // Detailed health check with dependency checks
  if (req.url === '/health/detailed' || req.url === '/health/full') {
    // Check cache
    if (lastHealthCheck && Date.now() - lastHealthCheck.timestamp < HEALTH_CHECK_CACHE_TTL) {
      return res.status(lastHealthCheck.httpStatus).json(lastHealthCheck.data);
    }
    
    const startTime = Date.now();
    
    // Run all checks in parallel
    const [openai, ghl, checkpointer, environment] = await Promise.all([
      checkOpenAI(),
      checkGHL(),
      checkCheckpointer(),
      Promise.resolve(checkEnvironment())
    ]);
    
    const system = getSystemMetrics();
    
    // Determine overall health
    const dependencies = { openai, ghl, checkpointer, environment };
    const allHealthy = Object.values(dependencies).every(dep => dep.status === 'healthy');
    const status = allHealthy ? 'healthy' : 'degraded';
    const httpStatus = allHealthy ? 200 : 503;
    
    const response = {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: config.env,
      latency: Date.now() - startTime,
      dependencies,
      system,
      features: config.features
    };
    
    // Cache the result
    lastHealthCheck = {
      timestamp: Date.now(),
      httpStatus,
      data: response
    };
    
    logger.info('Health check completed', {
      status,
      latency: response.latency,
      dependencies: Object.entries(dependencies).reduce((acc, [key, val]) => {
        acc[key] = val.status;
        return acc;
      }, {})
    });
    
    return res.status(httpStatus).json(response);
  }
  
  // Liveness probe (for k8s)
  if (req.url === '/health/live') {
    return res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString()
    });
  }
  
  // Readiness probe (for k8s)
  if (req.url === '/health/ready') {
    const env = checkEnvironment();
    const isReady = env.status === 'healthy';
    
    return res.status(isReady ? 200 : 503).json({
      status: isReady ? 'ready' : 'not ready',
      timestamp: new Date().toISOString(),
      environment: env
    });
  }
  
  // Unknown health endpoint
  return res.status(404).json({
    error: 'Unknown health check endpoint',
    available: [
      '/health',
      '/health/detailed',
      '/health/live',
      '/health/ready'
    ]
  });
}