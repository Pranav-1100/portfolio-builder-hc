const express = require('express');
const router = express.Router();
const { Portfolio } = require('../models');
const { verifyFirebaseToken, checkOwnership, optionalAuth } = require('../middleware/auth');
const { validateUUID } = require('../middleware/validation');
const { apiLimiter } = require('../middleware/rateLimiter');

const templateEngine = require('../services/templateEngine');

// Apply rate limiting
router.use(apiLimiter);

/**
 * @route   GET /api/preview/:id
 * @desc    Get portfolio preview HTML
 * @access  Private (owner only)
 */
router.get('/:id',
  verifyFirebaseToken,
  validateUUID('id'),
  checkOwnership(Portfolio, 'id'),
  async (req, res) => {
    try {
      const portfolio = req.resource;

      console.log(`Generating preview for portfolio ${portfolio.id}`);

      // Check if we have cached generated HTML
      if (portfolio.generated_html) {
        return res.type('html').send(portfolio.generated_html);
      }

      // Generate HTML using template engine
      const result = await templateEngine.generateHTML(
        portfolio.content,
        portfolio.template_id
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'Preview Generation Failed',
          message: result.error
        });
      }

      // Cache the generated HTML
      await portfolio.setGeneratedFiles(result.html, result.css, result.js);

      // Return HTML
      res.type('html').send(result.html);
    } catch (error) {
      console.error('Preview generation error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to generate preview'
      });
    }
  }
);

/**
 * @route   POST /api/preview/generate
 * @desc    Generate preview from content (without saving)
 * @access  Private
 */
router.post('/generate', verifyFirebaseToken, async (req, res) => {
  try {
    const { content, template_id = 'modern-dev' } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required'
      });
    }

    console.log(`Generating temporary preview with template: ${template_id}`);

    // Generate HTML using template engine
    const result = await templateEngine.generateHTML(content, template_id);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Preview Generation Failed',
        message: result.error
      });
    }

    res.json({
      success: true,
      html: result.html,
      css: result.css,
      js: result.js,
      template: result.template
    });
  } catch (error) {
    console.error('Temporary preview generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to generate preview'
    });
  }
});

/**
 * @route   POST /api/preview/:id/regenerate
 * @desc    Regenerate portfolio preview (clear cache and rebuild)
 * @access  Private (owner only)
 */
router.post('/:id/regenerate',
  verifyFirebaseToken,
  validateUUID('id'),
  checkOwnership(Portfolio, 'id'),
  async (req, res) => {
    try {
      const portfolio = req.resource;
      const { template_id } = req.body;

      console.log(`Regenerating preview for portfolio ${portfolio.id}`);

      // Use provided template or current template
      const templateToUse = template_id || portfolio.template_id;

      // Generate fresh HTML
      const result = await templateEngine.generateHTML(
        portfolio.content,
        templateToUse
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'Preview Regeneration Failed',
          message: result.error
        });
      }

      // Update template if provided
      const updates = {
        generated_html: result.html,
        generated_css: result.css,
        generated_js: result.js
      };

      if (template_id && template_id !== portfolio.template_id) {
        updates.template_id = template_id;
      }

      await portfolio.update(updates);

      res.json({
        success: true,
        message: 'Preview regenerated successfully',
        template: result.template,
        updated_template: !!template_id
      });
    } catch (error) {
      console.error('Preview regeneration error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to regenerate preview'
      });
    }
  }
);

/**
 * @route   GET /api/preview/:id/iframe
 * @desc    Get portfolio preview in iframe-friendly format
 * @access  Private (owner only)
 */
router.get('/:id/iframe',
  verifyFirebaseToken,
  validateUUID('id'),
  checkOwnership(Portfolio, 'id'),
  async (req, res) => {
    try {
      const portfolio = req.resource;

      // Generate or get cached HTML
      let html = portfolio.generated_html;

      if (!html) {
        const result = await templateEngine.generateHTML(
          portfolio.content,
          portfolio.template_id
        );

        if (!result.success) {
          return res.status(400).json({
            success: false,
            error: 'Preview Generation Failed',
            message: result.error
          });
        }

        html = result.html;
        await portfolio.setGeneratedFiles(result.html, result.css, result.js);
      }

      // Add iframe-specific styles
      const iframeCSS = `
        <style>
          body { margin: 0; padding: 0; }
          .portfolio-container { min-height: 100vh; }
        </style>
      `;

      // Insert iframe styles into head
      const htmlWithIframeStyles = html.replace('</head>', `${iframeCSS}</head>`);

      res.type('html').send(htmlWithIframeStyles);
    } catch (error) {
      console.error('Iframe preview error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to generate iframe preview'
      });
    }
  }
);

