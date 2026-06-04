import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getFinanceReport, getMasterPayouts, getAllUsers,
  type FinanceReport, type MasterPayoutsResponse
} from '../api';

type Tab = 'overview' | 'payouts';

const periods = [
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
  { key: 'quarter', label: 'Квартал' },
  { key: 'year', label: 'Год' },
];

export function FinancePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState<Tab>('overview');
  const [period, setPeriod] = useState('month');
  const [masterFilter, setMasterFilter] = useState<number | ''>('');

  const [report, setReport] = useState<FinanceReport | null>(null);
  const [payouts, setPayouts] = useState<MasterPayoutsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [masters, setMasters] = useState<Array<{ id: number; name: string }>>([]);

  useEffect(() => {
    getAllUsers().then(u => setMasters(u.filter(x => x.role === 'master'))).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const now = new Date();
    const from = `${now.getFullYear()}-01-01`;
    const to = `${now.getFullYear()}-12-31`;

    if (tab === 'overview') {
      getFinanceReport(from, to).then(setReport).catch(console.error).finally(() => setLoading(false));
    } else {
      getMasterPayouts(period, masterFilter || undefined)
        .then(setPayouts).catch(console.error).finally(() => setLoading(false));
    }
  }, [tab, period, masterFilter]);

  return (
    <div className="ro-dashboard">
      <div className="page-header"><h2>Финансы</h2></div>

      {/* Tabs */}
      <div className="ro-tabs">
        <button className={`ro-tab${tab === 'overview' ? ' active' : ''}`} onClick={() => setTab('overview')}>Общий отчёт</button>
        <button className={`ro-tab${tab === 'payouts' ? ' active' : ''}`} onClick={() => setTab('payouts')}>Расчёт мастерам</button>
      </div>

      {tab === 'overview' && report && (
        <>
          <div className="finance-grid" style={{ marginTop: 16 }}>
            <div className="finance-card">
              <span className="finance-label">Доходы</span>
              <span className="finance-value positive">{report.income} ₸</span>
            </div>
            <div className="finance-card">
              <span className="finance-label">Расходы</span>
              <span className="finance-value negative">{report.expenses.total} ₸</span>
            </div>
            <div className="finance-card">
              <span className="finance-label">Прибыль</span>
              <span className={`finance-value ${report.profit >= 0 ? 'positive' : 'negative'}`}>
                {report.profit} ₸
              </span>
            </div>
            <div className="finance-card">
              <span className="finance-label">Завершённые заказы</span>
              <span className="finance-value">{report.completed_orders}</span>
            </div>
          </div>
          <div className="detail-card">
            <h3>Детали</h3>
            <div className="detail-row"><span>Прямые расходы</span><strong>{report.expenses.direct} ₸</strong></div>
            <div className="detail-row"><span>Себестоимость запчастей</span><strong>{report.expenses.parts_cost} ₸</strong></div>
            <div className="detail-row"><span>Период</span><strong>Январь — Декабрь {new Date().getFullYear()}</strong></div>
          </div>
        </>
      )}

      {tab === 'payouts' && (
        <>
          {/* Period selector + master filter (admin only) */}
          <div style={{ display: 'flex', gap: 12, marginTop: 16, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: '#5f6368', fontWeight: 500 }}>Период:</span>
            {periods.map(p => (
              <button
                key={p.key}
                className={`btn-status${period === p.key ? '' : ''}`}
                style={{
                  ...(period === p.key ? { background: '#1a73e8', color: '#fff', borderColor: '#1a73e8' } : {}),
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  fontSize: 13
                }}
                onClick={() => setPeriod(p.key)}
              >
                {p.label}
              </button>
            ))}
            {isAdmin && masters.length > 0 && (
              <>
                <span style={{ fontSize: 13, color: '#5f6368', fontWeight: 500, marginLeft: 8 }}>Мастер:</span>
                <select
                  className="filter-select"
                  value={masterFilter}
                  onChange={e => setMasterFilter(e.target.value ? Math.round(Number(e.target.value)) : '')}
                >
                  <option value="">Все</option>
                  {masters.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </>
            )}
          </div>

          {loading ? <div className="loading">Загрузка...</div> : !payouts ? <div className="error-message">Нет данных</div> : (
            <>
              {payouts.masters.length === 0 ? (
                <div className="empty-state"><p>Нет завершённых заказов за этот период</p></div>
              ) : (
                payouts.masters.map(m => (
                  <div key={m.master_id} className="detail-card" style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <h3 style={{ margin: 0 }}>{m.master_name}</h3>
                      <div style={{ display: 'flex', gap: 16 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 12, color: '#5f6368' }}>Прибыль</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: '#22c55e' }}>{m.total_profit} ₸</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 12, color: '#5f6368' }}>К выплате</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a73e8' }}>{m.total_payout} ₸</div>
                        </div>
                      </div>
                    </div>

                    <div className="ro-table-wrap">
                      <table className="ro-table">
                        <thead>
                          <tr>
                            <th>Заказ</th>
                            <th>Стоимость</th>
                            <th>Скидка</th>
                            <th>Запчасти</th>
                            <th>Прибыль</th>
                            <th>%</th>
                            <th>К выплате</th>
                          </tr>
                        </thead>
                        <tbody>
                          {m.orders.map(o => (
                            <tr key={o.order_id}>
                              <td className="ro-cell-id">#{o.order_id}</td>
                              <td>{Math.round(Number(o.cost))} ₸</td>
                              <td>{Math.round(Number(o.discount))} ₸</td>
                              <td>{Math.round(Number(o.parts_cost))} ₸</td>
                              <td style={{ fontWeight: 600, color: '#22c55e' }}>{Math.round(Number(o.profit))} ₸</td>
                              <td>{o.master_commission_pct}%</td>
                              <td style={{ fontWeight: 700, color: '#1a73e8' }}>{Math.round(Number(o.master_payout))} ₸</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </>
      )}

      {tab === 'overview' && loading && <div className="loading">Загрузка...</div>}
    </div>
  );
}
