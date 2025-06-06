const axios = require('axios');

class GitHubService {
  constructor() {
    this.baseURL = 'https://api.github.com';
    this.graphqlURL = 'https://api.github.com/graphql';
    
    // Create axios instance with default headers
    this.api = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Portfolio-Builder-App'
      }
    });
    
    // Add GitHub token if available
    if (process.env.GITHUB_TOKEN) {
      this.api.defaults.headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
    }
  }

  // Get user profile information
  async getUserProfile(username, accessToken = null) {
    try {
      const headers = {};
      if (accessToken) {
        headers.Authorization = `token ${accessToken}`;
      }

      const response = await this.api.get(`/users/${username}`, { headers });
      
      return {
        success: true,
        data: {
          username: response.data.login,
          name: response.data.name,
          bio: response.data.bio,
          avatar_url: response.data.avatar_url,
          location: response.data.location,
          company: response.data.company,
          blog: response.data.blog,
          email: response.data.email,
          public_repos: response.data.public_repos,
          followers: response.data.followers,
          following: response.data.following,
          created_at: response.data.created_at,
          updated_at: response.data.updated_at
        }
      };
    } catch (error) {
      console.error('GitHub profile fetch error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch GitHub profile'
      };
    }
  }

  // Get user repositories
  async getUserRepositories(username, accessToken = null, options = {}) {
    try {
      const {
        sort = 'updated',
        direction = 'desc',
        per_page = 30,
        type = 'owner'
      } = options;

      const headers = {};
      if (accessToken) {
        headers.Authorization = `token ${accessToken}`;
      }

      const response = await this.api.get(`/users/${username}/repos`, {
        headers,
        params: {
          sort,
          direction,
          per_page,
          type
        }
      });

      const repositories = response.data.map(repo => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        html_url: repo.html_url,
        clone_url: repo.clone_url,
        homepage: repo.homepage,
        language: repo.language,
        languages_url: repo.languages_url,
        stargazers_count: repo.stargazers_count,
        watchers_count: repo.watchers_count,
        forks_count: repo.forks_count,
        created_at: repo.created_at,
        updated_at: repo.updated_at,
        pushed_at: repo.pushed_at,
        size: repo.size,
        topics: repo.topics || [],
        private: repo.private,
        fork: repo.fork,
        archived: repo.archived,
        disabled: repo.disabled
      }));

      return {
        success: true,
        data: repositories
      };
    } catch (error) {
      console.error('GitHub repositories fetch error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch GitHub repositories'
      };
    }
  }

  // Get repository languages
  async getRepositoryLanguages(username, repoName, accessToken = null) {
    try {
      const headers = {};
      if (accessToken) {
        headers.Authorization = `token ${accessToken}`;
      }

      const response = await this.api.get(`/repos/${username}/${repoName}/languages`, { headers });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('GitHub languages fetch error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch repository languages'
      };
    }
  }

  // Get repository README
  async getRepositoryReadme(username, repoName, accessToken = null) {
    try {
      const headers = {};
      if (accessToken) {
        headers.Authorization = `token ${accessToken}`;
      }

      const response = await this.api.get(`/repos/${username}/${repoName}/readme`, { headers });
      
      // Decode base64 content
      const content = Buffer.from(response.data.content, 'base64').toString('utf8');
      
      return {
        success: true,
        data: {
          content: content,
          encoding: response.data.encoding,
          size: response.data.size,
          name: response.data.name,
          path: response.data.path
        }
      };
    } catch (error) {
      console.error('GitHub README fetch error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || 'README not found'
      };
    }
  }

  // Get user's profile README (username/username repository)
  async getProfileReadme(username, accessToken = null) {
    return await this.getRepositoryReadme(username, username, accessToken);
  }

  // Get pinned repositories using GraphQL
  async getPinnedRepositories(username, accessToken = null) {
    try {
      const query = `
        query($username: String!) {
          user(login: $username) {
            pinnedItems(first: 6, types: [REPOSITORY]) {
              edges {
                node {
                  ... on Repository {
                    id
                    name
                    description
                    url
                    homepageUrl
                    primaryLanguage {
                      name
                      color
                    }
                    languages(first: 10) {
                      edges {
                        node {
                          name
                          color
                        }
                      }
                    }
                    stargazerCount
                    forkCount
                    createdAt
                    updatedAt
                    repositoryTopics(first: 10) {
                      edges {
                        node {
                          topic {
                            name
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const headers = {
        'Authorization': `Bearer ${accessToken || process.env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json'
      };

      const response = await axios.post(this.graphqlURL, {
        query,
        variables: { username }
      }, { headers });

      if (response.data.errors) {
        throw new Error(response.data.errors[0].message);
      }

      const pinnedItems = response.data.data.user?.pinnedItems?.edges || [];
      
      const repositories = pinnedItems.map(edge => ({
        id: edge.node.id,
        name: edge.node.name,
        description: edge.node.description,
        html_url: edge.node.url,
        homepage: edge.node.homepageUrl,
        primary_language: edge.node.primaryLanguage?.name,
        languages: edge.node.languages.edges.map(lang => lang.node.name),
        stargazers_count: edge.node.stargazerCount,
        forks_count: edge.node.forkCount,
        created_at: edge.node.createdAt,
        updated_at: edge.node.updatedAt,
        topics: edge.node.repositoryTopics.edges.map(topic => topic.node.topic.name)
      }));

      return {
        success: true,
        data: repositories
      };
    } catch (error) {
      console.error('GitHub pinned repositories fetch error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.message || 'Failed to fetch pinned repositories'
      };
    }
  }

  // Get user's contribution graph
  async getContributionGraph(username, accessToken = null) {
    try {
      const query = `
        query($username: String!) {
          user(login: $username) {
            contributionsCollection {
              contributionCalendar {
                totalContributions
                weeks {
                  contributionDays {
                    contributionCount
                    date
                  }
                }
              }
            }
          }
        }
      `;

      const headers = {
        'Authorization': `Bearer ${accessToken || process.env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json'
      };

      const response = await axios.post(this.graphqlURL, {
        query,
        variables: { username }
      }, { headers });

      if (response.data.errors) {
        throw new Error(response.data.errors[0].message);
      }

      const calendar = response.data.data.user?.contributionsCollection?.contributionCalendar;
      
      return {
        success: true,
        data: {
          total_contributions: calendar?.totalContributions || 0,
          weeks: calendar?.weeks || []
        }
      };
    } catch (error) {
      console.error('GitHub contribution graph fetch error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.message || 'Failed to fetch contribution graph'
      };
    }
  }

  // Get comprehensive user data (combines multiple API calls)
  async getComprehensiveUserData(username, accessToken = null) {
    try {
      console.log(`Fetching comprehensive GitHub data for: ${username}`);
      
      // Fetch all data in parallel
      const [
        profileResult,
        repositoriesResult,
        pinnedResult,
        contributionResult,
        profileReadmeResult
      ] = await Promise.allSettled([
        this.getUserProfile(username, accessToken),
        this.getUserRepositories(username, accessToken, { per_page: 10 }),
        this.getPinnedRepositories(username, accessToken),
        this.getContributionGraph(username, accessToken),
        this.getProfileReadme(username, accessToken)
      ]);

      // Process results
      const profile = profileResult.status === 'fulfilled' && profileResult.value.success 
        ? profileResult.value.data 
        : null;

      const repositories = repositoriesResult.status === 'fulfilled' && repositoriesResult.value.success 
        ? repositoriesResult.value.data 
        : [];

      const pinnedRepos = pinnedResult.status === 'fulfilled' && pinnedResult.value.success 
        ? pinnedResult.value.data 
        : [];

      const contributions = contributionResult.status === 'fulfilled' && contributionResult.value.success 
        ? contributionResult.value.data 
        : null;

      const profileReadme = profileReadmeResult.status === 'fulfilled' && profileReadmeResult.value.success 
        ? profileReadmeResult.value.data.content 
        : null;

      // Get languages for top repositories
      const topRepos = repositories.slice(0, 5);
      const languagePromises = topRepos.map(repo => 
        this.getRepositoryLanguages(username, repo.name, accessToken)
      );
      
      const languageResults = await Promise.allSettled(languagePromises);
      
      // Aggregate languages
      const allLanguages = {};
      languageResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
          const repoLanguages = result.value.data;
          Object.entries(repoLanguages).forEach(([lang, bytes]) => {
            allLanguages[lang] = (allLanguages[lang] || 0) + bytes;
          });
        }
      });

      // Sort languages by usage
      const sortedLanguages = Object.entries(allLanguages)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([name, bytes]) => ({ name, bytes }));

      return {
        success: true,
        data: {
          profile,
          repositories: repositories.slice(0, 10), // Top 10 repos
          pinned_repositories: pinnedRepos,
          languages: sortedLanguages,
          contribution_graph: contributions,
          profile_readme: profileReadme,
          stats: {
            total_repos: repositories.length,
            total_stars: repositories.reduce((sum, repo) => sum + repo.stargazers_count, 0),
            total_forks: repositories.reduce((sum, repo) => sum + repo.forks_count, 0)
          }
        }
      };
    } catch (error) {
      console.error('Comprehensive GitHub data fetch error:', error);
      return {
        success: false,
        error: 'Failed to fetch comprehensive GitHub data'
      };
    }
  }

  // Validate GitHub username
  async validateUsername(username) {
    try {
      const response = await this.api.head(`/users/${username}`);
      return { success: true, exists: response.status === 200 };
    } catch (error) {
      if (error.response?.status === 404) {
        return { success: true, exists: false };
      }
      return { success: false, error: 'Failed to validate username' };
    }
  }

  // Get rate limit info
  async getRateLimit(accessToken = null) {
    try {
      const headers = {};
      if (accessToken) {
        headers.Authorization = `token ${accessToken}`;
      }

      const response = await this.api.get('/rate_limit', { headers });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('GitHub rate limit fetch error:', error.response?.data || error.message);
      return {
        success: false,
        error: 'Failed to fetch rate limit'
      };
    }
  }
}

module.exports = new GitHubService();