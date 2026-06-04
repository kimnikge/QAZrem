import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { getFinanceReport, type FinanceReport } from '../api';

export function FinancePage() {
  const [report, setReport] = useState<FinanceReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const from = `${now.getFullYear()}-01-01`;
    const to = `${now.getFullYear()}-12-31`;
    getFinanceReport(from, to).then(setReport).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Загрузка...</div>;
  if (!report) return <div className="error-message">Нет данных</div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">
          <TrendingUp size={24} />
          <h2>Финансы</h2>
        </div>
      </div>
      <div className="finance-grid">
        <div className="finance-card">
          <span className="finance-label">Доходы</span>
          <span className="finance-value positive">{report.income.toLocaleString()} ₸</span>
        </div>
        <div className="finance-card">
          <span className="finance-label">Расходы</span>
          <span className="finance-value negative">{report.expenses.total.toLocaleString()} ₸</span>
        </div>
        <div className="finance-card">
          <span className="finance-label">Прибыль</span>
          <span className={`finance-value ${report.profit >= 0 ? 'positive' : 'negative'}`}>
            {report.profit.toLocaleString()} ₸
          </span>
        </div>
        <div className="finance-card">
          <span className="finance-label">Завершённые заказы</span>
          <span className="finance-value">{report.completed_orders}</span>
        </div>
      </div>
      <div className="detail-card">
        <h3>Детали</h3>
        <div className="detail-row"><span>Прямые расходы</span><strong>{report.expenses.direct.toLocaleString()} ₸</strong></div>
        <div className="detail-row"><span>Себестоимость запчастей</span><strong>{report.expenses.parts_cost.toLocaleString()} ₸</strong></div>
      </div>
    </div>
  );
}
