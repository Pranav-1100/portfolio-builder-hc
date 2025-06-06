const Handlebars = require('handlebars');

// Register all custom helpers
function registerHelpers() {
  // Date formatting helper
  Handlebars.registerHelper('formatDate', function(date, format) {
    if (!date) return '';
    
    const d = new Date(date);
    if (format === 'year') {
      return d.getFullYear();
    } else if (format === 'month-year') {
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    
    return d.toLocaleDateString();
  });

  // Conditional helper
  Handlebars.registerHelper('if_eq', function(a, b, options) {
    if (a === b) {
      return options.fn(this);
    }
    return options.inverse(this);
  });

  // Array length helper
  Handlebars.registerHelper('length', function(array) {
    return array ? array.length : 0;
  });

  // Limit array helper
  Handlebars.registerHelper('limit', function(array, limit) {
    if (!array || !Array.isArray(array)) return [];
    return array.slice(0, limit);
  });

  // Join array helper
  Handlebars.registerHelper('join', function(array, separator) {
    if (!array || !Array.isArray(array)) return '';
    return array.join(separator || ', ');
  });

  // Truncate text helper
  Handlebars.registerHelper('truncate', function(text, length) {
    if (!text || text.length <= length) return text;
    return text.substring(0, length) + '...';
  });

  // Math helper
  Handlebars.registerHelper('add', function(a, b) {
    return a + b;
  });

  // URL helper
  Handlebars.registerHelper('ensureHttp', function(url) {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return 'https://' + url;
  });

  // Range helper for loops
  Handlebars.registerHelper('range', function(count) {
    const result = [];
    for (let i = 0; i < count; i++) {
      result.push(i);
    }
    return result;
  });

  // Random number helper
  Handlebars.registerHelper('random', function(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  });

  // Each with index helper
  Handlebars.registerHelper('eachWithIndex', function(array, options) {
    let result = '';
    for (let i = 0; i < array.length; i++) {
      result += options.fn({
        ...array[i],
        index: i,
        first: i === 0,
        last: i === array.length - 1
      });
    }
    return result;
  });

  console.log('✅ Handlebars helpers registered');
}

module.exports = { registerHelpers };
