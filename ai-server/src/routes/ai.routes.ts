import { Router, Request, Response, RequestHandler } from 'express';
import { aiService, langchainService } from '../services/ai';
import { authMiddleware } from '../middleware/auth';

const router = Router();

interface TypedRequestBody<T> extends Request {
  body: T;
}

interface GenerateArticleBody {
  title: string;
  description?: string;
  organizationId: string;
  collectionId?: string;
}

interface StoreEmbeddingsBody {
  articleId: string;
  content: string;
  organizationId: string;
}

const generateArticle: RequestHandler = async (
  req: TypedRequestBody<GenerateArticleBody>,
  res: Response
) => {
  try {
    const { title, description, organizationId, collectionId } = req.body;

    if (!title || !organizationId) {
      res.status(400).json({ 
        error: 'Title and organization ID are required' 
      });
      return;
    }

    const article = await aiService.generateArticle({
      title,
      description: description || '',
      organizationId,
      collectionId
    });

    res.json(article);
  } catch (error) {
    console.error('Error generating article:', error);
    res.status(500).json({ error: 'Failed to generate article' });
  }
};

// Route to store article embeddings
const storeEmbeddings: RequestHandler = async (
  req: TypedRequestBody<StoreEmbeddingsBody>,
  res: Response
) => {
  try {
    const { articleId, content, organizationId } = req.body;

    if (!articleId || !content || !organizationId) {
      res.status(400).json({
        error: 'Article ID, content, and organization ID are required'
      });
      return;
    }

    await aiService.storeArticleEmbeddings(articleId, content, organizationId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error storing embeddings:', error);
    res.status(500).json({ error: 'Failed to store embeddings' });
  }
};

router.post('/generate-article', authMiddleware as RequestHandler, generateArticle);
router.post('/store-embeddings', authMiddleware as RequestHandler, storeEmbeddings);

router.post('/generate-enhanced-article', authMiddleware as RequestHandler, async (req, res) => {
  try {
    console.log('🚀 Enhanced Article Generation Started');
    const { title, description, organizationId, collectionId } = req.body;

    if (!title || !organizationId) {
      res.status(400).json({ 
        error: 'Title and organization ID are required' 
      });
      return;
    }

    console.log('📝 Generating enhanced article for:', { title, description });
    const content = await langchainService.generateEnhancedArticle({
      title,
      description: description || '',
      organizationId,
      collectionId
    });

    console.log('✅ Enhanced article generated successfully');
    res.json({ content });
  } catch (error) {
    console.error('❌ Error generating enhanced article:', error);
    res.status(500).json({ error: 'Failed to generate enhanced article' });
  }
});

router.post('/search-similar', async (req, res) => {
  try {
    const { query, organizationId } = req.body;

    if (!query || !organizationId) {
      return res.status(400).json({
        error: 'Missing required parameters: query and organizationId'
      });
    }

    console.log('Searching for:', { query, organizationId });

    const similarArticles = await langchainService.findSimilarArticles(
      query,
      organizationId
    );

    console.log('Found articles:', similarArticles);

    return res.json({
      articles: similarArticles
    });

  } catch (error) {
    console.error('Detailed error in search-similar:', {
      message: error.message,
      stack: error.stack
    });
    return res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

router.get('/test-similarity', async (req, res) => {
  try {
    const results = await langchainService.findSimilarArticles(
      "How do I return an item?",
      "645d0512-984f-4a3a-b625-5b429b24291e" // Your org ID
    );
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.post('/generate-response', async (req, res) => {
  try {
    const { question, articleContent } = req.body;

    if (!question || !articleContent) {
      return res.status(400).json({
        error: 'Question and article content are required'
      });
    }

    const response = await langchainService.generateChatResponse(question, articleContent);
    
    return res.json({ response });

  } catch (error) {
    console.error('Error generating response:', error);
    return res.status(500).json({
      error: 'Failed to generate response'
    });
  }
});

router.post('/chat-deflection', async (req, res) => {
  try {
    const { question, articleContent } = req.body;
    const response = await langchainService.generateChatResponse(question, articleContent);
    res.json({ response });
  } catch (error) {
    console.error('Error generating response:', error);
    res.status(400).json({ error: 'AI response generation failed' });
  }
});

export const aiRoutes = router;