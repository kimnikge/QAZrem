import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Download } from 'lucide-react';
import {
  getFinanceReport, getMasterPayouts, getAllUsers,
  type FinanceReport, type MasterPayoutsResponse
} from '../api';

const apiUrl = import.meta.env.VITE_API_URL || '/api';

type Tab = 'overview' | 'payouts';
type ModalType = 'income' | 'paid' | 'debt' | 'expenses' | 'profit' | null;

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
  const [modal, setModal] = useState<ModalType>(null);
  const navigate = useNavigate();

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div className="ro-tabs" style={{ flex: 1 }}>
          <button className={`ro-tab${tab === 'overview' ? ' active' : ''}`} onClick={() => setTab('overview')}>Общий отчёт</button>
          <button className={`ro-tab${tab === 'payouts' ? ' active' : ''}`} onClick={() => setTab('payouts')}>Расчёт мастерам</button>
        </div>
        {tab === 'overview' && report && isAdmin && (
          <button className="btn-secondary" onClick={() => {
            const token = sessionStorage.getItem('token');
            fetch(`${apiUrl}/finance/report/export`, { headers: { Authorization: `Bearer ${token}` } })
              .then(res => res.blob())
              .then(blob => {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `finance_report_${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
              })
              .catch(console.error);
          }}>
            <Download size={14} /> Экспорт
          </button>
        )}
      </div>

      {tab === 'overview' && report && (
        <>
          <div className="finance-grid" style={{ marginTop: 16 }}>
            <div className="finance-card" style={{ cursor: 'pointer' }} onClick={() => setModal('income')}>
              <span className="finance-label">Заработано</span>
              <span className="finance-value positive">{report.income} ₸</span>
            </div>
            <div className="finance-card" style={{ cursor: 'pointer' }} onClick={() => setModal('paid')}>
              <span className="finance-label">Оплачено</span>
              <span className="finance-value" style={{ color: '#1a73e8' }}>{report.paid} ₸</span>
            </div>
            <div className="finance-card" style={{ cursor: 'pointer' }} onClick={() => setModal('debt')}>
              <span className="finance-label">Долг</span>
              <span className={`finance-value ${report.debt > 0 ? 'negative' : 'positive'}`}>{report.debt} ₸</span>
            </div>
            <div className="finance-card" style={{ cursor: 'pointer' }} onClick={() => setModal('expenses')}>
              <span className="finance-label">Расходы</span>
              <span className="finance-value negative">{report.expenses.total} ₸</span>
            </div>
            <div className="finance-card" style={{ cursor: 'pointer' }} onClick={() => setModal('profit')}>
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

      {/* Modal */}
      {modal && report && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setModal(null)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 12, padding: 24,
              maxWidth: 640, width: '90%', maxHeight: '80vh', overflow: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>
                {modal === 'income' && `Заработано: ${report.income} ₸`}
                {modal === 'paid' && `Оплачено: ${report.paid} ₸`}
                {modal === 'debt' && `Долг: ${report.debt} ₸`}
                {modal === 'expenses' && `Расходы: ${report.expenses.total} ₸`}
                {modal === 'profit' && `Прибыль: ${report.profit} ₸`}
              </h3>
              <button
                onClick={() => setModal(null)}
                style={{
                  background: 'none', border: 'none', fontSize: 24, cursor: 'pointer',
                  color: '#5f6368', lineHeight: 1, padding: '0 4px'
                }}
              >×</button>
            </div>

            {/* Income detail: list of completed orders */}
            {modal === 'income' && (
              <div className="ro-table-wrap">
                <table className="ro-table">
                  <thead>
                    <tr>
                      <th>Заказ</th>
                      <th>Клиент</th>
                      <th>Устройство</th>
                      <th>Стоимость</th>
                      <th>Скидка</th>
                      <th>Итого</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.income_orders.map(o => (
                      <tr
                        key={o.id} className="ro-row"
                        style={{ cursor: 'pointer' }}
                        onClick={() => { setModal(null); navigate(`/orders/${o.id}`); }}
                      >
                        <td className="ro-cell-id">#{o.id}</td>
                        <td>{o.client_name}</td>
                        <td>{o.brand} {o.model}</td>
                        <td>{o.cost} ₸</td>
                        <td>{o.discount > 0 ? `${o.discount} ₸` : '—'}</td>
                        <td style={{ fontWeight: 600 }}>{o.cost - o.discount} ₸</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700, background: '#f8f9fa' }}>
                      <td colSpan={3}></td>
                      <td>{report.income_orders.reduce((s, o) => s + o.cost, 0)} ₸</td>
                      <td>{report.income_orders.reduce((s, o) => s + o.discount, 0)} ₸</td>
                      <td>{report.income} ₸</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Paid detail: list of payments */}
            {modal === 'paid' && (
              <div className="ro-table-wrap">
                <table className="ro-table">
                  <thead>
                    <tr>
                      <th>Заказ</th>
                      <th>Клиент</th>
                      <th>Сумма</th>
                      <th>Способ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.paid_orders.map((p, i) => (
                      <tr key={i} className="ro-row">
                        <td className="ro-cell-id">#{p.order_id}</td>
                        <td>{p.client_name}</td>
                        <td style={{ fontWeight: 600, color: '#1a73e8' }}>{p.amount} ₸</td>
                        <td>{p.payment_method_name}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700, background: '#f8f9fa' }}>
                      <td colSpan={2}></td>
                      <td>{report.paid} ₸</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Debt detail: orders with balance > 0 */}
            {modal === 'debt' && (
              <div className="ro-table-wrap">
                {report.debt_orders.length === 0 ? (
                  <p style={{ color: '#5f6368', padding: 16 }}>Долгов нет</p>
                ) : (
                  <table className="ro-table">
                    <thead>
                      <tr>
                        <th>Заказ</th>
                        <th>Клиент</th>
                        <th>Стоимость</th>
                        <th>Оплачено</th>
                        <th>Долг</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.debt_orders.map(o => (
                        <tr
                          key={o.id} className="ro-row"
                          style={{ cursor: 'pointer' }}
                          onClick={() => { setModal(null); navigate(`/orders/${o.id}`); }}
                        >
                          <td className="ro-cell-id">#{o.id}</td>
                          <td>{o.client_name}</td>
                          <td>{o.cost - o.discount} ₸</td>
                          <td>{o.paid_total} ₸</td>
                          <td style={{ fontWeight: 600, color: '#ef4444' }}>{o.balance} ₸</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ fontWeight: 700, background: '#f8f9fa' }}>
                        <td colSpan={3}></td>
                        <td>{report.debt_orders.reduce((s, o) => s + o.paid_total, 0)} ₸</td>
                        <td style={{ color: '#ef4444' }}>{report.debt} ₸</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            )}

            {/* Expenses detail */}
            {modal === 'expenses' && (
              <div className="ro-table-wrap">
                <table className="ro-table">
                  <thead>
                    <tr>
                      <th>Тип</th>
                      <th>Описание</th>
                      <th>Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.expense_items.map((item, i) => (
                      <tr key={i} className="ro-row">
                        <td>
                          <span className={`ro-badge ${item.type === 'expense' ? 's-cancelled' : 's-repair'}`}>
                            {item.type === 'expense' ? 'Расход' : 'Запчасть'}
                          </span>
                        </td>
                        <td>
                          {item.description}
                          {item.type === 'part' && item.order_id && (
                            <span
                              style={{ color: '#1a73e8', cursor: 'pointer', marginLeft: 8, fontSize: 12 }}
                              onClick={() => { setModal(null); navigate(`/orders/${item.order_id}`); }}
                            >
                              #{item.order_id}
                            </span>
                          )}
                        </td>
                        <td style={{ fontWeight: 600, color: '#ef4444' }}>{item.amount} ₸</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700, background: '#f8f9fa' }}>
                      <td colSpan={2}></td>
                      <td style={{ color: '#ef4444' }}>{report.expenses.total} ₸</td>
                    </tr>
                  </tfoot>
                </table>
                <div style={{ marginTop: 12, display: 'flex', gap: 16, fontSize: 13, color: '#5f6368' }}>
                  <span>Прямые расходы: <strong>{report.expenses.direct} ₸</strong></span>
                  <span>Запчасти: <strong>{report.expenses.parts_cost} ₸</strong></span>
                </div>
              </div>
            )}

            {/* Profit detail */}
            {modal === 'profit' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div style={{ background: '#f0fdf4', padding: 16, borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: '#5f6368' }}>Заработано</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#22c55e' }}>{report.income} ₸</div>
                  </div>
                  <div style={{ background: '#fef2f2', padding: 16, borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: '#5f6368' }}>Расходы</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#ef4444' }}>{report.expenses.total} ₸</div>
                  </div>
                </div>
                <div style={{ background: '#f0fdf4', padding: 16, borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#5f6368' }}>Прибыль</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#22c55e' }}>{report.income - report.expenses.total} ₸</div>
                </div>
                <p style={{ fontSize: 13, color: '#5f6368', marginTop: 16, textAlign: 'center' }}>
                  Прибыль = Заработано − Расходы
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
