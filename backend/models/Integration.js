const { DataTypes } = require('sequelize');
const { sequelize } = require('../utils/database');
const { v4: uuidv4 } = require('uuid');

const Integration = sequelize.define('Integration', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  user_id: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  platform: {
    type: DataTypes.ENUM('github', 'linkedin', 'leetcode'),
    allowNull: false
  },
  platform_user_id: {
    type: DataTypes.STRING,
    allowNull: true
  },
  platform_username: {
    type: DataTypes.STRING,
    allowNull: true
  },
  access_token: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  refresh_token: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Cached profile data as JSON
  profile_data: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: '{}',
    get() {
      const value = this.getDataValue('profile_data');
      try {
        return value ? JSON.parse(value) : {};
      } catch (error) {
        return {};
      }
    },
    set(value) {
      this.setDataValue('profile_data', JSON.stringify(value || {}));
    }
  },
  last_synced_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  sync_status: {
    type: DataTypes.ENUM('pending', 'success', 'error', 'never'),
    defaultValue: 'never'
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'integrations',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['platform']
    },
    {
      unique: true,
      fields: ['user_id', 'platform']
    }
  ]
});

// Instance methods
Integration.prototype.updateProfileData = async function(data) {
  this.profile_data = { ...this.profile_data, ...data };
  this.last_synced_at = new Date();
  this.sync_status = 'success';
  this.error_message = null;
  await this.save();
};

Integration.prototype.markSyncError = async function(errorMessage) {
  this.sync_status = 'error';
  this.error_message = errorMessage;
  await this.save();
};

Integration.prototype.markSyncPending = async function() {
  this.sync_status = 'pending';
  this.error_message = null;
  await this.save();
};

Integration.prototype.isStale = function(maxAgeHours = 24) {
  if (!this.last_synced_at) return true;
  
  const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
  const now = new Date();
  const lastSync = new Date(this.last_synced_at);
  
  return (now - lastSync) > maxAge;
};

// Static methods
Integration.findByUserAndPlatform = async function(userId, platform) {
  return await this.findOne({
    where: {
      user_id: userId,
      platform: platform
    }
  });
};

Integration.findActiveByUser = async function(userId) {
  return await this.findAll({
    where: {
      user_id: userId,
      is_active: true
    }
  });
};

Integration.findStaleIntegrations = async function(maxAgeHours = 24) {
  const cutoffTime = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));
  
  return await this.findAll({
    where: {
      is_active: true,
      [sequelize.Op.or]: [
        { last_synced_at: null },
        { last_synced_at: { [sequelize.Op.lt]: cutoffTime } }
      ]
    }
  });
};

// Default profile data structures for different platforms
Integration.getDefaultProfileData = function(platform) {
  const defaults = {
    github: {
      username: '',
      name: '',
      bio: '',
      avatar_url: '',
      public_repos: 0,
      followers: 0,
      following: 0,
      location: '',
      company: '',
      blog: '',
      repositories: [],
      pinned_repos: [],
      contribution_graph: {},
      languages: {},
      profile_readme: ''
    },
    linkedin: {
      name: '',
      headline: '',
      summary: '',
      location: '',
      industry: '',
      experience: [],
      education: [],
      skills: [],
      profile_picture: ''
    },
    leetcode: {
      username: '',
      ranking: 0,
      problems_solved: 0,
      acceptance_rate: 0,
      easy_solved: 0,
      medium_solved: 0,
      hard_solved: 0,
      contest_rating: 0,
      badges: [],
      recent_submissions: []
    }
  };
  
  return defaults[platform] || {};
};

module.exports = Integration;