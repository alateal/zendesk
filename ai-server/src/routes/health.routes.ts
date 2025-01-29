import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ 
    message: 'Hello World',
    status: 'healthy'
  });
});

export const healthRoutes = router; 