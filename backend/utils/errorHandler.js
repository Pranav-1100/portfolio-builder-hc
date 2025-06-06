/**
 * Custom error classes for better error handling
 */

class BaseError extends Error {
    constructor(message, statusCode = 500, isOperational = true) {
      super(message);
      this.name = this.constructor.name;
      this.statusCode = statusCode;
      this.isOperational = isOperational;
      this.timestamp = new Date().toISOString();
      
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  class ValidationError extends BaseError {
    constructor(message, field = null) {
      super(message, 400);
      this.field = field;
      this.type = 'validation_error';
    }
  }
  
  class AuthenticationError extends BaseError {
    constructor(message = 'Authentication failed') {
      super(message, 401);
      this.type = 'authentication_error';
    }
  }
  
  class AuthorizationError extends BaseError {
    constructor(message = 'Access forbidden') {
      super(message, 403);
      this.type = 'authorization_error';
    }
  }
  
  class NotFoundError extends BaseError {
    constructor(resource = 'Resource') {
      super(`${resource} not found`, 404);
      this.type = 'not_found_error';
      this.resource = resource;
    }
  }
  
  class ConflictError extends BaseError {
    constructor(message) {
      super(message, 409);
      this.type = 'conflict_error';
    }
  }
  
  class RateLimitError extends BaseError {
    constructor(message = 'Rate limit exceeded') {
      super(message, 429);
      this.type = 'rate_limit_error';
    }
  }
  
  class ExternalServiceError extends BaseError {
    constructor(service, message = 'External service error') {
      super(`${service}: ${message}`, 502);
      this.type = 'external_service_error';
      this.service = service;
    }
  }
  
  class DatabaseError extends BaseError {
    constructor(message = 'Database operation failed') {
      super(message, 500);
      this.type = 'database_error';
    }
  }
  
  class AIServiceError extends BaseError {
    constructor(message = 'AI service error', tokensUsed = 0) {
      super(message, 500);
      this.type = 'ai_service_error';
      this.tokensUsed = tokensUsed;
    }
  }
  
  class FileUploadError extends BaseError {
    constructor(message = 'File upload failed') {
      super(message, 400);
      this.type = 'file_upload_error';
    }
  }
  
  class TemplateError extends BaseError {
    constructor(templateId, message = 'Template processing failed') {
      super(message, 500);
      this.type = 'template_error';
      this.templateId = templateId;
    }
  }
  
  class IntegrationError extends BaseError {
    constructor(platform, message = 'Integration error') {
      super(`${platform}: ${message}`, 500);
      this.type = 'integration_error';
      this.platform = platform;
    }
  }
  
  /**
   * Error handler middleware
   */
  function errorHandler(error, req, res, next) {
    let { statusCode = 500, message } = error;
    
    // Log error details
    const errorLog = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        statusCode: error.statusCode,
        type: error.type
      }
    };
    
    // Log based on severity
    if (statusCode >= 500) {
      console.error('Server Error:', errorLog);
    } else if (statusCode >= 400) {
      console.warn('Client Error:', errorLog);
    }
    
    // Don't expose internal errors in production
    if (process.env.NODE_ENV === 'production' && statusCode >= 500) {
      message = 'Internal Server Error';
    }
    
    // Prepare error response
    const errorResponse = {
      success: false,
      error: error.name || 'Error',
      message: message,
      statusCode: statusCode,
      timestamp: errorLog.timestamp
    };
    
    // Add additional error details in development
    if (process.env.NODE_ENV === 'development') {
      errorResponse.stack = error.stack;
      errorResponse.type = error.type;
      
      if (error.field) errorResponse.field = error.field;
      if (error.resource) errorResponse.resource = error.resource;
      if (error.service) errorResponse.service = error.service;
      if (error.platform) errorResponse.platform = error.platform;
      if (error.templateId) errorResponse.templateId = error.templateId;
      if (error.tokensUsed) errorResponse.tokensUsed = error.tokensUsed;
    }
    
