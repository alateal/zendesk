import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/environment';

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

  async generateArticle(params: {
    title: string;
    description: string;
    organizationId: string;
    collectionId?: string;
  }) {
    const { title, description } = params;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a professional article writer creating content for a help center. Write in a clear, professional, and helpful tone."
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