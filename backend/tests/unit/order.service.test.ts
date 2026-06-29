/**
 * Unit-тесты: order.service.ts
 *
 * Мокаем db/pool — тестируем бизнес-логику изолированно.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPoolQuery = vi.fn();

// Мокаем модуль pool ДО импорта сервиса
vi.mock('../../src/db/pool.js', () => ({
  pool: {
    query: vi.fn(),
    connect: vi.fn(),
  },
  closePool: vi.fn(),
  getSupabaseClient: vi.fn(),
  getSupabaseAnonClient: vi.fn(),
}));

vi.mock('../../src/services/telegram.js', () => ({
  sendTelegramMessage: vi.fn().mockResolvedValue({ sent: true }),
}));

import { pool } from '../../src/db/pool.js';
import { recalcOrderCost } from '../../src/services/order.service.js';
import { STATUS_TRANSITIONS } from '../../src/types/domain.js';

describe('STATUS_TRANSITIONS', () => {
  it('new → diagnosis, cancelled', () => {
    expect(STATUS_TRANSITIONS['new']).toEqual(['diagnosis', 'cancelled']);
  });

  it('completed — финальный, нет переходов', () => {
    expect(STATUS_TRANSITIONS['completed']).toEqual([]);
  });

  it('cancelled — финальный, нет переходов', () => {
    expect(STATUS_TRANSITIONS['cancelled']).toEqual([]);
  });

  it('ready → completed, cancelled', () => {
    expect(STATUS_TRANSITIONS['ready']).toEqual(['completed', 'cancelled']);
  });

  it('все статусы имеют записи', () => {
    const slugs = ['new', 'diagnosis', 'waiting_parts', 'repair', 'ready', 'completed', 'cancelled'];
    for (const slug of slugs) {
      expect(STATUS_TRANSITIONS).toHaveProperty(slug);
      expect(Array.isArray(STATUS_TRANSITIONS[slug])).toBe(true);
    }
  });

  it('нет переходов в несуществующие статусы', () => {
    const validSlugs = new Set(Object.keys(STATUS_TRANSITIONS));
    for (const targets of Object.values(STATUS_TRANSITIONS)) {
      for (const t of targets) {
        expect(validSlugs.has(t)).toBe(true);
      }
    }
  });
});

describe('recalcOrderCost (unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('вычисляет стоимость на основе запчастей и услуг', async () => {
    (pool.query as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        rows: [{ total: '15000' }],
      })
      .mockResolvedValueOnce({ rows: [] });

    await recalcOrderCost(pool as any, 1);

    expect(pool.query).toHaveBeenCalledTimes(2);
    const calls = (pool.query as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toContain('order_parts');
    expect(calls[0][0]).toContain('order_services');
    expect(calls[0][1]).toEqual([1]);
    expect(calls[1][0]).toContain('UPDATE orders SET cost');
    expect(calls[1][1]).toEqual([15000, 1]);
  });

  it('округляет стоимость до целого', async () => {
    (pool.query as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        rows: [{ total: '12345.67' }],
      })
      .mockResolvedValueOnce({ rows: [] });

    await recalcOrderCost(pool as any, 1);

    const calls = (pool.query as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[1][1]).toEqual([12346, 1]);
  });

  it('обрабатывает нулевую стоимость', async () => {
    (pool.query as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        rows: [{ total: '0' }],
      })
      .mockResolvedValueOnce({ rows: [] });

    await recalcOrderCost(pool as any, 1);

    const calls = (pool.query as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[1][1]).toEqual([0, 1]);
  });
});
