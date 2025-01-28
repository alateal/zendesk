import { Router, Request, Response, RequestHandler } from 'express';
import { aiService } from '../services/ai';
import { authMiddleware } from '../middleware/auth';

const router = Router();

const generateArticle: RequestHandler = async (req, res) => {
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
const storeEmbeddings: RequestHandler = async (req, res) => {
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

router.post('/generate-article', authMiddleware, generateArticle);
router.post('/store-embeddings', authMiddleware, storeEmbeddings);

export const aiRoutes = router;