import { env } from '../config/env.js';

export async function sendTelegramMessage(text: string) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return { sent: false, reason: 'Telegram environment variables are not configured' };
  }

  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'HTML'
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram API failed: ${response.status} ${body}`);
  }

  return { sent: true };
}
