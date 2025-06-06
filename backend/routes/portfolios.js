const express = require('express');
const router = express.Router();
const { Portfolio, PortfolioIteration, User } = require('../models');
const { verifyFirebaseToken, checkOwnership, optionalAuth } = require('../middleware/auth');
const { 
  validatePortfolioCreation, 
  validatePortfolioUpdate, 
  validateUUID,
  validatePagination 
} = require('../middleware/validation');
const { portfolioCreationLimiter, apiLimiter } = require('../middleware/rateLimiter');

// Apply general rate limiting
router.use(apiLimiter);

/**
 * @route   GET /api/portfolios
 * @desc    Get all portfolios for authenticated user
 * @access  Private
 */
router.get('/', verifyFirebaseToken, validatePagination, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      page = 1, 
      limit = 10, 
      sort = 'updated_at', 
      order = 'DESC',
      status,
      search
    } = req.query;

    // Build where clause
    const whereClause = { user_id: userId };
    
    if (status && ['draft', 'published', 'archived'].includes(status)) {
      whereClause.status = status;
    }

    // Build search conditions
    const searchConditions = [];
    if (search) {
      searchConditions.push(
        { title: { [require('sequelize').Op.like]: `%${search}%` } }
      );
    }

    if (searchConditions.length > 0) {
      whereClause[require('sequelize').Op.or] = searchConditions;
    }

    // Calculate offset
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Fetch portfolios
    const { count, rows: portfolios } = await Portfolio.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: offset,
      order: [[sort, order.toUpperCase()]],
      attributes: [
        'id', 'title', 'slug', 'status', 'template_id', 
        'view_count', 'is_public', 'published_at', 
        'created_at', 'updated_at'
      ]
    });

    // Calculate pagination info
    const totalPages = Math.ceil(count / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      success: true,
      portfolios,
      pagination: {
        current_page: parseInt(page),
        total_pages: totalPages,
        total_items: count,
        items_per_page: parseInt(limit),
        has_next_page: hasNextPage,
        has_prev_page: hasPrevPage
      }
    });
  } catch (error) {
    console.error('Portfolio list error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch portfolios'
    });
  }
});

/**
 * @route   POST /api/portfolios
 * @desc    Create new portfolio
 * @access  Private
 */
router.post('/', verifyFirebaseToken, portfolioCreationLimiter, validatePortfolioCreation, async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, template_id, content } = req.body;

    // Generate unique slug
    const slug = await Portfolio.generateSlug(userId, title);

    // Create portfolio
    const portfolio = await Portfolio.create({
      user_id: userId,
      title,
      slug,
      template_id: template_id || 'modern-dev',
      content: content || Portfolio.getDefaultContent(),
      status: 'draft'
    });

    res.status(201).json({
      success: true,
      message: 'Portfolio created successfully',
      portfolio: {
        id: portfolio.id,
        title: portfolio.title,
        slug: portfolio.slug,
        status: portfolio.status,
        template_id: portfolio.template_id,
        created_at: portfolio.created_at
      }
    });
  } catch (error) {
    console.error('Portfolio creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to create portfolio'
    });
  }
});

/**
 * @route   GET /api/portfolios/:id
 * @desc    Get specific portfolio by ID
 * @access  Private (owner only)
 */
router.get('/:id', 
  verifyFirebaseToken, 
  validateUUID('id'), 
  checkOwnership(Portfolio, 'id'), 
  async (req, res) => {
    try {
      const portfolio = req.resource; // Set by checkOwnership middleware

      // Include recent iterations
      const iterations = await PortfolioIteration.findByPortfolio(portfolio.id, 5);

      res.json({
        success: true,
        portfolio: {
          id: portfolio.id,
          title: portfolio.title,
          slug: portfolio.slug,
          status: portfolio.status,
          template_id: portfolio.template_id,
          content: portfolio.content,
          view_count: portfolio.view_count,
          is_public: portfolio.is_public,
          published_at: portfolio.published_at,
          created_at: portfolio.created_at,
          updated_at: portfolio.updated_at
        },
        recent_iterations: iterations
      });
    } catch (error) {
      console.error('Portfolio fetch error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch portfolio'
      });
    }
  }
);

/**
 * @route   PUT /api/portfolios/:id
 * @desc    Update portfolio
 * @access  Private (owner only)
 */
router.put('/:id',
  verifyFirebaseToken,
  validateUUID('id'),
  validatePortfolioUpdate,
  checkOwnership(Portfolio, 'id'),
  async (req, res) => {
    try {
      const portfolio = req.resource;
      const updates = req.body;

      // If slug is being updated, ensure it's unique
      if (updates.slug && updates.slug !== portfolio.slug) {
        const existingPortfolio = await Portfolio.findByUserAndSlug(portfolio.user_id, updates.slug);
        if (existingPortfolio && existingPortfolio.id !== portfolio.id) {
          return res.status(400).json({
            success: false,
            error: 'Slug already exists',
            message: 'Please choose a different slug'
          });
        }
      }

      // Update portfolio
      await portfolio.update(updates);

      res.json({
        success: true,
        message: 'Portfolio updated successfully',
        portfolio: {
          id: portfolio.id,
          title: portfolio.title,
          slug: portfolio.slug,
          status: portfolio.status,
          template_id: portfolio.template_id,
          updated_at: portfolio.updated_at
        }
      });
    } catch (error) {
      console.error('Portfolio update error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to update portfolio'
      });
    }
  }
);

/**
 * @route   DELETE /api/portfolios/:id
 * @desc    Delete portfolio
 * @access  Private (owner only)
 */
