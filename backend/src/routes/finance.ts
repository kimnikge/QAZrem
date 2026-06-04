import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import type { QueryResult } from 'pg';

export const financeRouter = Router();

financeRouter.use(requireAuth);

const reportSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional()
});

// GET /finance/report — отчёт о прибыли за период (только admin)
financeRouter.get('/report', requireRole('admin'), async (req, res, next) => {
  try {
    const { from, to } = reportSchema.parse(req.query);

    const fromDate = from || '1970-01-01';
    const toDate = to || '2999-12-31';

    // Доходы: стоимость завершённых заказов (cost - discount)
    const incomeResult = await pool.query(
      `SELECT COALESCE(SUM(o.cost - o.discount), 0) AS total
       FROM orders o
       WHERE o.completed_at IS NOT NULL
         AND o.completed_at >= $1
         AND o.completed_at <= $2`,
      [fromDate, toDate]
    );

    // Реально оплачено: сумма платежей по завершённым заказам
    const paidResult = await pool.query(
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
    const paid = Number(paidResult.rows[0].total);
    const directExpenses = Number(expenseResult.rows[0].direct_expenses);
    const partsCost = Number(expenseResult.rows[0].parts_cost);
    const totalExpenses = directExpenses + partsCost;
    const profit = income - totalExpenses;

    // Детализация: заказы, из которых состоит income
    const incomeOrdersResult = await pool.query(
      `SELECT o.id, o.cost, o.discount, o.completed_at,
              c.name AS client_name, d.brand, d.model
       FROM orders o
       JOIN devices d ON d.id = o.device_id
       JOIN clients c ON c.id = d.client_id
       WHERE o.completed_at IS NOT NULL
         AND o.completed_at >= $1
         AND o.completed_at <= $2
       ORDER BY o.completed_at DESC`,
      [fromDate, toDate]
    );

    // Детализация: платежи для paid
    const paidOrdersResult = await pool.query(
      `SELECT p.id AS payment_id, p.amount, p.payment_method_id, pm.name AS payment_method_name,
              p.order_id, o.completed_at, c.name AS client_name
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       JOIN devices d ON d.id = o.device_id
       JOIN clients c ON c.id = d.client_id
       LEFT JOIN payment_methods pm ON pm.id = p.payment_method_id
       WHERE o.completed_at IS NOT NULL
         AND o.completed_at >= $1
         AND o.completed_at <= $2
       ORDER BY o.completed_at DESC`,
      [fromDate, toDate]
    );

    // Детализация: заказы с долгом (income - paid > 0)
    const debtOrdersResult = await pool.query(
      `SELECT o.id, o.cost, o.discount, o.completed_at,
              c.name AS client_name, d.brand, d.model,
              COALESCE(payments.paid_total, 0) AS paid_total
       FROM orders o
       JOIN devices d ON d.id = o.device_id
       JOIN clients c ON c.id = d.client_id
       LEFT JOIN (
         SELECT order_id, SUM(amount) AS paid_total
         FROM payments
         GROUP BY order_id
       ) payments ON payments.order_id = o.id
       WHERE o.completed_at IS NOT NULL
         AND o.completed_at >= $1
         AND o.completed_at <= $2
       ORDER BY (o.cost - o.discount - COALESCE(payments.paid_total, 0)) DESC`,
      [fromDate, toDate]
    );

    // Детализация: расходы (expenses + order_parts)
    const expenseItemsResult = await pool.query(
      `SELECT 'expense' AS item_type, e.id, e.amount, ec.name AS category_name, e.description, e.created_at,
              NULL AS part_name, NULL AS quantity_used, NULL AS purchase_price, NULL AS order_id
       FROM expenses e
       LEFT JOIN expense_categories ec ON ec.id = e.category_id
       WHERE e.created_at >= $1 AND e.created_at <= $2
       UNION ALL
       SELECT 'part' AS item_type, op.id, (op.purchase_price_at_moment * op.quantity_used) AS amount,
              'Запчасть' AS category_name, op.part_name AS description, o.completed_at AS created_at,
              op.part_name, op.quantity_used, op.purchase_price_at_moment, o.id AS order_id
       FROM order_parts op
       JOIN orders o ON o.id = op.order_id
       WHERE o.completed_at >= $1 AND o.completed_at <= $2
       ORDER BY created_at DESC`,
      [fromDate, toDate]
    );

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
      income_orders: incomeOrdersResult.rows.map(r => ({
        id: r.id,
        client_name: r.client_name,
        brand: r.brand,
        model: r.model,
        cost: Number(r.cost),
        discount: Number(r.discount),
        completed_at: r.completed_at
      })),
      paid,
      paid_orders: paidOrdersResult.rows.map(r => ({
        order_id: r.order_id,
        amount: Number(r.amount),
        payment_method_name: r.payment_method_name,
        client_name: r.client_name,
        completed_at: r.completed_at
      })),
      debt: income - paid,
      debt_orders: debtOrdersResult.rows.map(r => {
        const cost = Number(r.cost);
        const discount = Number(r.discount);
        const paidTotal = Number(r.paid_total);
        return {
          id: r.id,
          client_name: r.client_name,
          brand: r.brand,
          model: r.model,
          cost: cost,
          discount: discount,
          paid_total: paidTotal,
          balance: cost - discount - paidTotal,
          completed_at: r.completed_at
        };
      }),
      expenses: {
        direct: directExpenses,
        parts_cost: partsCost,
        total: totalExpenses
      },
      expense_items: expenseItemsResult.rows.map(r => ({
        type: r.item_type,
        id: r.id,
        amount: Number(r.amount),
        category_name: r.category_name,
        description: r.description,
        created_at: r.created_at,
        ...(r.item_type === 'part' ? {
          part_name: r.part_name,
          quantity_used: Number(r.quantity_used),
          purchase_price: Number(r.purchase_price),
          order_id: r.order_id
        } : {})
      })),
      profit,
      completed_orders: ordersResult.rows[0].count
    });
  } catch (error) {
    next(error);
  }
});

