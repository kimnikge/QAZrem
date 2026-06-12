import type { MasterPayoutsResponse } from '../api';

interface Props {
  payouts: MasterPayoutsResponse | null;
  loading: boolean;
}

export function FinancePayoutsTab({ payouts, loading }: Props) {
  if (loading) return <div className="loading">Загрузка...</div>;
  if (!payouts) return <div className="error-message">Нет данных</div>;
  if (payouts.masters.length === 0) return <div className="empty-state"><p>Нет завершённых заказов за этот период</p></div>;

  return (
    <>
      {payouts.masters.map(m => (
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
              <thead><tr><th>Заказ</th><th>Стоимость</th><th>Скидка</th><th>Запчасти</th><th>Прибыль</th><th>%</th><th>К выплате</th></tr></thead>
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
      ))}
    </>
  );
}
