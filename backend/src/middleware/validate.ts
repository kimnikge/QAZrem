// ═══════════════════════════════════════════════════════════
// Middleware: validateBody / validateQuery
//
// Устраняет повторяющийся паттерн:
//   const input = schema.parse(req.body);
//   ...обработка...
//   catch (error) { next(error); }
//
// Использование:
//   router.post('/', validateBody(createOrderSchema), async (req, res) => { ... });
// ═══════════════════════════════════════════════════════════

import type { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { BadRequestError } from '../lib/errors.js';

/**
 * Middleware: валидирует req.body через Zod-схему.
 * При ошибке — выбрасывает BadRequestError с деталями.
 * При успехе — заменяет req.body на валидированный объект.
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new BadRequestError(`Ошибка валидации: ${error.errors.map((e) => e.message).join('; ')}`));
        return;
      }
      next(error);
    }
  };
}

/**
 * Middleware: валидирует req.query через Zod-схему.
 * При ошибке — выбрасывает BadRequestError с деталями.
 * При успехе — заменяет req.query на валидированный объект.
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query) as unknown as typeof req.query;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new BadRequestError(`Ошибка валидации параметров: ${error.errors.map((e) => e.message).join('; ')}`));
        return;
      }
      next(error);
    }
  };
}
