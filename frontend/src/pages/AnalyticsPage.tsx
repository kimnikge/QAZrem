import { useEffect, useState } from 'react';
import { getOrders, getFinanceReport, type Order, type FinanceReport } from '../api';

const masterColors: Record<number, { name: string; color: string; bg: string }> = {
  2: { name: 'Алексей Петров', color: '#1a4fba', bg: '#e8f0fe' },
  3: { name: 'Дмитрий Соколов', color: '#137333', bg: '#e6f4ea' },
  4: { name: 'Сергей Иванов', color: '#b45309', bg: '#fef7e0' },
  5: { name: 'Артём Кузнецов', color: '#6b21a8', bg: '#f3e8ff' },
};

const statusLabels: Record<string, string> = {
  new: 'Новая', diagnosis: 'Диагностика', waiting_parts: 'Ожидание',
  repair: 'Ремонт', ready: 'Готов', completed: 'Выдан', cancelled: 'Отказ'
};

export function AnalyticsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [report, setReport] = useState<FinanceReport | null>(null);

  useEffect(() => {
    const now = new Date();
    const from = `${now.getFullYear()}-01-01`;
    const to = `${now.getFullYear()}-12-31`;
    Promise.all([
      getOrders({ limit: 200 }),
      getFinanceReport(from, to)
    ]).then(([o, r]) => { setOrders(o.orders); setReport(r); }).catch(console.error);
  }, []);

  // Группировка заказов по мастерам
  const byMaster: Record<number, { masterName: string; orders: Order[] }> = {};
  const unassigned: Order[] = [];

  orders.forEach(o => {
    if (o.master_id && masterColors[o.master_id]) {
      if (!byMaster[o.master_id]) {
        byMaster[o.master_id] = { masterName: masterColors[o.master_id].name, orders: [] };
      }
      byMaster[o.master_id].orders.push(o);
    } else {
      unassigned.push(o);
    }
  });

  const totalCost = orders.reduce((s, o) => s + Number(o.cost), 0);
  const urgentCount = orders.filter(o => o.priority === 'urgent' || o.priority === 'critical').length;
  const overdueCount = orders.filter(o => o.deadline && new Date(o.deadline) < new Date() && !['completed', 'cancelled'].includes(o.status_slug)).length;
  const completedCount = orders.filter(o => o.status_slug === 'completed').length;

  return (
    <div className="ro-dashboard">
      <div className="page-header"><h2>Аналитика</h2></div>

      {/* Общая статистика */}
      <div className="ro-stats">
        <div className="ro-stat-card" style={{ borderLeftColor: '#3b82f6' }}>
          <span className="ro-stat-value">{orders.length}</span>
          <span className="ro-stat-label">Всего заказов</span>
        </div>
        <div className="ro-stat-card" style={{ borderLeftColor: '#22c55e' }}>
          <span className="ro-stat-value">{completedCount}</span>
          <span className="ro-stat-label">Завершено</span>
        </div>
        <div className="ro-stat-card" style={{ borderLeftColor: '#ef4444' }}>
          <span className="ro-stat-value">{urgentCount}</span>
          <span className="ro-stat-label">Срочных</span>
        </div>
        <div className="ro-stat-card" style={{ borderLeftColor: '#f59e0b' }}>
          <span className="ro-stat-value">{overdueCount}</span>
          <span className="ro-stat-label">Просрочено</span>
        </div>
        <div className="ro-stat-card" style={{ borderLeftColor: '#8b5cf6' }}>
          <span className="ro-stat-value">{totalCost.toLocaleString()} ₸</span>
          <span className="ro-stat-label">Общая сумма</span>
        </div>
        {report && (
          <div className="ro-stat-card" style={{ borderLeftColor: '#06b6d4' }}>
            <span className="ro-stat-value">{report.profit.toLocaleString()} ₸</span>
            <span className="ro-stat-label">Прибыль за год</span>
          </div>
        )}
      </div>

      {/* Разбивка по мастерам */}
      <h3 style={{ marginBottom: 12, fontSize: 16, fontWeight: 600 }}>По мастерам</h3>
      <div className="ro-stats">
        {Object.entries(byMaster).map(([id, data]) => {
          const mc = masterColors[Number(id)];
          const activeOrders = data.orders.filter(o => !['completed', 'cancelled'].includes(o.status_slug)).length;
          const masterCost = data.orders.reduce((s, o) => s + Number(o.cost), 0);
          return (
            <div key={id} className="ro-stat-card" style={{ borderLeftColor: mc.color, background: mc.bg }}>
              <span className="ro-stat-value" style={{ color: mc.color, fontSize: 18 }}>{data.masterName}</span>
              <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                <div><span style={{ fontSize: 22, fontWeight: 700 }}>{data.orders.length}</span><span style={{ fontSize: 12, color: '#5f6368', marginLeft: 4 }}>всего</span></div>
                <div><span style={{ fontSize: 22, fontWeight: 700 }}>{activeOrders}</span><span style={{ fontSize: 12, color: '#5f6368', marginLeft: 4 }}>в работе</span></div>
              </div>
              <div style={{ fontSize: 13, color: '#5f6368', marginTop: 4 }}>{masterCost.toLocaleString()} ₸</div>
            </div>
          );
        })}
      </div>

      {/* Таблица: заказы каждого мастера */}
      <div className="ro-table-wrap" style={{ marginTop: 16 }}>
        <table className="ro-table">
          <thead>
            <tr>
              <th>Заказ</th>
              <th>Мастер</th>
              <th>Статус</th>
              <th>Приоритет</th>
              <th>Клиент</th>
              <th>Устройство</th>
              <th>Сумма</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => {
              const mc = o.master_id ? masterColors[o.master_id] : null;
              return (
                <tr key={o.id} className="ro-row" style={mc ? { borderLeft: `3px solid ${mc.color}` } : {}}>
                  <td className="ro-cell-id">#{o.id}</td>
                  <td style={mc ? { color: mc.color, fontWeight: 500 } : {}}>
                    {mc ? mc.name : '—'}
                  </td>
                  <td><span className={`ro-badge s-${o.status_slug}`}>{statusLabels[o.status_slug]}</span></td>
                  <td>{o.priority !== 'normal' && <span className={`ro-priority ${o.priority}`}>{o.priority === 'urgent' ? 'Срочно' : 'Критично'}</span>}</td>
                  <td className="ro-cell-client">
                    <strong>{o.client_name}</strong>
                    <span>{o.client_phone}</span>
                  </td>
                  <td>{o.brand} {o.model}</td>
                  <td className="ro-cell-price">{Number(o.cost).toLocaleString()} ₸</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
