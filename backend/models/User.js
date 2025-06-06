const { DataTypes } = require('sequelize');
const { sequelize } = require('../utils/database');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      len: [3, 30],
      is: /^[a-zA-Z0-9_-]+$/
    }
  },
  full_name: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: [0, 100]
    }
  },
  avatar_url: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      isUrl: true
    }
  },
  firebase_uid: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  github_id: {
    type: DataTypes.STRING,
    allowNull: true
  },
  google_id: {
    type: DataTypes.STRING,
    allowNull: true
  },
  subscription_tier: {
    type: DataTypes.ENUM('free', 'pro'),
    defaultValue: 'free'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  last_login_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['email']
    },
    {
      unique: true,
      fields: ['username']
    },
    {
      unique: true,
      fields: ['firebase_uid']
    }
  ]
});

// Instance methods
User.prototype.toJSON = function() {
  const user = this.get();
  delete user.firebase_uid; // Don't expose Firebase UID in responses
  return user;
};

User.prototype.updateLastLogin = async function() {
  this.last_login_at = new Date();
  await this.save();
};

// Static methods
User.findByFirebaseUid = async function(firebaseUid) {
  return await this.findOne({ where: { firebase_uid: firebaseUid } });
};

User.findByEmail = async function(email) {
  return await this.findOne({ where: { email } });
};

User.findByUsername = async function(username) {
  return await this.findOne({ where: { username } });
};

User.generateUsername = async function(email, preferredUsername = null) {
  // Try preferred username first
  if (preferredUsername) {
    const existing = await this.findByUsername(preferredUsername);
    if (!existing) return preferredUsername;
  }
  
  // Generate from email
  let baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
  let username = baseUsername;
  let counter = 1;
  
  while (await this.findByUsername(username)) {
    username = `${baseUsername}${counter}`;
    counter++;
  }
  
  return username;
};

module.exports = User;