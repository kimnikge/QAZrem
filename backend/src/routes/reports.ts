import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

// GET /reports/masters — отчёт по мастерам
reportsRouter.get('/masters', requireRole('admin'), async (req, res, next) => {
  try {
    const { from = '1970-01-01', to = '2999-12-31' } = req.query as Record<string, string>;

    // Только завершённые заказы: комиссия начисляется по факту выдачи,
    // а не по дате создания. Себестоимость запчастей вычитается так же,
    // как в /finance/master-payouts.
    const result = await pool.query(
      `SELECT
        u.id, u.name,
        COUNT(o.id)::int AS order_count,
        COALESCE(SUM(o.cost - o.discount), 0) AS total_amount,
        COALESCE(SUM(
          GREATEST(0, o.cost - o.discount - COALESCE(op.parts_cost, 0))
          * o.master_commission_pct / 100
        ), 0) AS commission,
        COALESCE(SUM(op.parts_cost), 0) AS parts_cost
      FROM users u
      LEFT JOIN orders o ON o.master_id = u.id
        AND o.completed_at IS NOT NULL
        AND o.completed_at >= $1 AND o.completed_at <= $2
      LEFT JOIN (
        SELECT order_id, SUM(purchase_price_at_moment * quantity_used) AS parts_cost
        FROM order_parts
        GROUP BY order_id
      ) op ON op.order_id = o.id
      WHERE u.role = 'master'
      GROUP BY u.id, u.name
      ORDER BY total_amount DESC`,
      [from, to]
    );

    res.json(result.rows);
  } catch (error) { next(error); }
});

// GET /reports/services — популярность услуг
reportsRouter.get('/services', requireRole('admin'), async (req, res, next) => {
  try {
    const { from = '1970-01-01', to = '2999-12-31' } = req.query as Record<string, string>;

    // Фильтр по дате должен применяться к order_services до LEFT JOIN,
    // иначе услуги из заказов вне периода всё равно попадают в COUNT/SUM.
    const result = await pool.query(
      `SELECT
        s.id, s.name,
        COUNT(osrv.order_id)::int AS usage_count,
        COALESCE(SUM(osrv.price_at_moment * osrv.quantity), 0) AS total_amount
      FROM services s
      LEFT JOIN (
        SELECT osrv.service_id, osrv.order_id, osrv.price_at_moment, osrv.quantity
        FROM order_services osrv
        JOIN orders o ON o.id = osrv.order_id
        WHERE o.created_at >= $1 AND o.created_at <= $2
      ) osrv ON osrv.service_id = s.id
      GROUP BY s.id, s.name
      ORDER BY usage_count DESC`,
      [from, to]
    );

    res.json(result.rows);
  } catch (error) { next(error); }
});

// GET /reports/finance — приход/расход/прибыль по месяцам
reportsRouter.get('/finance', requireRole('admin'), async (req, res, next) => {
  try {
    const { from = '1970-01-01', to = '2999-12-31' } = req.query as Record<string, string>;

    // Доходы по месяцам (завершённые заказы)
    const income = await pool.query(
      `SELECT
        TO_CHAR(o.completed_at, 'YYYY-MM') AS month,
        COALESCE(SUM(o.cost - o.discount), 0) AS income
      FROM orders o
      WHERE o.completed_at IS NOT NULL
        AND o.completed_at >= $1 AND o.completed_at <= $2
      GROUP BY month ORDER BY month`,
      [from, to]
    );

    // Прямые расходы по месяцам
    const expenses = await pool.query(
      `SELECT
        TO_CHAR(created_at, 'YYYY-MM') AS month,
        COALESCE(SUM(amount), 0) AS expenses
      FROM expenses
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY month ORDER BY month`,
      [from, to]
    );

    // Себестоимость запчастей по завершённым заказам
    const parts = await pool.query(
      `SELECT
        TO_CHAR(o.completed_at, 'YYYY-MM') AS month,
        COALESCE(SUM(op.purchase_price_at_moment * op.quantity_used), 0) AS parts_cost
      FROM order_parts op
      JOIN orders o ON o.id = op.order_id
      WHERE o.completed_at IS NOT NULL
        AND o.completed_at >= $1 AND o.completed_at <= $2
      GROUP BY month ORDER BY month`,
      [from, to]
    );

    // Объединить. expenses = прямые расходы + себестоимость запчастей —
    // так же, как в /finance/report.
    type MonthRow = { month: string; income: number; expenses: number; parts_cost: number; profit: number };
    const months = new Map<string, MonthRow>();
    const ensure = (month: string): MonthRow => {
      if (!months.has(month)) {
        months.set(month, { month, income: 0, expenses: 0, parts_cost: 0, profit: 0 });
      }
      return months.get(month)!;
    };

    income.rows.forEach((r: any) => { ensure(r.month).income = Number(r.income); });
    expenses.rows.forEach((r: any) => { ensure(r.month).expenses = Number(r.expenses); });
    parts.rows.forEach((r: any) => {
      const m = ensure(r.month);
      m.parts_cost = Number(r.parts_cost);
      m.expenses += m.parts_cost;
    });

    for (const m of months.values()) m.profit = m.income - m.expenses;

    res.json([...months.values()].sort((a, b) => a.month.localeCompare(b.month)));
  } catch (error) { next(error); }
});

// GET /reports/orders — статистика по заказам
reportsRouter.get('/orders', requireRole('admin'), async (req, res, next) => {
  try {
    const { from = '1970-01-01', to = '2999-12-31' } = req.query as Record<string, string>;

    const created = await pool.query(
      'SELECT COUNT(*)::int AS count FROM orders WHERE created_at >= $1 AND created_at <= $2',
      [from, to]
    );
    const closed = await pool.query(
      `SELECT COUNT(*)::int AS count FROM orders
       WHERE completed_at IS NOT NULL AND completed_at >= $1 AND completed_at <= $2`,
      [from, to]
    );
    const inProgress = await pool.query(
      `SELECT COUNT(*)::int AS count FROM orders o
       JOIN order_statuses os ON os.id = o.status_id
       WHERE os.is_final = FALSE`,
      []
    );

    res.json({
      created: created.rows[0].count,
      closed: closed.rows[0].count,
      in_progress: inProgress.rows[0].count
    });
  } catch (error) { next(error); }
});

// GET /reports/events — журнал событий
reportsRouter.get('/events', requireRole('admin'), async (req, res, next) => {
  try {
    const { limit = '50' } = req.query;
    const limitNum = Math.min(Number(limit) || 50, 200);

    const result = await pool.query(
      `SELECT oh.*, u.name AS user_name,
        fs.name AS from_status_name, ts.name AS to_status_name
      FROM order_history oh
      LEFT JOIN users u ON u.id = oh.user_id
      LEFT JOIN order_statuses fs ON fs.id = oh.from_status_id
      JOIN order_statuses ts ON ts.id = oh.to_status_id
      ORDER BY oh.created_at DESC LIMIT $1`,
      [limitNum]
    );

    res.json(result.rows);
  } catch (error) { next(error); }
});
