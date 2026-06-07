import { z } from 'zod';
import { BadRequestError } from './errors.js';

/** Валидация числового ID из req.params */
export const idParamSchema = z.coerce.number().int().positive('ID должен быть положительным целым числом');

/** Валидация и приведение query-параметров пагинации */
export function parsePaginationParams(
  limit: unknown,
  offset: unknown,
  maxLimit = 200
): { limit: number; offset: number } {
  const limitNum = Math.min(Math.max(parseInt(String(limit), 10) || 50, 1), maxLimit);
  const offsetNum = Math.max(parseInt(String(offset), 10) || 0, 0);
  return { limit: limitNum, offset: offsetNum };
}

/** Проверка, что скидка не превышает стоимость */
export function validateDiscount(discount: number, cost: number): void {
  if (discount > cost) {
    throw new BadRequestError('Скидка не может превышать стоимость заказа');
  }
}
