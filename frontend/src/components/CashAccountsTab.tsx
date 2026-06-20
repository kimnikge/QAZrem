import { useEffect, useState } from 'react';
import { Plus, ArrowRightLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { getAccounts, getAccountTransactions, createAccount, type CompanyAccount, type AccountTransaction } from '../api';
import { CashTransferModal } from './CashTransferModal';
import { CashOperationModal } from './CashOperationModal';

interface Props {
  isAdmin: boolean;
  onRefresh?: () => void;
}

export function CashAccountsTab({ isAdmin }: Props) {
  const [accounts, setAccounts] = useState<CompanyAccount[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showOperation, setShowOperation] = useState<'income' | 'expense' | null>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('cash');

  async function load() {
    const accs = await getAccounts();
    setAccounts(accs);
  }

  useEffect(() => { load(); }, []);

  async function loadTransactions(id: number) {
    setSelectedId(id);
    const data = await getAccountTransactions(id);
    setTransactions(data.transactions);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    await createAccount({ name: newName.trim(), type: newType });
    setShowCreate(false); setNewName(''); setNewType('cash');
    await load();
  }

  const refreshAll = async () => {
    await load();
    if (selectedId) await loadTransactions(selectedId);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, minHeight: 300 }}>
      {/* Список касс */}
      <div style={{ borderRight: '1px solid var(--border)', paddingRight: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <strong style={{ fontSize: 14 }}>Кассы</strong>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setShowOperation('income')} className="btn-icon" title="Приход" style={{ color: '#22c55e' }}><TrendingUp size={16} /></button>
            <button onClick={() => setShowOperation('expense')} className="btn-icon" title="Расход" style={{ color: '#ef4444' }}><TrendingDown size={16} /></button>
            <button onClick={() => setShowTransfer(true)} className="btn-icon" title="Перемещение"><ArrowRightLeft size={16} /></button>
            {isAdmin && <button onClick={() => setShowCreate(true)} className="btn-icon" title="Добавить кассу"><Plus size={16} /></button>}
          </div>
        </div>

        {showCreate && (
          <div style={{ marginBottom: 8, padding: 8, background: 'var(--bg)', borderRadius: 8 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Название кассы"
              style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, marginBottom: 6 }} />
            <select value={newType} onChange={e => setNewType(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, marginBottom: 6 }}>
              <option value="cash">Наличные</option>
              <option value="kaspi">Kaspi</option>
              <option value="bank">Банк</option>
              <option value="terminal">Терминал</option>
              <option value="virtual">Виртуальный</option>
            </select>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={handleCreate} className="btn-primary" style={{ flex: 1, padding: '4px 8px', fontSize: 12 }}>Создать</button>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>Отмена</button>
            </div>
          </div>
        )}

        {accounts.map(a => (
          <div key={a.id} onClick={() => loadTransactions(a.id)}
            style={{
              padding: '10px 12px', borderRadius: 8, marginBottom: 4, cursor: 'pointer',
              background: selectedId === a.id ? 'var(--sidebar-active-bg)' : 'transparent',
              border: selectedId === a.id ? '1px solid var(--primary)' : '1px solid transparent'
            }}>
            <div style={{ fontWeight: 500, fontSize: 14 }}>{a.name}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)', marginTop: 2 }}>
              {Number(a.balance).toLocaleString('ru-RU')} ₸
            </div>
          </div>
        ))}
      </div>

      {/* История операций */}
      <div>
        {selectedId ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 14 }}>
                {accounts.find(a => a.id === selectedId)?.name || 'Касса'} — история
              </strong>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setShowOperation('income')} className="btn-primary" style={{ padding: '4px 10px', fontSize: 12, background: '#22c55e' }}>Приход</button>
                <button onClick={() => setShowOperation('expense')} className="btn-primary" style={{ padding: '4px 10px', fontSize: 12, background: '#ef4444' }}>Расход</button>
                <button onClick={() => setShowTransfer(true)} className="btn-primary" style={{ padding: '4px 10px', fontSize: 12 }}>Перемещение</button>
              </div>
            </div>
            {transactions.length === 0 ? (
              <div style={{ color: '#9aa0a6', fontSize: 13, marginTop: 12 }}>Нет операций</div>
            ) : (
              <table style={{ width: '100%', fontSize: 12, marginTop: 8, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '4px 6px', color: '#5f6368', fontWeight: 500 }}>Дата</th>
                    <th style={{ padding: '4px 6px', color: '#5f6368', fontWeight: 500 }}>Операция</th>
                    <th style={{ padding: '4px 6px', color: '#5f6368', fontWeight: 500, textAlign: 'right' }}>Приход</th>
                    <th style={{ padding: '4px 6px', color: '#5f6368', fontWeight: 500, textAlign: 'right' }}>Расход</th>
                    <th style={{ padding: '4px 6px', color: '#5f6368', fontWeight: 500, textAlign: 'right' }}>Остаток</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--bg)' }}>
                      <td style={{ padding: '4px 6px' }}>{new Date(t.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                      <td style={{ padding: '4px 6px' }}>{t.description}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: '#22c55e' }}>{Number(t.income) > 0 ? `${Number(t.income).toLocaleString('ru-RU')} ₸` : ''}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: '#ef4444' }}>{Number(t.outcome) > 0 ? `${Number(t.outcome).toLocaleString('ru-RU')} ₸` : ''}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 500 }}>{Number(t.balance).toLocaleString('ru-RU')} ₸</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        ) : (
          <div style={{ color: '#9aa0a6', fontSize: 13, marginTop: 12 }}>Выберите кассу слева для просмотра истории</div>
        )}
      </div>

      {showTransfer && <CashTransferModal accounts={accounts} onClose={() => setShowTransfer(false)} onDone={async () => { setShowTransfer(false); await refreshAll(); }} />}
      {showOperation && (
        <CashOperationModal
          accounts={accounts}
          type={showOperation}
          onClose={() => setShowOperation(null)}
          onDone={async () => { setShowOperation(null); await refreshAll(); }}
        />
      )}
    </div>
  );
}
