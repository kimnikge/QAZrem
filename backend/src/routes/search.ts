import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';

export const searchRouter = Router();

const searchSchema = z.object({
  q: z.string().min(1, 'Поисковый запрос не может быть пустым')
});

searchRouter.get('/', async (req, res, next) => {
  try {
    const { q } = searchSchema.parse(req.query);

    const searchPattern = `%${q}%`;

    // Ищем клиентов + их устройства одним запросом
    const result = await pool.query(
      `
        SELECT
          c.id AS client_id,
          c.name AS client_name,
          c.phone AS client_phone,
          c.email AS client_email,
          c.total_spent AS client_total_spent,
          c.created_at AS client_created_at,
          d.id AS device_id,
          d.brand AS device_brand,
          d.model AS device_model,
          d.imei AS device_imei,
          d.serial_number AS device_serial_number,
          d.color AS device_color
        FROM clients c
        LEFT JOIN devices d ON d.client_id = c.id
        WHERE
          c.name ILIKE $1
          OR c.phone ILIKE $1
          OR d.imei ILIKE $1
          OR d.serial_number ILIKE $1
          OR d.brand ILIKE $1
          OR d.model ILIKE $1
        ORDER BY c.name, d.model
      `,
      [searchPattern]
    );

    // Группируем: клиент → его устройства
    const clientMap = new Map<number, {
      client: {
        id: number;
        name: string;
        phone: string;
        email: string | null;
        totalSpent: number;
        createdAt: string;
      };
      devices: Array<{
        id: number;
        brand: string;
        model: string;
        imei: string;
        serialNumber: string | null;
        color: string | null;
      }>;
    }>();

    for (const row of result.rows) {
      if (!clientMap.has(row.client_id)) {
        clientMap.set(row.client_id, {
          client: {
            id: row.client_id,
            name: row.client_name,
            phone: row.client_phone,
            email: row.client_email,
            totalSpent: Number(row.client_total_spent),
            createdAt: row.client_created_at
          },
          devices: []
        });
      }

      if (row.device_id) {
        clientMap.get(row.client_id)!.devices.push({
          id: row.device_id,
          brand: row.device_brand,
          model: row.device_model,
          imei: row.device_imei,
          serialNumber: row.device_serial_number,
          color: row.device_color
        });
      }
    }

    const clients = Array.from(clientMap.values());

    // Определяем тип совпадения
    let matchType: 'exact_device' | 'exact_phone' | 'partial_name' | 'no_results' = 'no_results';

    if (clients.length > 0) {
      const hasExactImei = clients.some(({ devices }) =>
        devices.some((d) => d.imei === q)
      );
      const hasExactPhone = clients.some(({ client }) => client.phone === q);

      if (hasExactImei) {
        matchType = 'exact_device';
      } else if (hasExactPhone) {
        matchType = 'exact_phone';
      } else {
        matchType = 'partial_name';
      }
    }

    res.json({ matchType, clients });
  } catch (error) {
    next(error);
  }
});
