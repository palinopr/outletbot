// Production-ready logging service
export class Logger {
  constructor(serviceName) {
    this.serviceName = serviceName;
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  // Format log entry with timestamp and service name
  formatLog(level, message, data) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      service: this.serviceName,
      message,
      ...(data && { data })
    };

    // In production, return JSON for structured logging
    if (this.isProduction) {
      return JSON.stringify(logEntry);
    }

    // In development, return human-readable format
    return `[${timestamp}] [${level}] [${this.serviceName}] ${message} ${data ? JSON.stringify(data, null, 2) : ''}`;
  }

  info(message, data) {
    if (!this.isProduction || process.env.LOG_LEVEL === 'info') {
      console.log(this.formatLog('INFO', message, data));
    }
  }

  warn(message, data) {
    if (!this.isProduction || ['info', 'warn'].includes(process.env.LOG_LEVEL)) {
      console.warn(this.formatLog('WARN', message, data));
    }
  }

  error(message, error) {
    const errorData = {
      message: error?.message,
      stack: error?.stack,
      code: error?.code,
      ...(error?.response?.data && { response: error.response.data })
    };
    
    console.error(this.formatLog('ERROR', message, errorData));
    
    // In production, send to error tracking service
    if (this.isProduction && process.env.SENTRY_DSN) {
      // Sentry or other error tracking integration would go here
    }
  }

  debug(message, data) {
    if (process.env.LOG_LEVEL === 'debug' && !this.isProduction) {
      console.log(this.formatLog('DEBUG', message, data));
    }
  }

  // Log API requests and responses
  logApiCall(method, url, duration, status, error = null) {
    const logData = {
      method,
      url,
      duration: `${duration}ms`,
      status,
      ...(error && { error: error.message })
    };

    if (error) {
      this.error(`API call failed: ${method} ${url}`, error);
    } else {
      this.info(`API call completed: ${method} ${url}`, logData);
    }
  }

  // Log tool execution
  logToolExecution(toolName, duration, success, error = null) {
    const logData = {
      tool: toolName,
      duration: `${duration}ms`,
      success
    };

    if (error) {
      this.error(`Tool execution failed: ${toolName}`, error);
    } else {
      this.info(`Tool executed: ${toolName}`, logData);
    }
  }

  // Create child logger with additional context
  child(context) {
    const childLogger = new Logger(`${this.serviceName}:${context}`);
    return childLogger;
  }
}

// Export singleton instances for common services
export const apiLogger = new Logger('API');
export const agentLogger = new Logger('Agent');
export const ghlLogger = new Logger('GHL');
export const toolLogger = new Logger('Tools');