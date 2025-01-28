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

export const aiRoutes = router;