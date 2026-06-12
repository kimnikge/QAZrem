import { useNavigate } from 'react-router-dom';
import type { FinanceReport } from '../api';

const shortMonths = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

function formatPeriod(from: string, to: string): string {
  const d1 = new Date(from); const d2 = new Date(to);
  if (d1.getFullYear() === d2.getFullYear()) return `${shortMonths[d1.getMonth()]} — ${shortMonths[d2.getMonth()]} ${d1.getFullYear()}`;
  return `${shortMonths[d1.getMonth()]} ${d1.getFullYear()} — ${shortMonths[d2.getMonth()]} ${d2.getFullYear()}`;
}

interface Props {
  report: FinanceReport;
  onOpenModal: (type: 'income' | 'paid' | 'debt' | 'expenses' | 'profit') => void;
}

export function FinanceOverviewTab({ report, onOpenModal }: Props) {
  return (
    <>
      <div className="finance-grid" style={{ marginTop: 8 }}>
        <div className="finance-card" style={{ cursor: 'pointer' }} onClick={() => onOpenModal('income')}>
          <span className="finance-label">Заработано</span>
          <span className="finance-value positive">{report.income} ₸</span>
        </div>
        <div className="finance-card" style={{ cursor: 'pointer' }} onClick={() => onOpenModal('paid')}>
          <span className="finance-label">Оплачено</span>
          <span className="finance-value" style={{ color: '#1a73e8' }}>{report.paid} ₸</span>
        </div>
        <div className="finance-card" style={{ cursor: 'pointer' }} onClick={() => onOpenModal('debt')}>
          <span className="finance-label">Долг</span>
          <span className={`finance-value ${report.debt > 0 ? 'negative' : 'positive'}`}>{report.debt} ₸</span>
        </div>
        <div className="finance-card" style={{ cursor: 'pointer' }} onClick={() => onOpenModal('expenses')}>
          <span className="finance-label">Расходы</span>
          <span className="finance-value negative">{report.expenses.total} ₸</span>
        </div>
        <div className="finance-card" style={{ cursor: 'pointer' }} onClick={() => onOpenModal('profit')}>
          <span className="finance-label">Прибыль</span>
          <span className={`finance-value ${report.profit >= 0 ? 'positive' : 'negative'}`}>{report.profit} ₸</span>
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
        <div className="detail-row"><span>Период</span><strong>{formatPeriod(report.period.from, report.period.to)}</strong></div>
      </div>
    </>
  );
}
