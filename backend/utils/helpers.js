const crypto = require('crypto');
const path = require('path');

/**
 * Generate a random UUID v4
 * @returns {string} UUID string
 */
function generateUUID() {
  return crypto.randomUUID();
}

/**
 * Hash a string using SHA256
 * @param {string} text - Text to hash
 * @returns {string} Hashed string
 */
function hashString(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Generate a random string of specified length
 * @param {number} length - Length of random string
 * @returns {string} Random string
 */
function generateRandomString(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Slugify a string for URL use
 * @param {string} text - Text to slugify
 * @returns {string} Slugified string
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .substring(0, 50); // Limit length
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} Is valid email
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} Is valid URL
 */
function isValidURL(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize HTML content
 * @param {string} html - HTML to sanitize
 * @returns {string} Sanitized HTML
 */
function sanitizeHTML(html) {
  if (!html || typeof html !== 'string') return '';
  
  // Basic HTML sanitization - remove script tags and dangerous attributes
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/data:/gi, '');
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHTML(text) {
  if (!text || typeof text !== 'string') return '';
  
  const escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  };
  
  return text.replace(/[&<>"'/]/g, char => escapeMap[char]);
}

/**
 * Extract text content from HTML
 * @param {string} html - HTML content
 * @returns {string} Text content
 */
function extractTextFromHTML(html) {
  if (!html || typeof html !== 'string') return '';
  
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} length - Maximum length
 * @param {string} suffix - Suffix to add (default: '...')
 * @returns {string} Truncated text
 */
function truncateText(text, length = 100, suffix = '...') {
  if (!text || typeof text !== 'string') return '';
  
  if (text.length <= length) return text;
  
  return text.substring(0, length - suffix.length).trim() + suffix;
}

/**
 * Format file size in human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get file extension from filename
 * @param {string} filename - Filename
 * @returns {string} File extension
 */
function getFileExtension(filename) {
  if (!filename || typeof filename !== 'string') return '';
  
  return path.extname(filename).toLowerCase().substring(1);
}

/**
 * Check if file type is allowed
 * @param {string} mimetype - File MIME type
 * @param {string[]} allowedTypes - Allowed MIME types
 * @returns {boolean} Is file type allowed
 */
function isAllowedFileType(mimetype, allowedTypes = []) {
  if (!mimetype || !Array.isArray(allowedTypes)) return false;
  
  return allowedTypes.includes(mimetype.toLowerCase());
}

/**
 * Delay execution for specified time
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} Promise that resolves after delay
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} Promise that resolves with function result
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      const delayTime = baseDelay * Math.pow(2, attempt);
      await delay(delayTime);
    }
  }
}

/**
 * Deep clone an object
 * @param {*} obj - Object to clone
 * @returns {*} Cloned object
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  
  if (typeof obj === 'object') {
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  
  return obj;
}

/**
 * Check if object is empty
 * @param {*} obj - Object to check
 * @returns {boolean} Is object empty
 */
function isEmpty(obj) {
  if (obj == null) return true;
  
  if (Array.isArray(obj) || typeof obj === 'string') {
    return obj.length === 0;
  }
  
  if (typeof obj === 'object') {
    return Object.keys(obj).length === 0;
  }
  
  return false;
}

/**
 * Remove undefined values from object
 * @param {Object} obj - Object to clean
 * @returns {Object} Cleaned object
 */
function removeUndefinedValues(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const cleaned = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
        cleaned[key] = removeUndefinedValues(value);
      } else {
        cleaned[key] = value;
      }
    }
  }
  
  return cleaned;
}

/**
 * Parse JSON safely
 * @param {string} jsonString - JSON string to parse
 * @param {*} defaultValue - Default value if parsing fails
 * @returns {*} Parsed object or default value
 */
function safeJSONParse(jsonString, defaultValue = null) {
  try {
    return JSON.parse(jsonString);
  } catch {
    return defaultValue;
  }
}

/**
 * Stringify JSON safely
 * @param {*} obj - Object to stringify
 * @param {string} defaultValue - Default value if stringifying fails
 * @returns {string} JSON string or default value
 */
function safeJSONStringify(obj, defaultValue = '{}') {
  try {
    return JSON.stringify(obj);
  } catch {
    return defaultValue;
  }
}

/**
 * Get nested object property safely
 * @param {Object} obj - Object to traverse
 * @param {string} path - Property path (e.g., 'user.profile.name')
 * @param {*} defaultValue - Default value if property doesn't exist
 * @returns {*} Property value or default value
 */
function getNestedProperty(obj, path, defaultValue = null) {
  if (!obj || typeof obj !== 'object' || !path) return defaultValue;
  
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current == null || typeof current !== 'object' || !(key in current)) {
      return defaultValue;
    }
    current = current[key];
  }
  
  return current;
}

/**
 * Set nested object property safely
 * @param {Object} obj - Object to modify
 * @param {string} path - Property path
 * @param {*} value - Value to set
 * @returns {Object} Modified object
 */
function setNestedProperty(obj, path, value) {
  if (!obj || typeof obj !== 'object' || !path) return obj;
  
  const keys = path.split('.');
  const lastKey = keys.pop();
  let current = obj;
  
  for (const key of keys) {
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[lastKey] = value;
  return obj;
}

/**
 * Generate pagination metadata
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items
 * @returns {Object} Pagination metadata
 */
function generatePaginationMeta(page, limit, total) {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;
  
  return {
    current_page: parseInt(page),
    total_pages: totalPages,
    total_items: total,
    items_per_page: parseInt(limit),
    has_next_page: hasNextPage,
    has_prev_page: hasPrevPage,
    next_page: hasNextPage ? page + 1 : null,
    prev_page: hasPrevPage ? page - 1 : null
  };
}

/**
 * Generate cache key
 * @param {string} prefix - Cache key prefix
 * @param {...any} parts - Cache key parts
 * @returns {string} Cache key
 */
function generateCacheKey(prefix, ...parts) {
  const key = [prefix, ...parts].filter(Boolean).join(':');
  return hashString(key).substring(0, 16);
}

module.exports = {
  generateUUID,
  hashString,
  generateRandomString,
  slugify,
  isValidEmail,
  isValidURL,
  sanitizeHTML,
  escapeHTML,
  extractTextFromHTML,
  truncateText,
  formatFileSize,
  getFileExtension,
  isAllowedFileType,
  delay,
  retryWithBackoff,
  deepClone,
  isEmpty,
  removeUndefinedValues,
  safeJSONParse,
  safeJSONStringify,
  getNestedProperty,
  setNestedProperty,
  generatePaginationMeta,
  generateCacheKey
};