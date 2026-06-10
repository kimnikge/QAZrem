import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, RefreshCw, Save, PlusCircle, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getOrder, getOrderStatuses, updateOrderStatus, createPayment, deletePayment, refundPayment, getSettings, getOrderGroups, createOrderGroup,
  type OrderDetail, type AvailableStatus, type SettingsData, type OrderGroup } from '../api';

const statusLabels: Record<string, string> = {
  new: 'Новая', diagnosis: 'Диагностика', waiting_parts: 'Ожидание запчасти',
  repair: 'Ремонт', ready: 'Готов к выдаче', completed: 'Выдан', cancelled: 'Отказ'
};

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

  // Editable fields
  const [editCost, setEditCost] = useState('');
  const [editDiscount, setEditDiscount] = useState('');
  const [editDiagnosis, setEditDiagnosis] = useState('');
  const [editComment, setEditComment] = useState('');

  // Payment form
  const [showPayment, setShowPayment] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<number>(0);
  const [payPrepayment, setPayPrepayment] = useState(false);
  const [paySaving, setPaySaving] = useState(false);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [groups, setGroups] = useState<OrderGroup[]>([]);
  const [editGroupId, setEditGroupId] = useState('');

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const [o, s] = await Promise.all([
        getOrder(Math.round(Number(id))),
        getOrderStatuses(Math.round(Number(id)))
      ]);
      setOrder(o);
      setAvailableStatuses(s.available);
      setEditCost(String(Math.round(Number(o.cost))));
      setEditDiscount(String(Math.round(Number(o.discount))));
      setEditDiagnosis(o.diagnosis || '');
      setEditComment(o.internal_comment || '');
      setEditGroupId(o.group_id ? String(o.group_id) : '');
      getSettings().then(setSettings).catch(() => {});
      getOrderGroups().then(setGroups).catch(() => {});
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
      if (Math.round(Number(editCost)) !== Math.round(Number(order?.cost))) body.cost = Math.round(Number(editCost));
      if (Math.round(Number(editDiscount)) !== Math.round(Number(order?.discount))) body.discount = Math.round(Number(editDiscount));
      if (editDiagnosis !== (order?.diagnosis || '')) body.diagnosis = editDiagnosis;
      if (editComment !== (order?.internal_comment || '')) body.internal_comment = editComment;
      if (editGroupId !== (order?.group_id ? String(order.group_id) : '')) {
        body.group_id = editGroupId ? Number(editGroupId) : null;
      }

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

  async function handleAddPayment() {
    if (!id || !payAmount || !payMethod) return;
    setPaySaving(true);
    try {
      await createPayment({
        order_id: Math.round(Number(id)),
        amount: Math.round(Number(payAmount)),
        payment_method_id: payMethod,
        is_prepayment: payPrepayment
      });
      setShowPayment(false);
      setPayAmount('');
      setPayPrepayment(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка приёма платежа');
    } finally {
      setPaySaving(false);
    }
  }

  async function handleDeletePayment(paymentId: number) {
    if (!confirm('Удалить платёж?')) return;
    try {
      await deletePayment(paymentId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления платежа');
    }
  }

  async function handleRefundPayment(paymentId: number) {
    const reason = prompt('Причина возврата (необязательно):');
    if (reason === null) return; // cancelled
    try {
      await refundPayment(paymentId, reason || undefined);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка возврата платежа');
    }
  }

  async function handleStatusChange(slug: string) {
    try {
      await updateOrderStatus(Math.round(Number(id)), slug);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка смены статуса');
    }
  }

  const finalCost = order ? Math.max(0, Math.round(Number(order.cost)) - Math.round(Number(order.discount))) : 0;
  const totalPaid = order ? order.payments.reduce((s, p) => s + Math.round(Number(p.amount)), 0) : 0;
  const remaining = finalCost - totalPaid;

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
          <div className="detail-row">
            <span>Группа</span>
            {editing ? (
              <select
                value={editGroupId}
                onChange={e => setEditGroupId(e.target.value)}
                style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, minWidth: 180 }}
              >
                <option value="">— Без группы —</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            ) : (
              <strong style={{ color: order.group_name ? '#1a73e8' : '#9aa0a6' }}>
                {order.group_name || '—'}
              </strong>
            )}
          </div>

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
              <div className="detail-row"><span>Стоимость</span><strong>{Math.round(Number(order.cost))} ₸</strong></div>
              {Math.round(Number(order.discount)) > 0 && <div className="detail-row"><span>Скидка</span><strong style={{ color: '#ef4444' }}>−{Math.round(Number(order.discount))} ₸</strong></div>}
              <div className="detail-row"><span>Итого</span><strong style={{ color: '#1a73e8', fontSize: 18 }}>{finalCost} ₸</strong></div>
              <div className="detail-row"><span>Предоплата</span><strong>{Math.round(Number(order.prepaid))} ₸</strong></div>
              <div className="detail-row">
                <span>Оплачено всего</span>
                <strong style={{ color: totalPaid > 0 ? '#1a73e8' : '#5f6368' }}>{totalPaid} ₸</strong>
              </div>
              {remaining > 0 && (
                <div className="detail-row">
                  <span style={{ color: '#ef4444', fontWeight: 500 }}>Остаток</span>
                  <strong style={{ color: '#ef4444', fontSize: 16 }}>{remaining} ₸</strong>
                </div>
              )}
              {remaining <= 0 && (
                <div className="detail-row">
                  <span>Остаток</span>
                  <strong style={{ color: '#22c55e' }}>0 ₸ ✓</strong>
                </div>
              )}
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
                    <strong>{Math.round(Number(p.selling_price_at_moment))} ₸</strong>
                  </div>
                ))}
              </div>
            )}

            <div className="detail-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: order.payments.length === 0 && !showPayment ? 0 : 12 }}>
                <h3 style={{ margin: 0 }}>Платежи</h3>
                <button className="btn-icon" onClick={() => { setShowPayment(!showPayment); setPayMethod(settings?.payment_methods[0]?.id || 0); }} title="Добавить платёж">
                  <PlusCircle size={18} />
                </button>
              </div>

              {showPayment && (
                <div style={{ background: '#f8f9fa', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#5f6368', marginBottom: 4 }}>Сумма</div>
                      <input
                        type="number"
                        value={payAmount}
                        onChange={e => setPayAmount(e.target.value)}
                        placeholder="Сумма"
                        style={{ width: 120, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#5f6368', marginBottom: 4 }}>Способ</div>
                      <select
                        value={payMethod}
                        onChange={e => setPayMethod(Math.round(Number(e.target.value)))}
                        style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }}
                      >
                        {settings?.payment_methods.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 16 }}>
                      <input
                        type="checkbox"
                        id="prepay"
                        checked={payPrepayment}
                        onChange={e => setPayPrepayment(e.target.checked)}
                      />
                      <label htmlFor="prepay" style={{ fontSize: 13, color: '#5f6368', cursor: 'pointer' }}>Предоплата</label>
                    </div>
                    <button
                      className="btn-primary"
                      onClick={handleAddPayment}
                      disabled={paySaving || !payAmount || !payMethod}
                      style={{ padding: '8px 14px', fontSize: 13 }}
                    >
                      {paySaving ? '...' : 'Провести'}
                    </button>
                  </div>
                </div>
              )}

              {order.payments.length > 0 && order.payments.map(p => (
                <div key={p.id} className="detail-row" style={{ opacity: p.refunded_at ? 0.5 : 1 }}>
                  <span>
                    {p.payment_method_name} {p.is_prepayment ? '(предоплата)' : '(доплата)'}
                    {p.refunded_at && (
                      <span style={{ color: '#ef4444', fontSize: 11, marginLeft: 6 }}>
                        ↩ Возврат {new Date(p.refunded_at).toLocaleDateString()}
                        {p.refund_reason && ` — ${p.refund_reason}`}
                      </span>
                    )}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ textDecoration: p.refunded_at ? 'line-through' : 'none' }}>
                      {Math.round(Number(p.amount))} ₸
                    </strong>
                    {user?.role === 'admin' && !p.refunded_at && (
                      <>
                        <button
                          onClick={() => handleRefundPayment(p.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', padding: 2, display: 'flex', fontSize: 13 }}
                          title="Возврат платежа"
                        >
                          ↩
                        </button>
                        <button
                          onClick={() => handleDeletePayment(p.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2, display: 'flex' }}
                          title="Удалить платёж"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                    {p.refunded_at && user?.role === 'admin' && (
                      <button
                        onClick={() => handleDeletePayment(p.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0a6', padding: 2, display: 'flex' }}
                        title="Удалить платёж"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {order.payments.length === 0 && !showPayment && (
                <div style={{ textAlign: 'center', padding: '12px 0', color: '#5f6368', fontSize: 13 }}>
                  Нет платежей. Нажмите + чтобы добавить.
                </div>
              )}
            </div>

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
