const { DataTypes } = require('sequelize');
const { sequelize } = require('../utils/database');
const { v4: uuidv4 } = require('uuid');

const PortfolioIteration = sequelize.define('PortfolioIteration', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  portfolio_id: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: 'portfolios',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  prompt: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  // Changes made during this iteration as JSON
  changes_made: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: '{}',
    get() {
      const value = this.getDataValue('changes_made');
      try {
        return value ? JSON.parse(value) : {};
      } catch (error) {
        return {};
      }
    },
    set(value) {
      this.setDataValue('changes_made', JSON.stringify(value || {}));
    }
  },
  // Backup of content before this change
  previous_content: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const value = this.getDataValue('previous_content');
      try {
        return value ? JSON.parse(value) : {};
      } catch (error) {
        return {};
      }
    },
    set(value) {
      this.setDataValue('previous_content', JSON.stringify(value || {}));
    }
  },
  iteration_type: {
    type: DataTypes.ENUM('generate', 'enhance', 'fix', 'custom'),
    defaultValue: 'enhance'
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed'),
    defaultValue: 'pending'
  },
  ai_model_used: {
    type: DataTypes.STRING,
    defaultValue: 'gpt-4'
  },
  tokens_used: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  processing_time_ms: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'portfolio_iterations',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['portfolio_id']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['status']
    }
  ]
});

// Instance methods
PortfolioIteration.prototype.markCompleted = async function(changesMade, tokensUsed = 0, processingTime = 0) {
  this.status = 'completed';
  this.changes_made = changesMade;
  this.tokens_used = tokensUsed;
  this.processing_time_ms = processingTime;
  await this.save();
};

PortfolioIteration.prototype.markFailed = async function(errorMessage) {
  this.status = 'failed';
  this.error_message = errorMessage;
  await this.save();
};

// Static methods
PortfolioIteration.findByPortfolio = async function(portfolioId, limit = 10) {
  return await this.findAll({
    where: { portfolio_id: portfolioId },
    order: [['created_at', 'DESC']],
    limit
  });
};

PortfolioIteration.getLatestByPortfolio = async function(portfolioId) {
  return await this.findOne({
    where: { 
      portfolio_id: portfolioId,
      status: 'completed'
    },
    order: [['created_at', 'DESC']]
  });
};

PortfolioIteration.getIterationStats = async function(portfolioId) {
  const iterations = await this.findAll({
    where: { portfolio_id: portfolioId },
    attributes: [
      'status',
      'iteration_type',
      'tokens_used',
      'processing_time_ms'
    ]
  });

  const stats = {
    total: iterations.length,
    completed: iterations.filter(i => i.status === 'completed').length,
    failed: iterations.filter(i => i.status === 'failed').length,
    pending: iterations.filter(i => i.status === 'pending').length,
    total_tokens: iterations.reduce((sum, i) => sum + i.tokens_used, 0),
    avg_processing_time: 0,
    types: {
      generate: iterations.filter(i => i.iteration_type === 'generate').length,
      enhance: iterations.filter(i => i.iteration_type === 'enhance').length,
      fix: iterations.filter(i => i.iteration_type === 'fix').length,
      custom: iterations.filter(i => i.iteration_type === 'custom').length
    }
  };

  const completedIterations = iterations.filter(i => i.status === 'completed');
  if (completedIterations.length > 0) {
    stats.avg_processing_time = Math.round(
      completedIterations.reduce((sum, i) => sum + i.processing_time_ms, 0) / completedIterations.length
    );
  }

  return stats;
};

module.exports = PortfolioIteration;