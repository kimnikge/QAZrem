import { Router } from 'express';
import { pool } from '../../db/pool.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';

export const warehouseReportsRouter = Router();

warehouseReportsRouter.use(requireAuth);

// ============================================================
// 1. Остатки на текущий момент
// GET /warehouse/reports/stock
// ============================================================
warehouseReportsRouter.get('/stock', async (req, res, next) => {
  try {
    const { category_id } = req.query;
    const params: unknown[] = [];
    let idx = 1;

    let sql = `
      SELECT p.id, p.name, p.sku, p.quantity, p.min_quantity,
        p.purchase_price, p.selling_price, p.unit,
        pc.name AS category_name,
        (p.quantity <= p.min_quantity) AS is_low_stock,
        (p.quantity * p.purchase_price) AS total_cost,
        (p.quantity * p.selling_price) AS total_value
      FROM parts p
      LEFT JOIN part_categories pc ON pc.id = p.category_id
      WHERE p.is_active = TRUE
    `;
    if (category_id) {
      sql += ` AND p.category_id = $${idx++}`;
      params.push(Number(category_id));
    }
    sql += ' ORDER BY pc.name, p.name';

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// ============================================================
// 2. Движение за период
// GET /warehouse/reports/movements?from=2026-01-01&to=2026-06-30
// ============================================================
warehouseReportsRouter.get('/movements', requireRole('admin'), async (req, res, next) => {
  try {
    const { from, to, type, limit = '200' } = req.query;
    const params: unknown[] = [];
    let idx = 1;

    let sql = `
      SELECT pm.*, p.name AS part_name, p.sku,
        s.name AS supplier_name
      FROM part_movements pm
      JOIN parts p ON p.id = pm.part_id
      LEFT JOIN suppliers s ON s.id = pm.supplier_id
      WHERE 1=1
    `;

    if (from) {
      sql += ` AND pm.created_at >= $${idx++}`;
      params.push(from as string);
    }
    if (to) {
      sql += ` AND pm.created_at < ($${idx++}::date + INTERVAL '1 day')`;
      params.push(to as string);
    }
    if (type) {
      sql += ` AND pm.type = $${idx++}`;
      params.push(type as string);
    }

    sql += ` ORDER BY pm.created_at DESC LIMIT $${idx++}`;
    params.push(Math.min(Number(limit) || 200, 500));

    // Агрегация за период
    const summaryParams: unknown[] = [];
    let summaryWhere = '';
    if (from) {
      summaryWhere += ` AND pm.created_at >= $${summaryParams.length + 1}`;
      summaryParams.push(from as string);
    }
    if (to) {
      summaryWhere += ` AND pm.created_at < ($${summaryParams.length + 1}::date + INTERVAL '1 day')`;
      summaryParams.push(to as string);
    }
    const summarySql = `
      SELECT pm.type, COUNT(*)::int AS count, COALESCE(SUM(pm.quantity), 0)::int AS total_quantity
      FROM part_movements pm WHERE 1=1${summaryWhere}
      GROUP BY pm.type ORDER BY pm.type
    `;

    const [movements, summary] = await Promise.all([
      pool.query(sql, params),
      pool.query(summarySql, summaryParams)
    ]);

    res.json({ movements: movements.rows, summary: summary.rows });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// 3. Самые ходовые запчасти
// GET /warehouse/reports/top-parts?limit=20
// ============================================================
warehouseReportsRouter.get('/top-parts', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);

    const result = await pool.query(
      `SELECT p.id, p.name, p.sku, p.quantity,
        COUNT(op.id)::int AS times_used,
        COALESCE(SUM(op.quantity_used), 0)::int AS total_used,
        COALESCE(SUM(op.selling_price_at_moment * op.quantity_used), 0) AS total_revenue
       FROM parts p
       LEFT JOIN order_parts op ON op.part_id = p.id
       GROUP BY p.id, p.name, p.sku, p.quantity
       ORDER BY total_used DESC
       LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// ============================================================
// 4. Залежавшиеся запчасти (без движения)
// GET /warehouse/reports/stale?days=90
// ============================================================
warehouseReportsRouter.get('/stale', requireRole('admin'), async (req, res, next) => {
  try {
    const days = Math.max(Number(req.query.days) || 90, 30);

    const result = await pool.query(
      `SELECT p.id, p.name, p.sku, p.quantity, p.min_quantity,
        p.purchase_price, p.selling_price,
        (p.quantity * p.purchase_price) AS frozen_cost,
        MAX(pm.created_at) AS last_movement,
        EXTRACT(DAY FROM NOW() - MAX(pm.created_at))::int AS days_idle
       FROM parts p
       LEFT JOIN part_movements pm ON pm.part_id = p.id
       WHERE p.is_active = TRUE AND p.quantity > 0
       GROUP BY p.id
       HAVING MAX(pm.created_at) IS NULL
          OR MAX(pm.created_at) < NOW() - INTERVAL '1 day' * $1
       ORDER BY days_idle DESC NULLS FIRST`,
      [days]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// ============================================================
// 5. Расход по поставщикам
// GET /warehouse/reports/by-supplier
// ============================================================
warehouseReportsRouter.get('/by-supplier', requireRole('admin'), async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.name,
        COUNT(DISTINCT pb.id)::int AS batches_count,
        COALESCE(SUM(pb.initial_quantity), 0)::int AS total_received,
        COALESCE(SUM(pb.initial_quantity - pb.current_quantity), 0)::int AS total_used,
        COALESCE(SUM(pb.initial_quantity * pb.purchase_price), 0) AS total_spent
       FROM suppliers s
       LEFT JOIN part_batches pb ON pb.supplier_id = s.id
       GROUP BY s.id, s.name
       ORDER BY total_spent DESC`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// ============================================================
// 6. Оборот по категориям
// GET /warehouse/reports/by-category
// ============================================================
warehouseReportsRouter.get('/by-category', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT pc.id, pc.name,
        COUNT(p.id)::int AS parts_count,
        COALESCE(SUM(p.quantity), 0)::int AS total_stock,
        COALESCE(SUM(p.quantity * p.purchase_price), 0) AS total_cost,
        COALESCE(SUM(p.quantity * p.selling_price), 0) AS total_value
       FROM part_categories pc
       LEFT JOIN parts p ON p.category_id = pc.id AND p.is_active = TRUE
       GROUP BY pc.id, pc.name
       ORDER BY total_value DESC`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// ============================================================
// 7. Инвентаризационная ведомость
// GET /warehouse/reports/inventory/:sheetId
// ============================================================
warehouseReportsRouter.get('/inventory/:sheetId', async (req, res, next) => {
  try {
    const { sheetId } = req.params;

    const sheet = await pool.query(
      `SELECT s.*, u.name AS created_by_name, l.name AS location_name
       FROM inventory_sheets s
       JOIN users u ON u.id = s.created_by
       LEFT JOIN locations l ON l.id = s.location_id
       WHERE s.id = $1`,
      [sheetId]
    );
    if (sheet.rows.length === 0) {
      res.status(404).json({ error: 'Ведомость не найдена' });
      return;
    }

    const items = await pool.query(
      `SELECT ii.*, p.name AS part_name, p.sku, p.unit,
        (COALESCE(ii.actual_quantity, ii.expected_quantity) - ii.expected_quantity) AS discrepancy,
        CASE
          WHEN ii.actual_quantity IS NULL THEN 'не проверено'
          WHEN ii.actual_quantity = ii.expected_quantity THEN 'совпадает'
          WHEN ii.actual_quantity > ii.expected_quantity THEN 'излишек'
          ELSE 'недостача'
        END AS result
       FROM inventory_items ii
       JOIN parts p ON p.id = ii.part_id
       WHERE ii.sheet_id = $1
       ORDER BY p.name`,
      [sheetId]
    );

    const stats = await pool.query(
      `SELECT
        COUNT(*)::int AS total_items,
        COUNT(*) FILTER (WHERE actual_quantity IS NOT NULL)::int AS checked_items,
        COUNT(*) FILTER (WHERE actual_quantity IS NOT NULL AND actual_quantity != expected_quantity)::int AS discrepancies,
        COUNT(*) FILTER (WHERE actual_quantity > expected_quantity)::int AS surplus,
        COUNT(*) FILTER (WHERE actual_quantity < expected_quantity)::int AS shortage
       FROM inventory_items
       WHERE sheet_id = $1`,
      [sheetId]
    );

    res.json({ ...sheet.rows[0], items: items.rows, stats: stats.rows[0] });
  } catch (error) {
    next(error);
  }
});
