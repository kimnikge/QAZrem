import express from 'express';

// Импортируем скомпилированный backend (tsc → backend/dist/)
import { app } from '../backend/dist/app.js';

// Vercel serverless: оборачиваем Express под /api,
// т.к. в production все API-запросы идут с префиксом /api.
const wrapper = express();
wrapper.use('/api', app);

export default wrapper;

