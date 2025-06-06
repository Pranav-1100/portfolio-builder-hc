const Handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');

class TemplateEngineService {
  constructor() {
    this.templatesPath = path.join(__dirname, '../templates');
    this.compiledTemplates = new Map();
    this.templateConfigs = new Map();
    
    // Register custom Handlebars helpers
    this._registerHelpers();
  }

  // Initialize templates (load and compile all templates)
  async initializeTemplates() {
    try {
      console.log('Initializing templates...');
      
      // Load available templates
      const templateDirs = await fs.readdir(this.templatesPath);
      
      for (const templateDir of templateDirs) {
        const templatePath = path.join(this.templatesPath, templateDir);
        const stat = await fs.stat(templatePath);
        
        if (stat.isDirectory()) {
          await this._loadTemplate(templateDir);
        }
      }
      
      console.log(`✅ Loaded ${this.compiledTemplates.size} templates`);
    } catch (error) {
      console.error('❌ Failed to initialize templates:', error);
    }
  }

  // Generate HTML from portfolio content
  async generateHTML(portfolioContent, templateId = 'modern-dev') {
    try {
      console.log(`Generating HTML with template: ${templateId}`);
      
      // Get compiled template
      const template = this.compiledTemplates.get(templateId);
      if (!template) {
        throw new Error(`Template '${templateId}' not found`);
      }

      // Get template config
      const config = this.templateConfigs.get(templateId);
      
      // Prepare template data
      const templateData = this._prepareTemplateData(portfolioContent, config);
      
      // Generate HTML
      const html = template(templateData);
      
      // Get CSS and JS
      const css = await this._getTemplateCSS(templateId);
      const js = await this._getTemplateJS(templateId);
      
      // Combine into complete HTML document
      const completeHTML = this._createCompleteHTML(html, css, js, templateData);
      
      return {
        success: true,
        html: completeHTML,
        css: css,
        js: js,
        template: templateId
      };
    } catch (error) {
      console.error('HTML generation error:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate HTML'
      };
    }
  }

  // Get available templates
  async getAvailableTemplates() {
    try {
      const templates = [];
      
      for (const [id, config] of this.templateConfigs) {
        templates.push({
          id: id,
          name: config.name || id,
          description: config.description || '',
          preview_image: config.preview_image || null,
          features: config.features || [],
          is_premium: config.is_premium || false
        });
      }
      
      return {
        success: true,
        templates
      };
    } catch (error) {
      console.error('Error getting templates:', error);
      return {
        success: false,
        error: 'Failed to get templates'
      };
    }
  }

  // Get template configuration
  getTemplateConfig(templateId) {
    return this.templateConfigs.get(templateId) || null;
  }

  // Update template with custom styling
  async customizeTemplate(templateId, customizations) {
    try {
      const config = this.templateConfigs.get(templateId);
      if (!config) {
        throw new Error(`Template '${templateId}' not found`);
      }

      // Apply customizations
      const customizedConfig = {
        ...config,
        customizations: {
          ...config.customizations,
          ...customizations
        }
      };

      // Generate custom CSS
      const customCSS = this._generateCustomCSS(customizedConfig);
      
      return {
        success: true,
        css: customCSS,
        config: customizedConfig
      };
    } catch (error) {
      console.error('Template customization error:', error);
      return {
        success: false,
        error: error.message || 'Failed to customize template'
      };
    }
  }

  // Private methods

