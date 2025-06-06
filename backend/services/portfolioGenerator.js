const aiService = require('./aiService');
const githubService = require('./githubService');
const { Portfolio, PortfolioIteration } = require('../models');

class PortfolioGeneratorService {
  constructor() {
    this.defaultTemplate = 'modern-dev';
  }

  // Main portfolio generation function
  async generatePortfolio(userId, sources, preferences = {}) {
    const startTime = Date.now();
    let iteration = null;
    
    try {
      // Create portfolio iteration record
      iteration = await PortfolioIteration.create({
        portfolio_id: null, // Will be set after portfolio creation
        prompt: `Generate portfolio from sources: ${sources.map(s => s.type).join(', ')}`,
        iteration_type: 'generate',
        status: 'pending'
      });

      console.log('Starting portfolio generation with sources:', sources.map(s => s.type));

      // Process all sources
      const processedSources = await this._processSources(sources);
      
      // Generate portfolio content using AI
      const aiResult = await aiService.generatePortfolio(processedSources, preferences);
      
      if (!aiResult.success) {
        throw new Error('AI generation failed');
      }

      // Create portfolio in database
      const portfolioData = {
        user_id: userId,
        title: this._generatePortfolioTitle(aiResult.content),
        template_id: preferences.template_id || this.defaultTemplate,
        content: aiResult.content,
        status: 'draft'
      };

      // Generate unique slug
      portfolioData.slug = await Portfolio.generateSlug(userId, portfolioData.title);

      const portfolio = await Portfolio.create(portfolioData);

      // Update iteration with portfolio ID
      iteration.portfolio_id = portfolio.id;
      
      // Mark iteration as completed
      const processingTime = Date.now() - startTime;
      await iteration.markCompleted(
        { generated: true, sources: sources.map(s => s.type) },
        aiResult.tokensUsed,
        processingTime
      );

      return {
        success: true,
        portfolio: portfolio,
        metadata: {
          sources_processed: processedSources.length,
          tokens_used: aiResult.tokensUsed,
          processing_time_ms: processingTime,
          ai_model: aiResult.model
        }
      };
    } catch (error) {
      console.error('Portfolio generation error:', error);
      
      // Mark iteration as failed
      if (iteration) {
        await iteration.markFailed(error.message);
      }
      
      return {
        success: false,
        error: error.message || 'Portfolio generation failed'
      };
    }
  }

  // Enhance existing portfolio with user prompt
  async enhancePortfolio(portfolioId, prompt, section = null) {
    const startTime = Date.now();
    let iteration = null;

    try {
      // Get existing portfolio
      const portfolio = await Portfolio.findByPk(portfolioId);
      if (!portfolio) {
        throw new Error('Portfolio not found');
      }

      // Create iteration record
      iteration = await PortfolioIteration.create({
        portfolio_id: portfolioId,
        prompt: prompt,
        iteration_type: 'enhance',
        status: 'pending',
        previous_content: portfolio.content
      });

      console.log(`Enhancing portfolio ${portfolioId} with prompt: ${prompt}`);

      let enhancedContent;
      let tokensUsed = 0;

      if (section) {
        // Enhance specific section
        const aiResult = await aiService.enhanceSection(
          portfolio.content,
          section,
          prompt,
          { portfolio_id: portfolioId }
        );
        
        if (!aiResult.success) {
          throw new Error('AI enhancement failed');
        }

        enhancedContent = {
          ...portfolio.content,
          [section]: aiResult.content[section] || aiResult.content
        };
        tokensUsed = aiResult.tokensUsed;
      } else {
        // Enhance entire portfolio
        const sources = [{ type: 'prompt', data: { description: prompt } }];
        const aiResult = await aiService.generatePortfolio(
          sources,
          { existing_content: portfolio.content }
        );
        
        if (!aiResult.success) {
          throw new Error('AI enhancement failed');
        }

        enhancedContent = {
          ...portfolio.content,
          ...aiResult.content
        };
        tokensUsed = aiResult.tokensUsed;
      }

      // Update portfolio content
      await portfolio.updateContent(enhancedContent);

      // Mark iteration as completed
      const processingTime = Date.now() - startTime;
      await iteration.markCompleted(
        { enhanced: true, section: section || 'entire_portfolio' },
        tokensUsed,
        processingTime
      );

      return {
        success: true,
        portfolio: portfolio,
        changes: {
          section: section || 'entire_portfolio',
          prompt: prompt
        },
        metadata: {
          tokens_used: tokensUsed,
          processing_time_ms: processingTime
        }
      };
    } catch (error) {
      console.error('Portfolio enhancement error:', error);
      
      if (iteration) {
        await iteration.markFailed(error.message);
      }
      
      return {
        success: false,
        error: error.message || 'Portfolio enhancement failed'
      };
    }
  }

  // Process different types of sources
  async _processSources(sources) {
    const processedSources = [];

    for (const source of sources) {
      try {
        let processedSource = { type: source.type, data: source.data };

        switch (source.type) {
          case 'github':
            processedSource = await this._processGitHubSource(source);
            break;
          case 'resume':
            processedSource = await this._processResumeSource(source);
            break;
          case 'prompt':
            processedSource = await this._processPromptSource(source);
            break;
          case 'linkedin':
            processedSource = await this._processLinkedInSource(source);
            break;
          default:
            console.warn(`Unknown source type: ${source.type}`);
        }

        processedSources.push(processedSource);
      } catch (error) {
        console.error(`Error processing ${source.type} source:`, error);
        // Continue with other sources even if one fails
      }
    }

    return processedSources;
  }

