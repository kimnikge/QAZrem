import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { getClients, getOrders, type Client } from '../api';

export function ClientsPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    getClients({ search: search || undefined, limit: 200 })
      .then(async (data) => {
        // Подсчитать заказы для каждого клиента
        const withOrders = await Promise.all(data.map(async c => {
          try {
            const res = await getOrders({ client_id: String(c.id), limit: 1 });
            return { ...c, order_count: res.total };
          } catch { return { ...c, order_count: 0 }; }
        }));
        setClients(withOrders);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <div className="ro-dashboard">
      <div className="page-header"><h2>Контакты</h2></div>

      <div style={{ marginBottom: 12, position: 'relative', maxWidth: 400 }}>
        <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9aa0a6' }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по имени или телефону..." className="glass-search"
          style={{ paddingLeft: 34, width: '100%' }} />
      </div>

      {loading ? <div className="loading">Загрузка...</div> : (
        <div style={{ background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Имя</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Телефон</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Email</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>Потрачено</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>Заказов</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <tr key={c.id} onClick={() => navigate(`/?client_id=${c.id}`)}
                  style={{ cursor: 'pointer', borderBottom: '1px solid var(--bg)', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8f9fa')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td style={{ padding: '10px 14px', fontWeight: 500 }}>{c.name}</td>
                  <td style={{ padding: '10px 14px' }}>{c.phone}</td>
                  <td style={{ padding: '10px 14px', color: c.email ? 'var(--text)' : '#9aa0a6' }}>{c.email || '—'}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>{Math.round(Number(c.total_spent)).toLocaleString('ru-RU')} ₸</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>{(c as any).order_count || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {clients.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#9aa0a6' }}>Нет клиентов</div>}
        </div>
      )}
    </div>
  );
}
