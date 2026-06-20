import { useState } from 'react';
import { createTransfer, type CompanyAccount } from '../api';

interface Props {
  accounts: CompanyAccount[];
  onClose: () => void;
  onDone: () => void;
}

export function CashTransferModal({ accounts, onClose, onDone }: Props) {
  const [fromId, setFromId] = useState(accounts[0]?.id || 0);
  const [toId, setToId] = useState(accounts[1]?.id || 0);
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fromAcc = accounts.find(a => a.id === fromId);
  const toAcc = accounts.find(a => a.id === toId);

  async function handleSubmit() {
    if (!fromId || !toId || !amount) return;
    setSaving(true); setError('');
    try {
      await createTransfer({
        from_account_id: fromId,
        to_account_id: toId,
        amount: Math.round(Number(amount)),
        comment: comment || undefined
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка перемещения');
    } finally { setSaving(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 28, width: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <h3 style={{ margin: '0 0 16px' }}>Перемещение между кассами</h3>

        {error && <div className="error-message">{error}</div>}

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#5f6368' }}>Откуда</label>
          <select value={fromId} onChange={e => setFromId(Number(e.target.value))}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }}>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name} (баланс: {Number(a.balance).toLocaleString('ru-RU')} ₸)</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#5f6368' }}>Куда</label>
          <select value={toId} onChange={e => setToId(Number(e.target.value))}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }}>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name} (баланс: {Number(a.balance).toLocaleString('ru-RU')} ₸)</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#5f6368' }}>Сумма</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: '#5f6368' }}>Комментарий</label>
          <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Инкассация, перевод..."
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>Отмена</button>
          <button onClick={handleSubmit} disabled={saving || !amount || fromId === toId}
            style={{ flex: 1, padding: '10px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, opacity: saving || !amount || fromId === toId ? 0.5 : 1 }}>
            {saving ? '...' : 'Переместить'}
          </button>
        </div>
      </div>
    </div>
  );
}
