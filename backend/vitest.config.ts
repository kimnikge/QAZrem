import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Загружаем корневой .env (DATABASE_URL, ADMIN_LOGIN/ADMIN_PASSWORD и т.д.)
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
