/**
 * Unit-тесты: query-builder.ts
 *
 * Тестируем чистые функции buildPatchQuery и buildConditions.
 * БД не требуется.
 */

import { describe, it, expect } from 'vitest';
import { buildPatchQuery, buildConditions } from '../../src/lib/query-builder.js';

// ═══════════════════════════════════════════════════════════
// buildPatchQuery
// ═══════════════════════════════════════════════════════════

describe('buildPatchQuery', () => {
  const ALLOWED = ['name', 'phone', 'email'];

  it('строит UPDATE с переданными полями', () => {
    const result = buildPatchQuery(
      { name: 'Иван', phone: '+7999' },
      ALLOWED,
      'clients',
    );

    expect(result).not.toBeNull();
    expect(result!.sql).toContain('UPDATE clients SET');
    expect(result!.sql).toContain('name = $1');
    expect(result!.sql).toContain('phone = $2');
    expect(result!.sql).toContain('WHERE id = $3');
    expect(result!.values).toEqual(['Иван', '+7999', null]);
  });

  it('игнорирует поля не из белого списка', () => {
    const result = buildPatchQuery(
      { name: 'Иван', password: 'secret', role: 'admin' },
      ALLOWED,
      'clients',
    );

    expect(result).not.toBeNull();
    expect(result!.sql).toContain('name = $1');
    expect(result!.sql).not.toContain('password');
    expect(result!.sql).not.toContain('role');
    expect(result!.values).toEqual(['Иван', null]);
  });

  it('игнорирует undefined-значения', () => {
    const result = buildPatchQuery(
      { name: 'Иван', phone: undefined, email: undefined },
      ALLOWED,
      'clients',
    );

    expect(result).not.toBeNull();
    expect(result!.sql).toContain('name = $1');
    expect(result!.sql).not.toContain('phone');
    expect(result!.sql).not.toContain('email');
  });

  it('возвращает null если нет изменений', () => {
    const result = buildPatchQuery(
      { name: undefined, phone: undefined },
      ALLOWED,
      'clients',
    );

    expect(result).toBeNull();
  });

  it('возвращает null для пустого объекта', () => {
    const result = buildPatchQuery({}, ALLOWED, 'clients');
    expect(result).toBeNull();
  });

  it('поддерживает кастомный idColumn', () => {
    const result = buildPatchQuery(
      { name: 'Test' },
      ALLOWED,
      'parts',
      'part_id',
    );

    expect(result).not.toBeNull();
    expect(result!.sql).toContain('WHERE part_id = $2');
  });

  it('корректно обрабатывает null-значения', () => {
    const result = buildPatchQuery(
      { email: null },
      ALLOWED,
      'clients',
    );

    expect(result).not.toBeNull();
    expect(result!.sql).toContain('email = $1');
    expect(result!.values).toEqual([null, null]);
  });

  it('не инжектит SQL через имя поля (белый список защищает)', () => {
    const result = buildPatchQuery(
      { "name'; DROP TABLE clients;--": 'x' } as Record<string, unknown>,
      ALLOWED,
      'clients',
    );

    // Такого поля нет в белом списке — запрос не строится
    expect(result).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════
// buildConditions
// ═══════════════════════════════════════════════════════════

describe('buildConditions', () => {
  it('собирает несколько условий через AND', () => {
    const result = buildConditions([
      { clause: 'status = $1', params: ['new'] },
      { clause: 'brand ILIKE $2', params: ['%Apple%'] },
    ]);

    expect(result.clause).toBe('status = $1 AND brand ILIKE $2');
    expect(result.params).toEqual(['new', '%Apple%']);
  });

  it('пропускает null и undefined', () => {
    const result = buildConditions([
      { clause: 'status = $1', params: ['new'] },
      null,
      undefined,
      { clause: 'brand ILIKE $2', params: ['%Apple%'] },
    ]);

    expect(result.clause).toBe('status = $1 AND brand ILIKE $2');
  });

  it('пропускает false', () => {
    const result = buildConditions([
      { clause: 'status = $1', params: ['new'] },
      false,
    ]);

    expect(result.clause).toBe('status = $1');
  });

  it('возвращает пустую строку для пустого массива', () => {
    const result = buildConditions([]);
    expect(result.clause).toBe('');
    expect(result.params).toEqual([]);
  });

  it('возвращает пустую строку если все условия null', () => {
    const result = buildConditions([null, undefined, false]);
    expect(result.clause).toBe('');
    expect(result.params).toEqual([]);
  });

  it('корректно собирает индексы параметров', () => {
    const result = buildConditions([
      { clause: 'a = $1', params: [1] },
      { clause: 'b = $2', params: [2] },
      { clause: 'c = $3', params: [3] },
    ]);

    expect(result.params).toEqual([1, 2, 3]);
    expect(result.clause).toBe('a = $1 AND b = $2 AND c = $3');
  });
});
