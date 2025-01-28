import { ChatOpenAI } from "@langchain/openai";
import { WebBrowser } from "langchain/tools/webbrowser";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "langchain/document";
import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/environment';
import { tavily } from "@tavily/core";

export class LangchainService {
  private model: ChatOpenAI;
  private embeddings: OpenAIEmbeddings;
  private browser: WebBrowser;
  private supabase;
  private tavilyClient;

  constructor() {
    if (!config.openaiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.model = new ChatOpenAI({
      openAIApiKey: config.openaiKey,
      modelName: "gpt-4",
      temperature: 0.7,
    });

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: config.openaiKey,
      modelName: "text-embedding-3-small",
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

  private async storeEmbeddings(docs: Document[], organizationId: string) {
    for (const doc of docs) {
      const embedding = await this.embeddings.embedQuery(doc.pageContent);
      
      await this.supabase
        .from('ai_research_chunks')
        .insert({
          organizations_id: organizationId,
          content: doc.pageContent,
          embedding,
          metadata: doc.metadata,
          source_url: doc.metadata.source
        });
    }
  }

  private async getSimilarContent(query: string, organizationId: string, limit: number = 5) {
    console.log('🔍 Starting semantic search...');
    const queryEmbedding = await this.embeddings.embedQuery(query);
    
    // First try to get articles from the same collection for closest style match
    const { data: collectionChunks } = await this.supabase.rpc('match_content', {
      query_embedding: queryEmbedding,
      match_threshold: 0.88, // Increased threshold for closer matches
      match_count: 3,
      p_organization_id: organizationId
    });

    // Then get articles from the entire organization
    const { data: orgChunks } = await this.supabase.rpc('match_content', {
      query_embedding: queryEmbedding,
      match_threshold: 0.85,
      match_count: limit,
      p_organization_id: organizationId
    });

    const combinedChunks = [...(collectionChunks || []), ...(orgChunks || [])];
    
    // Remove duplicates and sort by similarity
    const uniqueChunks = Array.from(new Set(combinedChunks.map(c => c.id)))
      .map(id => combinedChunks.find(c => c.id === id))
      .filter(Boolean)
      .slice(0, limit);

    console.log('📊 Found similar articles:');
    uniqueChunks.forEach((chunk, i) => {
      console.log(`${i + 1}. Article ID: ${chunk.id}, Similarity: ${chunk.similarity}`);
    });

    return uniqueChunks;
  }

  private async scrapeAndProcessUrl(url: string): Promise<Document[]> {
    try {
      const loader = new CheerioWebBaseLoader(url, {
        selector: 'article, .article, .content, main',
      });
      const docs = await loader.load();

      // Add source metadata
      docs.forEach(doc => {
        doc.metadata.source = url;
      });

      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      return await splitter.splitDocuments(docs);
    } catch (error) {
      console.error(`Error processing URL ${url}:`, error);
      return [];
    }
  }

  private async searchHelpCenterArticles(topic: string, organizationId: string): Promise<string[]> {
    try {
      // First get organization name from Supabase
      const { data: orgData, error: orgError } = await this.supabase
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .single();

      if (orgError || !orgData) {
        console.error('❌ Error getting organization name:', orgError);
        return this.searchIndustryHelpCenters(topic);
      }

      const orgName = orgData.name;
      console.log('🔍 Analyzing competitors for:', orgName);

      // First search for competitors
      const competitorSearch = await this.tavilyClient.search(`${orgName} main competitors brands market analysis`, {
        searchDepth: "advanced",
        maxResults: 3
      });

      // Extract competitor names
      const competitorAnalysis = await this.model.invoke(
        `Based on this market research, list the top 3 direct competitors of ${orgName}.
         
         Market Research:
         ${competitorSearch.results.map(r => r.content).join('\n\n')}

         Return ONLY a JSON array of competitor names, no other text.
         Example: ["Brand1", "Brand2", "Brand3"]`
      );

      let competitors;
      try {
        competitors = JSON.parse(competitorAnalysis.content.trim());
      } catch (e) {
        console.error('Failed to parse competitor list, using default search');
        return this.searchIndustryHelpCenters(topic);
      }

      // Now search for help content from each competitor separately
      const allResults = [];
      for (const competitor of competitors) {
        const results = await this.tavilyClient.search(
          `${competitor} ${topic} help center support article`, {
            searchDepth: "advanced",
            maxResults: 2
          }
        );
        allResults.push(...results.results);
      }

      console.log('📊 Found competitor content from:', competitors);
      return allResults.map(result => result.url);
    } catch (error) {
      console.error('❌ Error analyzing market competitors:', error);
      return this.searchIndustryHelpCenters(topic);
    }
  }

  // Fallback function for general industry search
  private async searchIndustryHelpCenters(topic: string): Promise<string[]> {
    const searchQuery = `help center article "${topic}" site:support.zendesk.com OR site:help.zendesk.com`;
    const results = await this.tavilyClient.search(searchQuery, {
      searchDepth: "advanced",
      maxResults: 5
    });
    return results.results.map(result => result.url);
  }

  private async processHelpCenterUrls(urls: string[]): Promise<Document[]> {
    const allDocs: Document[] = [];
    
    for (const url of urls) {
      const docs = await this.scrapeAndProcessUrl(url);
      // Limit each document to ~1000 tokens (roughly 750 words)
      docs.forEach(doc => {
        doc.pageContent = doc.pageContent.slice(0, 3000);
      });
      allDocs.push(...docs.slice(0, 2)); // Only take first 2 chunks from each URL
    }

    return allDocs.slice(0, 5); // Limit total documents
  }

  async learnFromHelpCenters(topic: string, organizationId: string): Promise<string> {
    try {
      console.log('🔍 Learning from help centers about:', topic);
      const urls = await this.searchHelpCenterArticles(topic, organizationId);
      
      const docs = await this.processHelpCenterUrls(urls);
      console.log(`📄 Processed ${docs.length} documents`);

      // Limit content sent to OpenAI
      const limitedContent = docs
        .map(d => d.pageContent)
        .join('\n\n')
        .slice(0, 6000); // Roughly 2000 tokens

      console.log('🧠 Analyzing content patterns...');
      const analysis = await this.model.invoke(
        `Analyze these help center articles concisely:
         1. Key points about ${topic}
         2. Common approaches
         3. Important considerations
         
         Articles: ${limitedContent}`
      );

      return analysis.content;
    } catch (error) {
      console.error('❌ Error learning from help centers:', error);
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
    const { title, description, organizationId } = params;

    // Get most similar content but limit amount
    const similarContent = await this.getSimilarContent(
      `${title} ${description}`,
      organizationId,
      3 // Reduced from 5 to 3
    );

    // Take only essential content from each article
    const limitedSimilarContent = similarContent.map(doc => ({
      ...doc,
      content: doc.content.slice(0, 2000) // Limit each article
    }));

    // Analyze brand voice with limited content
    const brandVoiceAnalysis = await this.model.invoke(
      `Analyze brand voice briefly:
       ${limitedSimilarContent.map(doc => doc.content).join('\n\n')}

       Return concise JSON:
       {
         "tone": "tone summary",
         "terminology": ["key terms"],
         "style": "writing style"
       }`
    );

    // Get competitor insights (already limited in learnFromHelpCenters)
    const competitorInsights = await this.learnFromHelpCenters(title, organizationId);

    // Generate with limited context
    const response = await this.model.invoke(
      `Write help center article matching brand voice exactly.

       VOICE:
       ${brandVoiceAnalysis.content}

       REFERENCE:
       ${limitedSimilarContent[0]?.content || ''}

       TOPIC: ${title}
       CONTEXT: ${description}

       KEY POINTS:
       ${competitorInsights}

       Match brand voice precisely. Be concise.`
    );

    return response.content;
  }
}

export const langchainService = new LangchainService(); 