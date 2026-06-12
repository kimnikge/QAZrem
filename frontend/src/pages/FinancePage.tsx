import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Download } from 'lucide-react';
import { getFinanceReport, getMasterPayouts, getAllUsers, type FinanceReport, type MasterPayoutsResponse } from '../api';
import { FinancePeriodSelector } from '../components/FinancePeriodSelector';
import { FinanceOverviewTab } from '../components/FinanceOverviewTab';
import { FinancePayoutsTab } from '../components/FinancePayoutsTab';
import { FinanceModal } from '../components/FinanceModal';

const apiUrl = import.meta.env.VITE_API_URL || '/api';
const currentMonth = new Date().getMonth();
const currentYear = new Date().getFullYear();

type Tab = 'overview' | 'payouts';
type ModalType = 'income' | 'paid' | 'debt' | 'expenses' | 'profit' | null;
type PeriodMode = 'month' | 'custom';

function getMonthRange(m: number, y: number) {
  const lastDay = new Date(y, m + 1, 0).getDate();
  return { from: `${y}-${String(m + 1).padStart(2, '0')}-01`, to: `${y}-${String(m + 1).padStart(2, '0')}-${lastDay}` };
}

export function FinancePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState<Tab>('overview');
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month');
  const [selMonth, setSelMonth] = useState(currentMonth);
  const [selYear, setSelYear] = useState(currentYear);
  const [customFrom, setCustomFrom] = useState(`${currentYear}-01-01`);
  const [customTo, setCustomTo] = useState(`${currentYear}-12-31`);
  const [masterFilter, setMasterFilter] = useState<number | ''>('');

  const [report, setReport] = useState<FinanceReport | null>(null);
  const [payouts, setPayouts] = useState<MasterPayoutsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [masters, setMasters] = useState<Array<{ id: number; name: string }>>([]);
  const [modal, setModal] = useState<ModalType>(null);

  useEffect(() => { getAllUsers().then(u => setMasters(u.filter(x => x.role === 'master'))).catch(() => {}); }, []);

  useEffect(() => {
    setLoading(true);
    const { from, to } = periodMode === 'custom' ? { from: customFrom, to: customTo } : getMonthRange(selMonth, selYear);
    if (tab === 'overview') {
      getFinanceReport(from, to).then(setReport).catch(console.error).finally(() => setLoading(false));
    } else {
      getMasterPayouts(`custom_${from}_${to}`, masterFilter || undefined)
        .then(setPayouts).catch(console.error).finally(() => setLoading(false));
    }
  }, [tab, periodMode, selMonth, selYear, customFrom, customTo, masterFilter]);

  return (
    <div className="ro-dashboard">
      <div className="page-header"><h2>Финансы</h2></div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div className="ro-tabs" style={{ flex: 1 }}>
          <button className={`ro-tab${tab === 'overview' ? ' active' : ''}`} onClick={() => setTab('overview')}>Общий отчёт</button>
          <button className={`ro-tab${tab === 'payouts' ? ' active' : ''}`} onClick={() => setTab('payouts')}>Расчёт мастерам</button>
        </div>
        {tab === 'overview' && report && isAdmin && (
          <button className="btn-secondary" onClick={() => {
            const token = sessionStorage.getItem('token');
            fetch(`${apiUrl}/finance/report/export`, { headers: { Authorization: `Bearer ${token}` } })
              .then(res => res.blob()).then(blob => {
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                a.download = `finance_report_${new Date().toISOString().split('T')[0]}.csv`; a.click();
              }).catch(console.error);
          }}><Download size={14} /> Экспорт</button>
        )}
      </div>

      {/* Period selector (shared) */}
      <FinancePeriodSelector
        mode={periodMode} onModeChange={setPeriodMode}
        month={selMonth} onMonthChange={setSelMonth} year={selYear} onYearChange={setSelYear}
        from={customFrom} onFromChange={setCustomFrom} to={customTo} onToChange={setCustomTo}
      />

      {tab === 'overview' && report && <FinanceOverviewTab report={report} onOpenModal={setModal} />}
      {tab === 'overview' && loading && <div className="loading">Загрузка...</div>}

      {tab === 'payouts' && (
        <>
          {isAdmin && masters.length > 0 && (
            <div style={{ display: 'flex', gap: 10, marginTop: 4, marginBottom: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#5f6368', fontWeight: 500 }}>Мастер:</span>
              <select className="filter-select" value={masterFilter}
                onChange={e => setMasterFilter(e.target.value ? Math.round(Number(e.target.value)) : '')}>
                <option value="">Все</option>
                {masters.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}
          <FinancePayoutsTab payouts={payouts} loading={loading} />
        </>
      )}

      {modal && report && <FinanceModal type={modal} report={report} onClose={() => setModal(null)} />}
    </div>
  );
}
