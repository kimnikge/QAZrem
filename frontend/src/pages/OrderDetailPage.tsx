import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, RefreshCw, Save } from 'lucide-react';
import { getOrder, getOrderStatuses, updateOrderStatus, type OrderDetail, type AvailableStatus } from '../api';

const statusLabels: Record<string, string> = {
  new: 'Новая', diagnosis: 'Диагностика', waiting_parts: 'Ожидание запчасти',
  repair: 'Ремонт', ready: 'Готов к выдаче', completed: 'Выдан', cancelled: 'Отказ'
};

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [availableStatuses, setAvailableStatuses] = useState<AvailableStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [editCost, setEditCost] = useState('');
  const [editDiscount, setEditDiscount] = useState('');
  const [editDiagnosis, setEditDiagnosis] = useState('');
  const [editComment, setEditComment] = useState('');

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
      setEditCost(o.cost);
      setEditDiscount(o.discount);
      setEditDiagnosis(o.diagnosis || '');
      setEditComment(o.internal_comment || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (editCost !== order?.cost) body.cost = Number(editCost);
      if (editDiscount !== order?.discount) body.discount = Number(editDiscount);
      if (editDiagnosis !== (order?.diagnosis || '')) body.diagnosis = editDiagnosis;
      if (editComment !== (order?.internal_comment || '')) body.internal_comment = editComment;

      if (Object.keys(body).length > 0) {
        const token = localStorage.getItem('token');
        const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
        await fetch(`${apiUrl}/orders/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body)
        });
      }
      setEditing(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(slug: string) {
    try {
      await updateOrderStatus(Number(id), slug);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка смены статуса');
    }
  }

  const finalCost = order ? Math.max(0, Number(order.cost) - Number(order.discount)) : 0;

  if (loading) return <div className="loading">Загрузка...</div>;
  if (error) return <div className="error-message">{error}</div>;
  if (!order) return <div className="error-message">Заказ не найден</div>;

  return (
    <div>
      <div className="page-header">
        <Link to="/" className="btn-icon"><ArrowLeft size={20} /></Link>
        <h2>Заказ №{order.id}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-icon" onClick={load}><RefreshCw size={18} /></button>
          <button className="btn-icon" onClick={() => window.open(`/print-order/${order.id}`, '_blank')}><Printer size={18} /></button>
          {editing ? (
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              <Save size={16} /> {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          ) : (
            <button className="btn-secondary" onClick={() => setEditing(true)}>Редактировать</button>
          )}
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-card">
          <h3>Информация</h3>
          <div className="detail-row"><span>Клиент</span><strong>{order.client_name}</strong></div>
          <div className="detail-row"><span>Телефон</span><strong>{order.client_phone}</strong></div>
          <div className="detail-row"><span>Устройство</span><strong>{order.brand} {order.model}</strong></div>
          <div className="detail-row"><span>IMEI</span><code>{order.imei}</code></div>
          <div className="detail-row"><span>Статус</span><strong>{statusLabels[order.status_slug]}</strong></div>
          <div className="detail-row"><span>Мастер</span><strong>{order.master_name || '—'}</strong></div>

          {editing ? (
            <>
              <div className="detail-row">
                <span>Диагноз</span>
                <input value={editDiagnosis} onChange={e => setEditDiagnosis(e.target.value)} style={{ width: '60%', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
              </div>
              <div className="detail-row">
                <span>Стоимость</span>
                <input value={editCost} onChange={e => setEditCost(e.target.value)} type="number" style={{ width: '40%', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, textAlign: 'right' }} />
              </div>
              <div className="detail-row">
                <span>Скидка</span>
                <input value={editDiscount} onChange={e => setEditDiscount(e.target.value)} type="number" style={{ width: '40%', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, textAlign: 'right' }} />
              </div>
              <div className="detail-row">
                <span>Комментарий</span>
                <input value={editComment} onChange={e => setEditComment(e.target.value)} style={{ width: '60%', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
              </div>
            </>
          ) : (
            <>
              {order.diagnosis && <div className="detail-row"><span>Диагноз</span>{order.diagnosis}</div>}
              <div className="detail-row"><span>Стоимость</span><strong>{Number(order.cost).toLocaleString()} ₸</strong></div>
              {Number(order.discount) > 0 && <div className="detail-row"><span>Скидка</span><strong style={{ color: '#ef4444' }}>−{Number(order.discount).toLocaleString()} ₸</strong></div>}
              <div className="detail-row"><span>Итого</span><strong style={{ color: '#1a73e8', fontSize: 18 }}>{finalCost.toLocaleString()} ₸</strong></div>
              <div className="detail-row"><span>Предоплата</span><strong>{Number(order.prepaid).toLocaleString()} ₸</strong></div>
              {order.internal_comment && <div className="detail-row"><span>Комментарий</span>{order.internal_comment}</div>}
            </>
          )}
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

        {!editing && (
          <>
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
                    <strong>{Number(p.selling_price_at_moment).toLocaleString()} ₸</strong>
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
                    <strong>{Number(p.amount).toLocaleString()} ₸</strong>
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
                  <div className="history-meta">{h.user_name} · {new Date(h.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
