const { body, param, query, validationResult } = require('express-validator');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid input data',
      details: errors.array()
    });
  }
  
  next();
};

// Portfolio validation rules
const validatePortfolioCreation = [
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 1, max: 255 })
    .withMessage('Title must be between 1 and 255 characters'),
  
  body('template_id')
    .optional()
    .isString()
    .withMessage('Template ID must be a string'),
  
  body('content')
    .optional()
    .isObject()
    .withMessage('Content must be an object'),
  
  handleValidationErrors
];

const validatePortfolioUpdate = [
  body('title')
    .optional()
    .isLength({ min: 1, max: 255 })
    .withMessage('Title must be between 1 and 255 characters'),
  
  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Status must be draft, published, or archived'),
  
  body('content')
    .optional()
    .isObject()
    .withMessage('Content must be an object'),
  
  body('template_id')
    .optional()
    .isString()
    .withMessage('Template ID must be a string'),
  
  handleValidationErrors
];

// AI generation validation
const validateAIGeneration = [
  body('sources')
    .isArray({ min: 1 })
    .withMessage('At least one source is required'),
  
  body('sources.*.type')
    .isIn(['github', 'resume', 'prompt', 'linkedin', 'leetcode'])
    .withMessage('Invalid source type'),
  
  body('sources.*.data')
    .isObject()
    .withMessage('Source data must be an object'),
  
  body('template_id')
    .optional()
    .isString()
    .withMessage('Template ID must be a string'),
  
  body('preferences')
    .optional()
    .isObject()
    .withMessage('Preferences must be an object'),
  
  handleValidationErrors
];

const validateAIIteration = [
  body('prompt')
    .notEmpty()
    .withMessage('Prompt is required')
    .isLength({ min: 10, max: 2000 })
    .withMessage('Prompt must be between 10 and 2000 characters'),
  
  body('section')
    .optional()
    .isString()
    .withMessage('Section must be a string'),
  
  body('iteration_type')
    .optional()
    .isIn(['generate', 'enhance', 'fix', 'custom'])
    .withMessage('Invalid iteration type'),
  
  handleValidationErrors
];

// Integration validation
const validateGitHubIntegration = [
  body('username')
    .notEmpty()
    .withMessage('GitHub username is required')
    .matches(/^[a-zA-Z0-9]([a-zA-Z0-9-]){0,38}$/)
    .withMessage('Invalid GitHub username format'),
  
  body('access_token')
    .optional()
    .isString()
    .withMessage('Access token must be a string'),
  
  handleValidationErrors
];

// User profile validation
const validateProfileUpdate = [
  body('username')
    .optional()
    .matches(/^[a-zA-Z0-9_-]{3,30}$/)
    .withMessage('Username must be 3-30 characters and contain only letters, numbers, underscores, and hyphens'),
  
  body('full_name')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Full name must be less than 100 characters'),
  
  body('avatar_url')
    .optional()
    .isURL()
    .withMessage('Avatar URL must be a valid URL'),
  
  handleValidationErrors
];

// Common parameter validations
const validateUUID = (paramName) => [
  param(paramName)
    .isUUID()
    .withMessage(`${paramName} must be a valid UUID`),
  
  handleValidationErrors
];

const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('sort')
    .optional()
    .isIn(['created_at', 'updated_at', 'title', 'view_count'])
    .withMessage('Invalid sort field'),
  
  query('order')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('Order must be ASC or DESC'),
  
  handleValidationErrors
];

// File upload validation
const validateFileUpload = (fieldName, allowedTypes = [], maxSize = 5 * 1024 * 1024) => {
  return (req, res, next) => {
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `${fieldName} file is required`
      });
    }
    
    // Check file type
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
      });
    }
    
    // Check file size
    if (file.size > maxSize) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `File size too large. Maximum size: ${maxSize / 1024 / 1024}MB`
      });
    }
    
    next();
  };
};

// Resume file validation
const validateResumeUpload = validateFileUpload(
  'resume',
  ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  10 * 1024 * 1024 // 10MB
);

module.exports = {
  handleValidationErrors,
  validatePortfolioCreation,
  validatePortfolioUpdate,
  validateAIGeneration,
  validateAIIteration,
  validateGitHubIntegration,
  validateProfileUpdate,
  validateUUID,
  validatePagination,
  validateFileUpload,
  validateResumeUpload
};