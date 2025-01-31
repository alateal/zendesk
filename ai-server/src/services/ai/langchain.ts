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

  constructor() {
    if (!config.openaiKey) {
      throw new Error('OpenAI API key is required');
    }

    if (!config.langsmithApiKey || !config.langsmithProjectName) {
      throw new Error('LangSmith configuration is required');
    }

    // Enable background callbacks
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = 'true';

    // Initialize LangSmith client
    this.client = new Client({
      apiUrl: process.env.LANGCHAIN_ENDPOINT,
      apiKey: process.env.LANGSMITH_API_KEY,
    });

    // Initialize tracer and callback manager
    this.callbackManager = new CallbackManager();
    this.tracer = new LangChainTracer({
      projectName: config.langsmithProjectName
    });
    this.callbackManager.addHandler(this.tracer);

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
      const competitorInsightsPromise = this.learnFromHelpCenters(title, organizationId);

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

      // Wait for competitor insights
      const competitorInsights = await competitorInsightsPromise;

      if (competitorResearchRun) {
        await competitorResearchRun.end({
          outputs: { competitorInsights }
        });
        await competitorResearchRun.patchRun();
      }

      let accumulatedContent = '';
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
          // Could emit progress events here if needed
        }
      );

      const cleanedContent = content.replace(/['"]/g, '');

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

  async findSimilarArticles(query: string, organizationId: string): Promise<Array<{
    id: string;
    content: string;
    title?: string;
    similarity: number;
  }>> {
    let parentRun;
    try {
      // Create parent run for deflection
      parentRun = await this.client.createRun({
        name: "AI Deflection",
        run_type: "chain",
        project_name: process.env.LANGSMITH_PROJECT_DEFLECTION,
        inputs: { 
          query,
          organizationId
        }
      });

      // Create child run for embedding generation
      const embeddingRun = await this.client.createRun({
        name: "Generate Query Embedding",
        run_type: "embedding",
        project_name: process.env.LANGSMITH_PROJECT_DEFLECTION,
        parent_run_id: parentRun?.id,
        inputs: { query }
      });

      const queryEmbedding = await this.createEmbedding(query);

      if (embeddingRun) {
        await embeddingRun.end({
          outputs: { embedding_length: queryEmbedding.length }
        });
        await embeddingRun.patchRun();
      }

      // Create child run for similarity search
      const searchRun = await this.client.createRun({
        name: "Similarity Search",
        run_type: "chain",
        project_name: process.env.LANGSMITH_PROJECT_DEFLECTION,
        parent_run_id: parentRun?.id,
        inputs: { 
          queryEmbedding,
          organizationId
        }
      });

      // First, let's check if we have any embeddings in the database
      const { data: checkEmbeddings, error: checkError } = await this.supabase
        .from('ai_content_chunks')
        .select('count')
        .eq('organizations_id', organizationId);
      
      console.log('3. Existing embeddings check:', { checkEmbeddings, checkError });

      // Perform the similarity search with a lower threshold
      const { data: similarArticles, error } = await this.supabase.rpc(
        'match_articles',
        {
          query_embedding: queryEmbedding,
          match_threshold: 0.5, // Lowered from 0.7 to catch more matches
          match_count: 3,      // Increased from 3 to get more potential matches
          p_organization_id: organizationId
        }
      );

      console.log('4. Similarity search results:', {
        similarArticles,
        error,
        count: similarArticles?.length || 0
      });

      if (error) {
        console.error('Error in similarity search:', error);
        return [];
      }

      if (!similarArticles || similarArticles.length === 0) {
        console.log('No similar articles found');
        return [];
      }

      // Get the article IDs we found
      const articleIds = similarArticles.map(match => match.id);
      console.log('5. Looking up articles with IDs:', articleIds);

      // Look up the full articles
      const { data: articlesContent, error: articlesError } = await this.supabase
        .from('articles')
        .select('id, content, title, is_published, is_public')
        .in('id', articleIds)
        .eq('is_published', true)
        .eq('is_public', true);

      console.log('6. Articles content lookup:', {
        articlesContent,
        articlesError,
        count: articlesContent?.length || 0
      });

      if (articlesError || !articlesContent) {
        console.error('Error looking up articles:', articlesError);
        return [];
      }

      // Map the results together
      const results = similarArticles.map(match => {
        const article = articlesContent.find(a => a.id === match.id);
        return {
          id: match.id,
          content: article?.content || '',
          title: article?.title,
          similarity: match.similarity
        };
      });

      console.log('7. Final results:', {
        count: results.length,
        similarities: results.map(r => r.similarity),
        titles: results.map(r => r.title)
      });

      if (searchRun) {
        await searchRun.end({
          outputs: { 
            results_count: results.length,
            similarities: results.map(r => r.similarity)
          }
        });
        await searchRun.patchRun();
      }

      if (parentRun) {
        await parentRun.end({
          outputs: { 
            results_count: results.length,
            found_matches: results.length > 0
          }
        });
        await parentRun.patchRun(false);
      }

      return results;

    } catch (error) {
      console.error('Error in findSimilarArticles:', error);
      // End the parent run with error if it exists
      if (parentRun) {
        await parentRun.end({
          error: error instanceof Error ? error.message : "Unknown error"
        });
        await parentRun.patchRun(false);
      }
      throw error;
    }
  }

  async generateChatResponse(question: string, articleContent: string): Promise<string> {
    try {
      let run;
      try {
        // Create run for chat response generation
        run = await this.client.createRun({
          name: "Generate Chat Response",
          run_type: "llm",
          project_name: process.env.LANGSMITH_PROJECT_DEFLECTION,
          inputs: {
            question,
            articleContent
          }
        });
      } catch (runError) {
        console.warn('Failed to create LangSmith run:', runError);
        // Continue without run tracking if it fails
      }

      const response = await this.model.invoke(
        `You are Agent Dali, a helpful but sophisticated CHANEL customer service AI. 
         Using the provided article content, answer the customer's question in a concise, 
         friendly, and professional manner. Keep your response brief (2-3 sentences max) 
         while maintaining CHANEL's elegant tone.

         Customer Question: ${question}
         
         Article Content: ${articleContent}
         
         Instructions:
         - Be concise and friendly
         - Use "we" when referring to CHANEL
         - Focus on the most relevant information
         - Maintain a sophisticated tone
         - Keep response to 2-3 sentences maximum
         - If customer wants to talk to human Agent, try to help customer one more time before deflecting to human Agent`
      );

      // Only try to end the run if it was successfully created
      if (run) {
        try {
          await run.end({
            outputs: { response: response.content.toString() }
          });
          await run.patchRun();
        } catch (runEndError) {
          console.warn('Failed to end LangSmith run:', runEndError);
          // Continue even if run tracking fails
        }
      }

      return response.content.toString();
    } catch (error) {
      console.error('Error generating chat response:', error);
      throw error;
    }
  }

  // Add this new method for streaming responses
  private async streamOpenAIResponse(
    prompt: string,
    onProgress?: (chunk: string) => void
  ): Promise<string> {
    const response = await this.model.invoke(prompt, {
      callbacks: [{
        handleLLMNewToken(token: string) {
          onProgress?.(token);
        },
      }],
      stream: true
    });

    return response.content.toString();
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