import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getStockReport, getTopParts, getStaleParts, getSupplierReport, getCategoryReport } from '../api/warehouse';

const apiUrl = import.meta.env.VITE_API_URL || '/api';

type Tab = 'masters' | 'services' | 'finance' | 'wh-stock' | 'wh-top' | 'wh-stale' | 'wh-supplier' | 'wh-category';

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

    // Складские отчёты — через API-функции
    if (tab.startsWith('wh-')) {
      const fetchers: Record<string, () => Promise<any>> = {
        'wh-stock': () => getStockReport(),
        'wh-top': () => getTopParts(20),
        'wh-stale': () => getStaleParts(90),
        'wh-supplier': () => getSupplierReport(),
        'wh-category': () => getCategoryReport(),
      };
      const fn = fetchers[tab];
      if (fn) {
        fn().then(setData).catch(console.error).finally(() => setLoading(false));
        return;
      }
    }

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
        <span style={{ margin: '0 8px', color: '#d1d5db', alignSelf: 'center' }}>|</span>
        <button className={`ro-tab${tab === 'wh-stock' ? ' active' : ''}`} onClick={() => setTab('wh-stock')}>Склад: остатки</button>
        <button className={`ro-tab${tab === 'wh-top' ? ' active' : ''}`} onClick={() => setTab('wh-top')}>Склад: топ</button>
        <button className={`ro-tab${tab === 'wh-stale' ? ' active' : ''}`} onClick={() => setTab('wh-stale')}>Склад: залежалось</button>
        <button className={`ro-tab${tab === 'wh-supplier' ? ' active' : ''}`} onClick={() => setTab('wh-supplier')}>По поставщикам</button>
        <button className={`ro-tab${tab === 'wh-category' ? ' active' : ''}`} onClick={() => setTab('wh-category')}>По категориям</button>
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

          {/* Warehouse: Stock */}
          {tab === 'wh-stock' && data && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Запчасть</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Категория</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Остаток</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Себест.</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Стоимость</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row: any) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--bg)', background: row.is_low_stock ? '#fef2f2' : undefined }}>
                    <td style={{ padding: '10px 16px' }}>{row.name} <code style={{ fontSize: 11 }}>{row.sku}</code></td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: '#5f6368' }}>{row.category_name || '—'}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: row.is_low_stock ? '#ef4444' : undefined }}>{row.quantity}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>{Math.round(Number(row.total_cost)).toLocaleString('ru-RU')} ₸</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>{Math.round(Number(row.total_value)).toLocaleString('ru-RU')} ₸</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Warehouse: Top parts */}
          {tab === 'wh-top' && data && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Запчасть</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Использований</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Продано шт.</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Выручка</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row: any) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--bg)' }}>
                    <td style={{ padding: '10px 16px' }}>{row.name} <code style={{ fontSize: 11 }}>{row.sku}</code></td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>{row.times_used}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>{row.total_used}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600 }}>{Math.round(Number(row.total_revenue)).toLocaleString('ru-RU')} ₸</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Warehouse: Stale */}
          {tab === 'wh-stale' && data && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Запчасть</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Остаток</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Дней без движения</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Заморожено</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row: any) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--bg)' }}>
                    <td style={{ padding: '10px 16px' }}>{row.name}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>{row.quantity}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: '#ef4444' }}>{row.days_idle ?? '∞'}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>{Math.round(Number(row.frozen_cost)).toLocaleString('ru-RU')} ₸</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Warehouse: By supplier */}
          {tab === 'wh-supplier' && data && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Поставщик</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Партий</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Получено</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Потрачено</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row: any) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--bg)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 500 }}>{row.name}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>{row.batches_count}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>{row.total_received}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600 }}>{Math.round(Number(row.total_spent)).toLocaleString('ru-RU')} ₸</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Warehouse: By category */}
          {tab === 'wh-category' && data && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Категория</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Запчастей</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Остаток</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Себест.</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row: any) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--bg)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 500 }}>{row.name}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>{row.parts_count}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>{row.total_stock}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600 }}>{Math.round(Number(row.total_cost)).toLocaleString('ru-RU')} ₸</td>
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
