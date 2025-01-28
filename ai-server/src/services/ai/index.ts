import OpenAI from 'openai';
import { config } from '../../config/environment';
import { createClient } from '@supabase/supabase-js';

const CHUNK_SIZE = 1000; // Size of each content chunk for embeddings

export class AIService {
  private openai: OpenAI;
  private supabase;

  constructor() {
    if (!config.openaiKey) {
      throw new Error('OpenAI API key is required');
    }
    if (!config.supabaseUrl || !config.supabaseServiceKey) {
      throw new Error('Supabase URL and service key are required');
    }

    this.openai = new OpenAI({
      apiKey: config.openaiKey
    });
    this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
  }

  private chunkContent(content: string): string[] {
    const words = content.split(' ');
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentLength = 0;

    for (const word of words) {
      if (currentLength + word.length > CHUNK_SIZE) {
        chunks.push(currentChunk.join(' '));
        currentChunk = [word];
        currentLength = word.length;
      } else {
        currentChunk.push(word);
        currentLength += word.length + 1; // +1 for the space
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
    }

    return chunks;
  }

  private async createEmbedding(text: string) {
    const response = await this.openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return response.data[0].embedding;
  }

  async storeArticleEmbeddings(articleId: string, content: string, organizationId: string) {
    // Delete existing chunks for this article
    await this.supabase
      .from('ai_content_chunks')
      .delete()
      .eq('article_id', articleId);

    // Create new chunks and their embeddings
    const chunks = this.chunkContent(content);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await this.createEmbedding(chunk);
      
      await this.supabase
        .from('ai_content_chunks')
        .insert({
          article_id: articleId,
          organizations_id: organizationId,
          content_chunk: chunk,
          embedding,
          chunk_index: i,
          metadata: { chunk_count: chunks.length }
        });
    }
  }

  private async getSimilarContentChunks(query: string, organizationId: string, limit: number = 5) {
    const queryEmbedding = await this.createEmbedding(query);
    
    // Using pgvector's cosine similarity search
    const { data: chunks } = await this.supabase.rpc('match_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: limit,
      p_organization_id: organizationId
    });

    return chunks || [];
  }

  private async getCollectionContext(collectionId: string) {
    const { data: collection } = await this.supabase
      .from('collections')
      .select('title')
      .eq('id', collectionId)
      .single();

    const { data: articles } = await this.supabase
      .from('articles')
      .select('title, description')
      .eq('collection_id', collectionId)
      .eq('is_published', true)
      .limit(5);

    if (!collection) return '';

    let context = `This article belongs to the "${collection.title}" collection.\n`;
    if (articles?.length) {
      context += "Here are some existing articles in this collection:\n";
      articles.forEach(article => {
        context += `- ${article.title}: ${article.description}\n`;
      });
    }
    return context;
  }

  async generateArticle(params: {
    title: string;
    description: string;
    organizationId: string;
    collectionId?: string;
  }) {
    const { title, description, organizationId, collectionId } = params;

    // Get collection context if collectionId is provided
    const collectionContext = collectionId 
      ? await this.getCollectionContext(collectionId)
      : '';

    // Get similar content chunks for context
    const similarChunks = await this.getSimilarContentChunks(
      `${title} ${description}`,
      organizationId
    );

    // Create context from similar content
    let contentContext = '';
    if (similarChunks.length > 0) {
      contentContext = "Here are some relevant excerpts from existing articles to maintain consistent style and tone:\n\n";
      similarChunks.forEach((chunk: any) => {
        contentContext += `${chunk.content_chunk}\n\n`;
      });
    }

    // Add collection context to the prompt if collectionId is provided
    const systemPrompt = `You are a professional article writer creating content for a help center.
${collectionId ? `This article belongs to a specific collection.\n${collectionContext}\n` : ''}
${contentContext ? `Use these existing article excerpts as reference for tone and style:\n${contentContext}\n` : ''}
Write in a clear, professional, and helpful tone.
Format the content in Markdown with appropriate headings and sections.
Maintain consistency with the existing content's style and terminology.`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Write a comprehensive help center article about: ${title}\nDescription: ${description}\n\nEnsure the article is:\n1. Well-structured with clear headings\n2. Easy to understand\n3. Comprehensive yet concise\n4. Includes relevant examples where appropriate`
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    return {
      content: completion.choices[0].message.content
    };
  }
}

export const aiService = new AIService();