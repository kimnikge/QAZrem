// ═══════════════════════════════════════════════════════════
// Middleware: parsePagination
//
// Устраняет дублирующийся паттерн:
//   const limitNum = Math.min(Math.max(parseInt(limit as string, 10) || 50, 1), 200);
//   const offsetNum = Math.max(parseInt(offset as string, 10) || 0, 0);
//
// Использование:
//   router.get('/', parsePagination({ defaultLimit: 50, maxLimit: 200 }), ...);
//   req.pagination.limit, req.pagination.offset — уже готовы.
// ═══════════════════════════════════════════════════════════

import type { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      pagination: { limit: number; offset: number };
    }
  }
}

export interface PaginationOptions {
  defaultLimit?: number;
  maxLimit?: number;
  defaultOffset?: number;
}

/**
 * Извлекает и валидирует query-параметры limit/offset.
 * Добавляет их в req.pagination.
 */
export function parsePagination(options: PaginationOptions = {}) {
  const {
    defaultLimit = 50,
    maxLimit = 200,
    defaultOffset = 0,
  } = options;

  return (req: Request, _res: Response, next: NextFunction) => {
    const rawLimit = req.query.limit;
    const rawOffset = req.query.offset;

    const limit = Math.min(
      Math.max(parseInt(String(rawLimit), 10) || defaultLimit, 1),
      maxLimit,
    );
    const offset = Math.max(parseInt(String(rawOffset), 10) || defaultOffset, 0);

    req.pagination = { limit, offset };
    next();
  };
}
