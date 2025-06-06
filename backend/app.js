const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// Import middleware
const { initializeFirebase } = require('./middleware/auth');
const { rateLimitErrorHandler } = require('./middleware/rateLimiter');

// Import services
const { testConnection, initDatabase } = require('./utils/database');
const templateEngine = require('./services/templateEngine');

// Import routes
const authRoutes = require('./routes/auth');
const portfolioRoutes = require('./routes/portfolios');
const aiRoutes = require('./routes/ai');
const integrationRoutes = require('./routes/integrations');
const previewRoutes = require('./routes/preview');

class App {
  constructor() {
    this.app = express();
    this.PORT = process.env.PORT || 3000;
    this.NODE_ENV = process.env.NODE_ENV || 'development';
    
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  initializeMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:", "http:"],
          connectSrc: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false
    }));

    // CORS configuration
    const corsOptions = {
      origin: process.env.NODE_ENV === 'production' 
        ? process.env.FRONTEND_URL?.split(',') || ['https://your-frontend.com']
        : ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    };
    this.app.use(cors(corsOptions));

    // Logging
    if (this.NODE_ENV === 'development') {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined'));
    }

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Static files - FIXED: Ensure directories exist and use absolute paths
    const staticPath = path.join(__dirname, 'public');
    const uploadsPath = path.join(__dirname, 'uploads');
    
    this.app.use('/static', express.static(staticPath));
    this.app.use('/uploads', express.static(uploadsPath));

    // Request timestamp middleware
    this.app.use((req, res, next) => {
      req.timestamp = new Date().toISOString();
      next();
    });

    // Custom headers
    this.app.use((req, res, next) => {
      res.setHeader('X-API-Version', '1.0.0');
      res.setHeader('X-Powered-By', 'Portfolio Builder API');
      next();
    });
  }

  initializeRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'OK',
        timestamp: req.timestamp,
        uptime: Math.floor(process.uptime()),
        environment: this.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0',
        memory: process.memoryUsage(),
        node_version: process.version
      });
    });

    // API info endpoint
    this.app.get('/api', (req, res) => {
      res.json({
        name: 'Portfolio Builder API',
        version: '1.0.0',
        description: 'AI-powered portfolio generation API',
        documentation: '/api/docs',
        endpoints: {
          auth: '/api/auth',
          portfolios: '/api/portfolios',
          ai: '/api/ai',
          integrations: '/api/integrations',
          preview: '/api/preview'
        },
        timestamp: req.timestamp,
        server_time: new Date().toISOString()
      });
    });

    // FIXED: API routes - Mount routes properly for Express 5.x
    try {
      this.app.use('/api/auth', authRoutes);
      this.app.use('/api/portfolios', portfolioRoutes);
      this.app.use('/api/ai', aiRoutes);
      this.app.use('/api/integrations', integrationRoutes);
      this.app.use('/api/preview', previewRoutes);
    } catch (error) {
      console.error('Error mounting routes:', error);
      throw error;
    }

    // FIXED: Simple redirect for public portfolios - Express 5.x compatible
    this.app.get('/p/:slug', (req, res) => {
      try {
        const { slug } = req.params;
        if (slug && slug.length > 0 && /^[a-zA-Z0-9_-]+$/.test(slug)) {
          res.redirect(301, `/api/preview/public/${encodeURIComponent(slug)}`);
        } else {
          res.status(400).send('Invalid portfolio slug');
        }
      } catch (error) {
        console.error('Portfolio redirect error:', error);
        res.status(500).send('Server error');
      }
    });

    // API documentation endpoint
    this.app.get('/api/docs', (req, res) => {
      res.json({
        title: 'Portfolio Builder API Documentation',
        version: '1.0.0',
        description: 'Complete API documentation for the Portfolio Builder platform',
        baseUrl: `${req.protocol}://${req.get('host')}/api`,
        authentication: 'Bearer token (Firebase ID token) required for most endpoints',
        rateLimit: 'API requests are rate limited per user/IP',
        
        endpoints: {
          authentication: {
            'POST /auth/verify-token': {
              description: 'Verify Firebase token and authenticate user',
              body: { token: 'Firebase ID token' },
              response: { user: 'object', is_new_user: 'boolean' }
            },
            'GET /auth/profile': {
              description: 'Get current user profile with stats',
              auth: 'required',
              response: { user: 'object', stats: 'object' }
            },
            'PUT /auth/profile': {
              description: 'Update user profile',
              auth: 'required',
              body: { username: 'string', full_name: 'string', avatar_url: 'string' }
            },
            'POST /auth/check-username': {
              description: 'Check username availability',
              body: { username: 'string' },
              response: { available: 'boolean' }
            }
          },
          
          portfolios: {
            'GET /portfolios': {
              description: 'List user portfolios with pagination',
              auth: 'required',
              query: { page: 'number', limit: 'number', status: 'string', search: 'string' },
              response: { portfolios: 'array', pagination: 'object' }
            },
            'POST /portfolios': {
              description: 'Create new portfolio',
              auth: 'required',
              body: { title: 'string', template_id: 'string', content: 'object' },
              response: { portfolio: 'object' }
            },
            'GET /portfolios/:id': {
              description: 'Get portfolio details with iterations',
              auth: 'required (owner only)',
              response: { portfolio: 'object', recent_iterations: 'array' }
            },
            'PUT /portfolios/:id': {
              description: 'Update portfolio',
              auth: 'required (owner only)',
              body: { title: 'string', content: 'object', status: 'string' }
            },
            'DELETE /portfolios/:id': {
              description: 'Delete portfolio',
              auth: 'required (owner only)'
            },
            'POST /portfolios/:id/publish': {
              description: 'Publish portfolio to make it public',
              auth: 'required (owner only)'
            },
            'POST /portfolios/:id/duplicate': {
              description: 'Create a copy of existing portfolio',
              auth: 'required (owner only)',
              body: { title: 'string (optional)' }
            }
          },
          
          ai: {
            'POST /ai/generate': {
              description: 'Generate new portfolio using AI from multiple sources',
              auth: 'required',
              body: {
                sources: [
                  { type: 'github', data: { username: 'string', access_token: 'string' } },
                  { type: 'resume', data: { text: 'string' } },
                  { type: 'prompt', data: { description: 'string' } }
                ],
                template_id: 'string (optional)',
                preferences: 'object (optional)'
              },
              response: { portfolio: 'object', metadata: 'object' }
            },
            'POST /ai/iterate/:id': {
              description: 'Enhance existing portfolio with AI based on prompt',
              auth: 'required (owner only)',
              body: { prompt: 'string', section: 'string (optional)', iteration_type: 'string' },
              response: { changes: 'object', metadata: 'object' }
            },
            'POST /ai/parse-resume': {
              description: 'Upload and parse resume with AI',
              auth: 'required',
              body: 'multipart/form-data with resume file',
              response: { data: 'object', tokens_used: 'number' }
            },
            'POST /ai/generate-bio': {
              description: 'Generate professional bio using AI',
              auth: 'required',
              body: { user_data: 'object', style: 'string' },
              response: { bio: 'string', tokens_used: 'number' }
            }
          },
          
          integrations: {
            'GET /integrations': {
              description: 'List user integrations',
              auth: 'required',
              response: { integrations: 'array' }
            },
            'POST /integrations/github': {
              description: 'Connect GitHub integration',
              auth: 'required',
              body: { username: 'string', access_token: 'string (optional)' },
              response: { integration: 'object' }
            },
            'POST /integrations/:platform/sync': {
              description: 'Sync integration data from platform',
              auth: 'required',
              response: { last_synced_at: 'datetime', data_summary: 'object' }
            },
            'DELETE /integrations/:platform': {
              description: 'Disconnect integration',
              auth: 'required'
            }
          },
          
          preview: {
            'GET /preview/:id': {
              description: 'Get portfolio preview HTML',
              auth: 'required (owner only)',
              response: 'HTML content'
            },
            'POST /preview/generate': {
              description: 'Generate temporary preview from content',
              auth: 'required',
              body: { content: 'object', template_id: 'string' },
              response: { html: 'string', css: 'string', js: 'string' }
            },
            'GET /preview/public/:slug': {
              description: 'View public portfolio (no auth required)',
              response: 'HTML content'
            }
          }
        },
        
        error_codes: {
          400: 'Bad Request - Invalid input data',
          401: 'Unauthorized - Authentication required',
          403: 'Forbidden - Insufficient permissions',
          404: 'Not Found - Resource not found',
          409: 'Conflict - Resource already exists',
          429: 'Too Many Requests - Rate limit exceeded',
          500: 'Internal Server Error - Server error'
        },
        
        rate_limits: {
          free_tier: {
            general_api: '100 requests per 15 minutes',
            ai_generation: '10 requests per hour',
            file_upload: '5 uploads per hour',
            portfolio_creation: '3 portfolios per day'
          },
          pro_tier: {
            general_api: '100 requests per 15 minutes',
            ai_generation: '50 requests per hour',
            file_upload: '20 uploads per hour',
            portfolio_creation: '20 portfolios per day'
          }
        }
      });
    });

    // 404 handler for API routes
    this.app.use('/api/*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'API endpoint not found',
        timestamp: req.timestamp,
        requested_path: req.path,
        method: req.method
      });
    });

    // Root route
    this.app.get('/', (req, res) => {
      res.type('html').send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Portfolio Builder API</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              max-width: 800px; margin: 50px auto; padding: 20px; 
              background: #f5f5f5; color: #333; line-height: 1.6;
            }
            .header { text-align: center; color: #333; margin-bottom: 2rem; }
            .header h1 { color: #c770f0; margin-bottom: 0.5rem; }
            .links { margin: 30px 0; text-align: center; }
            .links a { 
              display: inline-block; margin: 10px; padding: 12px 24px; 
              background: #c770f0; color: white; text-decoration: none; 
              border-radius: 8px; transition: all 0.3s ease;
              box-shadow: 0 2px 4px rgba(199, 112, 240, 0.3);
            }
            .links a:hover { 
              background: #b660e0; transform: translateY(-2px);
              box-shadow: 0 4px 8px rgba(199, 112, 240, 0.4);
            }
            .info { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .endpoints { margin-top: 1.5rem; }
            .endpoint { margin: 0.5rem 0; font-family: 'Monaco', 'Consolas', monospace; }
            .status { text-align: center; margin-top: 2rem; padding: 1rem; background: #e8f5e8; border-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🚀 Portfolio Builder API</h1>
            <p>AI-powered portfolio generation platform</p>
          </div>
          
          <div class="links">
            <a href="/api">API Info</a>
            <a href="/api/docs">Documentation</a>
            <a href="/health">Health Check</a>
          </div>
          
          <div class="info">
            <h3>📡 Available Endpoints:</h3>
            <div class="endpoints">
              <div class="endpoint"><strong>Authentication:</strong> /api/auth/*</div>
              <div class="endpoint"><strong>Portfolios:</strong> /api/portfolios/*</div>
              <div class="endpoint"><strong>AI Generation:</strong> /api/ai/*</div>
              <div class="endpoint"><strong>Integrations:</strong> /api/integrations/*</div>
              <div class="endpoint"><strong>Preview:</strong> /api/preview/*</div>
            </div>
            
            <div class="status">
              <strong>✅ Server Status:</strong> Running on port ${this.PORT}<br>
              <strong>🌍 Environment:</strong> ${this.NODE_ENV}<br>
              <strong>⏰ Server Time:</strong> ${new Date().toISOString()}
            </div>
          </div>
        </body>
        </html>
      `);
    });

    // Catch-all for non-API routes
    this.app.get('*', (req, res) => {
      res.status(404).type('html').send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Page Not Found - Portfolio Builder API</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .error { color: #666; }
            .back-link { margin-top: 2rem; }
            .back-link a { color: #c770f0; text-decoration: none; }
          </style>
        </head>
        <body>
          <h1>404 - Page Not Found</h1>
          <p class="error">The requested page does not exist.</p>
          <div class="back-link">
            <a href="/">← Back to API Home</a>
          </div>
        </body>
        </html>
      `);
    });
  }

  initializeErrorHandling() {
    // Rate limit error handler
    this.app.use(rateLimitErrorHandler);

    // General error handler
    this.app.use((error, req, res, next) => {
      console.error('Application error:', error);

      // Multer errors (file upload)
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'File Too Large',
          message: 'File size exceeds the limit'
        });
      }

      if (error.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          error: 'Upload Error',
          message: 'Unexpected file field'
        });
      }

      // Validation errors
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: error.message,
          details: error.errors
        });
      }

      // Database errors
      if (error.name && error.name.startsWith('Sequelize')) {
        console.error('Database error:', error);
        return res.status(500).json({
          success: false,
          error: 'Database Error',
          message: this.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
      }

      // Default error response
      const statusCode = error.statusCode || error.status || 500;
      const message = this.NODE_ENV === 'development' 
        ? error.message 
        : statusCode === 500 ? 'Internal Server Error' : error.message;

      res.status(statusCode).json({
        success: false,
        error: error.name || 'Error',
        message: message,
        timestamp: req.timestamp,
        ...(this.NODE_ENV === 'development' && { 
          stack: error.stack,
          details: error 
        })
      });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      process.exit(1);
    });
  }

  async initialize() {
    try {
      console.log('🚀 Initializing Portfolio Builder API...');

      // Test database connection
      await testConnection();

      // Initialize database tables
      await initDatabase();

      // Initialize Firebase
      initializeFirebase();
      console.log('✅ Firebase initialized');

      // Initialize template engine
      await templateEngine.initializeTemplates();

      // Create required directories
      const fs = require('fs');
      const dirs = ['uploads', 'database', 'public'];
      
      dirs.forEach(dir => {
        const dirPath = path.join(__dirname, dir);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
          console.log(`✅ ${dir} directory created`);
        }
      });

      console.log('✅ Application initialized successfully');
    } catch (error) {
      console.error('❌ Application initialization failed:', error);
      process.exit(1);
    }
  }

  async start() {
    try {
      await this.initialize();
      
      this.server = this.app.listen(this.PORT, () => {
        console.log('');
        console.log('🎉 Portfolio Builder API Server Started!');
        console.log('');
        console.log(`🌍 Environment: ${this.NODE_ENV}`);
        console.log(`🚀 Server running on port: ${this.PORT}`);
        console.log(`📡 API Base URL: http://localhost:${this.PORT}/api`);
        console.log(`📖 Documentation: http://localhost:${this.PORT}/api/docs`);
        console.log(`💓 Health Check: http://localhost:${this.PORT}/health`);
        console.log(`🏠 Home Page: http://localhost:${this.PORT}`);
        console.log('');
        console.log('Ready to generate amazing portfolios! 🎨');
        console.log('');
      });

      // Graceful shutdown
      const gracefulShutdown = async (signal) => {
        console.log(`\n📡 Received ${signal}. Starting graceful shutdown...`);
        
        this.server.close(async () => {
          console.log('🔒 HTTP server closed');
          
          try {
            const { closeConnection } = require('./utils/database');
            await closeConnection();
            console.log('✅ Graceful shutdown completed');
            process.exit(0);
          } catch (error) {
            console.error('❌ Error during shutdown:', error);
            process.exit(1);
          }
        });
      };

      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  getApp() {
    return this.app;
  }
}

module.exports = App;