  async _processGitHubSource(source) {
    console.log('Processing GitHub source:', source.data.username);
    
    const githubData = await githubService.getComprehensiveUserData(
      source.data.username,
      source.data.access_token
    );

    if (!githubData.success) {
      throw new Error(`Failed to fetch GitHub data: ${githubData.error}`);
    }

    // Extract relevant information for AI
    const processedData = {
      profile: githubData.data.profile,
      top_repositories: githubData.data.repositories.slice(0, 6),
      pinned_repositories: githubData.data.pinned_repositories,
      languages: githubData.data.languages.slice(0, 8),
      stats: githubData.data.stats,
      profile_readme: githubData.data.profile_readme
    };

    return {
      type: 'github',
      data: processedData
    };
  }

  async _processResumeSource(source) {
    console.log('Processing resume source');
    
    const resumeText = source.data.text || source.data.content;
    
    if (!resumeText) {
      throw new Error('No resume text provided');
    }

    // Use AI to parse resume content
    const parseResult = await aiService.parseResumeContent(resumeText);
    
    if (!parseResult.success) {
      throw new Error('Failed to parse resume content');
    }

    return {
      type: 'resume',
      data: parseResult.data
    };
  }

  async _processPromptSource(source) {
    console.log('Processing prompt source');
    
    return {
      type: 'prompt',
      data: {
        description: source.data.description || source.data.prompt,
        preferences: source.data.preferences || {}
      }
    };
  }

  async _processLinkedInSource(source) {
    console.log('Processing LinkedIn source');
    
    // For now, return the data as-is
    // In the future, this could include scraping logic
    return {
      type: 'linkedin',
      data: source.data
    };
  }

  // Generate a meaningful portfolio title
  _generatePortfolioTitle(content) {
    const name = content.hero?.name || 'Portfolio';
    const title = content.hero?.title || '';
    
    if (title) {
      return `${name} - ${title}`;
    }
    
    return `${name}'s Portfolio`;
  }

  // Get portfolio generation suggestions based on available data
  async getGenerationSuggestions(userId) {
    try {
      const suggestions = {
        sources: [],
        templates: ['modern-dev', 'minimal', 'creative'],
        tips: []
      };

      // Check if user has GitHub integration
      const { Integration } = require('../models');
      const githubIntegration = await Integration.findByUserAndPlatform(userId, 'github');
      
      if (githubIntegration && githubIntegration.is_active) {
        suggestions.sources.push({
          type: 'github',
          available: true,
          description: 'Use your GitHub repositories and profile'
        });
      } else {
        suggestions.sources.push({
          type: 'github',
          available: false,
          description: 'Connect GitHub to showcase your projects'
        });
      }

      suggestions.sources.push(
        {
          type: 'resume',
          available: true,
          description: 'Upload your resume for comprehensive portfolio generation'
        },
        {
          type: 'prompt',
          available: true,
          description: 'Describe yourself and your work'
        }
      );

      suggestions.tips = [
        'Combine multiple sources for the best results',
        'GitHub integration provides rich project data',
        'A well-written resume helps generate better content',
        'Be specific in your descriptions for personalized results'
      ];

      return {
        success: true,
        suggestions
      };
    } catch (error) {
      console.error('Error getting generation suggestions:', error);
      return {
        success: false,
        error: 'Failed to get suggestions'
      };
    }
  }

  // Get template recommendations based on user data
  async getTemplateRecommendations(sources, userPreferences = {}) {
    try {
      const recommendations = [];

      // Analyze sources to recommend templates
      const hasGitHub = sources.some(s => s.type === 'github');
      const hasDesignWork = this._detectDesignWork(sources);
      const hasBackendWork = this._detectBackendWork(sources);

      if (hasGitHub && hasBackendWork) {
        recommendations.push({
          id: 'modern-dev',
          name: 'Modern Developer',
          match_score: 0.9,
          reasons: ['GitHub integration', 'Backend development focus']
        });
      }

      if (hasDesignWork) {
        recommendations.push({
          id: 'creative',
          name: 'Creative Portfolio',
          match_score: 0.8,
          reasons: ['Design work detected', 'Visual portfolio layout']
        });
      }

      recommendations.push({
        id: 'minimal',
        name: 'Minimal Professional',
        match_score: 0.7,
        reasons: ['Clean design', 'Professional appearance']
      });

      // Sort by match score
      recommendations.sort((a, b) => b.match_score - a.match_score);

      return {
        success: true,
        recommendations
      };
    } catch (error) {
      console.error('Error getting template recommendations:', error);
      return {
        success: false,
        error: 'Failed to get template recommendations'
      };
    }
  }

  _detectDesignWork(sources) {
    // Simple heuristic to detect design work
    const designKeywords = ['design', 'ui', 'ux', 'figma', 'photoshop', 'illustrator', 'sketch'];
    
    return sources.some(source => {
      const text = JSON.stringify(source.data).toLowerCase();
      return designKeywords.some(keyword => text.includes(keyword));
    });
  }

  _detectBackendWork(sources) {
    // Simple heuristic to detect backend work
    const backendKeywords = ['api', 'server', 'database', 'backend', 'node', 'python', 'java', 'sql'];
    
    return sources.some(source => {
      const text = JSON.stringify(source.data).toLowerCase();
      return backendKeywords.some(keyword => text.includes(keyword));
    });
  }
}

module.exports = new PortfolioGeneratorService();