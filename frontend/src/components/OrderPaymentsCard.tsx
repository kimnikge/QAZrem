import { useState } from 'react';
import { PlusCircle, Trash2 } from 'lucide-react';
import { createPayment, deletePayment, refundPayment, type OrderDetail, type SettingsData } from '../api';

interface Props {
  order: OrderDetail;
  settings: SettingsData | null;
  userId?: number;
  userRole?: string;
  onRefresh: () => void;
  onError: (msg: string) => void;
}

export function OrderPaymentsCard({ order, settings, userRole, onRefresh, onError }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<number>(0);
  const [prepayment, setPrepayment] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!amount || !method) return;
    setSaving(true);
    try {
      await createPayment({
        order_id: order.id,
        amount: Math.round(Number(amount)),
        payment_method_id: method,
        is_prepayment: prepayment
      });
      setShowForm(false); setAmount(''); setPrepayment(false);
      onRefresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Ошибка приёма платежа');
    } finally { setSaving(false); }
  }

  async function handleDelete(paymentId: number) {
    if (!confirm('Удалить платёж?')) return;
    try { await deletePayment(paymentId); onRefresh(); }
    catch (err) { onError(err instanceof Error ? err.message : 'Ошибка удаления'); }
  }

  async function handleRefund(paymentId: number) {
    const reason = prompt('Причина возврата (необязательно):');
    if (reason === null) return;
    try { await refundPayment(paymentId, reason || undefined); onRefresh(); }
    catch (err) { onError(err instanceof Error ? err.message : 'Ошибка возврата'); }
  }

  return (
    <div className="detail-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: order.payments.length === 0 && !showForm ? 0 : 12 }}>
        <h3 style={{ margin: 0 }}>Платежи</h3>
        <button className="btn-icon" onClick={() => { setShowForm(!showForm); setMethod(settings?.payment_methods[0]?.id || 0); }} title="Добавить платёж">
          <PlusCircle size={18} />
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#f8f9fa', padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
            <div>
              <div style={{ fontSize: 12, color: '#5f6368', marginBottom: 4 }}>Сумма</div>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Сумма"
                style={{ width: 120, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#5f6368', marginBottom: 4 }}>Способ</div>
              <select value={method} onChange={e => setMethod(Math.round(Number(e.target.value)))}
                style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }}>
                {settings?.payment_methods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 16 }}>
              <input type="checkbox" id="prepay" checked={prepayment} onChange={e => setPrepayment(e.target.checked)} />
              <label htmlFor="prepay" style={{ fontSize: 13, color: '#5f6368', cursor: 'pointer' }}>Предоплата</label>
            </div>
            <button className="btn-primary" onClick={handleAdd} disabled={saving || !amount || !method} style={{ padding: '8px 14px', fontSize: 13 }}>
              {saving ? '...' : 'Провести'}
            </button>
          </div>
        </div>
      )}

      {order.payments.length > 0 && order.payments.map(p => (
        <div key={p.id} className="detail-row" style={{ opacity: p.refunded_at ? 0.5 : 1 }}>
          <span>
            {p.payment_method_name} {p.is_prepayment ? '(предоплата)' : '(доплата)'}
            {p.refunded_at && <span style={{ color: '#ef4444', fontSize: 11, marginLeft: 6 }}>↩ Возврат {new Date(p.refunded_at).toLocaleDateString()}{p.refund_reason && ` — ${p.refund_reason}`}</span>}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong style={{ textDecoration: p.refunded_at ? 'line-through' : 'none' }}>{Math.round(Number(p.amount))} ₸</strong>
            {userRole === 'admin' && !p.refunded_at && (
              <>
                <button onClick={() => handleRefund(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', padding: 2, display: 'flex', fontSize: 13 }} title="Возврат">↩</button>
                <button onClick={() => handleDelete(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2, display: 'flex' }} title="Удалить"><Trash2 size={14} /></button>
              </>
            )}
            {p.refunded_at && userRole === 'admin' && (
              <button onClick={() => handleDelete(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0a6', padding: 2, display: 'flex' }} title="Удалить"><Trash2 size={14} /></button>
            )}
          </div>
        </div>
      ))}
      {order.payments.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: '12px 0', color: '#5f6368', fontSize: 13 }}>Нет платежей. Нажмите + чтобы добавить.</div>
      )}
    </div>
  );
}
