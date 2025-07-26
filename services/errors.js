/**
 * Structured error types for better error handling and monitoring
 */

export class AppError extends Error {
  constructor(message, code, statusCode, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }
  
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

// Validation Errors (400)
export class ValidationError extends AppError {
  constructor(message, details = {}) {
    super(message, 'VALIDATION_ERROR', 400);
    this.details = details;
  }
}

export class MissingFieldError extends ValidationError {
  constructor(fields) {
    super(`Missing required fields: ${fields.join(', ')}`, { missingFields: fields });
    this.code = 'MISSING_FIELDS';
  }
}

// Authentication/Authorization Errors (401/403)
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 'AUTHENTICATION_ERROR', 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 'AUTHORIZATION_ERROR', 403);
  }
}

// Resource Errors (404)
export class NotFoundError extends AppError {
  constructor(resource, id) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', 404);
    this.resource = resource;
    this.resourceId = id;
  }
}

// Conflict Errors (409)
export class ConflictError extends AppError {
  constructor(message, details = {}) {
    super(message, 'CONFLICT', 409);
    this.details = details;
  }
}

export class DuplicateError extends ConflictError {
  constructor(resource, field, value) {
    super(`${resource} already exists with ${field}: ${value}`, {
      resource,
      field,
      value
    });
    this.code = 'DUPLICATE_RESOURCE';
  }
}

// Rate Limit Errors (429)
export class RateLimitError extends AppError {
  constructor(limit, window, retryAfter) {
    super(`Rate limit exceeded: ${limit} requests per ${window}`, 'RATE_LIMIT_EXCEEDED', 429);
    this.limit = limit;
    this.window = window;
    this.retryAfter = retryAfter;
  }
}

// External Service Errors (502/503)
export class ExternalServiceError extends AppError {
  constructor(service, originalError) {
    super(`External service error: ${service}`, 'EXTERNAL_SERVICE_ERROR', 502);
    this.service = service;
    this.originalError = originalError;
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service, retryAfter = null) {
    super(`Service temporarily unavailable: ${service}`, 'SERVICE_UNAVAILABLE', 503);
    this.service = service;
    this.retryAfter = retryAfter;
  }
}

// Timeout Errors (504)
export class TimeoutError extends AppError {
  constructor(operation, timeout) {
    super(`Operation timed out: ${operation} (${timeout}ms)`, 'TIMEOUT', 504);
    this.operation = operation;
    this.timeout = timeout;
  }
}

// Business Logic Errors
export class BusinessLogicError extends AppError {
  constructor(message, code, details = {}) {
    super(message, code, 422);
    this.details = details;
  }
}

export class BudgetNotQualifiedError extends BusinessLogicError {
  constructor(budget, minBudget) {
    super(
      `Budget $${budget}/month does not meet minimum requirement of $${minBudget}/month`,
      'BUDGET_NOT_QUALIFIED',
      { budget, minBudget }
    );
  }
}

export class ConversationStateError extends BusinessLogicError {
  constructor(message, currentStep, expectedStep) {
    super(message, 'INVALID_CONVERSATION_STATE', {
      currentStep,
      expectedStep
    });
  }
}

// Circuit Breaker Error
export class CircuitBreakerOpenError extends ServiceUnavailableError {
  constructor(service) {
    super(service, 60); // Retry after 60 seconds
    this.code = 'CIRCUIT_BREAKER_OPEN';
  }
}

// Error handler utility
export function isOperationalError(error) {
  return error instanceof AppError && error.isOperational;
}

export function getHttpStatusCode(error) {
  if (error instanceof AppError) {
    return error.statusCode;
  }
  
  // Map common errors
  if (error.name === 'ValidationError') return 400;
  if (error.name === 'CastError') return 400;
  if (error.name === 'JsonWebTokenError') return 401;
  if (error.name === 'TokenExpiredError') return 401;
  if (error.name === 'MongoError' && error.code === 11000) return 409;
  
  return 500;
}

export function formatErrorResponse(error) {
  const response = {
    error: true,
    message: error.message || 'An unexpected error occurred',
    code: error.code || 'INTERNAL_ERROR',
    timestamp: new Date().toISOString()
  };
  
  if (error instanceof AppError) {
    response.statusCode = error.statusCode;
    
    if (error.details) {
      response.details = error.details;
    }
    
    if (error.retryAfter) {
      response.retryAfter = error.retryAfter;
    }
  }
  
  // Include stack trace in development
  if (process.env.NODE_ENV === 'development' && error.stack) {
    response.stack = error.stack;
  }
  
  return response;
}