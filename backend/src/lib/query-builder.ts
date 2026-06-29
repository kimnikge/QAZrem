// ═══════════════════════════════════════════════════════════
// SQL Query Builder — утилита для безопасного построения
// динамических SQL-запросов с параметризацией.
//
// Устраняет дублирование: построение WHERE, COUNT(*), пагинация.
// ═══════════════════════════════════════════════════════════

import { pool } from '../db/pool.js';

// ─── Типы ───────────────────────────────────────────────

export interface QueryCondition {
  clause: string;
  params: unknown[];
}

export interface QueryConfig {
  select: string;
  from: string;
  /** WHERE-условия, которые применяются и к основному запросу, и к COUNT */
  where?: QueryCondition;
  /** Дополнительные JOIN/WHERE которые нужны только для COUNT (обычно не нужны) */
  countOverrides?: {
    select?: string;
    from?: string;
    where?: QueryCondition;
  };
  orderBy?: string;
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  rows: T[];
  total: number;
  limit: number;
  offset: number;
}

// ─── Построитель ────────────────────────────────────────

/**
 * Строит параметризованный SQL-запрос с автоматическим COUNT-запросом.
 *
 * Пример:
 * ```ts
 * const result = await executePaginatedQuery<OrderRow>(pool, {
 *   select: 'o.id, o.cost, c.name AS client_name',
 *   from: 'orders o JOIN clients c ON c.id = o.client_id',
 *   where: buildConditions([
 *     { clause: 'o.status = $1', params: ['new'] },
 *     search ? { clause: 'c.name ILIKE $2', params: [`%${search}%`] } : null,
 *   ]),
 *   orderBy: 'o.created_at DESC',
 *   limit: 50,
 *   offset: 0,
 * });
 * ```
 */
export async function executePaginatedQuery<T = Record<string, unknown>>(
  config: QueryConfig,
): Promise<PaginatedResult<T>> {
  const { select, from, where, countOverrides, orderBy, limit = 50, offset = 0 } = config;

  const { clause: whereClause, params: whereParams } = where ?? { clause: '', params: [] };
  const whereSql = whereClause ? ` WHERE ${whereClause}` : '';

  // Основной запрос
  let sql = `SELECT ${select} FROM ${from}${whereSql}`;
  if (orderBy) sql += ` ORDER BY ${orderBy}`;
  sql += ` LIMIT $${whereParams.length + 1} OFFSET $${whereParams.length + 2}`;

  const allParams = [...whereParams, limit, offset];
  const result = await pool.query(sql, allParams);

  // COUNT-запрос
  const countSelect = countOverrides?.select ?? 'COUNT(*)::int AS total';
  const countFrom = countOverrides?.from ?? from;
  const countWhere = countOverrides?.where ?? where;
  const { clause: cwClause, params: cwParams } = countWhere ?? { clause: '', params: [] };
  const countWhereSql = cwClause ? ` WHERE ${cwClause}` : '';

  const countSql = `SELECT ${countSelect} FROM ${countFrom}${countWhereSql}`;
  const countResult = await pool.query(countSql, cwParams);

  return {
    rows: result.rows as T[],
    total: countResult.rows[0]?.total ?? 0,
    limit,
    offset,
  };
}

// ─── Помощники для условий ──────────────────────────────

/**
 * Собирает массив условий в одно WHERE-выражение.
 * null/undefined условия пропускаются.
 */
export function buildConditions(
  conditions: Array<QueryCondition | null | undefined | false>,
): QueryCondition {
  const valid = conditions.filter((c): c is QueryCondition => !!c);
  const clauses = valid.map((c) => c.clause);
  const params = valid.flatMap((c) => c.params);
  return {
    clause: clauses.join(' AND '),
    params,
  };
}

/**
 * Создаёт ILIKE-условие с авто-инкрементом placeholder.
 * Используется ТОЛЬКО внутри buildConditions, который плоским списком собирает params.
 */
export function ilike(
  field: string,
  value: string,
  placeholderIndex: number,
): QueryCondition {
  return {
    clause: `${field} ILIKE $${placeholderIndex}`,
    params: [`%${value}%`],
  };
}

/**
 * Создаёт условие равенства.
 */
export function eq(
  field: string,
  value: unknown,
  placeholderIndex: number,
): QueryCondition {
  return {
    clause: `${field} = $${placeholderIndex}`,
    params: [value],
  };
}

// ─── Безопасный PATCH-билдер ─────────────────────────────

/**
 * Белый список полей, разрешённых к обновлению через PATCH.
 * Защищает от инъекций через имена колонок.
 */
export function buildPatchQuery<T extends Record<string, unknown>>(
  input: Partial<T>,
  allowedFields: ReadonlyArray<string>,
  tableName: string,
  idColumn: string = 'id',
): { sql: string; values: unknown[] } | null {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const key of allowedFields) {
    const value = input[key];
    if (value !== undefined) {
      fields.push(`${key} = $${fields.length + 1}`);
      values.push(value);
    }
  }

  if (fields.length === 0) return null;

  values.push(null); // placeholder for id — will be replaced by caller
  const sql = `UPDATE ${tableName} SET ${fields.join(', ')} WHERE ${idColumn} = $${values.length}`;

  return { sql, values };
}
