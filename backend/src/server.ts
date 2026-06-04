import { app } from './app.js';
import { env } from './config/env.js';
import { closePool } from './db/pool.js';

const server = app.listen(env.API_PORT, () => {
  console.log(`API is running on http://localhost:${env.API_PORT}`);
});

async function shutdown() {
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
