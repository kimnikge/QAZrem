import express from 'express';
import { app } from '../backend/src/app.ts';

// Vercel serverless: оборачиваем Express под /api
const wrapper = express();
wrapper.use('/api', app);

export default wrapper;

