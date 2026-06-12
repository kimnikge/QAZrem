const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

type PeriodMode = 'month' | 'custom';

interface Props {
  mode: PeriodMode;
  onModeChange: (m: PeriodMode) => void;
  month: number;
  onMonthChange: (m: number) => void;
  year: number;
  onYearChange: (y: number) => void;
  from: string;
  onFromChange: (v: string) => void;
  to: string;
  onToChange: (v: string) => void;
}

export function FinancePeriodSelector({ mode, onModeChange, month, onMonthChange, year, onYearChange, from, onFromChange, to, onToChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 12, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>Период:</span>
      <button onClick={() => onModeChange('month')}
        style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 13,
          background: mode === 'month' ? 'var(--primary)' : 'var(--card-bg)',
          color: mode === 'month' ? '#fff' : 'var(--text-muted)' }}>За месяц</button>
      <button onClick={() => onModeChange('custom')}
        style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 13,
          background: mode === 'custom' ? 'var(--primary)' : 'var(--card-bg)',
          color: mode === 'custom' ? '#fff' : 'var(--text-muted)' }}>Произвольный</button>
      {mode === 'month' ? (
        <>
          <select value={month} onChange={e => onMonthChange(Number(e.target.value))}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: 'var(--card-bg)', color: 'var(--text)' }}>
            {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={year} onChange={e => onYearChange(Number(e.target.value))}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: 'var(--card-bg)', color: 'var(--text)' }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </>
      ) : (
        <>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>с</span>
          <input type="date" value={from} onChange={e => onFromChange(e.target.value)}
            style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: 'var(--card-bg)', color: 'var(--text)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>по</span>
          <input type="date" value={to} onChange={e => onToChange(e.target.value)}
            style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: 'var(--card-bg)', color: 'var(--text)' }} />
        </>
      )}
    </div>
  );
}
