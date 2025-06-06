const User = require('./User');
const Portfolio = require('./Portfolio');
const Integration = require('./Integration');
const PortfolioIteration = require('./PortfolioIteration');

// Define associations

// User associations
User.hasMany(Portfolio, {
  foreignKey: 'user_id',
  as: 'portfolios',
  onDelete: 'CASCADE'
});

User.hasMany(Integration, {
  foreignKey: 'user_id',
  as: 'integrations',
  onDelete: 'CASCADE'
});

// Portfolio associations
Portfolio.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
});

Portfolio.hasMany(PortfolioIteration, {
  foreignKey: 'portfolio_id',
  as: 'iterations',
  onDelete: 'CASCADE'
});

// Integration associations
Integration.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
});

// PortfolioIteration associations
PortfolioIteration.belongsTo(Portfolio, {
  foreignKey: 'portfolio_id',
  as: 'portfolio'
});

// Export all models
module.exports = {
  User,
  Portfolio,
  Integration,
  PortfolioIteration
};