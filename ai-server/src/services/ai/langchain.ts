import { ChatOpenAI } from "@langchain/openai";
import { WebBrowser } from "langchain/tools/webbrowser";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "langchain/document";
import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/environment';
import { tavily } from "@tavily/core";
import { Client, RunTree } from "langsmith";
import { LangChainTracer } from "langchain/callbacks";
import { CallbackManager } from "@langchain/core/callbacks/manager";

export class LangchainService {
  private model: ChatOpenAI;
  private embeddings: OpenAIEmbeddings;
  private browser: WebBrowser;
  private supabase;
  private tavilyClient;
  private tracer: LangChainTracer;
  private client: Client;
  private callbackManager: CallbackManager;
  private deflectionClient: Client;
  private deflectionTracer: LangChainTracer;
  private deflectionCallbackManager: CallbackManager;

  constructor() {
    if (!config.openaiKey) {
      throw new Error('OpenAI API key is required');
    }

    if (!config.langsmithApiKey || !config.langsmithProjectName) {
      throw new Error('LangSmith configuration is required');
    }

    // Enable background callbacks
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = 'true';

    // Initialize Langsmith client with shared API key for article generation
    this.client = new Client({
      apiKey: process.env.LANGSMITH_API_KEY,
      apiUrl: process.env.LANGCHAIN_ENDPOINT
    });

    // Add debug logging for client initialization
    console.log('Initializing deflection client with:', {
      apiKey: process.env.LANGSMITH_PROJECT_DEFLECTION_API_KEY?.slice(0, 8) + '...',
      endpoint: process.env.LANGCHAIN_ENDPOINT,
      projectName: process.env.LANGSMITH_PROJECT_DEFLECTION
    });

    // Initialize separate client for chat deflection with proper error handling
    try {
      if (!process.env.LANGSMITH_PROJECT_DEFLECTION_API_KEY) {
        throw new Error('Deflection API key is missing');
      }

      if (!process.env.LANGCHAIN_ENDPOINT) {
        throw new Error('Langchain endpoint is missing');
      }

      this.deflectionClient = new Client({
        apiKey: process.env.LANGSMITH_PROJECT_DEFLECTION_API_KEY,
        apiUrl: process.env.LANGCHAIN_ENDPOINT
      });

      // Verify client initialization
      if (!this.deflectionClient) {
        throw new Error('Failed to initialize deflection client');
      }

      // Test client by creating a test run with proper error handling
      const testRun = async () => {
        try {
          console.log('Creating test run with:', {
            projectName: process.env.LANGSMITH_PROJECT_DEFLECTION,
            apiKey: process.env.LANGSMITH_PROJECT_DEFLECTION_API_KEY?.slice(0, 8) + '...',
            endpoint: process.env.LANGCHAIN_ENDPOINT
          });

          const response = await this.deflectionClient.createRun({
            name: "Test Connection",
            run_type: "chain",
            project_name: process.env.LANGSMITH_PROJECT_DEFLECTION || 'default',
            inputs: { test: true },
            start_time: new Date().toISOString()  // Ensure proper date format
          });

          console.log('Create run response:', {
            success: !!response,
            hasId: !!response?.id,
            type: typeof response,
            response: response  // Log full response for debugging
          });

          if (!response) {
            throw new Error('No response from createRun');
          }

          console.log('Deflection client connection verified:', response.id);
          
          // Clean up test run
          await this.deflectionClient.updateRun(response.id, { 
            status: 'completed',
            end_time: new Date().toISOString()  // Ensure proper date format
          });
        } catch (error) {
          console.error('Deflection client connection test failed:', error);
          // Log more details about the error
          if (error instanceof Error) {
            console.error('Error details:', {
              message: error.message,
              stack: error.stack,
              name: error.name
            });
          }
        }
      };

      // Execute test but don't wait for it
      // testRun();

    } catch (error) {
      console.error('Error initializing deflection client:', error);
      throw error;  // Re-throw to prevent service from starting with invalid client
    }

    // Initialize tracer for article generation
    this.callbackManager = new CallbackManager();
    this.tracer = new LangChainTracer({
      projectName: process.env.LANGSMITH_PROJECT_ARTICLE
    });
    this.callbackManager.addHandler(this.tracer);

    // Initialize separate tracer for chat deflection
    this.deflectionCallbackManager = new CallbackManager();
    this.deflectionTracer = new LangChainTracer({
      projectName: process.env.LANGSMITH_PROJECT_DEFLECTION,
      apiKey: process.env.LANGSMITH_PROJECT_DEFLECTION_API_KEY
    });
    this.deflectionCallbackManager.addHandler(this.deflectionTracer);

    // Add callbacks to model
    this.model = new ChatOpenAI({
      openAIApiKey: config.openaiKey,
      modelName: "gpt-4",
      temperature: 0.7,
      callbacks: this.callbackManager
    });

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: config.openaiKey,
      modelName: "text-embedding-3-small",
      callbacks: this.callbackManager
    });

    this.browser = new WebBrowser({ model: this.model, embeddings: this.embeddings });
    
    if (!config.supabaseUrl || !config.supabaseServiceKey) {
      throw new Error('Supabase configuration is required');
    }
    
    this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

    if (!config.tavilyApiKey) {
      throw new Error('Tavily API key is required');
    }

    this.tavilyClient = tavily({ apiKey: config.tavilyApiKey });
  }

  // Create a proper mock client for fallback
  private createMockClient() {
    return {
      createRun: async () => ({
        id: crypto.randomUUID(), // Generate valid UUID
        patchRun: async () => ({}),
        end: async () => ({})
      }),
      updateRun: async () => ({}),
    } as unknown as Client;
  }

  // Helper method for run management with proper async handling
  private async createAndTrackRun(params: {
    name: string;
    runType: string;
    projectName: string;
    inputs: Record<string, any>;
    parentRunId?: string;
  }) {
    try {
      const run = await this.client.createRun({
        name: params.name,
        run_type: params.runType,
        project_name: params.projectName || 'default',
        inputs: params.inputs,
        parent_run_id: params.parentRunId
      });

      // Return run object with fallback methods
      return {
        ...run,
        patchRun: run.patchRun || (async () => ({})),
        end: run.end || (async () => ({}))
      };
    } catch (error) {
      console.warn(`Failed to create ${params.name} run:`, error);
      // Return a valid mock run with required methods
      return {
        id: crypto.randomUUID(),
        patchRun: async () => ({}),
        end: async () => ({})
      };
    }
  }

  // Helper method for updating runs with proper async handling
  private async updateRunSafely(runId: string, params: {
    outputs?: Record<string, any>;
    error?: string;
    status?: string;
  }) {
    try {
      if (!this.isValidUUID(runId)) {
        console.warn('Invalid run ID, skipping update');
        return;
      }
      
      await Promise.all([
        this.client.updateRun(runId, params),
        this.client.updateRun(runId, { status: params.status || 'completed' })
      ]);
    } catch (error) {
      console.warn(`Failed to update run ${runId}:`, error);
    }
  }

  // Helper to validate UUID
  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  private async withTimeout<T>(
    promise: Promise<T>, 
    timeoutMs: number = 10000, // 10 seconds default
    context: string = ''
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms: ${context}`));
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  private isValidHelpContent(content: string | undefined): boolean {
    // Guard against undefined or null content
    if (!content || typeof content !== 'string') return false;

    // More lenient length check
    const minLength = 50; // Reduced from 100
    if (content.length < minLength) return false;

    // Quick content validation using regex for better performance
    const scriptPattern = /function\s*\(|=>|{|}|\[|\]/;
    if (scriptPattern.test(content)) return false;

    // More lenient content validation
    const validationPatterns = [
      // Help-related terms
      /how|what|when|where|why|can|do|does|is|are|help|support|service|guide|faq/i,
      // Common customer service phrases
      /customer|contact|call|email|phone|visit|store|shop|return|exchange|repair/i,
      // Action words
      /find|get|make|need|want|request|provide|offer|available|please/i
    ];

    // Content is valid if it matches any of the patterns
    return validationPatterns.some(pattern => pattern.test(content));
  }

  private isValidHelpCenterUrl(url: string, competitor: string): boolean {
    const lowercaseUrl = url.toLowerCase();
    
    // Quick reject for invalid URLs
    if (url.length < 10 || !url.startsWith('http')) return false;
    
    // Reject low-quality and non-official domains
    const invalidDomains = [
      'pissedconsumer.com',
      'complaintsboard.com',
      'trustpilot.com',
      'reddit.com',
      'facebook.com',
      'twitter.com',
      'linkedin.com',
      'medium.com',
      'blogspot.com',
      'wordpress.com'
    ];
    if (invalidDomains.some(domain => lowercaseUrl.includes(domain))) return false;

    // Reject common non-content pages
    const invalidPatterns = [
      '/error', '/login', '/404', 'cloudflare', '/cart',
      '/search', '/index', '/sitemap'
    ];
    if (invalidPatterns.some(pattern => lowercaseUrl.includes(pattern))) return false;

    // Must contain help-related paths
    const helpPatterns = ['/help', '/support', '/faq', '/customer-service', '/care', '/contact'];
    const hasHelpPattern = helpPatterns.some(pattern => lowercaseUrl.includes(pattern));

    // Verify it's likely an official domain
    const officialDomainPattern = new RegExp(`^https?://([\\w-]+\\.)?${competitor.replace(/\s+/g, '')}\\.[a-z]+`);
    const isOfficialDomain = officialDomainPattern.test(lowercaseUrl);

    // Must be official domain and contain help pattern
    return isOfficialDomain && hasHelpPattern;
  }

  private async searchHelpCenterArticles(topic: string, organizationId: string): Promise<{
    urls: string[];
    competitors: string[];
  }> {
    try {
      const { data: orgData } = await this.supabase
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .single();

      if (!orgData) return this.searchIndustryHelpCenters(topic);

      // First, get relevant competitors based on the organization's name
      const searchQueries = [
        `${orgData.name} top luxury brand competitors market analysis`,
        `${orgData.name} main competitors luxury segment`,
        `top luxury brands competing with ${orgData.name}`,
        `${orgData.name} competitor brands luxury market`
      ];

      // Randomly select one query
      const selectedQuery = searchQueries[Math.floor(Math.random() * searchQueries.length)];

      const competitorSearch = await this.tavilyClient.search(
        selectedQuery, {
          searchDepth: "advanced",
          maxResults: 3,
          // Add time parameter to get recent results
          endDate: new Date().toISOString()
        }
      );

      // Combine and deduplicate results
      const combinedResults = competitorSearch.results.map(r => r.content);

      // Extract competitor names with more context
      const competitorAnalysis = await this.model.invoke(
        `Analyze these market research results and identify direct competitors of ${orgData.name}.
         Consider factors like:
         - Market segment overlap
         - Price point similarity
         - Brand positioning
         - Geographic presence

         Market Research: ${combinedResults.join('\n')}
         
         Instructions:
         1. Return ONLY a valid JSON array of lowercase brand names
         2. Format: ["brandname1", "brandname2", "brandname3"]
         3. Include only true luxury brand competitors
         4. Exclude non-luxury or mass-market brands
         
         Response:`
      );

      // Clean and parse the response
      let competitors: string[] = [];
      try {
        const cleanedResponse = competitorAnalysis.content
          .toString()
          .trim()
          .replace(/```json/g, '')
          .replace(/```/g, '');
        competitors = JSON.parse(cleanedResponse);
        
        if (!Array.isArray(competitors)) {
          competitors = [];
        }
        competitors = competitors
          .filter(c => typeof c === 'string')
          .map(c => c.toLowerCase().trim())
          .slice(0, 3); // Limit to top 3 competitors
      } catch (parseError) {
        console.error('Error parsing competitor names:', parseError);
        competitors = [];
      }

      console.log('🎯 Identified competitors:', competitors);

      // Collect valid URLs using smarter search patterns
      const validUrls: string[] = [];
      
      // Use parallel processing with improved search patterns
      const searchPromises = competitors.slice(0, 2).map(async competitor => {
        try {
          // First attempt - direct help center search
          const directSearch = await this.tavilyClient.search(
            `${competitor} official website customer service ${topic}`,
            {
              searchDepth: "basic",
            maxResults: 2,
            filterWebResults: true,
            excludeDomains: [
              'cloudflare.com',
              'facebook.com',
              'twitter.com',
                'linkedin.com',
                'pissedconsumer.com',
                'trustpilot.com',
                'reddit.com'
              ]
            }
          );

          // Filter and validate URLs
          const urls = directSearch.results
            .map(result => result.url)
            .filter(url => this.isValidHelpCenterUrl(url, competitor));

          if (urls.length > 0) {
            return urls[0]; // Return the first valid URL
          }

          // Fallback - try topic-specific search if no direct help center found
          const topicSearch = await this.tavilyClient.search(
            `${competitor} ${topic} support guide official site`,
            {
              searchDepth: "basic",
              maxResults: 1,
              filterWebResults: true
            }
          );

          const topicUrl = topicSearch.results[0]?.url;
          return topicUrl && this.isValidHelpCenterUrl(topicUrl, competitor) ? topicUrl : null;

        } catch (error) {
          console.warn(`Error searching competitor ${competitor}:`, error);
          return null;
        }
      });

      const searchResults = await Promise.all(searchPromises);
      validUrls.push(...searchResults.filter((url): url is string => url !== null));

      console.log('🔍 Filtered URLs to process:', validUrls);
      const urls = validUrls.length > 0 ? validUrls.slice(0, 2) : await this.searchIndustryHelpCenters(topic);
      
      return {
        urls,
        competitors
      };

    } catch (error) {
      console.error('Error searching help centers:', error);
      const fallbackUrls = await this.searchIndustryHelpCenters(topic);
      return {
        urls: fallbackUrls,
        competitors: []
      };
    }
  }

  // Fallback function for general industry search
  private async searchIndustryHelpCenters(topic: string): Promise<string[]> {
    const searchQuery = `help center article "${topic}" site:support.zendesk.com OR site:help.zendesk.com`;
    const results = await this.tavilyClient.search(searchQuery, {
      searchDepth: "advanced",
      maxResults: 3
    });
    return results.results.map(result => result.url);
  }

  private async processHelpCenterUrls(urls: string[]): Promise<Document[]> {
    const documents: Document[] = [];
    let validDocCount = 0;

    // Process URLs concurrently with early termination
    await Promise.all(
      urls.map(async (url) => {
        try {
          // Skip if we already have enough valid documents
          if (validDocCount >= 2) return;

          const docs = await this.scrapeAndProcessUrl(url);
          
          // Process each document as it arrives
          for (const doc of docs) {
            if (this.isValidHelpContent(doc.pageContent)) {
              documents.push(doc);
              validDocCount++;
              
              // Early termination if we have enough valid documents
              if (validDocCount >= 2) break;
            }
          }
        } catch (error) {
          console.warn(`Error processing URL ${url}:`, error);
        }
      })
    );

    console.log(`📊 Successfully processed ${documents.length} documents`);
    return documents;
  }

  // Add new method for direct API access
  private async getHelpCenterContent(competitor: string, topic: string): Promise<string | null> {
    // Common help center API endpoints
    const apiEndpoints = [
      `/api/v2/help_center/articles/search?query=${encodeURIComponent(topic)}`,
      `/api/v2/help_center/en-us/articles.json`,
      `/api/content/articles?query=${encodeURIComponent(topic)}`
    ];

    for (const endpoint of apiEndpoints) {
      try {
        const response = await fetch(`https://${competitor}.zendesk.com${endpoint}`, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (compatible; HelpCenterBot/1.0)'
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.articles?.[0]?.body) {
            return data.articles[0].body;
          }
        }
      } catch (error) {
        console.warn(`API attempt failed for ${competitor}:`, error);
      }
    }
    return null;
  }

  // Add new method for alternative content fetching
  private async getAlternativeContent(topic: string): Promise<string | null> {
    try {
      // Try searching in known luxury retail knowledge bases
      const searchResult = await this.tavilyClient.search(
        `${topic} luxury retail customer service best practices site:knowledge.hubspot.com OR site:zendesk.com/blog OR site:intercom.com/blog`,
        {
          searchDepth: "basic",
          maxResults: 2
        }
      );

      if (searchResult.results.length > 0) {
        // Get the content directly from the API response
        const content = searchResult.results
          .map(r => r.content)
          .join('\n\n');
        
        return content.length > 100 ? content : null;
      }
    } catch (error) {
      console.warn('Alternative content fetch failed:', error);
    }
    return null;
  }

  // Update learnFromHelpCenters to use new methods
  async learnFromHelpCenters(topic: string, organizationId: string): Promise<string> {
    try {
      console.log('\n🔍 Learning from help centers about:', topic);
      
      // Get URLs and competitors together
      const { urls, competitors } = await this.searchHelpCenterArticles(topic, organizationId);
      
      let accumulatedContent = '';
      const contentLimit = 4000;

      // Try direct API access first
      if (competitors && competitors.length > 0) {
        for (const competitor of competitors.slice(0, 2)) {
          const apiContent = await this.getHelpCenterContent(competitor, topic);
          if (apiContent) {
            accumulatedContent += apiContent + '\n\n';
            if (accumulatedContent.length >= contentLimit * 0.8) break;
          }
        }
      }

      // If API access didn't yield enough content, try alternative sources
      if (accumulatedContent.length < contentLimit * 0.5) {
        const alternativeContent = await this.getAlternativeContent(topic);
        if (alternativeContent) {
          accumulatedContent += alternativeContent;
        }
      }

      // Fallback to existing scraping method if needed
      if (accumulatedContent.length < contentLimit * 0.3) {
        const scrapedContent = await this.processHelpCenterUrls(urls);
        accumulatedContent += scrapedContent
          .map(doc => doc.pageContent)
          .join('\n\n');
      }

      console.log(`📄 Processed content length: ${accumulatedContent.length} characters`);

      // Generate analysis with whatever content we have
      const analysis = await this.streamOpenAIResponse(
        `Analyze these help center articles briefly:
         1. Key points about ${topic}
         2. Best practices
         
         Articles: ${accumulatedContent || 'No specific articles found. Provide general luxury retail best practices.'}`,
        (chunk) => {
          // Progress handling
        }
      );

      return analysis;
    } catch (error) {
      console.error('Error learning from help centers:', error);
      throw error;
    }
  }

  private extractUrls(searchResult: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return (searchResult.match(urlRegex) || [])
      .filter(url => {
        // Filter for known help center domains
        const helpCenterDomains = [
          'help.shopify.com',
          'stripe.com/docs',
          'support.zendesk.com',
          'help.github.com',
          'support.google.com'
        ];
        return helpCenterDomains.some(domain => url.includes(domain));
      })
      .slice(0, 3);
  }

  async generateEnhancedArticle(params: {
    title: string;
    description: string;
    organizationId: string;
    collectionId?: string;
  }): Promise<string> {
    let parentRun;
    try {
      parentRun = await this.client.createRun({
        name: "Article Generation",
        run_type: "chain",
        project_name: process.env.LANGSMITH_PROJECT_ARTICLE,
        inputs: { 
          title: params.title,
          description: params.description
        }
      });

      const { title, description, organizationId } = params;

      // Run competitor research and org data fetch concurrently
      const [competitorResearchRun, { data: orgData }] = await Promise.all([
        this.client.createRun({
          name: "Competitor Research",
          run_type: "chain",
          project_name: process.env.LANGSMITH_PROJECT_ARTICLE,
          parent_run_id: parentRun?.id,
          inputs: { title, organizationId }
        }),
        this.supabase
          .from('organizations')
          .select('name')
          .eq('id', organizationId)
          .single()
      ]);

      const brandName = orgData?.name || 'Our';

      // Start competitor research early
      const competitorInsights = await this.learnFromHelpCenters(title, organizationId);

      // Create article generation run while competitor research is in progress
      const articleGenRun = await this.client.createRun({
        name: "Generate Article Content",
        run_type: "llm",
        project_name: process.env.LANGSMITH_PROJECT_ARTICLE,
        parent_run_id: parentRun?.id,
        inputs: {
          title,
          description,
          brandName
        }
      });

      if (competitorResearchRun) {
        await competitorResearchRun.end({
          outputs: { competitorInsights }
        });
        await competitorResearchRun.patchRun();
      }

      let accumulatedContent = '';
      console.log('Starting article generation...');
      
      const content = await this.streamOpenAIResponse(
        `You are writing a help center article as ${brandName}'s official customer service representative.

         TOPIC: ${title}
         CONTEXT: ${description}

         COMPETITOR INSIGHTS:
         ${competitorInsights}

         STYLE GUIDE:
         - Write from ${brandName}'s perspective using "we," "our," and "us"
         - Be precise and elegant
         - Include only essential information
         - Write 1-2 brief and concise paragraphs only, prefer 1 paragraph
         - Each paragraph should be 1-2 sentences maximum
         - Use respectful, sophisticated language
         - No redundant explanations
         - Do not use quotation marks or bullet points

         EXAMPLE FORMAT:
         For CHANEL repair services, we recommend visiting your nearest CHANEL Boutique where an advisor can assist you.
         
         Write a concise, sophisticated response in our brand voice without quotation marks.`,
        (chunk) => {
          accumulatedContent += chunk;
          console.log('Received chunk:', chunk); // Debug logging
        }
      );

      console.log('Generated content:', content); // Debug logging

      // Clean the content and ensure it's not empty
      const cleanedContent = content?.replace(/['"]/g, '') || '';
      
      if (!cleanedContent) {
        throw new Error('No content was generated');
      }

      console.log('Cleaned content:', cleanedContent); // Debug logging

      if (articleGenRun) {
        await articleGenRun.end({
          outputs: { content: cleanedContent }
        });
        await articleGenRun.patchRun();
      }

      if (parentRun) {
        await parentRun.end({
          outputs: { content: cleanedContent }
        });
        await parentRun.patchRun(false);
      }

      return cleanedContent;

    } catch (error) {
      console.error('Error in article generation:', error);
      if (parentRun) {
        await parentRun.end({
          error: error instanceof Error ? error.message : "Unknown error"
        });
        await parentRun.patchRun(false);
      }
      throw error;
    }
  }

  private async createEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.embeddings.embedQuery(text);
      return response;
    } catch (error) {
      console.error('Error creating embedding:', error);
      throw error;
    }
  }

  async findSimilarArticles(query: string, organizationId: string): Promise<any[]> {
    try {
      // 1. Clean and enhance query
      const enhancedQuery = query
        .toLowerCase()
        .trim()
        + ' customer service help support';

      // 2. Get embedding with timeout protection
      const embedding = await this.withTimeout(
        this.embeddings.embedQuery(enhancedQuery),
        5000,
        'Generating query embedding'
      );

      // 3. Match articles with correct parameter types
      const { data: initialResults, error } = await this.supabase.rpc(
        'match_articles',
        {
          query_embedding: embedding,
          match_threshold: 0.5,
          match_count: 5,
          p_organization_id: organizationId
        }
      );

      if (error) throw error;
      if (!initialResults?.length) return [];

      // 4. Fetch full article data for matched articles
      const articleIds = initialResults.map(result => result.id);
      const { data: articles } = await this.supabase
        .from('articles')
        .select('id, title, content, description')
        .in('id', articleIds)
        .eq('organizations_id', organizationId);

      if (!articles) return [];

      // 5. Combine similarity scores with article content
      const enrichedResults = initialResults.map(result => {
        const article = articles.find(a => a.id === result.id);
        return {
          ...article,
          similarity: result.similarity,
          relevanceScore: article ? this.calculateRelevanceScore(query, {
            ...article,
            similarity: result.similarity
          }) : 0
        };
      }).filter(result => result.content); // Only return articles with content

      // 6. Return top 3 most relevant results
      return enrichedResults
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 3);

    } catch (error) {
      console.error('Error in findSimilarArticles:', error);
      throw error;
    }
  }

  private calculateRelevanceScore(query: string, article: any): number {
    const queryTerms = new Set(query.toLowerCase().split(/\s+/));
    
    // Calculate title match score with null check
    let titleScore = 0;
    if (article.title) {
      const titleTerms = new Set(article.title.toLowerCase().split(/\s+/));
      const titleMatches = [...queryTerms].filter(term => titleTerms.has(term)).length;
      titleScore = titleMatches / queryTerms.size;
    }

    // Calculate content match score with fallback
    const contentScore = article.similarity || 0;

    // Weighted combination
    // If no title, weight content score more heavily
    return article.title 
      ? (titleScore * 0.4) + (contentScore * 0.6)
      : contentScore;
  }

  // New helper methods
  private async preprocessQuery(query: string): Promise<string> {
    // Remove noise and normalize
    const cleaned = query
      .toLowerCase()
      .replace(/[^\w\s?]/g, '')
      .trim();

    // Expand common abbreviations
    const expanded = cleaned
      .replace(/govt/g, 'government')
      .replace(/asap/g, 'as soon as possible')
      // Add more common abbreviations

    // Add context terms for better matching
    return `${expanded} customer service help support`;
  }

  private async rerankResults(results: any[], query: string): Promise<any[]> {
    // Use semantic similarity to rerank results
    const reranked = await Promise.all(
      results.map(async (result) => {
        try {
          // Get embeddings for title and content
          const titleEmbedding = await this.embeddings.embedQuery(result.title || '');
          const contentEmbedding = await this.embeddings.embedQuery(
            result.content?.substring(0, 1000) || ''
          );
          
          // Calculate semantic scores
          const titleScore = await this.calculateCosineSimilarity(
            titleEmbedding,
            await this.embeddings.embedQuery(query)
          );
          
          const contentScore = await this.calculateCosineSimilarity(
            contentEmbedding,
            await this.embeddings.embedQuery(query)
          );

          // Weighted combination of scores
          const combinedScore = (titleScore * 0.4) + (contentScore * 0.6);
          
          return {
            ...result,
            similarity: combinedScore
          };
    } catch (error) {
          console.warn('Error reranking result:', error);
          return result;
        }
      })
    );

    // Sort by combined score
    return reranked.sort((a, b) => b.similarity - a.similarity);
  }

  private calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
    const dotProduct = embedding1.reduce((sum, val, i) => sum + val * embedding2[i], 0);
    const norm1 = Math.sqrt(embedding1.reduce((sum, val) => sum + val * val, 0));
    const norm2 = Math.sqrt(embedding2.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (norm1 * norm2);
  }

  async generateChatResponse(question: string, articleContent: string): Promise<string> {
    try {
      const run = await this.deflectionClient.createRun({
        name: "Chat Deflection",
        run_type: "chain",
        project_name: process.env.LANGSMITH_PROJECT_DEFLECTION,
        inputs: { question, articleContent },
        start_time: new Date()
      });

      // Simplify thank you detection with exact phrases
      const thankYouPhrases = [
        'thank you', 'thanks', 'thx',
        'no thank you', 'no thanks',
        'that\'s all', 'that is all',
        'i\'m good', 'im good',
        'i\'m ok', 'im ok',
        'goodbye', 'bye'
      ];

      const normalizedQuestion = question.toLowerCase().trim();
      const isThankYouMessage = thankYouPhrases.some(phrase => 
        normalizedQuestion.includes(phrase)
      );

      // Log the check
      console.log('Thank you check:', {
        question: normalizedQuestion,
        isThankYouMessage,
        matchedPhrase: thankYouPhrases.find(phrase => 
          normalizedQuestion.includes(phrase)
        )
      });

      // For thank you messages, return farewell
      if (isThankYouMessage) {
        const farewell = "Thank you for contacting us. Hope you have a nice day!";
        
        // Complete the run for thank you message
        if (run?.id) {
          await this.deflectionClient.updateRun(run.id, {
            end_time: new Date(),
            outputs: { 
              response: farewell,
              isThankYouMessage: true,
              conversationStatus: 'completed'
            },
            status: 'completed'
          });
        }
        
        return farewell;
      }

      // Generate normal response
      const result = await this.model.invoke(
        `You are Ai Dali, a helpful but sophisticated CHANEL customer service AI. 
         Using the provided article content, answer the customer's question in a concise, 
         friendly, and professional manner. Keep your response brief (2-3 sentences max) 
         while maintaining an elegant tone.

         Customer Question: ${question}
         Article Content: ${articleContent}
         
         Instructions:
         - Be concise and friendly
         - Use "we" when referring to CHANEL
         - Focus on the most relevant information
         - Maintain a sophisticated tone
         - Keep response to 2-3 sentences maximum
         - If customer wants to talk to human Agent, try to help customer one more time before deflecting to human Agent
         - After answering, ask if there's anything else they need help with today`,
        {
          callbacks: this.deflectionCallbackManager
        }
      );

      const response = result.content.toString();

      // Complete the run for normal response
      if (run?.id) {
        await this.deflectionClient.updateRun(run.id, {
          end_time: new Date(),
          outputs: { 
            response,
            articleLength: articleContent.length,
            responseLength: response.length,
            isThankYouMessage: false,
            conversationStatus: 'in_progress'
          },
          status: 'in_progress'
        });
      }

      return response;

    } catch (error) {
      console.error('Error in generateChatResponse:', error);
      throw error;
    }
  }

  // Update streamOpenAIResponse to return void since we're using the callback
  private async streamOpenAIResponse(
    prompt: string,
    onProgress: (chunk: string) => void
  ): Promise<string> {
    let accumulatedContent = '';
    
    const response = await this.model.invoke(prompt, {
      callbacks: [{
        handleLLMNewToken(token: string) {
          accumulatedContent += token;
          onProgress(token);
        },
      }],
      stream: true
    });

    // Wait for the final content and use it if available
    if (response.content) {
      return response.content.toString();
    }

    // Fallback to accumulated content if response.content is not available
    return accumulatedContent || '';
  }

  private async scrapeAndProcessUrl(url: string): Promise<Document[]> {
    try {
      console.log(`📄 Processing URL: ${url}`);
      
      // Add headers and options for better site access
      const loader = new CheerioWebBaseLoader(url, {
        selector: `
          main,
          article, 
          .help-article, 
          .article-content, 
          .content,
          .main-content,
          [class*="help"], 
          [class*="support"],
          [class*="article"],
          [class*="content"],
          [id*="content"],
          [id*="main"]
        `.trim(),
        scriptSelectors: [
          'script',
          'style',
          'header:not(.article-header)',
          'footer',
          'nav',
          '.cookie-banner',
          '.navigation',
          '.menu',
          '.sidebar',
          '.ads',
          'iframe'
        ],
        // Add headers for better site access
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });

      const docs = await this.withTimeout(
        loader.load(),
        15000,
        `Loading content from ${url}`
      );

      // Early validation with more detailed logging
      if (!docs || docs.length === 0) {
        console.log(`⚠️ No initial content found in: ${url}`);
        return [];
      }

      console.log(`📝 Found ${docs.length} potential content sections in: ${url}`);

      // Clean and validate content with better logging
      const validDocs = docs.map((doc, index) => {
        try {
          const content = doc.pageContent
            .replace(/[\r\n]+/g, '\n')
            .replace(/\s+/g, ' ')
            .trim();

          console.log(`📄 Content section ${index + 1} length: ${content.length} characters`);

          return new Document({
            pageContent: content,
            metadata: { ...doc.metadata, source: url }
          });
        } catch (error) {
          console.warn(`Error cleaning content section ${index + 1} from ${url}:`, error);
          return null;
        }
      }).filter((doc): doc is Document => {
        if (!doc) return false;
        const isValid = this.isValidHelpContent(doc.pageContent);
        if (!isValid) {
          console.log(`❌ Content section failed validation: ${doc.pageContent.slice(0, 100)}...`);
        }
        return isValid;
      });

      if (validDocs.length === 0) {
        console.log(`⚠️ No valid help content found in: ${url}`);
        return [];
      }

      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 100,
        separators: ['\n\n', '\n', '. ', ' ', ''] // More granular splitting
      });

      const splitDocs = await splitter.splitDocuments(validDocs);
      console.log(`📑 Split into ${splitDocs.length} chunks from: ${url}`);
      return splitDocs;

    } catch (error) {
      if (error instanceof Error && error.message.includes('timed out')) {
        console.log(`⏱️ Skipping slow URL ${url}: ${error.message}`);
      } else {
        console.error(`❌ Error processing URL ${url}:`, error);
      }
      return [];
    }
  }
}

export const langchainService = new LangchainService(); 