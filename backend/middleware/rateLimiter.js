const rateLimit = require('express-rate-limit');

// General API rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too Many Requests',
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks and static files
    return req.path === '/health' || req.path.startsWith('/static');
  }
});

// Strict rate limiting for AI endpoints
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: (req) => {
    // Different limits based on subscription tier
    if (req.user?.subscription_tier === 'pro') {
      return 50; // Pro users get 50 AI requests per hour
    }
    return 10; // Free users get 10 AI requests per hour
  },
  message: {
    error: 'AI Rate Limit Exceeded',
    message: 'You have exceeded your AI request limit. Please upgrade your plan or wait before making more requests.',
    retryAfter: '1 hour'
  },
  keyGenerator: (req) => {
    // Rate limit by user ID if authenticated, otherwise by IP
    return req.user?.id || req.ip;
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip if no user (will be handled by auth middleware)
    return !req.user;
  }
});

// Auth endpoint rate limiting (login attempts)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth requests per windowMs
  message: {
    error: 'Too Many Auth Attempts',
    message: 'Too many authentication attempts from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// File upload rate limiting
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: (req) => {
    if (req.user?.subscription_tier === 'pro') {
      return 20; // Pro users get 20 uploads per hour
    }
    return 5; // Free users get 5 uploads per hour
  },
  message: {
    error: 'Upload Rate Limit Exceeded',
    message: 'You have exceeded your file upload limit. Please upgrade your plan or wait before uploading more files.',
    retryAfter: '1 hour'
  },
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Portfolio creation rate limiting
const portfolioCreationLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: (req) => {
    if (req.user?.subscription_tier === 'pro') {
      return 20; // Pro users can create 20 portfolios per day
    }
    return 3; // Free users can create 3 portfolios per day
  },
  message: {
    error: 'Portfolio Creation Limit Exceeded',
    message: 'You have reached your daily portfolio creation limit. Please upgrade your plan or wait 24 hours.',
    retryAfter: '24 hours'
  },
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return !req.user || req.method !== 'POST';
  }
});

// Integration sync rate limiting
const integrationSyncLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 sync requests per hour per user
  message: {
    error: 'Integration Sync Limit Exceeded',
    message: 'You have exceeded your integration sync limit. Please wait before syncing again.',
    retryAfter: '1 hour'
  },
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Custom rate limiter factory for specific endpoints
const createCustomLimiter = (options) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000,
    max: options.max || 50,
    message: {
      error: options.errorType || 'Rate Limit Exceeded',
      message: options.message || 'Too many requests, please try again later.',
      retryAfter: options.retryAfter || '15 minutes'
    },
    keyGenerator: options.keyGenerator || ((req) => req.user?.id || req.ip),
    standardHeaders: true,
    legacyHeaders: false,
    skip: options.skip || (() => false)
  });
};

// Rate limit error handler
const rateLimitErrorHandler = (err, req, res, next) => {
  if (err.type === 'rate-limit') {
    return res.status(429).json({
      error: 'Rate Limit Exceeded',
      message: 'Too many requests, please try again later.',
      retryAfter: err.retryAfter
    });
  }
  next(err);
};

module.exports = {
  apiLimiter,
  aiLimiter,
  authLimiter,
  uploadLimiter,
  portfolioCreationLimiter,
  integrationSyncLimiter,
  createCustomLimiter,
  rateLimitErrorHandler
};