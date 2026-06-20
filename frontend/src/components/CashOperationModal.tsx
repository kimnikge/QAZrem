import { useState } from 'react';
import { createCashOperation, type CompanyAccount } from '../api';

interface Props {
  accounts: CompanyAccount[];
  type: 'income' | 'expense';
  onClose: () => void;
  onDone: () => void;
}

export function CashOperationModal({ accounts, type, onClose, onDone }: Props) {
  const [accountId, setAccountId] = useState(accounts[0]?.id || 0);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isIncome = type === 'income';
  const title = isIncome ? 'Приход в кассу' : 'Расход из кассы';
  const label = isIncome ? 'Откуда приход' : 'Основание расхода';

  async function handleSubmit() {
    if (!accountId || !amount) return;
    setSaving(true); setError('');
    try {
      await createCashOperation(accountId, {
        type,
        amount: Math.round(Number(amount)),
        description: description || undefined
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка операции');
    } finally { setSaving(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 28, width: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <h3 style={{ margin: '0 0 16px', color: isIncome ? '#22c55e' : '#ef4444' }}>{title}</h3>

        {error && <div className="error-message">{error}</div>}

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#5f6368' }}>Касса</label>
          <select value={accountId} onChange={e => setAccountId(Number(e.target.value))}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }}>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name} (баланс: {Number(a.balance).toLocaleString('ru-RU')} ₸)</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#5f6368' }}>Сумма (₸)</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0"
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: '#5f6368' }}>{label}</label>
          <input value={description} onChange={e => setDescription(e.target.value)}
            placeholder={isIncome ? 'Например: оплата за консультацию' : 'Например: ком. услуги за офис'}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>Отмена</button>
          <button onClick={handleSubmit} disabled={saving || !amount}
            style={{ flex: 1, padding: '10px', background: isIncome ? '#22c55e' : '#ef4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, opacity: saving || !amount ? 0.5 : 1 }}>
            {saving ? '...' : isIncome ? 'Внести' : 'Списать'}
          </button>
        </div>
      </div>
    </div>
  );
}
