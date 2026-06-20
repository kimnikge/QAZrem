interface Props {
  brands: string[];
  masters: Array<{ id: number; name: string }>;
  brandFilter: string;
  masterFilter: string;
  onBrandChange: (brand: string) => void;
  onMasterChange: (masterId: string) => void;
}

/** Быстрые чипсы брендов и мастеров — данные приходят из родителя (DashboardPage) */
export function QuickFilters({ brands, masters, brandFilter, masterFilter, onBrandChange, onMasterChange }: Props) {
  if (brands.length === 0 && masters.length === 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
      {brands.map(b => (
        <button key={b} onClick={() => onBrandChange(brandFilter === b ? '' : b)}
          className={brandFilter === b ? 'chip active' : 'chip'}>{b}</button>
      ))}
      {brands.length > 0 && masters.length > 0 && <span style={{ color: 'var(--border)', margin: '0 4px' }}>|</span>}
      {masters.map(m => (
        <button key={m.id} onClick={() => onMasterChange(masterFilter === String(m.id) ? '' : String(m.id))}
          className={masterFilter === String(m.id) ? 'chip active' : 'chip'}>{m.name.split(' ')[0]}</button>
      ))}
    </div>
  );
}
