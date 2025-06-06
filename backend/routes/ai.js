const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const { Portfolio } = require('../models');
const { verifyFirebaseToken, checkOwnership } = require('../middleware/auth');
const { 
  validateAIGeneration, 
  validateAIIteration, 
  validateUUID,
  validateResumeUpload 
} = require('../middleware/validation');
const { aiLimiter, uploadLimiter } = require('../middleware/rateLimiter');

const portfolioGenerator = require('../services/portfolioGenerator');
const aiService = require('../services/aiService');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Apply AI rate limiting to all routes
router.use(aiLimiter);

/**
 * @route   POST /api/ai/generate
 * @desc    Generate new portfolio using AI
 * @access  Private
 */
router.post('/generate', verifyFirebaseToken, validateAIGeneration, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sources, template_id, preferences = {} } = req.body;

    console.log(`AI generation request from user ${userId} with sources:`, sources.map(s => s.type));

    // Generate portfolio
    const result = await portfolioGenerator.generatePortfolio(userId, sources, {
      template_id,
      ...preferences
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Generation Failed',
        message: result.error
      });
    }

    res.status(201).json({
      success: true,
      message: 'Portfolio generated successfully',
      portfolio: {
        id: result.portfolio.id,
        title: result.portfolio.title,
        slug: result.portfolio.slug,
        status: result.portfolio.status,
        template_id: result.portfolio.template_id,
        created_at: result.portfolio.created_at
      },
      metadata: result.metadata
    });
  } catch (error) {
    console.error('AI generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to generate portfolio'
    });
  }
});

/**
 * @route   POST /api/ai/iterate/:id
 * @desc    Enhance existing portfolio with AI
 * @access  Private (owner only)
 */
router.post('/iterate/:id',
  verifyFirebaseToken,
  validateUUID('id'),
  validateAIIteration,
  checkOwnership(Portfolio, 'id'),
  async (req, res) => {
    try {
      const portfolio = req.resource;
      const { prompt, section, iteration_type = 'enhance' } = req.body;

      console.log(`AI iteration request for portfolio ${portfolio.id}: ${prompt}`);

      // Enhance portfolio
      const result = await portfolioGenerator.enhancePortfolio(
        portfolio.id,
        prompt,
        section
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'Enhancement Failed',
          message: result.error
        });
      }

      res.json({
        success: true,
        message: 'Portfolio enhanced successfully',
        changes: result.changes,
        metadata: result.metadata
      });
    } catch (error) {
      console.error('AI iteration error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to enhance portfolio'
      });
    }
  }
);

/**
 * @route   POST /api/ai/enhance-section/:id
 * @desc    Enhance specific portfolio section
 * @access  Private (owner only)
 */
router.post('/enhance-section/:id',
  verifyFirebaseToken,
  validateUUID('id'),
  checkOwnership(Portfolio, 'id'),
  async (req, res) => {
    try {
      const portfolio = req.resource;
      const { section, prompt, context = {} } = req.body;

      if (!section || !prompt) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'Section and prompt are required'
        });
      }

      console.log(`Enhancing section '${section}' for portfolio ${portfolio.id}`);

      // Enhance specific section
      const result = await aiService.enhanceSection(
        portfolio.content,
        section,
        prompt,
        context
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'Section Enhancement Failed',
          message: 'Failed to enhance section'
        });
      }

      // Update portfolio content
      const updatedContent = {
        ...portfolio.content,
        [section]: result.content[section] || result.content
      };

      await portfolio.updateContent(updatedContent);

      res.json({
        success: true,
        message: `Section '${section}' enhanced successfully`,
        enhanced_content: result.content,
        tokens_used: result.tokensUsed
      });
    } catch (error) {
      console.error('Section enhancement error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to enhance section'
      });
    }
  }
);

/**
 * @route   POST /api/ai/generate-bio
 * @desc    Generate professional bio using AI
 * @access  Private
 */
router.post('/generate-bio', verifyFirebaseToken, async (req, res) => {
  try {
    const { user_data, style = 'professional' } = req.body;

    if (!user_data) {
      return res.status(400).json({
        success: false,
        error: 'User data is required'
      });
    }

    console.log(`Generating bio for user ${req.user.id}`);

    // Generate bio
    const result = await aiService.generateBio(user_data, style);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Bio Generation Failed',
        message: 'Failed to generate bio'
      });
    }

    res.json({
      success: true,
      bio: result.bio,
      tokens_used: result.tokensUsed
    });
  } catch (error) {
    console.error('Bio generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to generate bio'
    });
  }
});

/**
 * @route   POST /api/ai/generate-projects
 * @desc    Generate project descriptions from GitHub repos
 * @access  Private
 */
router.post('/generate-projects', verifyFirebaseToken, async (req, res) => {
  try {
    const { repositories } = req.body;

    if (!repositories || !Array.isArray(repositories)) {
      return res.status(400).json({
        success: false,
        error: 'Repositories array is required'
      });
    }

    console.log(`Generating project descriptions for ${repositories.length} repositories`);

    // Generate project descriptions
    const result = await aiService.generateProjectDescriptions(repositories);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Project Generation Failed',
        message: 'Failed to generate project descriptions'
      });
    }

    res.json({
      success: true,
      projects: result.projects,
      tokens_used: result.tokensUsed
    });
  } catch (error) {
    console.error('Project generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to generate project descriptions'
    });
  }
});