  async _loadTemplate(templateDir) {
    try {
      const templatePath = path.join(this.templatesPath, templateDir);
      
      // Load template files
      const templateFile = path.join(templatePath, 'template.hbs');
      const configFile = path.join(templatePath, 'config.json');
      
      // Check if required files exist
      const templateExists = await this._fileExists(templateFile);
      if (!templateExists) {
        console.warn(`Template file not found for ${templateDir}`);
        return;
      }

      // Load template content
      const templateContent = await fs.readFile(templateFile, 'utf8');
      
      // Compile template
      const compiledTemplate = Handlebars.compile(templateContent);
      this.compiledTemplates.set(templateDir, compiledTemplate);
      
      // Load config if exists
      let config = { name: templateDir };
      if (await this._fileExists(configFile)) {
        const configContent = await fs.readFile(configFile, 'utf8');
        config = { ...config, ...JSON.parse(configContent) };
      }
      
      this.templateConfigs.set(templateDir, config);
      
      console.log(`✅ Loaded template: ${templateDir}`);
    } catch (error) {
      console.error(`❌ Failed to load template ${templateDir}:`, error);
    }
  }

  async _getTemplateCSS(templateId) {
    try {
      const cssFile = path.join(this.templatesPath, templateId, 'style.css');
      
      if (await this._fileExists(cssFile)) {
        return await fs.readFile(cssFile, 'utf8');
      }
      
      return ''; // Return empty CSS if file doesn't exist
    } catch (error) {
      console.error(`Error loading CSS for template ${templateId}:`, error);
      return '';
    }
  }

  async _getTemplateJS(templateId) {
    try {
      const jsFile = path.join(this.templatesPath, templateId, 'script.js');
      
      if (await this._fileExists(jsFile)) {
        return await fs.readFile(jsFile, 'utf8');
      }
      
      return ''; // Return empty JS if file doesn't exist
    } catch (error) {
      console.error(`Error loading JS for template ${templateId}:`, error);
      return '';
    }
  }

  _prepareTemplateData(portfolioContent, config) {
    // Ensure all required sections exist
    const defaultContent = {
      hero: {
        name: '',
        title: '',
        bio: '',
        image: '',
        social_links: {}
      },
      about: {
        description: '',
        skills: [],
        interests: []
      },
      projects: [],
      experience: [],
      education: [],
      contact: {
        email: '',
        phone: '',
        location: '',
        social_links: {}
      }
    };

    const data = {
      ...defaultContent,
      ...portfolioContent,
      // Template specific data
      template_config: config || {},
      // Helper data
      current_year: new Date().getFullYear(),
      has_projects: portfolioContent.projects && portfolioContent.projects.length > 0,
      has_experience: portfolioContent.experience && portfolioContent.experience.length > 0,
      has_education: portfolioContent.education && portfolioContent.education.length > 0
    };

    return data;
  }

  _createCompleteHTML(bodyHTML, css, js, templateData) {
    const title = templateData.hero?.name 
      ? `${templateData.hero.name} - Portfolio`
      : 'Portfolio';
    
    const description = templateData.hero?.bio || 'Professional Portfolio';
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="description" content="${description}">
    <meta name="author" content="${templateData.hero?.name || ''}">
    
    <!-- Open Graph -->
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:type" content="website">
    
    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    
    <style>
        ${css}
    </style>
</head>
<body>
    ${bodyHTML}
    
    <script>
        ${js}
    </script>
</body>
</html>`;
  }

  _generateCustomCSS(config) {
    const customizations = config.customizations || {};
    let customCSS = '';

    // Color customizations
    if (customizations.colors) {
      customCSS += ':root {\n';
      Object.entries(customizations.colors).forEach(([key, value]) => {
        customCSS += `  --${key}: ${value};\n`;
      });
      customCSS += '}\n\n';
    }

    // Font customizations
    if (customizations.fonts) {
      if (customizations.fonts.primary) {
        customCSS += `body { font-family: '${customizations.fonts.primary}', sans-serif; }\n`;
      }
      if (customizations.fonts.heading) {
        customCSS += `h1, h2, h3, h4, h5, h6 { font-family: '${customizations.fonts.heading}', sans-serif; }\n`;
      }
    }

    // Additional custom CSS
    if (customizations.custom_css) {
      customCSS += customizations.custom_css;
    }

    return customCSS;
  }

  async _fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  _registerHelpers() {
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
  }
}

module.exports = new TemplateEngineService();