import { Request, Response, NextFunction } from 'express';
import { authenticateJWT } from './jwtAuth';

export function dualAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticateJWT(req, res, next);
  }

  return next;
}