/**
 * @route   GET /api/preview/public/:slug
 * @desc    Get public portfolio preview (for published portfolios)
 * @access  Public
 */
router.get('/public/:slug', optionalAuth, async (req, res) => {
  try {
    const { slug } = req.params;

    // Find published portfolio
    const portfolio = await Portfolio.findOne({
      where: {
        slug,
        status: 'published',
        is_public: true
      }
    });

    if (!portfolio) {
      return res.status(404).type('html').send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Portfolio Not Found</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .error { color: #666; }
          </style>
        </head>
        <body>
          <h1>Portfolio Not Found</h1>
          <p class="error">The requested portfolio does not exist or is not publicly available.</p>
        </body>
        </html>
      `);
    }

    // Increment view count (async, don't wait)
    portfolio.incrementView().catch(err => {
      console.error('View count increment error:', err);
    });

    // Get or generate HTML
    let html = portfolio.generated_html;

    if (!html) {
      const result = await templateEngine.generateHTML(
        portfolio.content,
        portfolio.template_id
      );

      if (!result.success) {
        return res.status(500).type('html').send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Portfolio Error</title>
          </head>
          <body>
            <h1>Portfolio Error</h1>
            <p>Failed to generate portfolio preview.</p>
          </body>
          </html>
        `);
      }

      html = result.html;
      // Save generated HTML (async, don't wait)
      portfolio.setGeneratedFiles(result.html, result.css, result.js)
        .catch(err => console.error('Cache save error:', err));
    }

    // Add analytics tracking if needed
    const analyticsScript = `
      <script>
        // Track portfolio view
        if (typeof gtag !== 'undefined') {
          gtag('event', 'portfolio_view', {
            'portfolio_id': '${portfolio.id}',
            'portfolio_slug': '${portfolio.slug}'
          });
        }
      </script>
    `;

    const htmlWithAnalytics = html.replace('</body>', `${analyticsScript}</body>`);

    res.type('html').send(htmlWithAnalytics);
  } catch (error) {
    console.error('Public preview error:', error);
    res.status(500).type('html').send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Server Error</title>
      </head>
      <body>
        <h1>Server Error</h1>
        <p>An error occurred while loading the portfolio.</p>
      </body>
      </html>
    `);
  }
});

/**
 * @route   GET /api/preview/:id/mobile
 * @desc    Get mobile-optimized preview
 * @access  Private (owner only)
 */
router.get('/:id/mobile',
  verifyFirebaseToken,
  validateUUID('id'),
  checkOwnership(Portfolio, 'id'),
  async (req, res) => {
    try {
      const portfolio = req.resource;

      // Generate HTML with mobile optimizations
      const result = await templateEngine.generateHTML(
        portfolio.content,
        portfolio.template_id
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'Mobile Preview Generation Failed',
          message: result.error
        });
      }

      // Add mobile-specific meta tags and styles
      const mobileCSS = `
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>
          @media (max-width: 768px) {
            body { font-size: 16px !important; }
            .container { padding: 10px !important; }
            .section { padding: 20px 0 !important; }
          }
        </style>
      `;

      const mobileHTML = result.html.replace('</head>', `${mobileCSS}</head>`);

      res.type('html').send(mobileHTML);
    } catch (error) {
      console.error('Mobile preview error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to generate mobile preview'
      });
    }
  }
);

/**
 * @route   GET /api/preview/:id/metadata
 * @desc    Get preview metadata (for sharing, SEO)
 * @access  Private (owner only)
 */
router.get('/:id/metadata',
  verifyFirebaseToken,
  validateUUID('id'),
  checkOwnership(Portfolio, 'id'),
  async (req, res) => {
    try {
      const portfolio = req.resource;
      const content = portfolio.content;

      // Extract metadata from content
      const metadata = {
        title: content.hero?.name ? `${content.hero.name} - Portfolio` : portfolio.title,
        description: content.hero?.bio || content.about?.description || 'Professional Portfolio',
        image: content.hero?.image || null,
        url: `/portfolio/${portfolio.slug}`,
        author: content.hero?.name || '',
        keywords: [
          ...(content.about?.skills || []),
          ...(content.projects?.map(p => p.title) || [])
        ].slice(0, 10), // Limit to 10 keywords
        type: 'website',
        portfolio_data: {
          projects_count: content.projects?.length || 0,
          skills_count: content.about?.skills?.length || 0,
          experience_count: content.experience?.length || 0,
          has_contact: !!(content.contact?.email)
        }
      };

      res.json({
        success: true,
        metadata
      });
    } catch (error) {
      console.error('Metadata fetch error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch metadata'
      });
    }
  }
);

module.exports = router;