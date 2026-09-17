// ═══════════════════════════════════════════════════════════
// Ручной/CRON-запуск проверки залежавшихся запчастей.
//
//   npm run stale-check            # дефолт: 30 дней
//   npm run stale-check -- 90      # свой порог
//
// Пример cron (ежедневно в 09:00):
//   0 9 * * * cd /path/to/backend && npm run stale-check >> stale.log 2>&1
// ═══════════════════════════════════════════════════════════

import { closePool } from '../db/pool.js';
import { runStaleCheck } from '../services/notifications.service.js';

const days = Number(process.argv[2]) || 30;

runStaleCheck(days)
  .then((count) => {
    console.log(`[stale-check] порог ${days} дн., создано уведомлений: ${count}`);
  })
  .catch((error) => {
    console.error('[stale-check] ошибка:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closePool());
