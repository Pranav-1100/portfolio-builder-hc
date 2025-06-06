const { sequelize, testConnection } = require('./database');
const models = require('../models');

// Sample templates data
const templatesSeedData = [
  {
    id: 'modern-dev',
    name: 'Modern Developer',
    description: 'A sleek, modern portfolio template perfect for developers and tech professionals',
    preview_image_url: '/static/templates/modern-dev-preview.jpg',
    config: JSON.stringify({
      sections: ['hero', 'about', 'projects', 'skills', 'experience', 'contact'],
      customizable: {
        colors: true,
        fonts: true,
        layout: true,
        animations: true
      },
      features: [
        'Responsive design',
        'Dark theme',
        'Particle effects',
        'Smooth animations',
        'GitHub integration',
        'Project showcases'
      ],
      color_scheme: {
        primary: '#c770f0',
        secondary: '#623686',
        accent: '#8a49a8',
        background: '#0c0513',
        text: '#ffffff'
      }
    }),
    is_premium: false
  },
  {
    id: 'minimal',
    name: 'Minimal Professional',
    description: 'Clean and minimal design focusing on content and readability',
    preview_image_url: '/static/templates/minimal-preview.jpg',
    config: JSON.stringify({
      sections: ['hero', 'about', 'projects', 'experience', 'contact'],
      customizable: {
        colors: true,
        fonts: true,
        layout: false,
        animations: false
      },
      features: [
        'Clean design',
        'Fast loading',
        'Print friendly',
        'SEO optimized',
        'Accessibility focused'
      ],
      color_scheme: {
        primary: '#2563eb',
        secondary: '#64748b',
        accent: '#0ea5e9',
        background: '#ffffff',
        text: '#1e293b'
      }
    }),
    is_premium: false
  },
  {
    id: 'creative',
    name: 'Creative Portfolio',
    description: 'Bold and creative template for designers and creative professionals',
    preview_image_url: '/static/templates/creative-preview.jpg',
    config: JSON.stringify({
      sections: ['hero', 'about', 'projects', 'gallery', 'contact'],
      customizable: {
        colors: true,
        fonts: true,
        layout: true,
        animations: true
      },
      features: [
        'Visual focused',
        'Gallery support',
        'Creative layouts',
        'Bold typography',
        'Interactive elements'
      ],
      color_scheme: {
        primary: '#f59e0b',
        secondary: '#ef4444',
        accent: '#8b5cf6',
        background: '#1f2937',
        text: '#f9fafb'
      }
    }),
    is_premium: true
  }
];

// Sample user data (for development)
const sampleUserData = {
  id: 'sample-user-123',
  email: 'demo@portfoliobuilder.com',
  username: 'demo-user',
  full_name: 'Demo User',
  firebase_uid: 'demo-firebase-uid',
  subscription_tier: 'free'
};

// Sample portfolio data
const samplePortfolioData = {
  id: 'sample-portfolio-123',
  user_id: 'sample-user-123',
  title: 'Demo Portfolio',
  slug: 'demo-portfolio',
  status: 'published',
  template_id: 'modern-dev',
  is_public: true,
  content: JSON.stringify({
    hero: {
      name: 'Demo User',
      title: 'Full Stack Developer',
      bio: 'Passionate developer creating innovative web solutions',
      image: 'https://via.placeholder.com/350',
      social_links: {
        github: 'https://github.com/demo-user',
        linkedin: 'https://linkedin.com/in/demo-user',
        email: 'demo@portfoliobuilder.com'
      }
    },
    about: {
      description: 'I am a passionate full-stack developer with experience in modern web technologies. I love solving complex problems and building user-friendly applications.',
      skills: ['JavaScript', 'React', 'Node.js', 'Python', 'MongoDB', 'Express'],
      interests: ['Open Source', 'Machine Learning', 'Web Development']
    },
    projects: [
      {
        title: 'Portfolio Builder',
        description: 'AI-powered portfolio generation platform',
        tech_stack: ['React', 'Node.js', 'OpenAI'],
        github_url: 'https://github.com/demo/portfolio-builder',
        live_url: 'https://portfolio-builder.demo.com'
      },
      {
        title: 'E-commerce Platform',
        description: 'Modern e-commerce solution with real-time features',
        tech_stack: ['Next.js', 'Stripe', 'PostgreSQL'],
        github_url: 'https://github.com/demo/ecommerce',
        live_url: 'https://ecommerce.demo.com'
      }
    ],
    contact: {
      email: 'demo@portfoliobuilder.com',
      location: 'San Francisco, CA',
      social_links: {
        github: 'https://github.com/demo-user',
        linkedin: 'https://linkedin.com/in/demo-user'
      }
    }
  })
};

async function seed() {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Test connection
    await testConnection();
    
    // Check if we should clean existing data
    const clean = process.argv.includes('--clean');
    
    if (clean) {
      console.log('🧹 Cleaning existing data...');
      
      // Delete in correct order (reverse of dependencies)
      await models.PortfolioIteration.destroy({ where: {} });
      await models.Integration.destroy({ where: {} });
      await models.Portfolio.destroy({ where: {} });
      await models.User.destroy({ where: {} });
      
      console.log('✅ Existing data cleaned');
    }
    
    // Seed templates
    console.log('📝 Seeding templates...');
    for (const template of templatesSeedData) {
      await sequelize.query(
        `INSERT OR REPLACE INTO templates (id, name, description, preview_image_url, config, is_premium, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        {
          replacements: [
            template.id,
            template.name,
            template.description,
            template.preview_image_url,
            template.config,
            template.is_premium ? 1 : 0
          ]
        }
      );
    }
    console.log(`✅ Seeded ${templatesSeedData.length} templates`);
    
    // Seed sample user (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log('👤 Seeding sample user...');
      
      const existingUser = await models.User.findByPk(sampleUserData.id);
      if (!existingUser) {
        await models.User.create(sampleUserData);
        console.log('✅ Sample user created');
        
        // Seed sample portfolio
        console.log('📄 Seeding sample portfolio...');
        await models.Portfolio.create(samplePortfolioData);
        console.log('✅ Sample portfolio created');
      } else {
        console.log('ℹ️  Sample user already exists');
      }
    }
    
    console.log('✅ Database seeding completed successfully!');
    
    // Show summary
    const templateCount = await sequelize.query('SELECT COUNT(*) as count FROM templates', {
      type: sequelize.QueryTypes.SELECT
    });
    
    const userCount = await sequelize.query('SELECT COUNT(*) as count FROM users', {
      type: sequelize.QueryTypes.SELECT
    });
    
    const portfolioCount = await sequelize.query('SELECT COUNT(*) as count FROM portfolios', {
      type: sequelize.QueryTypes.SELECT
    });
    
    console.log('📊 Database summary:');
    console.log(`   Templates: ${templateCount[0].count}`);
    console.log(`   Users: ${userCount[0].count}`);
    console.log(`   Portfolios: ${portfolioCount[0].count}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run seeding if called directly
if (require.main === module) {
  seed();
}

module.exports = { seed };