    res.status(statusCode).json(errorResponse);
  }
  
  /**
   * Async error catcher wrapper
   */
  function asyncCatch(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
  
  /**
   * Handle specific error types
   */
  function handleSequelizeError(error) {
    if (error.name === 'SequelizeValidationError') {
      const message = error.errors.map(err => err.message).join(', ');
      return new ValidationError(message);
    }
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      const field = error.errors[0]?.path || 'field';
      return new ConflictError(`${field} already exists`);
    }
    
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return new ValidationError('Invalid reference to related resource');
    }
    
    if (error.name === 'SequelizeConnectionError') {
      return new DatabaseError('Database connection failed');
    }
    
    return new DatabaseError(error.message);
  }
  
  function handleMulterError(error) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return new FileUploadError('File size too large');
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return new FileUploadError('Too many files');
    }
    
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return new FileUploadError('Unexpected file field');
    }
    
    return new FileUploadError(error.message);
  }
  
  function handleFirebaseError(error) {
    if (error.code === 'auth/id-token-expired') {
      return new AuthenticationError('Token expired');
    }
    
    if (error.code === 'auth/id-token-revoked') {
      return new AuthenticationError('Token revoked');
    }
    
    if (error.code === 'auth/invalid-id-token') {
      return new AuthenticationError('Invalid token');
    }
    
    return new AuthenticationError('Authentication failed');
  }
  
  function handleOpenAIError(error) {
    if (error.code === 'insufficient_quota') {
      return new AIServiceError('AI service quota exceeded');
    }
    
    if (error.code === 'rate_limit_exceeded') {
      return new RateLimitError('AI service rate limit exceeded');
    }
    
    if (error.code === 'invalid_api_key') {
      return new AIServiceError('AI service configuration error');
    }
    
    return new AIServiceError(error.message || 'AI service error');
  }
  
  function handleGitHubError(error) {
    if (error.response?.status === 404) {
      return new NotFoundError('GitHub resource');
    }
    
    if (error.response?.status === 403) {
      return new RateLimitError('GitHub API rate limit exceeded');
    }
    
    if (error.response?.status === 401) {
      return new IntegrationError('GitHub', 'Invalid credentials');
    }
    
    return new IntegrationError('GitHub', error.message || 'GitHub API error');
  }
  
  /**
   * Global error transformer
   */
  function transformError(error) {
    // Handle known error types
    if (error.name?.startsWith('Sequelize')) {
      return handleSequelizeError(error);
    }
    
    if (error.name === 'MulterError') {
      return handleMulterError(error);
    }
    
    if (error.code?.startsWith('auth/')) {
      return handleFirebaseError(error);
    }
    
    if (error.type === 'openai_error' || error.error?.type) {
      return handleOpenAIError(error);
    }
    
    if (error.config?.baseURL?.includes('github.com')) {
      return handleGitHubError(error);
    }
    
    // Return as-is if already a BaseError
    if (error instanceof BaseError) {
      return error;
    }
    
    // Default transformation
    return new BaseError(error.message || 'Internal Server Error', 500);
  }
  
  /**
   * Error logger
   */
  function logError(error, context = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: error.statusCode >= 500 ? 'error' : 'warn',
      message: error.message,
      error: {
        name: error.name,
        stack: error.stack,
        statusCode: error.statusCode,
        type: error.type,
        isOperational: error.isOperational
      },
      context
    };
    
    if (error.statusCode >= 500) {
      console.error('Application Error:', JSON.stringify(logEntry, null, 2));
    } else {
      console.warn('Client Error:', JSON.stringify(logEntry, null, 2));
    }
  }
  
  /**
   * Validation helpers
   */
  function validateRequired(value, fieldName) {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      throw new ValidationError(`${fieldName} is required`, fieldName);
    }
  }
  
  function validateEmail(email, fieldName = 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError(`Invalid ${fieldName} format`, fieldName);
    }
  }
  
  function validateURL(url, fieldName = 'url') {
    try {
      new URL(url);
    } catch {
      throw new ValidationError(`Invalid ${fieldName} format`, fieldName);
    }
  }
  
  function validateLength(value, min, max, fieldName) {
    if (value.length < min || value.length > max) {
      throw new ValidationError(`${fieldName} must be between ${min} and ${max} characters`, fieldName);
    }
  }
  
  module.exports = {
    // Error classes
    BaseError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    ExternalServiceError,
    DatabaseError,
    AIServiceError,
    FileUploadError,
    TemplateError,
    IntegrationError,
    
    // Error handling functions
    errorHandler,
    asyncCatch,
    transformError,
    logError,
    
    // Validation helpers
    validateRequired,
    validateEmail,
    validateURL,
    validateLength
  };