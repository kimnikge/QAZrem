import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOrders, type Order } from '../api';

const statusLabels: Record<string, string> = {
  new: 'Новая', diagnosis: 'Диагностика', waiting_parts: 'Ожидание запчасти',
  repair: 'Ремонт', ready: 'Готов к выдаче', completed: 'Выдан', cancelled: 'Отказ'
};

const statusColors: Record<string, string> = {
  new: 's-new', diagnosis: 's-diagnosis', waiting_parts: 's-waiting',
  repair: 's-repair', ready: 's-ready', completed: 's-completed', cancelled: 's-cancelled'
};

export function DashboardPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState('active');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const statusMap: Record<string, string | undefined> = {
      active: undefined, new: 'new', diagnosis: 'diagnosis',
      waiting_parts: 'waiting_parts', repair: 'repair',
      ready: 'ready', completed: 'completed', cancelled: 'cancelled'
    };
    getOrders({ status: statusMap[tab], limit: 100 })
      .then(res => setOrders(res.orders))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [tab]);

  const counts = {
    new: orders.filter(o => o.status_slug === 'new').length,
    diagnosis: orders.filter(o => o.status_slug === 'diagnosis').length,
    waiting_parts: orders.filter(o => o.status_slug === 'waiting_parts').length,
    repair: orders.filter(o => o.status_slug === 'repair').length,
    ready: orders.filter(o => o.status_slug === 'ready').length,
  };

  const tabs = [
    { key: 'active', label: 'Активные', count: orders.filter(o => !['completed','cancelled'].includes(o.status_slug)).length },
    { key: 'new', label: 'Новые', count: counts.new },
    { key: 'diagnosis', label: 'Диагностика', count: counts.diagnosis },
    { key: 'repair', label: 'Ремонт', count: counts.repair },
    { key: 'ready', label: 'Готовы', count: counts.ready },
    { key: 'completed', label: 'Завершённые', count: orders.filter(o => o.status_slug === 'completed').length },
  ];

  const statCards = [
    { label: 'Новые заявки', value: counts.new, color: '#3b82f6' },
    { label: 'В работе', value: counts.diagnosis + counts.repair + counts.waiting_parts, color: '#f59e0b' },
    { label: 'Готовы к выдаче', value: counts.ready, color: '#22c55e' },
    { label: 'К оплате', value: orders.reduce((s, o) => s + (Number(o.cost) - Number(o.prepaid)), 0), color: '#8b5cf6', currency: true },
  ];

  return (
    <div className="ro-dashboard">
      <div className="ro-stats">
        {statCards.map(c => (
          <div key={c.label} className="ro-stat-card" style={{ borderLeftColor: c.color }}>
            <span className="ro-stat-value">{c.currency ? `${c.value.toLocaleString()} ₸` : c.value}</span>
            <span className="ro-stat-label">{c.label}</span>
          </div>
        ))}
      </div>

      <div className="ro-tabs">
        {tabs.map(t => (
          <button key={t.key} className={`ro-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
            {t.count > 0 && <span className="ro-tab-count">{t.count}</span>}
          </button>
        ))}
      </div>

      <div className="ro-actions">
        <button className="ro-btn-primary" onClick={() => navigate('/create-order')}>+ Заказ</button>
      </div>

      {loading ? <div className="loading">Загрузка...</div> : (
        <div className="ro-table-wrap">
          <table className="ro-table">
            <thead>
              <tr>
                <th>№</th>
                <th>Статус</th>
                <th>Клиент</th>
                <th>Устройство</th>
                <th>Проблема</th>
                <th>Создан</th>
                <th>Сумма</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="ro-row" onClick={() => navigate(`/orders/${o.id}`)}>
                  <td className="ro-cell-id">#{o.id}</td>
                  <td><span className={`ro-badge ${statusColors[o.status_slug]}`}>{statusLabels[o.status_slug]}</span></td>
                  <td className="ro-cell-client">
                    <strong>{o.client_name}</strong>
                    <span>{o.client_phone}</span>
                  </td>
                  <td>{o.brand} {o.model}</td>
                  <td className="ro-cell-desc">{o.issue_description}</td>
                  <td className="ro-cell-date">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="ro-cell-price">{Number(o.cost).toLocaleString()} ₸</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && orders.length === 0 && <div className="empty-state"><p>Нет заказов</p></div>}
    </div>
  );
}
