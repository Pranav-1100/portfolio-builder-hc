const express = require('express');
const router = express.Router();
const { User } = require('../models');
const { verifyFirebaseToken, optionalAuth } = require('../middleware/auth');
const { validateProfileUpdate } = require('../middleware/validation');
const { authLimiter } = require('../middleware/rateLimiter');

// Apply auth rate limiting to all routes
router.use(authLimiter);

/**
 * @route   POST /api/auth/verify-token
 * @desc    Verify Firebase token and create/login user
 * @access  Public
 */
router.post('/verify-token', verifyFirebaseToken, async (req, res) => {
  try {
    const user = req.user;
    const firebaseUser = req.firebaseUser;

    res.json({
      success: true,
      message: 'Token verified successfully',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        subscription_tier: user.subscription_tier,
        created_at: user.created_at,
        last_login_at: user.last_login_at
      },
      is_new_user: user.created_at === user.updated_at
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to verify token'
    });
  }
});

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', verifyFirebaseToken, async (req, res) => {
  try {
    const user = req.user;

    // Get user with related data
    const userWithStats = await User.findByPk(user.id, {
      attributes: [
        'id', 'email', 'username', 'full_name', 'avatar_url',
        'subscription_tier', 'created_at', 'last_login_at'
      ],
      include: [
        {
          association: 'portfolios',
          attributes: ['id', 'title', 'status', 'view_count', 'created_at'],
          limit: 5,
          order: [['updated_at', 'DESC']]
        },
        {
          association: 'integrations',
          attributes: ['platform', 'is_active', 'last_synced_at'],
          where: { is_active: true },
          required: false
        }
      ]
    });

    if (!userWithStats) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Calculate user stats
    const totalPortfolios = userWithStats.portfolios?.length || 0;
    const totalViews = userWithStats.portfolios?.reduce((sum, p) => sum + p.view_count, 0) || 0;
    const publishedPortfolios = userWithStats.portfolios?.filter(p => p.status === 'published').length || 0;

    res.json({
      success: true,
      user: userWithStats,
      stats: {
        total_portfolios: totalPortfolios,
        published_portfolios: publishedPortfolios,
        total_views: totalViews,
        active_integrations: userWithStats.integrations?.length || 0
      }
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch profile'
    });
  }
});

/**
 * @route   PUT /api/auth/profile
 * @desc    Update current user profile
 * @access  Private
 */
router.put('/profile', verifyFirebaseToken, validateProfileUpdate, async (req, res) => {
  try {
    const user = req.user;
    const updates = req.body;

    // Check if username is being changed and is available
    if (updates.username && updates.username !== user.username) {
      const existingUser = await User.findByUsername(updates.username);
      if (existingUser && existingUser.id !== user.id) {
        return res.status(400).json({
          success: false,
          error: 'Username already taken',
          message: 'Please choose a different username'
        });
      }
    }

    // Update user
    await user.update(updates);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        subscription_tier: user.subscription_tier
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to update profile'
    });
  }
});

/**
 * @route   POST /api/auth/check-username
 * @desc    Check if username is available
 * @access  Public
 */
router.post('/check-username', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        success: false,
        error: 'Username is required'
      });
    }

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid username format',
        message: 'Username must be 3-30 characters and contain only letters, numbers, underscores, and hyphens'
      });
    }

    const existingUser = await User.findByUsername(username);
    const isAvailable = !existingUser;

    res.json({
      success: true,
      username,
      available: isAvailable,
      message: isAvailable ? 'Username is available' : 'Username is already taken'
    });
  } catch (error) {
    console.error('Username check error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to check username'
    });
  }
});

/**
 * @route   DELETE /api/auth/account
 * @desc    Delete user account and all associated data
 * @access  Private
 */
router.delete('/account', verifyFirebaseToken, async (req, res) => {
  try {
    const user = req.user;
    const { confirm_deletion } = req.body;

    if (!confirm_deletion) {
      return res.status(400).json({
        success: false,
        error: 'Confirmation required',
        message: 'Please confirm account deletion'
      });
    }

    // Delete user (CASCADE will handle related records)
    await user.destroy();

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to delete account'
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (client-side should handle Firebase logout)
 * @access  Private
 */
router.post('/logout', verifyFirebaseToken, async (req, res) => {
  try {
    // Note: Firebase token revocation should be handled on client-side
    // This endpoint is mainly for logging purposes
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to logout'
    });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get minimal user info (for header/navbar)
 * @access  Private
 */
router.get('/me', verifyFirebaseToken, async (req, res) => {
  try {
    const user = req.user;

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        subscription_tier: user.subscription_tier
      }
    });
  } catch (error) {
    console.error('User info error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch user info'
    });
  }
});

module.exports = router;