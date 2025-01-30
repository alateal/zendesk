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

  private async scrapeAndProcessUrl(url: string): Promise<Document[]> {
    try {
      console.log(`📄 Processing URL: ${url}`);
      const loader = new CheerioWebBaseLoader(url, {
        selector: 'body, article, .article, .content, main, .container, .page-content, #content, .main-content',
      });
      const docs = await loader.load();
      console.log(`✅ Successfully loaded content from: ${url}`);

      // Add source metadata
      docs.forEach(doc => {
        doc.metadata.source = url;
      });

      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      const splitDocs = await splitter.splitDocuments(docs);
      console.log(`📑 Split into ${splitDocs.length} chunks from: ${url}`);
      return splitDocs;
    } catch (error) {
      console.error(`❌ Error processing URL ${url}:`, error);
      return [];
    }
  }

  private async searchHelpCenterArticles(topic: string, organizationId: string): Promise<string[]> {
    try {
      const { data: orgData } = await this.supabase
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .single();

      if (!orgData) return this.searchIndustryHelpCenters(topic);

      // First, get relevant competitors based on the organization's name
      const competitorSearch = await this.tavilyClient.search(
        `${orgData.name} top luxury brand competitors market analysis`, {
          searchDepth: "advanced",
          maxResults: 2
        }
      );

      // Extract competitor names using GPT with a more strict prompt
      const competitorAnalysis = await this.model.invoke(
        `Based on this market research, identify the top 3 direct competitors of ${orgData.name}.
         Market Research: ${competitorSearch.results.map(r => r.content).join('\n')}
         
         Instructions:
         1. Return ONLY a valid JSON array of lowercase brand names
         2. Format example: ["brandname1", "brandname2", "brandname3"]
         3. No explanation, just the JSON array
         4. No periods or other punctuation
         
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
          .map(c => c.toLowerCase().trim());
      } catch (parseError) {
        console.error('Error parsing competitor names:', parseError);
        competitors = [];
      }

      console.log('🎯 Identified competitors:', competitors);

      // Search specifically for competitor help center content
      const competitorSearchPromises = competitors.map(competitor => 
        this.tavilyClient.search(
          `${competitor} ${topic} help center OR customer service OR support guide`, {
            searchDepth: "basic",
            maxResults: 1,
            filterWebResults: true
          }
        )
      );

      const competitorResults = await Promise.all(competitorSearchPromises);
      const allResults = competitorResults.flatMap(result => result.results);

      console.log('🔍 Competitor help center results:', 
        allResults.map(r => ({
          url: r.url,
          competitor: competitors.find(c => r.url.toLowerCase().includes(c)) || 'unknown',
          title: r.title
        }))
      );

      return allResults
        .filter(result => {
          const url = result.url.toLowerCase();
          // Only include results from competitor domains
          return competitors.some(competitor => url.includes(competitor));
        })
        .map(result => result.url);
    } catch (error) {
      console.error('Error searching help centers:', error);
      return this.searchIndustryHelpCenters(topic);
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
    // Process URLs in parallel instead of sequentially
    const docPromises = urls.map(url => this.scrapeAndProcessUrl(url));
    const docsArrays = await Promise.all(docPromises);
    
    // Flatten and limit the documents
    const allDocs = docsArrays
      .flat()
      .slice(0, 3);

    return allDocs;
  }

  async learnFromHelpCenters(topic: string, organizationId: string): Promise<string> {
    try {
      console.log('\n🔍 Learning from help centers about:', topic);
      const urls = await this.searchHelpCenterArticles(topic, organizationId);
      
      const docs = await this.processHelpCenterUrls(urls);
      console.log(`📄 Processed ${docs.length} documents`);

      // Optimize: Reduce content length sent to OpenAI
      const limitedContent = docs
        .map(d => d.pageContent)
        .join('\n\n')
        .slice(0, 4000); // Reduced from 6000 to 4000 characters

      const analysis = await this.model.invoke(
        `Analyze these help center articles briefly:
         1. Key points about ${topic}
         2. Best practices
         
         Articles: ${limitedContent}`
      );

      return analysis.content;
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
      .slice(0, 5);
  }

  async generateEnhancedArticle(params: {
    title: string;
    description: string;
    organizationId: string;
    collectionId?: string;
  }): Promise<string> {
    let parentRun;
    try {
      // Create parent run for article generation
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

      // Get organization name for brand voice
      const { data: orgData } = await this.supabase
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .single();

      const brandName = orgData?.name || 'Our';

      // Create child run for competitor research
      const competitorResearchRun = await this.client.createRun({
        name: "Competitor Research",
        run_type: "chain",
        project_name: process.env.LANGSMITH_PROJECT_ARTICLE,
        parent_run_id: parentRun?.id,
        inputs: { title, organizationId }
      });

      const competitorInsights = await this.learnFromHelpCenters(title, organizationId);

      if (competitorResearchRun) {
        await competitorResearchRun.end({
          outputs: { competitorInsights }
        });
        await competitorResearchRun.patchRun();
      }

      // Create child run for article generation
      const articleGenRun = await this.client.createRun({
        name: "Generate Article Content",
        run_type: "llm",
        project_name: process.env.LANGSMITH_PROJECT_ARTICLE,
        parent_run_id: parentRun?.id,
        inputs: {
          title,
          description,
          competitorInsights,
          brandName
        }
      });

      const response = await this.model.invoke(
        `You are writing a help center article as ${brandName}'s official customer service representative.

         TOPIC: ${title}
         CONTEXT: ${description}

         COMPETITOR INSIGHTS:
         ${competitorInsights}

         STYLE GUIDE:
         - Write from ${brandName}'s perspective using "we," "our," and "us"
         - Be precise and elegant
         - Include only essential information
         - Write 1-2 concise paragraphs only
         - Each paragraph should be 2-3 sentences maximum
         - Use respectful, sophisticated language
         - No redundant explanations
         - Do not use quotation marks or bullet points

         EXAMPLE FORMAT:
         For CHANEL repair services, we recommend visiting your nearest CHANEL Boutique where an advisor can assist you.
         
         Contact our Client Care Advisors online or by telephone at 1.800.550.0005, available 7 AM to 12 AM ET.

         Write a concise, sophisticated response in our brand voice without quotation marks.`
      );

      const content = response.content.toString().replace(/['"]/g, '');

      if (articleGenRun) {
        await articleGenRun.end({
          outputs: { content }
        });
        await articleGenRun.patchRun();
      }

      if (parentRun) {
        await parentRun.end({
          outputs: { content }
        });
        await parentRun.patchRun(false);
      }

      return content;

    } catch (error) {
      console.error('Error in article generation:', error);
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
      // Create run for chat response generation
      const run = await this.client.createRun({
        name: "Generate Chat Response",
        run_type: "llm",
        project_name: process.env.LANGSMITH_PROJECT_DEFLECTION,
        inputs: {
          question,
          articleContent
        }
      });

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
         - Keep response to 2-3 sentences maximum`
      );

      await run.end({
        outputs: { response: response.content.toString() }
      });
      await run.patchRun();

      return response.content.toString();
    } catch (error) {
      console.error('Error generating chat response:', error);
      throw error;
    }
  }
}

export const langchainService = new LangchainService(); 