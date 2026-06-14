import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, RefreshCw, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getOrder, getOrderStatuses, updateOrderStatus, updateOrder, getSettings, getOrderGroups,
  type OrderDetail, type AvailableStatus, type SettingsData, type OrderGroup } from '../api';
import { OrderInfoCard } from '../components/OrderInfoCard';
import { OrderPaymentsCard } from '../components/OrderPaymentsCard';
import { STATUS_LABELS } from '../constants';
import { buildOrderPatchBody } from '../utils';

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [availableStatuses, setAvailableStatuses] = useState<AvailableStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editCost, setEditCost] = useState('');
  const [editDiscount, setEditDiscount] = useState('');
  const [editDiagnosis, setEditDiagnosis] = useState('');
  const [editComment, setEditComment] = useState('');
  const [editGroupId, setEditGroupId] = useState('');
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [groups, setGroups] = useState<OrderGroup[]>([]);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const [o, s] = await Promise.all([getOrder(Number(id)), getOrderStatuses(Number(id))]);
      setOrder(o); setAvailableStatuses(s.available);
      setEditCost(String(Math.round(Number(o.cost))));
      setEditDiscount(String(Math.round(Number(o.discount))));
      setEditDiagnosis(o.diagnosis || ''); setEditComment(o.internal_comment || '');
      setEditGroupId(o.group_id ? String(o.group_id) : '');
      getSettings().then(setSettings).catch(() => {});
      getOrderGroups().then(setGroups).catch(() => {});
    } catch (err) { setError(err instanceof Error ? err.message : 'Ошибка загрузки'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [id]);

  async function handleSave() {
    if (!order) return;
    setSaving(true);
    try {
      const body = buildOrderPatchBody(order, { editCost, editDiscount, editDiagnosis, editComment, editGroupId });
      if (Object.keys(body).length > 0) {
        await updateOrder(Number(id), body);
      }
      setEditing(false); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Ошибка сохранения'); }
    finally { setSaving(false); }
  }

  async function handleStatusChange(slug: string) {
    try { await updateOrderStatus(Number(id), slug); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Ошибка смены статуса'); }
  }

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
          <button className="btn-icon" onClick={() => navigate(`/print-order/${order.id}`)}><Printer size={18} /></button>
          {editing ? (
            <button className="btn-primary" onClick={handleSave} disabled={saving}><Save size={16} /> {saving ? 'Сохранение...' : 'Сохранить'}</button>
          ) : (
            <button className="btn-secondary" onClick={() => setEditing(true)}>Редактировать</button>
          )}
        </div>
      </div>

      <div className="detail-grid">
        <OrderInfoCard order={order} editing={editing}
          editCost={editCost} onEditCost={setEditCost} editDiscount={editDiscount} onEditDiscount={setEditDiscount}
          editDiagnosis={editDiagnosis} onEditDiagnosis={setEditDiagnosis} editComment={editComment} onEditComment={setEditComment}
          editGroupId={editGroupId} onEditGroupId={setEditGroupId} groups={groups} />

        {availableStatuses.length > 0 && (
          <div className="detail-card">
            <h3>Смена статуса</h3>
            <div className="status-actions">
              {availableStatuses.map(s => (
                <button key={s.slug} className="btn-status" onClick={() => handleStatusChange(s.slug)}>{STATUS_LABELS[s.slug] || s.name}</button>
              ))}
            </div>
          </div>
        )}

        {!editing && (
          <>
            <div className="detail-card"><h3>Проблема</h3><p>{order.issue_description}</p></div>
            {order.parts.length > 0 && (
              <div className="detail-card">
                <h3>Запчасти</h3>
                {order.parts.map(p => (
                  <div key={p.id} className="detail-row"><span>{p.part_name} ×{p.quantity_used}</span><strong>{Math.round(Number(p.selling_price_at_moment))} ₸</strong></div>
                ))}
              </div>
            )}
            <OrderPaymentsCard order={order} settings={settings} userRole={user?.role} onRefresh={load} onError={setError} />
            <div className="detail-card detail-card-full">
              <h3>История</h3>
              {order.history.map(h => (
                <div key={h.id} className="history-item">
                  <div className="history-status">{h.from_status_name && <span>{h.from_status_name} → </span>}<strong>{h.to_status_name}</strong></div>
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
