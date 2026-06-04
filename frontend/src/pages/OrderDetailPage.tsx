import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { getOrder, getOrderStatuses, updateOrderStatus, type OrderDetail, type AvailableStatus } from '../api';

const statusLabels: Record<string, string> = {
  new: 'Новая', diagnosis: 'Диагностика', waiting_parts: 'Ожидание запчасти',
  repair: 'Ремонт', ready: 'Готов к выдаче', completed: 'Выдан', cancelled: 'Отказ'
};

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [availableStatuses, setAvailableStatuses] = useState<AvailableStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const [o, s] = await Promise.all([
        getOrder(Number(id)),
        getOrderStatuses(Number(id))
      ]);
      setOrder(o);
      setAvailableStatuses(s.available);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleStatusChange(slug: string) {
    try {
      await updateOrderStatus(Number(id), slug);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка смены статуса');
    }
  }

  if (loading) return <div className="loading">Загрузка...</div>;
  if (error) return <div className="error-message">{error}</div>;
  if (!order) return <div className="error-message">Заказ не найден</div>;

  return (
    <div>
      <div className="page-header">
        <Link to="/" className="btn-icon"><ArrowLeft size={20} /></Link>
        <h2>Заказ №{order.id}</h2>
        <button onClick={load} className="btn-icon"><RefreshCw size={18} /></button>
      </div>

      <div className="detail-grid">
        <div className="detail-card">
          <h3>Информация</h3>
          <div className="detail-row"><span>Клиент</span><strong>{order.client_name}</strong></div>
          <div className="detail-row"><span>Телефон</span><strong>{order.client_phone}</strong></div>
          <div className="detail-row"><span>Устройство</span><strong>{order.brand} {order.model}</strong></div>
          <div className="detail-row"><span>IMEI</span><code>{order.imei}</code></div>
          <div className="detail-row"><span>Статус</span><strong>{statusLabels[order.status_slug]}</strong></div>
          {order.diagnosis && <div className="detail-row"><span>Диагноз</span>{order.diagnosis}</div>}
          <div className="detail-row"><span>Стоимость</span><strong>{Number(order.cost).toLocaleString()} ₽</strong></div>
          <div className="detail-row"><span>Предоплата</span><strong>{Number(order.prepaid).toLocaleString()} ₽</strong></div>
        </div>

        {availableStatuses.length > 0 && (
          <div className="detail-card">
            <h3>Смена статуса</h3>
            <div className="status-actions">
              {availableStatuses.map(s => (
                <button key={s.slug} className="btn-status" onClick={() => handleStatusChange(s.slug)}>
                  {statusLabels[s.slug] || s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="detail-card">
          <h3>Проблема</h3>
          <p>{order.issue_description}</p>
        </div>

        {order.parts.length > 0 && (
          <div className="detail-card">
            <h3>Запчасти</h3>
            {order.parts.map(p => (
              <div key={p.id} className="detail-row">
                <span>{p.part_name} ×{p.quantity_used}</span>
                <strong>{Number(p.selling_price_at_moment).toLocaleString()} ₽</strong>
              </div>
            ))}
          </div>
        )}

        {order.payments.length > 0 && (
          <div className="detail-card">
            <h3>Платежи</h3>
            {order.payments.map(p => (
              <div key={p.id} className="detail-row">
                <span>{p.payment_method_name} {p.is_prepayment ? '(предоплата)' : '(доплата)'}</span>
                <strong>{Number(p.amount).toLocaleString()} ₽</strong>
              </div>
            ))}
          </div>
        )}

        <div className="detail-card detail-card-full">
          <h3>История</h3>
          {order.history.map(h => (
            <div key={h.id} className="history-item">
              <div className="history-status">
                {h.from_status_name && <span>{h.from_status_name} → </span>}
                <strong>{h.to_status_name}</strong>
              </div>
              {h.comment && <div className="history-comment">{h.comment}</div>}
              <div className="history-meta">
                {h.user_name} · {new Date(h.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
