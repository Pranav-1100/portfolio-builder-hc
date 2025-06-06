const { DataTypes } = require('sequelize');
const { sequelize } = require('../utils/database');
const { v4: uuidv4 } = require('uuid');

const Portfolio = sequelize.define('Portfolio', {
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
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [1, 255]
    }
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [1, 255],
      is: /^[a-zA-Z0-9_-]+$/
    }
  },
  status: {
    type: DataTypes.ENUM('draft', 'published', 'archived'),
    defaultValue: 'draft'
  },
  template_id: {
    type: DataTypes.STRING,
    defaultValue: 'modern-dev'
  },
  // Portfolio content as JSON string (will be JSONB in PostgreSQL)
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: '{}',
    get() {
      const value = this.getDataValue('content');
      try {
        return value ? JSON.parse(value) : {};
      } catch (error) {
        return {};
      }
    },
    set(value) {
      this.setDataValue('content', JSON.stringify(value || {}));
    }
  },
  // Generated HTML, CSS, JS for preview
  generated_html: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  generated_css: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  generated_js: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Metadata
  view_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  is_public: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  meta_title: {
    type: DataTypes.STRING,
    allowNull: true
  },
  meta_description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  published_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'portfolios',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['status']
    },
    {
      fields: ['slug']
    },
    {
      unique: true,
      fields: ['user_id', 'slug']
    }
  ]
});

// Instance methods
Portfolio.prototype.publish = async function() {
  this.status = 'published';
  this.is_public = true;
  this.published_at = new Date();
  await this.save();
};

Portfolio.prototype.unpublish = async function() {
  this.status = 'draft';
  this.is_public = false;
  this.published_at = null;
  await this.save();
};

Portfolio.prototype.incrementView = async function() {
  this.view_count += 1;
  await this.save();
};

Portfolio.prototype.updateContent = async function(newContent) {
  this.content = { ...this.content, ...newContent };
  await this.save();
};

Portfolio.prototype.setGeneratedFiles = async function(html, css = null, js = null) {
  this.generated_html = html;
  if (css) this.generated_css = css;
  if (js) this.generated_js = js;
  await this.save();
};

// Static methods
Portfolio.findByUserAndSlug = async function(userId, slug) {
  return await this.findOne({ 
    where: { 
      user_id: userId, 
      slug 
    }
  });
};

Portfolio.findPublishedBySlug = async function(slug) {
  return await this.findOne({ 
    where: { 
      slug,
      status: 'published',
      is_public: true
    }
  });
};

Portfolio.generateSlug = async function(userId, title) {
  // Create base slug from title
  let baseSlug = title
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
  
  let slug = baseSlug;
  let counter = 1;
  
  // Check if slug exists for this user
  while (await this.findByUserAndSlug(userId, slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  return slug;
};

// Default portfolio content structure
Portfolio.getDefaultContent = function() {
  return {
    hero: {
      name: '',
      title: '',
      bio: '',
      image: '',
      social_links: {
        github: '',
        linkedin: '',
        email: ''
      }
    },
    about: {
      description: '',
      skills: [],
      interests: []
    },
    projects: [],
    experience: [],
    education: [],
    contact: {
      email: '',
      phone: '',
      location: '',
      social_links: {}
    }
  };
};

module.exports = Portfolio;