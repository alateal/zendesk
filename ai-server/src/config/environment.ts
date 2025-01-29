import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Set background callbacks before any other imports
process.env.LANGCHAIN_CALLBACKS_BACKGROUND = 'true';

export const config = {
  port: process.env.PORT || 3001,
  openaiKey: process.env.OPENAI_API_KEY,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  tavilyApiKey: process.env.TAVILY_API_KEY,
  langsmithApiKey: process.env.LANGSMITH_API_KEY,
  langsmithProjectName: process.env.LANGSMITH_PROJECT || 'help-center-ai'
};