const admin = require('firebase-admin');
const { User } = require('../models');

// Initialize Firebase Admin SDK
const initializeFirebase = () => {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      })
    });
  }
};

// Verify Firebase token middleware
const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'No valid authorization header found' 
      });
    }

    const token = authHeader.split('Bearer ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'No token provided' 
      });
    }

    // Verify the Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Find or create user in our database
    let user = await User.findByFirebaseUid(decodedToken.uid);
    
    if (!user) {
      // Create user if doesn't exist
      const email = decodedToken.email;
      const name = decodedToken.name;
      const picture = decodedToken.picture;
      
      // Generate username from email
      const username = await User.generateUsername(email);
      
      user = await User.create({
        firebase_uid: decodedToken.uid,
        email: email,
        username: username,
        full_name: name || '',
        avatar_url: picture || '',
        github_id: decodedToken.firebase?.identities?.['github.com']?.[0] || null,
        google_id: decodedToken.firebase?.identities?.['google.com']?.[0] || null
      });
    }

    // Update last login
    await user.updateLastLogin();

    // Add user and firebase data to request
    req.user = user;
    req.firebaseUser = decodedToken;
    
    next();
  } catch (error) {
    console.error('Firebase token verification error:', error);
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Invalid or expired token' 
    });
  }
};

// Optional auth middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      req.firebaseUser = null;
      return next();
    }

    const token = authHeader.split('Bearer ')[1];
    
    if (!token) {
      req.user = null;
      req.firebaseUser = null;
      return next();
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    const user = await User.findByFirebaseUid(decodedToken.uid);
    
    req.user = user;
    req.firebaseUser = decodedToken;
    
    next();
  } catch (error) {
    // Don't fail for optional auth
    req.user = null;
    req.firebaseUser = null;
    next();
  }
};

// Check if user owns resource
const checkOwnership = (modelClass, paramName = 'id', userIdField = 'user_id') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[paramName];
      const resource = await modelClass.findByPk(resourceId);
      
      if (!resource) {
        return res.status(404).json({ 
          error: 'Not Found', 
          message: 'Resource not found' 
        });
      }
      
      if (resource[userIdField] !== req.user.id) {
        return res.status(403).json({ 
          error: 'Forbidden', 
          message: 'You do not have permission to access this resource' 
        });
      }
      
      req.resource = resource;
      next();
    } catch (error) {
      console.error('Ownership check error:', error);
      return res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Error checking resource ownership' 
      });
    }
  };
};

// Check subscription tier
const requireSubscription = (requiredTier = 'pro') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Authentication required' 
      });
    }
    
    const tierLevels = { free: 0, pro: 1 };
    const userTierLevel = tierLevels[req.user.subscription_tier] || 0;
    const requiredTierLevel = tierLevels[requiredTier] || 1;
    
    if (userTierLevel < requiredTierLevel) {
      return res.status(403).json({ 
        error: 'Subscription Required', 
        message: `This feature requires a ${requiredTier} subscription` 
      });
    }
    
    next();
  };
};

module.exports = {
  initializeFirebase,
  verifyFirebaseToken,
  optionalAuth,
  checkOwnership,
  requireSubscription
};