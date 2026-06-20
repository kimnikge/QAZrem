import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

// GET /reports/masters — отчёт по мастерам
reportsRouter.get('/masters', requireRole('admin'), async (req, res, next) => {
  try {
    const { from = '1970-01-01', to = '2999-12-31' } = req.query as Record<string, string>;

    const result = await pool.query(
      `SELECT
        u.id, u.name,
        COUNT(o.id)::int AS order_count,
        COALESCE(SUM(o.cost - o.discount), 0) AS total_amount,
        COALESCE(SUM(
          (o.cost - o.discount) * o.master_commission_pct / 100
        ), 0) AS commission
      FROM users u
      LEFT JOIN orders o ON o.master_id = u.id
        AND o.created_at >= $1 AND o.created_at <= $2
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

    const result = await pool.query(
      `SELECT
        s.id, s.name,
        COUNT(osrv.order_id)::int AS usage_count,
        COALESCE(SUM(osrv.price_at_moment * osrv.quantity), 0) AS total_amount
      FROM services s
      LEFT JOIN order_services osrv ON osrv.service_id = s.id
      LEFT JOIN orders o ON o.id = osrv.order_id
        AND o.created_at >= $1 AND o.created_at <= $2
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

    // Расходы по месяцам
    const expenses = await pool.query(
      `SELECT
        TO_CHAR(created_at, 'YYYY-MM') AS month,
        COALESCE(SUM(amount), 0) AS expenses
      FROM expenses
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY month ORDER BY month`,
      [from, to]
    );

    // Объединить
    const months = new Map<string, { month: string; income: number; expenses: number; profit: number }>();
    income.rows.forEach((r: any) => months.set(r.month, { month: r.month, income: Number(r.income), expenses: 0, profit: Number(r.income) }));
    expenses.rows.forEach((r: any) => {
      const m = months.get(r.month) || { month: r.month, income: 0, expenses: 0, profit: 0 };
      m.expenses = Number(r.expenses);
      m.profit = m.income - m.expenses;
      months.set(r.month, m);
    });

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
