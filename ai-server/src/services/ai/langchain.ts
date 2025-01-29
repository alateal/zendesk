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
      // Get organization name from Supabase
      const { data: orgData } = await this.supabase
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .single();

      if (!orgData) return this.searchIndustryHelpCenters(topic);

      const orgName = orgData.name;
      console.log('🔍 Analyzing competitors for:', orgName);

      // Search for direct competitors
      const competitorSearch = await this.tavilyClient.search(
        `${orgName} luxury brand main competitors market analysis`, {
          searchDepth: "advanced",
          maxResults: 3
        }
      );

      console.log('📊 Market research results:', 
        competitorSearch.results.map(r => ({
          title: r.title,
          content: r.content.substring(0, 200) + '...'
        }))
      );

      // Extract competitor names
      const competitorAnalysis = await this.model.invoke(
        `List the top 3 luxury brand competitors of ${orgName}.
         Market Research: ${competitorSearch.results.map(r => r.content).join('\n')}
         Return ONLY a JSON array of competitor names.`
      );

      const competitors = JSON.parse(competitorAnalysis.content.toString().trim());
      console.log('🎯 Identified competitors:', competitors);

      // Search for help center content from luxury competitors
      const allResults = [];
      for (const competitor of competitors) {
        const results = await this.tavilyClient.search(
          `${competitor} ${topic} official help center customer service`, {
            searchDepth: "advanced",
            maxResults: 2
          }
        );
        console.log(`Found ${results.results.length} articles:`, 
          results.results.map(r => ({
            url: r.url,
            title: r.title,
            snippet: r.content.substring(0, 150) + '...'
          }))
        );
        allResults.push(...results.results);
      }

      return allResults.map(result => result.url);
    } catch (error) {
      console.error('❌ Error analyzing competitors:', error);
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
      console.log('\n🔍 Learning from help centers about:', topic);
      const urls = await this.searchHelpCenterArticles(topic, organizationId);
      
      const docs = await this.processHelpCenterUrls(urls);
      console.log(`📄 Processed ${docs.length} documents`);

      // Limit content sent to OpenAI
      const limitedContent = docs
        .map(d => d.pageContent)
        .join('\n\n')
        .slice(0, 6000);

      console.log('\n🧠 Analyzing competitor approaches...');
      const analysis = await this.model.invoke(
        `Analyze these help center articles concisely:
         1. Key points about ${topic}
         2. Common approaches
         3. Important considerations
         
         Articles: ${limitedContent}`
      );

      console.log('\n📝 Competitor analysis result:', analysis.content.toString());
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

    // Research how competitors handle this topic
    console.log('🔍 Researching competitor approaches...');
    const competitorInsights = await this.learnFromHelpCenters(title, organizationId);

    // Generate professional, brand-appropriate content
    const response = await this.model.invoke(
      `You are writing a luxury brand help center article.

       TOPIC: ${title}
       CONTEXT: ${description}

       COMPETITOR INSIGHTS:
       ${competitorInsights}

       STYLE GUIDE:
       - Be precise and elegant
       - Include only essential information
       - Use respectful, sophisticated language
       - Maintain the brand's prestige
       - No redundant explanations
       - Do not use quotation marks

       EXAMPLE FORMAT:
       For CHANEL repair services, we recommend visiting your nearest CHANEL Boutique where an advisor can assist you.
       
       Contact our Client Care Advisors online or by telephone at 1.800.550.0005, available 7 AM to 12 AM ET.

       Write a concise, sophisticated response without quotation marks.`
    );

    // Remove any remaining quotation marks from the response
    return response.content.toString().replace(/['"]/g, '');
  }
}

export const langchainService = new LangchainService(); 