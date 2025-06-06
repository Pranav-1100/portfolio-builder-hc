# 🚀 Portfolio Builder - AI-Powered Portfolio Generator

> Create stunning professional portfolios in minutes using AI and multiple data sources

## ✨ Features

- **🤖 AI-Powered Generation**: Generate portfolios from GitHub, resumes, or text prompts
- **🔗 Multiple Integrations**: Connect GitHub, LinkedIn, LeetCode, and more
- **🎨 Professional Templates**: Clean, modern designs optimized for different industries
- **⚡ Real-time Preview**: See changes instantly as you edit
- **🔄 Smart Iteration**: Enhance your portfolio using natural language prompts
- **🌐 One-Click Deploy**: Get a shareable link with custom subdomain
- **📊 Analytics**: Track portfolio views and engagement


## 🚀 Quick Start

### Prerequisites

- Node.js >= 16.0.0
- PostgreSQL 12+
- Firebase project (for authentication)
- OpenAI API key

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/portfolio-builder.git
cd portfolio-builder
```

### 2. Backend Setup

```bash
cd backend
npm install
# Configure your .env file
npm run db:migrate
npm run db:seed
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Configure your .env.local file
npm run dev
```

### 4. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

## 🛠️ Technology Stack

### Backend
- **Runtime**: Node.js + Express
- **Authentication**: Firebase Auth
- **AI Integration**: OpenAI GPT-4
- **File Storage**: Local/Cloud storage
- **Rate Limiting**: Express rate limiter

### Frontend
- **Framework**: Next.js 14 (React)
- **Styling**: Tailwind CSS
- **State Management**: React Context + Hooks
- **Authentication**: Firebase Auth
- **Forms**: React Hook Form
- **UI Components**: Headless UI

### Integrations
- **GitHub API**: Repository and profile data
- **Resume Parsing**: PDF/DOC text extraction
- **Web Scraping**: LinkedIn, LeetCode profiles
- **Deployment**: Static site generation

## 🚀 Deployment

### Production Environment

1. **Backend**: Deploy to Nest, Heroku, or any Node.js hosting
2. **Frontend**: Deploy to Vercel, Netlify, or static hosting
3. **Database**: PostgreSQL on Railway, Supabase, or managed service


## 📊 Project Status

- ✅ **Backend API**: Complete and functional
- 🚧 **Frontend**: In development 
- 🚧 **AI Generation**: Core features implemented
- 🚧 **Integrations**: GitHub complete, others in progress
- 🚧 **Templates**: Basic templates available
- 🚧 **Deployment**: Local deployment working