router.delete('/:id',
  verifyFirebaseToken,
  validateUUID('id'),
  checkOwnership(Portfolio, 'id'),
  async (req, res) => {
    try {
      const portfolio = req.resource;

      // Delete portfolio (CASCADE will handle iterations)
      await portfolio.destroy();

      res.json({
        success: true,
        message: 'Portfolio deleted successfully'
      });
    } catch (error) {
      console.error('Portfolio deletion error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to delete portfolio'
      });
    }
  }
);

/**
 * @route   POST /api/portfolios/:id/publish
 * @desc    Publish portfolio
 * @access  Private (owner only)
 */
router.post('/:id/publish',
  verifyFirebaseToken,
  validateUUID('id'),
  checkOwnership(Portfolio, 'id'),
  async (req, res) => {
    try {
      const portfolio = req.resource;

      // Publish portfolio
      await portfolio.publish();

      res.json({
        success: true,
        message: 'Portfolio published successfully',
        portfolio: {
          id: portfolio.id,
          status: portfolio.status,
          is_public: portfolio.is_public,
          published_at: portfolio.published_at
        }
      });
    } catch (error) {
      console.error('Portfolio publish error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to publish portfolio'
      });
    }
  }
);

/**
 * @route   POST /api/portfolios/:id/unpublish
 * @desc    Unpublish portfolio
 * @access  Private (owner only)
 */
router.post('/:id/unpublish',
  verifyFirebaseToken,
  validateUUID('id'),
  checkOwnership(Portfolio, 'id'),
  async (req, res) => {
    try {
      const portfolio = req.resource;

      // Unpublish portfolio
      await portfolio.unpublish();

      res.json({
        success: true,
        message: 'Portfolio unpublished successfully',
        portfolio: {
          id: portfolio.id,
          status: portfolio.status,
          is_public: portfolio.is_public,
          published_at: portfolio.published_at
        }
      });
    } catch (error) {
      console.error('Portfolio unpublish error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to unpublish portfolio'
      });
    }
  }
);

/**
 * @route   POST /api/portfolios/:id/duplicate
 * @desc    Duplicate portfolio
 * @access  Private (owner only)
 */
router.post('/:id/duplicate',
  verifyFirebaseToken,
  validateUUID('id'),
  checkOwnership(Portfolio, 'id'),
  async (req, res) => {
    try {
      const originalPortfolio = req.resource;
      const { title } = req.body;

      // Generate title and slug for duplicate
      const duplicateTitle = title || `${originalPortfolio.title} (Copy)`;
      const slug = await Portfolio.generateSlug(originalPortfolio.user_id, duplicateTitle);

      // Create duplicate portfolio
      const duplicatePortfolio = await Portfolio.create({
        user_id: originalPortfolio.user_id,
        title: duplicateTitle,
        slug,
        template_id: originalPortfolio.template_id,
        content: originalPortfolio.content,
        status: 'draft'
      });

      res.status(201).json({
        success: true,
        message: 'Portfolio duplicated successfully',
        portfolio: {
          id: duplicatePortfolio.id,
          title: duplicatePortfolio.title,
          slug: duplicatePortfolio.slug,
          status: duplicatePortfolio.status,
          template_id: duplicatePortfolio.template_id,
          created_at: duplicatePortfolio.created_at
        }
      });
    } catch (error) {
      console.error('Portfolio duplication error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to duplicate portfolio'
      });
    }
  }
);

/**
 * @route   GET /api/portfolios/:id/iterations
 * @desc    Get portfolio iterations history
 * @access  Private (owner only)
 */
router.get('/:id/iterations',
  verifyFirebaseToken,
  validateUUID('id'),
  checkOwnership(Portfolio, 'id'),
  async (req, res) => {
    try {
      const portfolio = req.resource;
      const { limit = 20 } = req.query;

      // Get iterations
      const iterations = await PortfolioIteration.findByPortfolio(portfolio.id, parseInt(limit));

      // Get iteration stats
      const stats = await PortfolioIteration.getIterationStats(portfolio.id);

      res.json({
        success: true,
        iterations,
        stats
      });
    } catch (error) {
      console.error('Portfolio iterations fetch error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch portfolio iterations'
      });
    }
  }
);

/**
 * @route   GET /api/portfolios/:id/stats
 * @desc    Get portfolio statistics
 * @access  Private (owner only)
 */
router.get('/:id/stats',
  verifyFirebaseToken,
  validateUUID('id'),
  checkOwnership(Portfolio, 'id'),
  async (req, res) => {
    try {
      const portfolio = req.resource;

      // Get iteration stats
      const iterationStats = await PortfolioIteration.getIterationStats(portfolio.id);

      // Basic portfolio stats
      const stats = {
        views: portfolio.view_count,
        status: portfolio.status,
        is_public: portfolio.is_public,
        created_at: portfolio.created_at,
        updated_at: portfolio.updated_at,
        published_at: portfolio.published_at,
        iterations: iterationStats
      };

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      console.error('Portfolio stats fetch error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch portfolio stats'
      });
    }
  }
);

/**
 * @route   GET /api/portfolios/public/:slug
 * @desc    Get public portfolio by slug (for public viewing)
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
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['username', 'full_name']
        }
      ]
    });

    if (!portfolio) {
      return res.status(404).json({
        success: false,
        error: 'Portfolio not found',
        message: 'The requested portfolio does not exist or is not public'
      });
    }

    // Increment view count
    await portfolio.incrementView();

    res.json({
      success: true,
      portfolio: {
        id: portfolio.id,
        title: portfolio.title,
        content: portfolio.content,
        template_id: portfolio.template_id,
        view_count: portfolio.view_count,
        published_at: portfolio.published_at,
        owner: {
          username: portfolio.user.username,
          full_name: portfolio.user.full_name
        }
      }
    });
  } catch (error) {
    console.error('Public portfolio fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch portfolio'
    });
  }
});

module.exports = router;