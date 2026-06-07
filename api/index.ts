import express from 'express';
import { app } from '../backend/src/app.js';

// Vercel serverless: оборачиваем Express под /api,
// т.к. в production все API-запросы идут с префиксом /api.
// В dev режиме бэкенд работает напрямую без префикса (на порту 4000).
const wrapper = express();
wrapper.use('/api', app);

export default wrapper;
