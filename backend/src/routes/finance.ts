import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const financeRouter = Router();

financeRouter.use(requireAuth);
financeRouter.use(requireRole('admin'));

const reportSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional()
});

// GET /finance/report — отчёт о прибыли за период
financeRouter.get('/report', async (req, res, next) => {
  try {
    const { from, to } = reportSchema.parse(req.query);

    const fromDate = from || '1970-01-01';
    const toDate = to || '2999-12-31';

    // Доходы: сумма платежей по завершённым заказам
    const incomeResult = await pool.query(
      `SELECT COALESCE(SUM(p.amount), 0) AS total
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       WHERE o.completed_at IS NOT NULL
         AND o.completed_at >= $1
         AND o.completed_at <= $2`,
      [fromDate, toDate]
    );

    // Расходы: expenses + закупочная цена запчастей по завершённым заказам
    const expenseResult = await pool.query(
      `SELECT
        (SELECT COALESCE(SUM(amount), 0) FROM expenses
         WHERE created_at >= $1 AND created_at <= $2) AS direct_expenses,
        (SELECT COALESCE(SUM(op.purchase_price_at_moment * op.quantity_used), 0)
         FROM order_parts op
         JOIN orders o ON o.id = op.order_id
         WHERE o.completed_at >= $1 AND o.completed_at <= $2) AS parts_cost`,
      [fromDate, toDate]
    );

    const income = Number(incomeResult.rows[0].total);
    const directExpenses = Number(expenseResult.rows[0].direct_expenses);
    const partsCost = Number(expenseResult.rows[0].parts_cost);
    const totalExpenses = directExpenses + partsCost;
    const profit = income - totalExpenses;

    // Количество завершённых заказов
    const ordersResult = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM orders
       WHERE completed_at >= $1 AND completed_at <= $2`,
      [fromDate, toDate]
    );

    res.json({
      period: { from: fromDate, to: toDate },
      income,
      expenses: {
        direct: directExpenses,
        parts_cost: partsCost,
        total: totalExpenses
      },
      profit,
      completed_orders: ordersResult.rows[0].count
    });
  } catch (error) {
    next(error);
  }
});
