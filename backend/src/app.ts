import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { AppError } from './lib/errors.js';
import { authRouter } from './routes/auth.js';
import { clientsRouter } from './routes/clients.js';
import { devicesRouter } from './routes/devices.js';
import { expensesRouter } from './routes/expenses.js';
import { financeRouter } from './routes/finance.js';
import { healthRouter } from './routes/health.js';
import { ordersRouter } from './routes/orders.js';
import { partsRouter } from './routes/parts.js';
import { paymentsRouter } from './routes/payments.js';
import { searchRouter } from './routes/search.js';
import { settingsRouter } from './routes/settings.js';
import { usersRouter } from './routes/users.js';

export const app = express();

// Безопасность
app.use(helmet());
app.use(cors({ origin: env.API_CORS_ORIGIN }));

// Логгирование запросов
app.use(morgan('short'));

// Ограничение body (10 MB максимум)
app.use(express.json({ limit: '10mb' }));

// Rate limiting на login (макс 10 попыток в минуту)
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Слишком много попыток. Повторите через минуту' },
  standardHeaders: true,
  legacyHeaders: false
});

// Публичные роуты
app.use('/health', healthRouter);
app.use('/auth/login', authLimiter);
app.use('/auth', authRouter);

// Защищённые роуты (авторизация внутри каждого роута)
app.use('/search', searchRouter);
app.use('/clients', clientsRouter);
app.use('/devices', devicesRouter);
app.use('/orders', ordersRouter);
app.use('/parts', partsRouter);
app.use('/payments', paymentsRouter);
app.use('/expenses', expensesRouter);
app.use('/finance', financeRouter);
app.use('/settings', settingsRouter);
app.use('/users', usersRouter);

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

  const message = error instanceof Error ? error.message : 'Неизвестная ошибка сервера';
  console.error('[Error]', error);
  res.status(500).json({ error: message });
});
