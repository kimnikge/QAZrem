import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ForbiddenError, UnauthorizedError } from '../lib/errors.js';

export type JwtPayload = {
  userId: number;
  role: 'admin' | 'master' | 'reception';
};

const JWT_SECRET = env.JWT_SECRET;

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

function extractToken(req: Request): string {
  // 1. httpOnly cookie (защищён от XSS)
  if (req.cookies?.token) {
    return req.cookies.token;
  }
  // 2. Fallback: Authorization Bearer header
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthorizedError();
  }
  return header.slice(7);
}

/** Проверяет JWT и добавляет req.user */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
      return;
    }
    next(new UnauthorizedError('Недействительный токен'));
  }
}

/** Проверяет, что роль пользователя входит в список разрешённых */
export function requireRole(...roles: Array<JwtPayload['role']>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError());
      return;
    }
    next();
  };
}
