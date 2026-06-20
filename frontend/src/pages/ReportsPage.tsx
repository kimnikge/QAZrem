import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const apiUrl = import.meta.env.VITE_API_URL || '/api';

type Tab = 'masters' | 'services' | 'finance';

export function ReportsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState<Tab>('masters');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const currentYear = now.getFullYear();

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    setLoading(true);
    const token = sessionStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    const from = `${currentYear}-01-01`;
    const to = `${currentYear}-12-31`;

    let url = '';
    if (tab === 'masters') url = `${apiUrl}/reports/masters?from=${from}&to=${to}`;
    else if (tab === 'services') url = `${apiUrl}/reports/services?from=${from}&to=${to}`;
    else if (tab === 'finance') url = `${apiUrl}/reports/finance?from=${from}&to=${to}`;

    fetch(url, { headers }).then(r => r.json()).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [tab, isAdmin]);

  if (!isAdmin) return <div className="ro-dashboard"><div className="page-header"><h2>Отчёты</h2></div><div className="error-message">Доступ запрещён</div></div>;

  return (
    <div className="ro-dashboard">
      <div className="page-header"><h2>Отчёты</h2></div>

      <div className="ro-tabs" style={{ marginBottom: 16 }}>
        <button className={`ro-tab${tab === 'masters' ? ' active' : ''}`} onClick={() => setTab('masters')}>По мастерам</button>
        <button className={`ro-tab${tab === 'services' ? ' active' : ''}`} onClick={() => setTab('services')}>По услугам</button>
        <button className={`ro-tab${tab === 'finance' ? ' active' : ''}`} onClick={() => setTab('finance')}>Финансы</button>
      </div>

      {loading ? <div className="loading">Загрузка...</div> : (
        <div style={{ background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>

          {/* Masters */}
          {tab === 'masters' && data && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Мастер</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Заказов</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Сумма</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Комиссия</th>
                </tr>
              </thead>
              <tbody>
                {data.map((m: any) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--bg)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 500 }}>{m.name}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>{m.order_count}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>{Number(m.total_amount).toLocaleString('ru-RU')} ₸</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--primary)' }}>{Math.round(Number(m.commission)).toLocaleString('ru-RU')} ₸</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Services */}
          {tab === 'services' && data && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Услуга</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Использований</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {data.map((s: any) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--bg)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 500 }}>{s.name}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>{s.usage_count}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600 }}>{Number(s.total_amount).toLocaleString('ru-RU')} ₸</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Finance */}
          {tab === 'finance' && data && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Месяц</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Доход</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Расход</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Прибыль</th>
                </tr>
              </thead>
              <tbody>
                {data.map((f: any) => (
                  <tr key={f.month} style={{ borderBottom: '1px solid var(--bg)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 500 }}>{f.month}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: '#22c55e' }}>{Number(f.income).toLocaleString('ru-RU')} ₸</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: '#ef4444' }}>{Number(f.expenses).toLocaleString('ru-RU')} ₸</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: Number(f.profit) >= 0 ? '#22c55e' : '#ef4444' }}>
                      {Number(f.profit).toLocaleString('ru-RU')} ₸
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!data && <div style={{ padding: 40, textAlign: 'center', color: '#9aa0a6' }}>Нет данных</div>}
        </div>
      )}
    </div>
  );
}
