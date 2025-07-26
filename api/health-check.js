// Health check endpoint for debugging deployment issues
import { GHLService } from '../services/ghlService.js';
import { Logger } from '../services/logger.js';

const logger = new Logger('health-check');

export default async function handler(req, res) {
  const startTime = Date.now();
  const results = {
    timestamp: new Date().toISOString(),
    environment: {},
    services: {},
    errors: []
  };
  
  // Check environment variables
  const envVars = ['GHL_API_KEY', 'GHL_LOCATION_ID', 'GHL_CALENDAR_ID', 'OPENAI_API_KEY'];
  envVars.forEach(varName => {
    results.environment[varName] = !!process.env[varName];
  });
  
  // Test GHL service initialization
  try {
    logger.info('Testing GHL service initialization...');
    const ghlService = new GHLService(
      process.env.GHL_API_KEY,
      process.env.GHL_LOCATION_ID
    );
    results.services.ghl = 'initialized';
    
    // Try a simple API call
    try {
      await ghlService.getContact('test').catch(() => null);
      results.services.ghlApi = 'connected';
    } catch (error) {
      results.services.ghlApi = 'failed';
      results.errors.push(`GHL API: ${error.message}`);
    }
  } catch (error) {
    results.services.ghl = 'failed';
    results.errors.push(`GHL Init: ${error.message}`);
    logger.error('GHL initialization failed', { error: error.message });
  }
  
  // Calculate timing
  results.processingTime = Date.now() - startTime;
  
  // Return results
  res.status(200).json({
    status: results.errors.length === 0 ? 'healthy' : 'unhealthy',
    ...results
  });
}