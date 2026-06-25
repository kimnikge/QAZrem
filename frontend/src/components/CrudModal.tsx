import { type ReactNode } from 'react';

type Field = {
  label: string;
  name: string;
  type?: 'text' | 'number' | 'select';
  value: string | number;
  onChange: (value: string | number) => void;
  options?: { label: string; value: string | number }[];
  placeholder?: string;
  required?: boolean;
  hint?: string;
};

type CrudModalProps = {
  title: string;
  fields: Field[];
  onSave: () => void;
  onClose: () => void;
  loading?: boolean;
  saveLabel?: string;
  children?: ReactNode; // дополнительный контент между полями и кнопкой
};

export function CrudModal({ title, fields, onSave, onClose, loading, saveLabel, children }: CrudModalProps) {
  const canSave = fields.every(f => !f.required || (f.value !== '' && f.value !== undefined && f.value !== null));

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 24,
        maxWidth: 520, width: '90%', maxHeight: '90vh', overflow: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#5f6368', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {fields.map(f => (
            <div key={f.name}>
              <label style={{ fontSize: 13, color: '#5f6368', display: 'block', marginBottom: 4 }}>
                {f.label}{f.required ? ' *' : ''}
                {f.hint && <span style={{ color: '#9ca3af', marginLeft: 6 }}>({f.hint})</span>}
              </label>
              {f.type === 'select' ? (
                <select
                  value={f.value}
                  onChange={e => f.onChange(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, background: '#fff' }}
                >
                  <option value="">—</option>
                  {f.options?.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type || 'text'}
                  value={f.value}
                  onChange={e => f.onChange(f.type === 'number' ? Math.round(Number(e.target.value)) : e.target.value)}
                  placeholder={f.placeholder}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }}
                />
              )}
            </div>
          ))}

          {children}

          <button
            className="btn-primary"
            onClick={onSave}
            disabled={loading || !canSave}
            style={{ marginTop: 8 }}
          >
            {loading ? 'Сохранение...' : (saveLabel || 'Сохранить')}
          </button>
        </div>
      </div>
    </div>
  );
}
