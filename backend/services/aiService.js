const OpenAI = require('openai');

class AIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.models = {
      primary: 'gpt-4',
      fallback: 'gpt-3.5-turbo',
      cheap: 'gpt-3.5-turbo'
    };
  }

  // Generate portfolio content from sources
  async generatePortfolio(sources, preferences = {}) {
    try {
      const prompt = this._buildPortfolioGenerationPrompt(sources, preferences);
      
      const response = await this.openai.chat.completions.create({
        model: this.models.primary,
        messages: [
          {
            role: 'system',
            content: this._getSystemPrompt('portfolio_generation')
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      });

      const content = response.choices[0].message.content;
      const parsedContent = this._parsePortfolioContent(content);
      
      return {
        success: true,
        content: parsedContent,
        tokensUsed: response.usage.total_tokens,
        model: this.models.primary
      };
    } catch (error) {
      console.error('Portfolio generation error:', error);
      
      // Try with fallback model
      if (error.code === 'model_overloaded') {
        return await this._generateWithFallback(sources, preferences);
      }
      
      throw error;
    }
  }

  // Enhance specific portfolio section
  async enhanceSection(currentContent, section, prompt, context = {}) {
    try {
      const enhancementPrompt = this._buildSectionEnhancementPrompt(
        currentContent, 
        section, 
        prompt, 
        context
      );
      
      const response = await this.openai.chat.completions.create({
        model: this.models.cheap, // Use cheaper model for enhancements
        messages: [
          {
            role: 'system',
            content: this._getSystemPrompt('section_enhancement')
          },
          {
            role: 'user',
            content: enhancementPrompt
          }
        ],
        temperature: 0.6,
        max_tokens: 2000
      });

      const enhancedContent = response.choices[0].message.content;
      const parsedContent = this._parseSectionContent(enhancedContent, section);
      
      return {
        success: true,
        content: parsedContent,
        tokensUsed: response.usage.total_tokens,
        model: this.models.cheap
      };
    } catch (error) {
      console.error('Section enhancement error:', error);
      throw error;
    }
  }

  // Generate project descriptions from GitHub repos
  async generateProjectDescriptions(repositories) {
    try {
      const prompt = this._buildProjectDescriptionPrompt(repositories);
      
      const response = await this.openai.chat.completions.create({
        model: this.models.cheap,
        messages: [
          {
            role: 'system',
            content: this._getSystemPrompt('project_description')
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 3000
      });

      const content = response.choices[0].message.content;
      const projects = this._parseProjectDescriptions(content, repositories);
      
      return {
        success: true,
        projects: projects,
        tokensUsed: response.usage.total_tokens,
        model: this.models.cheap
      };
    } catch (error) {
      console.error('Project description generation error:', error);
      throw error;
    }
  }

  // Generate professional bio from user data
  async generateBio(userData, style = 'professional') {
    try {
      const prompt = this._buildBioGenerationPrompt(userData, style);
      
      const response = await this.openai.chat.completions.create({
        model: this.models.cheap,
        messages: [
          {
            role: 'system',
            content: this._getSystemPrompt('bio_generation')
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 500
      });

      return {
        success: true,
        bio: response.choices[0].message.content.trim(),
        tokensUsed: response.usage.total_tokens,
        model: this.models.cheap
      };
    } catch (error) {
      console.error('Bio generation error:', error);
      throw error;
    }
  }

  // Parse resume content and extract structured data
  async parseResumeContent(resumeText) {
    try {
      const prompt = this._buildResumeParsingPrompt(resumeText);
      
      const response = await this.openai.chat.completions.create({
        model: this.models.cheap,
        messages: [
          {
            role: 'system',
            content: this._getSystemPrompt('resume_parsing')
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3, // Lower temperature for parsing
        max_tokens: 3000
      });

      const content = response.choices[0].message.content;
      const parsedData = this._parseResumeData(content);
      
      return {
        success: true,
        data: parsedData,
        tokensUsed: response.usage.total_tokens,
        model: this.models.cheap
      };
    } catch (error) {
      console.error('Resume parsing error:', error);
      throw error;
    }
  }

  // Private helper methods

  _buildPortfolioGenerationPrompt(sources, preferences) {
    let prompt = 'Generate a professional portfolio based on the following sources:\n\n';
    
    sources.forEach((source, index) => {
      prompt += `Source ${index + 1} (${source.type}):\n`;
      
      if (source.type === 'github') {
        prompt += `GitHub Data: ${JSON.stringify(source.data, null, 2)}\n\n`;
      } else if (source.type === 'resume') {
        prompt += `Resume Content: ${source.data.text}\n\n`;
      } else if (source.type === 'prompt') {
        prompt += `User Description: ${source.data.description}\n\n`;
      }
    });
    
    if (Object.keys(preferences).length > 0) {
      prompt += `Preferences: ${JSON.stringify(preferences, null, 2)}\n\n`;
    }
    
    prompt += 'Generate a complete portfolio with hero, about, projects, and contact sections.';
    return prompt;
  }

  _buildSectionEnhancementPrompt(currentContent, section, userPrompt, context) {
    return `
Current ${section} section content:
${JSON.stringify(currentContent[section], null, 2)}

User request: ${userPrompt}

Context: ${JSON.stringify(context, null, 2)}

Please enhance this section based on the user's request while maintaining consistency with the overall portfolio.
    `.trim();
  }

  _buildProjectDescriptionPrompt(repositories) {
    let prompt = 'Generate professional project descriptions for the following GitHub repositories:\n\n';
    
    repositories.forEach((repo, index) => {
      prompt += `Repository ${index + 1}:\n`;
      prompt += `Name: ${repo.name}\n`;
      prompt += `Description: ${repo.description || 'No description'}\n`;
      prompt += `Languages: ${repo.languages?.join(', ') || 'Not specified'}\n`;
      prompt += `README excerpt: ${repo.readme || 'No README available'}\n\n`;
    });
    
    prompt += 'Generate engaging, professional descriptions that highlight the technical aspects and value of each project.';
    return prompt;
  }

  _buildBioGenerationPrompt(userData, style) {
    return `
Generate a ${style} bio for a portfolio based on this information:
Name: ${userData.name || ''}
Title: ${userData.title || ''}
Experience: ${userData.experience || ''}
Skills: ${userData.skills?.join(', ') || ''}
Interests: ${userData.interests?.join(', ') || ''}
Company: ${userData.company || ''}
Location: ${userData.location || ''}

Additional context: ${userData.context || ''}

Keep it engaging, professional, and around 2-3 sentences.
    `.trim();
  }

  _buildResumeParsingPrompt(resumeText) {
    return `
Parse the following resume and extract structured data in JSON format:

${resumeText}

Extract the following information:
- Personal information (name, email, phone, location)
- Professional summary/objective
- Work experience (company, title, dates, description)
- Education (institution, degree, dates)
- Skills (technical and soft skills)
- Projects (if any)
- Certifications (if any)

Return the data in a structured JSON format.
    `.trim();
  }

  _getSystemPrompt(type) {
    const prompts = {
      portfolio_generation: `
You are an expert portfolio generator. Create professional, engaging portfolio content that highlights the person's skills and achievements. 

Return the response as a valid JSON object with the following structure:
{
  "hero": {
    "name": "string",
    "title": "string", 
    "bio": "string",
    "social_links": {}
  },
  "about": {
    "description": "string",
    "skills": ["array of skills"],
    "interests": ["array of interests"]
  },
  "projects": [
    {
      "title": "string",
      "description": "string",
      "tech_stack": ["array"],
      "github_url": "string",
      "live_url": "string"
    }
  ],
  "contact": {
    "email": "string",
    "location": "string"
  }
}

Ensure all content is professional, engaging, and highlights the person's strengths.
      `.trim(),
      
      section_enhancement: `
You are an expert content enhancer for professional portfolios. Improve the given section based on the user's request while maintaining professionalism and consistency.

Return only the enhanced content for the specific section in JSON format.
      `.trim(),
      
      project_description: `
You are an expert at writing compelling project descriptions for developer portfolios. Create engaging descriptions that highlight technical skills, problem-solving abilities, and project impact.

Return descriptions as a JSON array of objects with title, description, and key_features fields.
      `.trim(),
      
      bio_generation: `
You are an expert at writing professional bios for portfolios. Create engaging, concise bios that highlight the person's expertise and personality.

Return only the bio text, no additional formatting or JSON.
      `.trim(),
      
      resume_parsing: `
You are an expert at parsing resumes and extracting structured data. Parse the resume content and return well-structured JSON data.

Ensure all dates are in consistent format and all information is accurately extracted.
      `.trim()
    };
    
    return prompts[type] || prompts.portfolio_generation;
  }

  _parsePortfolioContent(content) {
    try {
      // Try to parse as JSON first
      return JSON.parse(content);
    } catch (error) {
      // If JSON parsing fails, try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1]);
        } catch (e) {
          console.error('Failed to parse JSON from code block:', e);
        }
      }
      
      // Fallback: return a basic structure
      return {
        hero: { name: '', title: '', bio: '' },
        about: { description: '', skills: [], interests: [] },
        projects: [],
        contact: { email: '' }
      };
    }
  }

  _parseSectionContent(content, section) {
    try {
      const parsed = JSON.parse(content);
      return parsed;
    } catch (error) {
      // Return the content as-is if parsing fails
      return { [section]: content };
    }
  }

  _parseProjectDescriptions(content, repositories) {
    try {
      const descriptions = JSON.parse(content);
      
      // Match descriptions with repositories
      return repositories.map((repo, index) => ({
        ...repo,
        description: descriptions[index]?.description || repo.description,
        key_features: descriptions[index]?.key_features || []
      }));
    } catch (error) {
      // Return original repositories if parsing fails
      return repositories;
    }
  }

  _parseResumeData(content) {
    try {
      return JSON.parse(content);
    } catch (error) {
      // Return basic structure if parsing fails
      return {
        personal: {},
        experience: [],
        education: [],
        skills: [],
        projects: []
      };
    }
  }

  async _generateWithFallback(sources, preferences) {
    try {
      const prompt = this._buildPortfolioGenerationPrompt(sources, preferences);
      
      const response = await this.openai.chat.completions.create({
        model: this.models.fallback,
        messages: [
          {
            role: 'system',
            content: this._getSystemPrompt('portfolio_generation')
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 3000
      });

      const content = response.choices[0].message.content;
      const parsedContent = this._parsePortfolioContent(content);
      
      return {
        success: true,
        content: parsedContent,
        tokensUsed: response.usage.total_tokens,
        model: this.models.fallback
      };
    } catch (error) {
      console.error('Fallback generation error:', error);
      throw error;
    }
  }
}

module.exports = new AIService();
