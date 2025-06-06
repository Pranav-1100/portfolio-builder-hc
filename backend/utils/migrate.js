const { sequelize, testConnection, initDatabase } = require('./database');
const models = require('../models');

async function migrate() {
  try {
    console.log('🔄 Starting database migration...');
    
    // Test connection
    await testConnection();
    
    // Force sync all models (be careful in production!)
    const force = process.argv.includes('--force');
    
    if (force) {
      console.log('⚠️  FORCE SYNC: This will drop all existing tables!');
      console.log('⚠️  Use only in development environment!');
      
      if (process.env.NODE_ENV === 'production') {
        console.error('❌ Force sync is not allowed in production!');
        process.exit(1);
      }
      
      // Wait 3 seconds for user to cancel if needed
      console.log('⏳ Starting in 3 seconds... (Ctrl+C to cancel)');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Sync database
    await sequelize.sync({ force });
    
    console.log('✅ Database migration completed successfully!');
    
    // Show table info
    const tables = await sequelize.getQueryInterface().showAllTables();
    console.log(`📊 Created ${tables.length} tables:`, tables.join(', '));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  migrate();
}

module.exports = { migrate };