/**
 * @route   POST /api/ai/parse-resume
 * @desc    Upload and parse resume with AI
 * @access  Private
 */
router.post('/parse-resume',
  verifyFirebaseToken,
  uploadLimiter,
  upload.single('resume'),
  validateResumeUpload,
  async (req, res) => {
    try {
      const file = req.file;
      
      console.log(`Parsing resume for user ${req.user.id}: ${file.originalname}`);

      let resumeText = '';

      // Extract text based on file type
      if (file.mimetype === 'application/pdf') {
        const dataBuffer = await fs.readFile(file.path);
        const pdfData = await pdfParse(dataBuffer);
        resumeText = pdfData.text;
      } else if (file.mimetype.includes('word')) {
        const dataBuffer = await fs.readFile(file.path);
        const result = await mammoth.extractRawText({ buffer: dataBuffer });
        resumeText = result.value;
      } else {
        // Plain text file
        resumeText = await fs.readFile(file.path, 'utf8');
      }

      // Clean up uploaded file
      await fs.unlink(file.path);

      if (!resumeText.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Empty resume',
          message: 'Could not extract text from the uploaded file'
        });
      }

      // Parse resume with AI
      const result = await aiService.parseResumeContent(resumeText);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'Resume Parsing Failed',
          message: 'Failed to parse resume content'
        });
      }

      res.json({
        success: true,
        message: 'Resume parsed successfully',
        data: result.data,
        tokens_used: result.tokensUsed,
        raw_text: resumeText.substring(0, 500) + '...' // First 500 chars for debugging
      });
    } catch (error) {
      console.error('Resume parsing error:', error);
      
      // Clean up file if it exists
      if (req.file && req.file.path) {
        try {
          await fs.unlink(req.file.path);
        } catch (unlinkError) {
          console.error('File cleanup error:', unlinkError);
        }
      }

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to parse resume'
      });
    }
  }
);

/**
 * @route   GET /api/ai/suggestions
 * @desc    Get AI generation suggestions for user
 * @access  Private
 */
router.get('/suggestions', verifyFirebaseToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get generation suggestions
    const result = await portfolioGenerator.getGenerationSuggestions(userId);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to get suggestions'
      });
    }

    res.json({
      success: true,
      suggestions: result.suggestions
    });
  } catch (error) {
    console.error('Suggestions fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to get suggestions'
    });
  }
});

/**
 * @route   POST /api/ai/template-recommendations
 * @desc    Get template recommendations based on sources
 * @access  Private
 */
router.post('/template-recommendations', verifyFirebaseToken, async (req, res) => {
  try {
    const { sources, preferences = {} } = req.body;

    if (!sources || !Array.isArray(sources)) {
      return res.status(400).json({
        success: false,
        error: 'Sources array is required'
      });
    }

    // Get template recommendations
    const result = await portfolioGenerator.getTemplateRecommendations(sources, preferences);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to get recommendations'
      });
    }

    res.json({
      success: true,
      recommendations: result.recommendations
    });
  } catch (error) {
    console.error('Template recommendations error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to get template recommendations'
    });
  }
});

/**
 * @route   GET /api/ai/usage
 * @desc    Get AI usage statistics for user
 * @access  Private
 */
router.get('/usage', verifyFirebaseToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's portfolios and their iterations
    const { Portfolio, PortfolioIteration } = require('../models');
    
    const portfolios = await Portfolio.findAll({
      where: { user_id: userId },
      include: [
        {
          model: PortfolioIteration,
          as: 'iterations',
          attributes: ['tokens_used', 'status', 'created_at']
        }
      ]
    });

    // Calculate usage stats
    const totalIterations = portfolios.reduce((sum, p) => sum + (p.iterations?.length || 0), 0);
    const totalTokens = portfolios.reduce((sum, p) => 
      sum + (p.iterations?.reduce((iterSum, iter) => iterSum + (iter.tokens_used || 0), 0) || 0), 0
    );
    const successfulIterations = portfolios.reduce((sum, p) => 
      sum + (p.iterations?.filter(iter => iter.status === 'completed').length || 0), 0
    );

    // Get current month usage
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const monthlyIterations = portfolios.reduce((sum, p) => 
      sum + (p.iterations?.filter(iter => new Date(iter.created_at) >= currentMonth).length || 0), 0
    );

    res.json({
      success: true,
      usage: {
        total_iterations: totalIterations,
        successful_iterations: successfulIterations,
        failed_iterations: totalIterations - successfulIterations,
        total_tokens_used: totalTokens,
        monthly_iterations: monthlyIterations,
        subscription_tier: req.user.subscription_tier
      }
    });
  } catch (error) {
    console.error('AI usage fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch AI usage'
    });
  }
});

module.exports = router;