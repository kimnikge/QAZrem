import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Plus, RefreshCw } from 'lucide-react';
import { getOrders, type Order } from '../api';

const statusColors: Record<string, string> = {
  new: 'status-new',
  diagnosis: 'status-diagnosis',
  waiting_parts: 'status-waiting',
  repair: 'status-repair',
  ready: 'status-ready',
  completed: 'status-completed',
  cancelled: 'status-cancelled'
};

const statusLabels: Record<string, string> = {
  new: 'Новая',
  diagnosis: 'Диагностика',
  waiting_parts: 'Ожидание запчасти',
  repair: 'Ремонт',
  ready: 'Готов к выдаче',
  completed: 'Выдан',
  cancelled: 'Отказ'
};

export function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await getOrders({ status: filter || undefined, limit: 50 });
      setOrders(res.orders);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filter]);

  const activeCount = orders.filter(o => !['completed', 'cancelled'].includes(o.status_slug)).length;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">
          <ClipboardList size={24} />
          <h2>Заказы</h2>
          {!loading && <span className="badge">{activeCount} активных</span>}
        </div>
        <div className="page-actions">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="filter-select">
            <option value="">Все статусы</option>
            <option value="new">Новые</option>
            <option value="diagnosis">Диагностика</option>
            <option value="waiting_parts">Ожидание запчасти</option>
            <option value="repair">Ремонт</option>
            <option value="ready">Готов к выдаче</option>
            <option value="completed">Выдан</option>
            <option value="cancelled">Отказ</option>
          </select>
          <button onClick={load} className="btn-icon" title="Обновить"><RefreshCw size={18} /></button>
          <Link to="/create-order" className="btn-primary">
            <Plus size={18} />
            Новый заказ
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="loading">Загрузка...</div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <ClipboardList size={48} />
          <p>Нет заказов</p>
          <Link to="/create-order" className="btn-primary">Создать первый заказ</Link>
        </div>
      ) : (
        <div className="order-list">
          {orders.map(order => (
            <Link to={`/orders/${order.id}`} key={order.id} className="order-card">
              <div className="order-card-top">
                <span className={`status-badge ${statusColors[order.status_slug]}`}>
                  {statusLabels[order.status_slug]}
                </span>
                <span className="order-cost">{Number(order.cost).toLocaleString()} ₽</span>
              </div>
              <div className="order-card-main">
                <strong>{order.brand} {order.model}</strong>
                <span className="order-client">{order.client_name} — {order.client_phone}</span>
              </div>
              <div className="order-card-bottom">
                <span className="order-issue">{order.issue_description}</span>
                <span className="order-date">{new Date(order.created_at).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
