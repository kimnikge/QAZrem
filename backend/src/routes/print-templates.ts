import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { NotFoundError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const printTemplatesRouter = Router();

printTemplatesRouter.use(requireAuth);

// ============================================================
// Схемы
// ============================================================
const templateSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  content: z.string(),
  is_default: z.boolean().optional()
});

// ============================================================
// Доступные переменные для подстановки в шаблоны
// ============================================================
const AVAILABLE_VARIABLES = [
  { key: '#ЗАКАЗ-НОМЕР', label: 'Номер заказа', group: 'Заказ' },
  { key: '#ДАТА-ЗАКАЗ-СОЗДАН', label: 'Дата создания заказа', group: 'Заказ' },
  { key: '#ДАТА-СЕГОДНЯ', label: 'Сегодняшняя дата', group: 'Дата' },
  { key: '#КЛИЕНТ-ИМЯ', label: 'Имя клиента', group: 'Клиент' },
  { key: '#КЛИЕНТ-ТЕЛЕФОН', label: 'Телефон клиента', group: 'Клиент' },
  { key: '#КЛИЕНТ-EMAIL', label: 'Email клиента', group: 'Клиент' },
  { key: '#КЛИЕНТ-АДРЕС', label: 'Адрес клиента', group: 'Клиент' },
  { key: '#УСТРОЙСТВО-БРЕНД', label: 'Бренд устройства', group: 'Устройство' },
  { key: '#УСТРОЙСТВО-МОДЕЛЬ', label: 'Модель устройства', group: 'Устройство' },
  { key: '#УСТРОЙСТВО-IMEI', label: 'IMEI', group: 'Устройство' },
  { key: '#УСТРОЙСТВО-SN', label: 'Серийный номер', group: 'Устройство' },
  { key: '#УСТРОЙСТВО-ЦВЕТ', label: 'Цвет', group: 'Устройство' },
  { key: '#НЕИСПРАВНОСТЬ', label: 'Описание неисправности', group: 'Заказ' },
  { key: '#ДИАГНОЗ', label: 'Диагноз', group: 'Заказ' },
  { key: '#СТАТУС', label: 'Статус заказа', group: 'Заказ' },
  { key: '#МАСТЕР', label: 'Имя мастера', group: 'Сотрудники' },
  { key: '#ЛОКАЦИЯ', label: 'Локация (филиал)', group: 'Компания' },
  { key: '#ГРУППА', label: 'Группа заказа', group: 'Заказ' },
  { key: '#СТОИМОСТЬ', label: 'Стоимость', group: 'Финансы' },
  { key: '#СКИДКА', label: 'Скидка', group: 'Финансы' },
  { key: '#ИТОГО', label: 'Итого (стоимость − скидка)', group: 'Финансы' },
  { key: '#ПРЕДОПЛАТА', label: 'Предоплата', group: 'Финансы' },
  { key: '#К-ОПЛАТЕ', label: 'К оплате (итого − предоплата)', group: 'Финансы' },
  { key: '#ТАБЛИЦА-ЗАПЧАСТЕЙ', label: 'Таблица запчастей', group: 'Таблицы' },
  { key: '#ТАБЛИЦА-ПЛАТЕЖЕЙ', label: 'Таблица платежей', group: 'Таблицы' },
  { key: '#ПОДПИСЬ', label: 'Подпись (документ создан в QAZRem)', group: 'Прочие' },
];

// ============================================================
// GET /print-templates/variables — список доступных переменных
// ============================================================
printTemplatesRouter.get('/variables', async (_req, res) => {
  res.json(AVAILABLE_VARIABLES);
});

