import { Request, Response, NextFunction, RequestHandler } from 'express';
import { supabase } from '../services/supabase';

export const authMiddleware: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    res.status(401).json({ error: 'No authorization header' });
    return;
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    // @ts-ignore
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Authentication failed' });
    return;
  }
};