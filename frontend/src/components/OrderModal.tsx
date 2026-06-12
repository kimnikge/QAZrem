import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Printer, Edit3, Save, Loader2 } from 'lucide-react';
import { getOrder, getOrderStatuses, updateOrderStatus, getOrderGroups, type OrderDetail, type AvailableStatus, type OrderGroup, type Order } from '../api';

const statusLabels: Record<string, string> = {
  new: 'Новая', diagnosis: 'Диагностика', waiting_parts: 'Ожидание запчасти',
  repair: 'Ремонт', ready: 'Готов к выдаче', completed: 'Выдан', cancelled: 'Отказ'
};

interface Props {
  orderId: number;
  preload?: Order;
  onClose: () => void;
  onOrderUpdated?: () => void;
}

export function OrderModal({ orderId, preload, onClose, onOrderUpdated }: Props) {
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [statuses, setStatuses] = useState<AvailableStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable fields — инициализируем из preload сразу
  const [editCost, setEditCost] = useState(preload ? String(Math.round(Number(preload.cost))) : '');
  const [editDiscount, setEditDiscount] = useState(preload ? String(Math.round(Number(preload.discount))) : '');
  const [editDiagnosis, setEditDiagnosis] = useState(preload?.diagnosis || '');
  const [editComment, setEditComment] = useState(preload?.internal_comment || '');
  const [editGroupId, setEditGroupId] = useState(preload?.group_id ? String(preload.group_id) : '');
  const [editClientName, setEditClientName] = useState(preload?.client_name || '');
  const [editClientPhone, setEditClientPhone] = useState(preload?.client_phone || '');
  const [editBrand, setEditBrand] = useState(preload?.brand || '');
  const [editModel, setEditModel] = useState(preload?.model || '');
  const [editImei, setEditImei] = useState(preload?.imei || '');
  const [editIssue, setEditIssue] = useState(preload?.issue_description || '');
  const [groups, setGroups] = useState<OrderGroup[]>([]);

  // Если есть preload — показываем его мгновенно как OrderDetail-подобный объект
  const preloadOrder: OrderDetail | null = preload ? {
    ...preload,
    history: [],
    parts: [],
    payments: [],
    group_name: preload.group_name || null,
  } : null;

  // Мгновенно показываем preload, затем догружаем детали
  useEffect(() => {
    if (preloadOrder) {
      setOrder(preloadOrder);
      setLoading(false);
    }
    // Фоновый догруз деталей
    async function fetchDetails() {
      try {
        const [o, s] = await Promise.all([
          getOrder(orderId),
          getOrderStatuses(orderId)
        ]);
        setOrder(o);
        setStatuses(s.available);
        setEditCost(String(Math.round(Number(o.cost))));
        setEditDiscount(String(Math.round(Number(o.discount))));
        setEditDiagnosis(o.diagnosis || '');
        setEditComment(o.internal_comment || '');
        setEditGroupId(o.group_id ? String(o.group_id) : '');
        setEditClientName(o.client_name || '');
        setEditClientPhone(o.client_phone || '');
        setEditBrand(o.brand || '');
        setEditModel(o.model || '');
        setEditImei(o.imei || '');
        setEditIssue(o.issue_description || '');
      } catch (err) {
        if (!preloadOrder) setError(err instanceof Error ? err.message : 'Ошибка');
      } finally {
        setLoading(false);
      }
    }
    fetchDetails();
    getOrderGroups().then(setGroups).catch(() => {});
  }, [orderId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (editing) { setEditing(false); return; }
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, editing]);

  async function handleStatus(slug: string) {
    try {
      await updateOrderStatus(orderId, slug);
      const [o, s] = await Promise.all([getOrder(orderId), getOrderStatuses(orderId)]);
      setOrder(o);
      setStatuses(s.available);
      setEditCost(String(Math.round(Number(o.cost))));
      setEditDiscount(String(Math.round(Number(o.discount))));
      setEditDiagnosis(o.diagnosis || '');
      setEditComment(o.internal_comment || '');
      setEditGroupId(o.group_id ? String(o.group_id) : '');
      setEditClientName(o.client_name || '');
      setEditClientPhone(o.client_phone || '');
      setEditBrand(o.brand || '');
      setEditModel(o.model || '');
      setEditImei(o.imei || '');
      setEditIssue(o.issue_description || '');
      onOrderUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function handleSave() {
    if (!order) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (Math.round(Number(editCost)) !== Math.round(Number(order.cost))) body.cost = Math.round(Number(editCost));
      if (Math.round(Number(editDiscount)) !== Math.round(Number(order.discount))) body.discount = Math.round(Number(editDiscount));
      if (editDiagnosis !== (order.diagnosis || '')) body.diagnosis = editDiagnosis;
      if (editComment !== (order.internal_comment || '')) body.internal_comment = editComment;
      if (editIssue !== (order.issue_description || '')) body.issue_description = editIssue;
      if (editGroupId !== (order.group_id ? String(order.group_id) : '')) {
        body.group_id = editGroupId ? Number(editGroupId) : null;
      }
      if (editClientName !== (order.client_name || '')) body.client_name = editClientName;
      if (editClientPhone !== (order.client_phone || '')) body.client_phone = editClientPhone;
      if (editBrand !== (order.brand || '')) body.device_brand = editBrand;
      if (editModel !== (order.model || '')) body.device_model = editModel;
      if (editImei !== (order.imei || '')) body.device_imei = editImei;

      if (Object.keys(body).length > 0) {
        const token = sessionStorage.getItem('token');
        const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
        await fetch(`${apiUrl}/orders/${orderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body)
        });
      }
      setEditing(false);
      // Перезагружаем полные данные
      const [o, s] = await Promise.all([getOrder(orderId), getOrderStatuses(orderId)]);
      setOrder(o);
      setStatuses(s.available);
      setEditCost(String(Math.round(Number(o.cost))));
      setEditDiscount(String(Math.round(Number(o.discount))));
      setEditDiagnosis(o.diagnosis || '');
      setEditComment(o.internal_comment || '');
      setEditGroupId(o.group_id ? String(o.group_id) : '');
      setEditClientName(o.client_name || '');
      setEditClientPhone(o.client_phone || '');
      setEditBrand(o.brand || '');
      setEditModel(o.model || '');
      setEditImei(o.imei || '');
      setEditIssue(o.issue_description || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  const finalCost = order ? Math.max(0, Math.round(Number(order.cost)) - Math.round(Number(order.discount))) : 0;
  const totalPaid = order ? order.payments.reduce((s, p) => s + Math.round(Number(p.amount)), 0) : 0;
  const remaining = finalCost - totalPaid;

  return (
    <div className="modal-overlay" onClick={() => { if (!editing) onClose(); }}>
      <div className="modal-glow">
        <div className="modal-content" onClick={e => e.stopPropagation()}>
        {loading ? (
          <div className="modal-loading"><Loader2 size={24} className="spin" /> Загрузка...</div>
        ) : error ? (
          <div className="modal-error">{error}</div>
        ) : order ? (
          <>
            <div className="modal-header">
              <div className="modal-header-left">
                <span className="modal-order-id">Заказ №{order.id}</span>
                <span className={`modal-status-badge status-${order.status_slug}`}>
                  {statusLabels[order.status_slug]}
                </span>
                {order.priority !== 'normal' && (
                  <span className={`modal-priority ${order.priority}`}>
                    {order.priority === 'urgent' ? '⚡ Срочно' : '🔥 Критично'}
                  </span>
                )}
              </div>
              <div className="modal-header-right">
                <button className="modal-btn-icon" onClick={() => navigate(`/print-order/${order.id}`)} title="Печать">
                  <Printer size={16} />
                </button>
                {editing ? (
                  <button className="modal-btn-icon" onClick={handleSave} disabled={saving} title="Сохранить" style={{ color: 'var(--primary)' }}>
                    <Save size={16} />
                  </button>
                ) : (
                  <button className="modal-btn-icon" onClick={() => setEditing(true)} title="Редактировать">
                    <Edit3 size={16} />
                  </button>
                )}
                <button className="modal-btn-icon" onClick={onClose} title="Закрыть">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="modal-body">
              {/* Клиент */}
              <div className="modal-section">
                <div className="modal-field">
                  <span className="modal-label">Клиент</span>
                  {editing ? (
                    <input value={editClientName} onChange={e => setEditClientName(e.target.value)}
                      className="modal-input-inline" placeholder="Имя клиента" />
                  ) : (
                    <span className="modal-value">{order.client_name}</span>
                  )}
                </div>
                <div className="modal-field">
                  <span className="modal-label">Телефон</span>
                  {editing ? (
                    <input value={editClientPhone} onChange={e => setEditClientPhone(e.target.value)}
                      className="modal-input-inline" placeholder="+7..." />
                  ) : (
                    <span className="modal-value">{order.client_phone}</span>
                  )}
                </div>
              </div>

              {/* Устройство */}
              <div className="modal-section">
                <div className="modal-field">
                  <span className="modal-label">Бренд</span>
                  {editing ? (
                    <input value={editBrand} onChange={e => setEditBrand(e.target.value)}
                      className="modal-input-inline" placeholder="Apple" />
                  ) : (
                    <span className="modal-value">{order.brand}</span>
                  )}
                </div>
                <div className="modal-field">
                  <span className="modal-label">Модель</span>
                  {editing ? (
                    <input value={editModel} onChange={e => setEditModel(e.target.value)}
                      className="modal-input-inline" placeholder="iPhone 15" />
                  ) : (
                    <span className="modal-value">{order.model}</span>
                  )}
                </div>
                <div className="modal-field">
                  <span className="modal-label">IMEI</span>
                  {editing ? (
                    <input value={editImei} onChange={e => setEditImei(e.target.value)}
                      className="modal-input-inline mono" placeholder="000000000000000" />
                  ) : (
                    <code className="modal-value-mono">{order.imei}</code>
                  )}
                </div>
              </div>

              {/* Диагноз */}
              {editing ? (
                <div className="modal-section">
                  <div className="modal-field" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
                    <span className="modal-label">Диагноз</span>
                    <textarea
                      value={editDiagnosis}
                      onChange={e => setEditDiagnosis(e.target.value)}
                      rows={2}
                      className="modal-input"
                      placeholder="Опишите диагноз..."
                    />
                  </div>
                </div>
              ) : order.diagnosis ? (
                <div className="modal-section">
                  <div className="modal-field">
                    <span className="modal-label">Диагноз</span>
                    <span className="modal-value">{order.diagnosis}</span>
                  </div>
                </div>
              ) : null}

              {/* Проблема */}
              <div className="modal-section">
                <div className="modal-field" style={editing ? { flexDirection: 'column', alignItems: 'stretch', gap: 4 } : undefined}>
                  <span className="modal-label">Проблема</span>
                  {editing ? (
                    <textarea value={editIssue} onChange={e => setEditIssue(e.target.value)}
                      rows={2} className="modal-input" placeholder="Опишите проблему..." />
                  ) : (
                    <span className="modal-value">{order.issue_description}</span>
                  )}
                </div>
              </div>

              {/* Финансы */}
              <div className="modal-section modal-finance">
                <div className="modal-field">
                  <span className="modal-label">Стоимость</span>
                  {editing ? (
                    <input type="number" value={editCost} onChange={e => setEditCost(e.target.value)}
                      className="modal-input-num" />
                  ) : (
                    <span className="modal-value">{Math.round(Number(order.cost))} ₸</span>
                  )}
                </div>
                {editing ? (
                  <div className="modal-field">
                    <span className="modal-label">Скидка</span>
                    <input type="number" value={editDiscount} onChange={e => setEditDiscount(e.target.value)}
                      className="modal-input-num" />
                  </div>
                ) : Math.round(Number(order.discount)) > 0 ? (
                  <div className="modal-field">
                    <span className="modal-label">Скидка</span>
                    <span className="modal-value" style={{ color: 'var(--danger)' }}>−{Math.round(Number(order.discount))} ₸</span>
                  </div>
                ) : null}
                <div className="modal-field">
                  <span className="modal-label">Итого</span>
                  <span className="modal-value" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                    {editing ? `${Math.max(0, Math.round(Number(editCost)) - Math.round(Number(editDiscount)))} ₸` : `${finalCost} ₸`}
                  </span>
                </div>
                <div className="modal-field">
                  <span className="modal-label">Оплачено</span>
                  <span className="modal-value">{totalPaid} ₸</span>
                </div>
                <div className="modal-field">
                  <span className="modal-label">Остаток</span>
                  <span className="modal-value" style={{ color: remaining > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {remaining > 0 ? `${remaining} ₸` : '0 ₸ ✓'}
                  </span>
                </div>
              </div>

              {/* Группа */}
              {editing && groups.length > 0 && (
                <div className="modal-section">
                  <div className="modal-field">
                    <span className="modal-label">Группа</span>
                    <select value={editGroupId} onChange={e => setEditGroupId(e.target.value)}
                      className="modal-select">
                      <option value="">— Без группы —</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Комментарий */}
              {editing ? (
                <div className="modal-section">
                  <div className="modal-field" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
                    <span className="modal-label">Комментарий</span>
                    <input
                      value={editComment}
                      onChange={e => setEditComment(e.target.value)}
                      className="modal-input"
                      placeholder="Внутренний комментарий..."
                    />
                  </div>
                </div>
              ) : order.internal_comment ? (
                <div className="modal-section">
                  <div className="modal-field">
                    <span className="modal-label">Комментарий</span>
                    <span className="modal-value" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{order.internal_comment}</span>
                  </div>
                </div>
              ) : null}

              {order.parts.length > 0 && (
                <div className="modal-section">
                  <div className="modal-subtitle">Запчасти</div>
                  {order.parts.map(p => (
                    <div key={p.id} className="modal-field">
                      <span className="modal-label">{p.part_name} ×{p.quantity_used}</span>
                      <span className="modal-value">{Math.round(Number(p.selling_price_at_moment))} ₸</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {statuses.length > 0 && (
              <div className="modal-footer">
                {statuses.map(s => (
                  <button key={s.slug} className="btn-status" onClick={() => handleStatus(s.slug)}>
                    {statusLabels[s.slug] || s.name}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
      </div>
    </div>
  );
}
