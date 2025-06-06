const express = require('express');
const router = express.Router();
const { Integration } = require('../models');
const { verifyFirebaseToken } = require('../middleware/auth');
const { validateGitHubIntegration } = require('../middleware/validation');
const { integrationSyncLimiter, apiLimiter } = require('../middleware/rateLimiter');

const githubService = require('../services/githubService');

// Apply rate limiting
router.use(apiLimiter);

/**
 * @route   GET /api/integrations
 * @desc    Get all integrations for authenticated user
 * @access  Private
 */
router.get('/', verifyFirebaseToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const integrations = await Integration.findActiveByUser(userId);

    // Format response
    const formattedIntegrations = integrations.map(integration => ({
      id: integration.id,
      platform: integration.platform,
      platform_username: integration.platform_username,
      is_active: integration.is_active,
      last_synced_at: integration.last_synced_at,
      sync_status: integration.sync_status,
      error_message: integration.error_message,
      created_at: integration.created_at,
      // Include some profile data without sensitive info
      profile_summary: {
        username: integration.profile_data?.username,
        name: integration.profile_data?.name,
        public_repos: integration.profile_data?.public_repos,
        followers: integration.profile_data?.followers
      }
    }));

    res.json({
      success: true,
      integrations: formattedIntegrations
    });
  } catch (error) {
    console.error('Integrations fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch integrations'
    });
  }
});

/**
 * @route   POST /api/integrations/github
 * @desc    Connect GitHub integration
 * @access  Private
 */
router.post('/github', verifyFirebaseToken, validateGitHubIntegration, async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, access_token } = req.body;

    console.log(`Connecting GitHub integration for user ${userId}: ${username}`);

    // Validate GitHub username
    const validationResult = await githubService.validateUsername(username);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'GitHub API Error',
        message: 'Failed to validate GitHub username'
      });
    }

    if (!validationResult.exists) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Username',
        message: 'GitHub username does not exist'
      });
    }

    // Fetch GitHub profile data
    const profileResult = await githubService.getUserProfile(username, access_token);
    if (!profileResult.success) {
      return res.status(400).json({
        success: false,
        error: 'GitHub API Error',
        message: profileResult.error || 'Failed to fetch GitHub profile'
      });
    }

    // Check if integration already exists
    let integration = await Integration.findByUserAndPlatform(userId, 'github');

    if (integration) {
      // Update existing integration
      await integration.update({
        platform_username: username,
        platform_user_id: profileResult.data.username,
        access_token: access_token,
        is_active: true,
        sync_status: 'success',
        error_message: null
      });

      await integration.updateProfileData(profileResult.data);
    } else {
      // Create new integration
      integration = await Integration.create({
        user_id: userId,
        platform: 'github',
        platform_username: username,
        platform_user_id: profileResult.data.username,
        access_token: access_token,
        is_active: true
      });

      await integration.updateProfileData(profileResult.data);
    }

    res.status(201).json({
      success: true,
      message: 'GitHub integration connected successfully',
      integration: {
        id: integration.id,
        platform: integration.platform,
        platform_username: integration.platform_username,
        is_active: integration.is_active,
        last_synced_at: integration.last_synced_at,
        profile_summary: {
          username: profileResult.data.username,
          name: profileResult.data.name,
          public_repos: profileResult.data.public_repos,
          followers: profileResult.data.followers
        }
      }
    });
  } catch (error) {
    console.error('GitHub integration error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to connect GitHub integration'
    });
  }
});

/**
 * @route   POST /api/integrations/:platform/sync
 * @desc    Sync integration data
 * @access  Private
 */
router.post('/:platform/sync', verifyFirebaseToken, integrationSyncLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const { platform } = req.params;

    if (!['github', 'linkedin', 'leetcode'].includes(platform)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid platform'
      });
    }

    // Find integration
    const integration = await Integration.findByUserAndPlatform(userId, platform);
    if (!integration) {
      return res.status(404).json({
        success: false,
        error: 'Integration not found',
        message: `${platform} integration not found`
      });
    }

    if (!integration.is_active) {
      return res.status(400).json({
        success: false,
        error: 'Integration inactive',
        message: 'Integration is not active'
      });
    }

    console.log(`Syncing ${platform} integration for user ${userId}`);

    // Mark sync as pending
    await integration.markSyncPending();

    let syncResult;

    // Sync based on platform
    switch (platform) {
      case 'github':
        syncResult = await syncGitHubIntegration(integration);
        break;
      case 'linkedin':
        syncResult = await syncLinkedInIntegration(integration);
        break;
      case 'leetcode':
        syncResult = await syncLeetCodeIntegration(integration);
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }

    if (syncResult.success) {
      await integration.updateProfileData(syncResult.data);
      
      res.json({
        success: true,
        message: `${platform} integration synced successfully`,
        last_synced_at: integration.last_synced_at,
        data_summary: getSyncSummary(platform, syncResult.data)
      });
    } else {
      await integration.markSyncError(syncResult.error);
      
      res.status(400).json({
        success: false,
        error: 'Sync Failed',
        message: syncResult.error
      });
    }
  } catch (error) {
    console.error('Integration sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to sync integration'
    });
  }
});

/**
 * @route   GET /api/integrations/:platform/data
 * @desc    Get integration data
 * @access  Private
 */
