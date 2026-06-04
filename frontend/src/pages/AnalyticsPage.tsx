import { useEffect, useState } from 'react';
import { getOrders, getFinanceReport, type Order, type FinanceReport } from '../api';

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

  const byStatus: Record<string, number> = {};
  orders.forEach(o => { byStatus[o.status_slug] = (byStatus[o.status_slug] || 0) + 1; });

  const urgentCount = orders.filter(o => o.priority === 'urgent' || o.priority === 'critical').length;
  const overdueCount = orders.filter(o => o.deadline && new Date(o.deadline) < new Date() && !['completed', 'cancelled'].includes(o.status_slug)).length;
  const avgCost = orders.filter(o => Number(o.cost) > 0).reduce((s, o) => s + Number(o.cost), 0) / Math.max(orders.filter(o => Number(o.cost) > 0).length, 1);

  return (
    <div className="ro-dashboard">
      <div className="page-header"><h2>Аналитика</h2></div>
      <div className="ro-stats">
        <div className="ro-stat-card" style={{ borderLeftColor: '#3b82f6' }}>
          <span className="ro-stat-value">{orders.length}</span>
          <span className="ro-stat-label">Всего заказов</span>
        </div>
        <div className="ro-stat-card" style={{ borderLeftColor: '#ef4444' }}>
          <span className="ro-stat-value">{urgentCount}</span>
          <span className="ro-stat-label">Срочных</span>
        </div>
        <div className="ro-stat-card" style={{ borderLeftColor: '#f59e0b' }}>
          <span className="ro-stat-value">{overdueCount}</span>
          <span className="ro-stat-label">Просрочено</span>
        </div>
        <div className="ro-stat-card" style={{ borderLeftColor: '#22c55e' }}>
          <span className="ro-stat-value">{avgCost.toLocaleString()} ₸</span>
          <span className="ro-stat-label">Средний чек</span>
        </div>
        {report && (
          <div className="ro-stat-card" style={{ borderLeftColor: '#8b5cf6' }}>
            <span className="ro-stat-value">{report.profit.toLocaleString()} ₸</span>
            <span className="ro-stat-label">Прибыль за год</span>
          </div>
        )}
      </div>

      <div className="ro-table-wrap">
        <table className="ro-table">
          <thead><tr><th>Статус</th><th>Количество</th></tr></thead>
          <tbody>
            {Object.entries(byStatus).map(([slug, count]) => (
              <tr key={slug}><td>{slug}</td><td><strong>{count}</strong></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
