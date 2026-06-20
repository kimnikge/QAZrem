import { useNavigate } from 'react-router-dom';
import { X, Printer, Edit3, Save, Loader2, PlusCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { type Order, createPayment, getAccounts, type CompanyAccount } from '../api';
import { useOrderModal } from '../hooks/useOrderModal';
import { OrderPartsSection } from './OrderPartsSection';
import { STATUS_LABELS } from '../constants';

interface Props { orderId: number; preload?: Order; onClose: () => void; onOrderUpdated?: () => void; }

export function OrderModal({ orderId, preload, onClose, onOrderUpdated }: Props) {
  const navigate = useNavigate();
  const m = useOrderModal({ orderId, preload, onOrderUpdated });

  const order = m.order;
  const finalCost = order ? Math.max(0, Math.round(Number(order.cost)) - Math.round(Number(order.discount))) : 0;
  const totalPaid = order ? order.payments.reduce((s, p) => s + Math.round(Number(p.amount)), 0) : 0;
  const remaining = finalCost - totalPaid;

  // Payment split state
  const [accounts, setAccounts] = useState<CompanyAccount[]>([]);
  const [payAmount, setPayAmount] = useState(remaining > 0 ? String(remaining) : '');
  const [payMethod, setPayMethod] = useState<number>(1);
  const [paying, setPaying] = useState(false);
  const [splitRows, setSplitRows] = useState<Array<{ account_id: number; amount: number }>>([]);
  const splitsTotal = splitRows.reduce((s, r) => s + r.amount, 0);

  useEffect(() => { getAccounts().then(setAccounts).catch(() => {}); }, []);
  useEffect(() => {
    if (accounts.length > 0 && splitRows.length === 0) {
      setSplitRows(accounts.map(a => ({ account_id: a.id, amount: 0 })));
    }
  }, [accounts]);
  // Авто-подстановка суммы платежа из разбивки
  useEffect(() => {
    if (splitsTotal > 0 && (!payAmount || Number(payAmount) === 0)) {
      setPayAmount(String(splitsTotal));
    }
  }, [splitsTotal]);

  return (
    <div className="modal-overlay" onClick={() => { if (!m.editing) onClose(); }}>
      <div className="modal-glow">
        <div className="modal-content" onClick={e => e.stopPropagation()}>
        {m.loading ? (
          <div className="modal-loading"><Loader2 size={24} className="spin" /> Загрузка...</div>
        ) : m.error ? (
          <div className="modal-error">{m.error}</div>
        ) : order ? (<>
          <div className="modal-header">
            <div className="modal-header-left">
              <span className="modal-order-id">Заказ №{order.id}</span>
              <span className={`modal-status-badge status-${order.status_slug}`}>{STATUS_LABELS[order.status_slug]}</span>
              {order.priority !== 'normal' && <span className={`modal-priority ${order.priority}`}>{order.priority === 'urgent' ? '⚡ Срочно' : '🔥 Критично'}</span>}
            </div>
            <div className="modal-header-right">
              <button className="modal-btn-icon" onClick={() => navigate(`/print-order/${order.id}`)} title="Печать"><Printer size={16} /></button>
              {m.editing ? (
                <button className="modal-btn-icon" onClick={m.handleSave} disabled={m.saving} title="Сохранить" style={{ color: 'var(--primary)' }}><Save size={16} /></button>
              ) : (
                <button className="modal-btn-icon" onClick={() => m.setEditing(true)} title="Редактировать"><Edit3 size={16} /></button>
              )}
              <button className="modal-btn-icon" onClick={onClose} title="Закрыть"><X size={18} /></button>
            </div>
          </div>

          <div className="modal-body">
            <div className="modal-section">
              <div className="modal-field"><span className="modal-label">Клиент</span>
                {m.editing ? <input value={m.editClientName} onChange={e => m.setEditClientName(e.target.value)} className="modal-input-inline" placeholder="Имя клиента" /> : <span className="modal-value">{order.client_name}</span>}</div>
              <div className="modal-field"><span className="modal-label">Телефон</span>
                {m.editing ? <input value={m.editClientPhone} onChange={e => m.setEditClientPhone(e.target.value)} className="modal-input-inline" placeholder="+7..." /> : <span className="modal-value">{order.client_phone}</span>}</div>
            </div>
            <div className="modal-section">
              <div className="modal-field"><span className="modal-label">Бренд</span>
                {m.editing ? <input value={m.editBrand} onChange={e => m.setEditBrand(e.target.value)} className="modal-input-inline" placeholder="Apple" /> : <span className="modal-value">{order.brand}</span>}</div>
              <div className="modal-field"><span className="modal-label">Модель</span>
                {m.editing ? <input value={m.editModel} onChange={e => m.setEditModel(e.target.value)} className="modal-input-inline" placeholder="iPhone 15" /> : <span className="modal-value">{order.model}</span>}</div>
              <div className="modal-field"><span className="modal-label">IMEI</span>
                {m.editing ? <input value={m.editImei} onChange={e => m.setEditImei(e.target.value)} className="modal-input-inline mono" placeholder="000000000000000" /> : <code className="modal-value-mono">{order.imei}</code>}</div>
              <div className="modal-field"><span className="modal-label">Серийный №</span>
                {m.editing ? <input value={m.editSerialNumber} onChange={e => m.setEditSerialNumber(e.target.value)} className="modal-input-inline mono" placeholder="SN..." /> : (
                  order.serial_number ? <code className="modal-value-mono">{order.serial_number}</code> : <span className="modal-value" style={{ color: 'var(--text-muted)' }}>—</span>
                )}</div>
            </div>

            {m.editing ? (
              <div className="modal-section"><div className="modal-field" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}><span className="modal-label">Диагноз</span>
                <textarea value={m.editDiagnosis} onChange={e => m.setEditDiagnosis(e.target.value)} rows={2} className="modal-input" placeholder="Опишите диагноз..." /></div></div>
            ) : order.diagnosis ? (
              <div className="modal-section"><div className="modal-field"><span className="modal-label">Диагноз</span><span className="modal-value">{order.diagnosis}</span></div></div>
            ) : null}

            <div className="modal-section"><div className="modal-field" style={m.editing ? { flexDirection: 'column', alignItems: 'stretch', gap: 4 } : undefined}>
              <span className="modal-label">Проблема</span>
              {m.editing ? <textarea value={m.editIssue} onChange={e => m.setEditIssue(e.target.value)} rows={2} className="modal-input" placeholder="Опишите проблему..." /> : <span className="modal-value">{order.issue_description}</span>}</div></div>

            <div className="modal-section modal-finance">
              <div className="modal-field"><span className="modal-label">Стоимость</span>
                {m.editing ? <input type="number" value={m.editCost} onChange={e => m.setEditCost(e.target.value)} className="modal-input-num" /> : <span className="modal-value">{Math.round(Number(order.cost))} ₸</span>}</div>
              {m.editing ? (
                <div className="modal-field"><span className="modal-label">Скидка</span><input type="number" value={m.editDiscount} onChange={e => m.setEditDiscount(e.target.value)} className="modal-input-num" /></div>
              ) : Math.round(Number(order.discount)) > 0 ? (
                <div className="modal-field"><span className="modal-label">Скидка</span><span className="modal-value" style={{ color: 'var(--danger)' }}>−{Math.round(Number(order.discount))} ₸</span></div>
              ) : null}
              <div className="modal-field"><span className="modal-label">Итого</span><span className="modal-value" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                {m.editing ? `${Math.max(0, Math.round(Number(m.editCost)) - Math.round(Number(m.editDiscount)))} ₸` : `${finalCost} ₸`}</span></div>
              <div className="modal-field"><span className="modal-label">Оплачено</span><span className="modal-value">{totalPaid} ₸</span></div>
              <div className="modal-field"><span className="modal-label">Остаток</span><span className="modal-value" style={{ color: remaining > 0 ? 'var(--danger)' : 'var(--success)' }}>
                {remaining > 0 ? `${remaining} ₸` : '0 ₸ ✓'}</span></div>
            </div>

            {m.editing && m.groups.length > 0 && (
              <div className="modal-section"><div className="modal-field"><span className="modal-label">Группа</span>
                <select value={m.editGroupId} onChange={e => m.setEditGroupId(e.target.value)} className="modal-select">
                  <option value="">— Без группы —</option>{m.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div></div>
            )}

            {m.editing ? (
              <div className="modal-section"><div className="modal-field" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}><span className="modal-label">Комментарий</span>
                <input value={m.editComment} onChange={e => m.setEditComment(e.target.value)} className="modal-input" placeholder="Внутренний комментарий..." /></div></div>
            ) : order.internal_comment ? (
              <div className="modal-section"><div className="modal-field"><span className="modal-label">Комментарий</span><span className="modal-value" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{order.internal_comment}</span></div></div>
            ) : null}

            <OrderPartsSection orderId={order.id} initialParts={order.parts} onRefresh={m.refresh} onError={m.setError} />

            {/* Блок оплаты — если есть остаток */}
            {remaining > 0 && !m.editing && (
              <div className="modal-section" style={{
                border: order.status_slug === 'ready' ? '2px solid #22c55e' : '1px solid var(--border)',
                background: order.status_slug === 'ready' ? '#f0fdf4' : 'var(--bg)',
                borderRadius: 8, padding: 10, marginTop: 8
              }}>
                {order.status_slug === 'ready' && (
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#166534', marginBottom: 8 }}>
                    💰 Клиент забирает — примите оплату
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'end' }}>
                  <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                    style={{ width: 90, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13 }} />
                  <select value={payMethod} onChange={e => setPayMethod(Number(e.target.value))}
                    style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}>
                    <option value={1}>Наличные</option><option value={2}>Карта</option><option value={3}>Перевод</option>
                  </select>
                  <button onClick={async () => {
                    if (paying || !order || (splitsTotal === 0 && !payAmount)) return;
                    setPaying(true);
                    try {
                      const amt = splitsTotal > 0 ? splitsTotal : Math.round(Number(payAmount));
                      const validSplits = splitRows.filter(r => r.amount > 0);
                      await createPayment({
                        order_id: order.id, amount: amt,
                        payment_method_id: payMethod,
                        splits: validSplits.length > 0 && splitsTotal === amt ? validSplits : undefined
                      });
                      setPayAmount(''); setSplitRows(accounts.map(a => ({ account_id: a.id, amount: 0 })));
                      m.refresh();
                    } catch (err) { m.setError(err instanceof Error ? err.message : 'Ошибка'); }
                    finally { setPaying(false); }
                  }} disabled={paying || (splitsTotal === 0 && !payAmount)}
                    style={{ padding: '6px 14px', background: order.status_slug === 'ready' ? '#22c55e' : 'var(--primary)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    {paying ? '...' : 'Провести'}
                  </button>
                </div>
                {/* Разбивка по кассам */}
                {accounts.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: '#5f6368', fontWeight: 500 }}>Разбивка по кассам</span>
                      <button type="button" onClick={() => setSplitRows(prev => [...prev, { account_id: accounts[0].id, amount: 0 }])}
                        style={{ fontSize: 10, background: 'none', border: '1px dashed var(--primary)', borderRadius: 4, color: 'var(--primary)', cursor: 'pointer', padding: '1px 6px' }}>
                        + Касса
                      </button>
                    </div>
                    {splitRows.map((r, i) => (
                      <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 3 }}>
                        <select value={r.account_id} onChange={e => {
                          setSplitRows(prev => prev.map((s, j) => j === i ? { ...s, account_id: Number(e.target.value) } : s));
                        }} style={{ flex: 1, padding: '3px 4px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 11, background: 'var(--card-bg)' }}>
                          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                        <input type="number" value={r.amount || ''}
                          onChange={e => setSplitRows(prev => prev.map((s, j) => j === i ? { ...s, amount: Math.round(Number(e.target.value) || 0) } : s))}
                          style={{ width: 65, padding: '3px 5px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 11, textAlign: 'right' }} />
                        <button type="button" onClick={() => setSplitRows(prev => prev.filter((_, j) => j !== i))}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }} disabled={splitRows.length <= 1}>×</button>
                      </div>
                    ))}
                    {splitsTotal > 0 && (
                      <div style={{ fontSize: 11, marginTop: 2, color: splitsTotal === remaining ? '#22c55e' : '#ef4444' }}>
                        {splitsTotal}/{remaining} ₸
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* История платежей */}
            {order.payments.length > 0 && (
              <div className="modal-section" style={{ marginTop: 4 }}>
                {order.payments.map(p => (
                  <div key={p.id} className="modal-field" style={{ opacity: p.refunded_at ? 0.5 : 1 }}>
                    <span className="modal-label">
                      {p.payment_method_name} {p.is_prepayment ? '(аванс)' : ''}
                      {p.splits && p.splits.length > 0 && (
                        <span style={{ fontSize: 10, color: '#5f6368', marginLeft: 4 }}>
                          {p.splits.map(s => `${s.account_name}: ${Math.round(Number(s.amount))} ₸`).join(', ')}
                        </span>
                      )}
                    </span>
                    <span className="modal-value">{Math.round(Number(p.amount))} ₸</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {m.statuses.length > 0 && (
            <div className="modal-footer">{m.statuses.map(s => <button key={s.slug} className="btn-status" onClick={() => m.handleStatus(s.slug)}>{STATUS_LABELS[s.slug] || s.name}</button>)}</div>
          )}
        </>) : null}
      </div>
      </div>
    </div>
  );
}