router.get('/:platform/data', verifyFirebaseToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { platform } = req.params;

    // Find integration
    const integration = await Integration.findByUserAndPlatform(userId, platform);
    if (!integration) {
      return res.status(404).json({
        success: false,
        error: 'Integration not found'
      });
    }

    // Check if data is stale
    const isStale = integration.isStale(24); // 24 hours

    res.json({
      success: true,
      data: integration.profile_data,
      metadata: {
        last_synced_at: integration.last_synced_at,
        sync_status: integration.sync_status,
        is_stale: isStale,
        platform: integration.platform
      }
    });
  } catch (error) {
    console.error('Integration data fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch integration data'
    });
  }
});

/**
 * @route   DELETE /api/integrations/:platform
 * @desc    Disconnect integration
 * @access  Private
 */
router.delete('/:platform', verifyFirebaseToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { platform } = req.params;

    // Find and delete integration
    const integration = await Integration.findByUserAndPlatform(userId, platform);
    if (!integration) {
      return res.status(404).json({
        success: false,
        error: 'Integration not found'
      });
    }

    await integration.destroy();

    res.json({
      success: true,
      message: `${platform} integration disconnected successfully`
    });
  } catch (error) {
    console.error('Integration deletion error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to disconnect integration'
    });
  }
});

/**
 * @route   POST /api/integrations/:platform/toggle
 * @desc    Toggle integration active status
 * @access  Private
 */
router.post('/:platform/toggle', verifyFirebaseToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { platform } = req.params;

    // Find integration
    const integration = await Integration.findByUserAndPlatform(userId, platform);
    if (!integration) {
      return res.status(404).json({
        success: false,
        error: 'Integration not found'
      });
    }

    // Toggle active status
    integration.is_active = !integration.is_active;
    await integration.save();

    res.json({
      success: true,
      message: `${platform} integration ${integration.is_active ? 'activated' : 'deactivated'}`,
      is_active: integration.is_active
    });
  } catch (error) {
    console.error('Integration toggle error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to toggle integration'
    });
  }
});

/**
 * @route   GET /api/integrations/available
 * @desc    Get available integrations and their status
 * @access  Private
 */
router.get('/available', verifyFirebaseToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's current integrations
    const userIntegrations = await Integration.findActiveByUser(userId);
    const connectedPlatforms = userIntegrations.map(i => i.platform);

    // Available integrations
    const availableIntegrations = [
      {
        platform: 'github',
        name: 'GitHub',
        description: 'Import repositories, profile data, and contribution graph',
        features: ['Repositories', 'Profile Info', 'Contribution Graph', 'Languages'],
        is_connected: connectedPlatforms.includes('github'),
        setup_difficulty: 'Easy',
        data_richness: 'High'
      },
      {
        platform: 'linkedin',
        name: 'LinkedIn',
        description: 'Import professional experience and education',
        features: ['Work Experience', 'Education', 'Skills', 'Profile Summary'],
        is_connected: connectedPlatforms.includes('linkedin'),
        setup_difficulty: 'Medium',
        data_richness: 'Medium',
        note: 'Currently supports manual data entry'
      },
      {
        platform: 'leetcode',
        name: 'LeetCode',
        description: 'Import coding challenge statistics and achievements',
        features: ['Problem Stats', 'Contest Rating', 'Badges', 'Recent Submissions'],
        is_connected: connectedPlatforms.includes('leetcode'),
        setup_difficulty: 'Medium',
        data_richness: 'Low',
        note: 'Public profile required'
      }
    ];

    res.json({
      success: true,
      integrations: availableIntegrations,
      connected_count: connectedPlatforms.length
    });
  } catch (error) {
    console.error('Available integrations fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch available integrations'
    });
  }
});

// Helper functions (moved outside of router)
async function syncGitHubIntegration(integration) {
  try {
    const result = await githubService.getComprehensiveUserData(
      integration.platform_username,
      integration.access_token
    );
    
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to sync GitHub data'
    };
  }
}

async function syncLinkedInIntegration(integration) {
  // Placeholder for LinkedIn sync
  // In a real implementation, this would include LinkedIn API calls or scraping
  return {
    success: false,
    error: 'LinkedIn sync not yet implemented'
  };
}

async function syncLeetCodeIntegration(integration) {
  // Placeholder for LeetCode sync
  // In a real implementation, this would include LeetCode API calls or scraping
  return {
    success: false,
    error: 'LeetCode sync not yet implemented'
  };
}

function getSyncSummary(platform, data) {
  switch (platform) {
    case 'github':
      return {
        repositories: data.repositories?.length || 0,
        languages: data.languages?.length || 0,
        total_stars: data.stats?.total_stars || 0,
        profile_complete: !!(data.profile?.name && data.profile?.bio)
      };
    case 'linkedin':
      return {
        experience_count: data.experience?.length || 0,
        education_count: data.education?.length || 0,
        skills_count: data.skills?.length || 0
      };
    case 'leetcode':
      return {
        problems_solved: data.problems_solved || 0,
        contest_rating: data.contest_rating || 0,
        badges_count: data.badges?.length || 0
      };
    default:
      return {};
  }
}

module.exports = router;