// ============================================================
// GET /print-templates/preview/:orderId?templateId= — превью шаблона
// ============================================================
printTemplatesRouter.get('/preview/:orderId', async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const templateId = req.query.templateId as string | undefined;

    // Загружаем заказ со всеми связями
    const orderResult = await pool.query(
      `SELECT
        o.id, o.issue_description, o.diagnosis, o.cost, o.discount,
        o.prepaid, o.created_at,
        os.name AS status_name,
        d.brand, d.model, d.imei, d.serial_number, d.color,
        c.name AS client_name, c.phone AS client_phone, c.email AS client_email, c.address AS client_address,
        u.name AS master_name, og.name AS group_name, l.name AS location_name
      FROM orders o
      JOIN order_statuses os ON os.id = o.status_id
      JOIN devices d ON d.id = o.device_id
      JOIN clients c ON c.id = d.client_id
      LEFT JOIN users u ON u.id = o.master_id
      LEFT JOIN order_groups og ON og.id = o.group_id
      LEFT JOIN locations l ON l.id = o.location_id
      WHERE o.id = $1`,
      [orderId]
    );
    if (orderResult.rows.length === 0) throw new NotFoundError('Заказ');

    // Запчасти
    const partsResult = await pool.query(
      `SELECT op.quantity_used, op.selling_price_at_moment, p.name AS part_name
       FROM order_parts op JOIN parts p ON p.id = op.part_id
       WHERE op.order_id = $1`,
      [orderId]
    );

    // Платежи
    const paymentsResult = await pool.query(
      `SELECT p.amount, pm.name AS method_name, p.created_at
       FROM payments p JOIN payment_methods pm ON pm.id = p.payment_method_id
       WHERE p.order_id = $1 AND p.refunded_at IS NULL
       ORDER BY p.created_at`,
      [orderId]
    );

    const order = orderResult.rows[0];
    const finalCost = Math.max(0, Number(order.cost) - Number(order.discount));
    const toPay = Math.max(0, finalCost - Number(order.prepaid));

    // Загружаем шаблон
    let templateContent: string;
    if (templateId) {
      const tpl = await pool.query('SELECT content FROM print_templates WHERE id = $1', [templateId]);
      if (tpl.rows.length === 0) throw new NotFoundError('Шаблон');
      templateContent = tpl.rows[0].content;
    } else {
      const tpl = await pool.query('SELECT content FROM print_templates WHERE is_default = TRUE LIMIT 1');
      if (tpl.rows.length === 0) {
        templateContent = '<p>Шаблон не найден</p>';
      } else {
        templateContent = tpl.rows[0].content;
      }
    }

    // Строим таблицу запчастей
    let partsTable = '';
    if (partsResult.rows.length > 0) {
      partsTable = '<table><thead><tr><th>Наименование</th><th>Кол-во</th><th>Цена</th></tr></thead><tbody>';
      for (const p of partsResult.rows) {
        partsTable += `<tr><td>${p.part_name}</td><td>${p.quantity_used}</td><td>${Math.round(Number(p.selling_price_at_moment))} ₸</td></tr>`;
      }
      partsTable += '</tbody></table>';
    } else {
      partsTable = '<p style="color:#999">—</p>';
    }

    // Строим таблицу платежей
    let paymentsTable = '';
    if (paymentsResult.rows.length > 0) {
      paymentsTable = '<table><thead><tr><th>Сумма</th><th>Способ</th><th>Дата</th></tr></thead><tbody>';
      for (const p of paymentsResult.rows) {
        paymentsTable += `<tr><td>${Math.round(Number(p.amount))} ₸</td><td>${p.method_name}</td><td>${new Date(p.created_at).toLocaleDateString('ru-RU')}</td></tr>`;
      }
      paymentsTable += '</tbody></table>';
    } else {
      paymentsTable = '<p style="color:#999">—</p>';
    }

    // Подстановка переменных
    const substitutions: Record<string, string> = {
      '#ЗАКАЗ-НОМЕР': String(order.id),
      '#ДАТА-ЗАКАЗ-СОЗДАН': new Date(order.created_at).toLocaleDateString('ru-RU'),
      '#ДАТА-СЕГОДНЯ': new Date().toLocaleDateString('ru-RU'),
      '#КЛИЕНТ-ИМЯ': order.client_name || '—',
      '#КЛИЕНТ-ТЕЛЕФОН': order.client_phone || '—',
      '#КЛИЕНТ-EMAIL': order.client_email || '—',
      '#КЛИЕНТ-АДРЕС': order.client_address || '—',
      '#УСТРОЙСТВО-БРЕНД': order.brand || '—',
      '#УСТРОЙСТВО-МОДЕЛЬ': order.model || '—',
      '#УСТРОЙСТВО-IMEI': order.imei || '—',
      '#УСТРОЙСТВО-SN': order.serial_number || '—',
      '#УСТРОЙСТВО-ЦВЕТ': order.color || '—',
      '#НЕИСПРАВНОСТЬ': order.issue_description || '—',
      '#ДИАГНОЗ': order.diagnosis || '—',
      '#СТАТУС': order.status_name || '—',
      '#МАСТЕР': order.master_name || '—',
      '#ЛОКАЦИЯ': order.location_name || '—',
      '#ГРУППА': order.group_name || '—',
      '#СТОИМОСТЬ': String(Math.round(Number(order.cost))),
      '#СКИДКА': String(Math.round(Number(order.discount))),
      '#ИТОГО': String(finalCost),
      '#ПРЕДОПЛАТА': String(Math.round(Number(order.prepaid))),
      '#К-ОПЛАТЕ': String(toPay),
      '#ТАБЛИЦА-ЗАПЧАСТЕЙ': partsTable,
      '#ТАБЛИЦА-ПЛАТЕЖЕЙ': paymentsTable,
      '#ПОДПИСЬ': 'Документ создан автоматически в QAZRem CRM',
    };

    let html = templateContent;
    for (const [key, value] of Object.entries(substitutions)) {
      html = html.split(key).join(value);
    }

    res.json({ html });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// GET /print-templates — список шаблонов (admin)
// ============================================================
printTemplatesRouter.get('/', requireRole('admin'), async (_req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, name, is_default, created_at, updated_at FROM print_templates ORDER BY is_default DESC, name'
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// ============================================================
// GET /print-templates/:id — один шаблон с содержимым (admin)
// ============================================================
printTemplatesRouter.get('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM print_templates WHERE id = $1', [id]);
    if (result.rows.length === 0) throw new NotFoundError('Шаблон');
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST /print-templates — создать шаблон (admin)
// ============================================================
printTemplatesRouter.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const input = templateSchema.parse(req.body);

    // Если is_default = true, сбрасываем у остальных
    if (input.is_default) {
      await pool.query('UPDATE print_templates SET is_default = FALSE');
    }

    const result = await pool.query(
      `INSERT INTO print_templates (name, content, is_default)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [input.name, input.content, input.is_default ?? false]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// ============================================================
// PUT /print-templates/:id — обновить шаблон (admin)
// ============================================================
printTemplatesRouter.put('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const input = templateSchema.parse(req.body);

    const existing = await pool.query('SELECT id FROM print_templates WHERE id = $1', [id]);
    if (existing.rows.length === 0) throw new NotFoundError('Шаблон');

    if (input.is_default) {
      await pool.query('UPDATE print_templates SET is_default = FALSE WHERE id != $1', [id]);
    }

    const result = await pool.query(
      `UPDATE print_templates
       SET name = $1, content = $2, is_default = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [input.name, input.content, input.is_default ?? false, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// ============================================================
// DELETE /print-templates/:id — удалить шаблон (admin)
// ============================================================
printTemplatesRouter.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM print_templates WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) throw new NotFoundError('Шаблон');
    res.json({ message: 'Удалено' });
  } catch (error) {
    next(error);
  }
});
