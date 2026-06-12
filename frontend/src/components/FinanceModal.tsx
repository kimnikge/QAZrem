import { useNavigate } from 'react-router-dom';
import type { FinanceReport } from '../api';

type ModalType = 'income' | 'paid' | 'debt' | 'expenses' | 'profit';

interface Props {
  type: ModalType;
  report: FinanceReport;
  onClose: () => void;
}

export function FinanceModal({ type, report, onClose }: Props) {
  const navigate = useNavigate();

  const title: Record<ModalType, string> = {
    income: `Заработано: ${report.income} ₸`,
    paid: `Оплачено: ${report.paid} ₸`,
    debt: `Долг: ${report.debt} ₸`,
    expenses: `Расходы: ${report.expenses.total} ₸`,
    profit: `Прибыль: ${report.profit} ₸`,
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 680, background: '#fff', color: '#202124' }}>
        <div className="modal-header">
          <h3 style={{ margin: 0, fontSize: 18 }}>{title[type]}</h3>
          <button className="modal-btn-icon" onClick={onClose} style={{ fontSize: 24, lineHeight: 1 }}>×</button>
        </div>
        <div className="modal-body">

          {type === 'income' && (
            <div className="ro-table-wrap">
              <table className="ro-table">
                <thead><tr><th>Заказ</th><th>Клиент</th><th>Устройство</th><th>Стоимость</th><th>Скидка</th><th>Итого</th></tr></thead>
                <tbody>
                  {report.income_orders.map(o => (
                    <tr key={o.id} className="ro-row" style={{ cursor: 'pointer' }} onClick={() => { onClose(); navigate(`/orders/${o.id}`); }}>
                      <td className="ro-cell-id">#{o.id}</td><td>{o.client_name}</td><td>{o.brand} {o.model}</td>
                      <td>{o.cost} ₸</td><td>{o.discount > 0 ? `${o.discount} ₸` : '—'}</td>
                      <td style={{ fontWeight: 600 }}>{o.cost - o.discount} ₸</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr style={{ fontWeight: 700, background: '#f8f9fa' }}>
                  <td colSpan={3}></td><td>{report.income_orders.reduce((s, o) => s + o.cost, 0)} ₸</td>
                  <td>{report.income_orders.reduce((s, o) => s + o.discount, 0)} ₸</td><td>{report.income} ₸</td>
                </tr></tfoot>
              </table>
            </div>
          )}

          {type === 'paid' && (
            <div className="ro-table-wrap">
              <table className="ro-table">
                <thead><tr><th>Заказ</th><th>Клиент</th><th>Сумма</th><th>Способ</th></tr></thead>
                <tbody>
                  {report.paid_orders.map((p, i) => (
                    <tr key={i} className="ro-row">
                      <td className="ro-cell-id">#{p.order_id}</td><td>{p.client_name}</td>
                      <td style={{ fontWeight: 600, color: '#1a73e8' }}>{p.amount} ₸</td><td>{p.payment_method_name}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr style={{ fontWeight: 700, background: '#f8f9fa' }}>
                  <td colSpan={2}></td><td>{report.paid} ₸</td><td></td>
                </tr></tfoot>
              </table>
            </div>
          )}

          {type === 'debt' && (
            <div className="ro-table-wrap">
              {report.debt_orders.length === 0 ? <p style={{ color: '#5f6368', padding: 16 }}>Долгов нет</p> : (
                <table className="ro-table">
                  <thead><tr><th>Заказ</th><th>Клиент</th><th>Стоимость</th><th>Оплачено</th><th>Долг</th></tr></thead>
                  <tbody>
                    {report.debt_orders.map(o => (
                      <tr key={o.id} className="ro-row" style={{ cursor: 'pointer' }} onClick={() => { onClose(); navigate(`/orders/${o.id}`); }}>
                        <td className="ro-cell-id">#{o.id}</td><td>{o.client_name}</td><td>{o.cost - o.discount} ₸</td>
                        <td>{o.paid_total} ₸</td><td style={{ fontWeight: 600, color: '#ef4444' }}>{o.balance} ₸</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr style={{ fontWeight: 700, background: '#f8f9fa' }}>
                    <td colSpan={3}></td><td>{report.debt_orders.reduce((s, o) => s + o.paid_total, 0)} ₸</td>
                    <td style={{ color: '#ef4444' }}>{report.debt} ₸</td>
                  </tr></tfoot>
                </table>
              )}
            </div>
          )}

          {type === 'expenses' && (
            <div className="ro-table-wrap">
              <table className="ro-table">
                <thead><tr><th>Тип</th><th>Описание</th><th>Сумма</th></tr></thead>
                <tbody>
                  {report.expense_items.map((item, i) => (
                    <tr key={i} className="ro-row">
                      <td><span className={`ro-badge ${item.type === 'expense' ? 's-cancelled' : 's-repair'}`}>{item.type === 'expense' ? 'Расход' : 'Запчасть'}</span></td>
                      <td>{item.description}{item.type === 'part' && item.order_id && <span style={{ color: '#1a73e8', cursor: 'pointer', marginLeft: 8, fontSize: 12 }}
                        onClick={() => { onClose(); navigate(`/orders/${item.order_id}`); }}>#{item.order_id}</span>}</td>
                      <td style={{ fontWeight: 600, color: '#ef4444' }}>{item.amount} ₸</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr style={{ fontWeight: 700, background: '#f8f9fa' }}>
                  <td colSpan={2}></td><td style={{ color: '#ef4444' }}>{report.expenses.total} ₸</td>
                </tr></tfoot>
              </table>
              <div style={{ marginTop: 12, display: 'flex', gap: 16, fontSize: 13, color: '#5f6368' }}>
                <span>Прямые расходы: <strong>{report.expenses.direct} ₸</strong></span>
                <span>Запчасти: <strong>{report.expenses.parts_cost} ₸</strong></span>
              </div>
            </div>
          )}

          {type === 'profit' && (
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
                <div style={{ fontSize: 28, fontWeight: 700, color: '#22c55e' }}>{report.profit} ₸</div>
              </div>
              <p style={{ fontSize: 13, color: '#5f6368', marginTop: 16, textAlign: 'center' }}>Прибыль = Заработано − Расходы</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