// Вспомогательная функция для расчёта периода
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getPeriodRange(period: string): { from: string; to: string } {
  const now = new Date();
  let from: Date;
  const to = new Date(now);
  to.setDate(now.getDate() + 1);

  switch (period) {
    case 'week':
      from = new Date(now);
      from.setDate(now.getDate() - now.getDay() + 1);
      break;
    case 'month':
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'quarter':
      from = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      break;
    case 'year':
    default:
      from = new Date(now.getFullYear(), 0, 1);
      break;
  }

  return { from: toDateStr(from), to: toDateStr(to) };
}

// GET /finance/master-payouts — расчёт комиссии мастерам
// admin — видит всех, master — только себя
financeRouter.get('/master-payouts', async (req, res, next) => {
  try {
    const user = req.user!;
    const { period = 'month', master_id } = req.query;
    const { from, to } = getPeriodRange(period as string);

    // Если мастер — видит только свои заказы
    // Если админ — может фильтровать по master_id
    let masterFilter = '';
    const params: unknown[] = [from, to];
    let idx = 3;

    if (user.role === 'master') {
      masterFilter = ` AND o.master_id = $${idx++}`;
      params.push(user.userId);
    } else if (master_id) {
      masterFilter = ` AND o.master_id = $${idx++}`;
      params.push(Number(master_id));
    }

    const result = await pool.query(
      `SELECT
        o.id AS order_id,
        o.cost,
        o.discount,
        o.master_commission_pct,
        o.completed_at,
        u.id AS master_id,
        u.name AS master_name,
        COALESCE(op.parts_cost, 0) AS parts_cost,
        (o.cost - o.discount - COALESCE(op.parts_cost, 0)) AS profit,
        ROUND((o.cost - o.discount - COALESCE(op.parts_cost, 0)) * o.master_commission_pct / 100, 2) AS master_payout
      FROM orders o
      JOIN users u ON u.id = o.master_id
      LEFT JOIN (
        SELECT order_id, SUM(purchase_price_at_moment * quantity_used) AS parts_cost
        FROM order_parts
        GROUP BY order_id
      ) op ON op.order_id = o.id
      WHERE o.completed_at >= $1 AND o.completed_at <= $2${masterFilter}
      ORDER BY o.completed_at DESC`,
      params
    );

    // Группировка по мастерам
    const byMaster: Record<number, {
      master_id: number;
      master_name: string;
      orders: typeof result.rows;
      total_profit: number;
      total_payout: number;
    }> = {};

    for (const row of result.rows) {
      if (!byMaster[row.master_id]) {
        byMaster[row.master_id] = {
          master_id: row.master_id,
          master_name: row.master_name,
          orders: [],
          total_profit: 0,
          total_payout: 0
        };
      }
      byMaster[row.master_id].orders.push(row);
      byMaster[row.master_id].total_profit += Number(row.profit);
      byMaster[row.master_id].total_payout += Number(row.master_payout);
    }

    res.json({
      period: { from, to, label: period },
      masters: Object.values(byMaster)
    });
  } catch (error) {
    next(error);
  }
});
