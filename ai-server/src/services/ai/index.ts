import { AIService } from './openai';
import { LangchainService } from './langchain';

export const aiService = new AIService();
export const langchainService = new LangchainService();