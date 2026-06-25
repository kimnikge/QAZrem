import cors from 'cors';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { AppError } from './lib/errors.js';
import { authRouter } from './routes/auth.js';
import { catalogRouter } from './routes/catalog.js';
import { clientsRouter } from './routes/clients.js';
import { devicesRouter } from './routes/devices.js';
import { expensesRouter } from './routes/expenses.js';
import { financeRouter } from './routes/finance.js';
import { healthRouter } from './routes/health.js';
import { locationsRouter } from './routes/locations.js';
import { ordersRouter } from './routes/orders.js';
import { orderGroupsRouter } from './routes/order-groups.js';
import { partsRouter } from './routes/parts.js';
import { paymentsRouter } from './routes/payments.js';
import { printTemplatesRouter } from './routes/print-templates.js';
import { searchRouter } from './routes/search.js';
import { servicesRouter } from './routes/services.js';
import { settingsRouter } from './routes/settings.js';
import { suppliersRouter } from './routes/suppliers.js';
import { usersRouter } from './routes/users.js';
import { accountsRouter } from './routes/accounts.js';
import { transfersRouter } from './routes/transfers.js';
import { reportsRouter } from './routes/reports.js';
import { warehouseCategoriesRouter } from './routes/warehouse/categories.js';
import { warehouseInventoryRouter } from './routes/warehouse/inventory.js';
import { warehouseReportsRouter } from './routes/warehouse/reports.js';
import { requireAuth } from './middleware/auth.js';

export const app = express();

// Безопасность
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", env.API_CORS_ORIGIN],
    }
  }
}));
app.use(cookieParser());
app.use(cors({ origin: env.API_CORS_ORIGIN }));

// Логгирование запросов
app.use(morgan('short'));

// Ограничение body (1 MB максимум)
app.use(express.json({ limit: '1mb' }));

// Rate limiting на login (макс 10 попыток в минуту)
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Слишком много попыток. Повторите через минуту' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting на мутирующие эндпоинты
// В dev-режиме лимит повышен, чтобы не мешать разработке
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 60 : 1000,
  message: { error: 'Слишком много запросов. Повторите через минуту' },
  standardHeaders: true,
  legacyHeaders: false
});

// Публичные роуты
app.use('/health', healthRouter);
app.use('/auth/login', authLimiter);
app.use('/auth', authRouter);

// Rate limit применяем ко всем защищённым API-роутам
app.use(apiLimiter);

// Защищённые роуты (требуется JWT)
app.use('/search', requireAuth, searchRouter);
app.use('/catalog', requireAuth, catalogRouter);
app.use('/clients', requireAuth, clientsRouter);
app.use('/locations', requireAuth, locationsRouter);
app.use('/devices', devicesRouter);
app.use('/orders', ordersRouter);
app.use('/order-groups', requireAuth, orderGroupsRouter);
app.use('/services', requireAuth, servicesRouter);
app.use('/parts', partsRouter);
app.use('/payments', paymentsRouter);
app.use('/expenses', expensesRouter);
app.use('/finance', financeRouter);
app.use('/settings', settingsRouter);
app.use('/suppliers', requireAuth, suppliersRouter);
app.use('/print-templates', printTemplatesRouter);
app.use('/users', usersRouter);
app.use('/accounts', requireAuth, accountsRouter);
app.use('/warehouse/categories', requireAuth, warehouseCategoriesRouter);
app.use('/warehouse/inventory', requireAuth, warehouseInventoryRouter);
app.use('/warehouse/reports', requireAuth, warehouseReportsRouter);
app.use('/transfers', requireAuth, transfersRouter);
app.use('/reports', requireAuth, reportsRouter);

// Централизованная обработка ошибок
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    res.status(400).json({ error: 'Ошибка валидации', details: error.flatten() });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  console.error('[Error]', error);

  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } else {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка сервера';
    res.status(500).json({ error: message });
  }
});
