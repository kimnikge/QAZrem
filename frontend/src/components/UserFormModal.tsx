import { useState } from 'react';
import { createUser, updateUser, type UserCreateInput, type UserUpdateInput } from '../api';

type Props = {
  mode: 'create' | 'edit';
  initial?: { id: number; name: string; login: string; role: string; default_commission_pct?: string };
  onClose: () => void;
  onSaved: () => void;
};

export function UserFormModal({ mode, initial, onClose, onSaved }: Props) {
  const [name, setName] = useState(initial?.name || '');
  const [login, setLogin] = useState(initial?.login || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<string>(initial?.role || 'master');
  const [commissionPct, setCommissionPct] = useState(
    initial ? String(Math.round(Number(initial.default_commission_pct || 50))) : '50'
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const commission = Math.round(Number(commissionPct));
      if (commission < 0 || commission > 100) {
        throw new Error('Процент комиссии должен быть от 0 до 100');
      }
      if (mode === 'create') {
        await createUser({ name, login, password, role: role as UserCreateInput['role'], default_commission_pct: commission });
      } else if (initial) {
        const data: UserUpdateInput = { name, login, role: role as UserUpdateInput['role'], default_commission_pct: commission };
        if (password.trim()) data.password = password;
        await updateUser(initial.id, data);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000
    }} onClick={onClose}>
      <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 12, padding: 28, width: 420,
        display: 'flex', flexDirection: 'column', gap: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
      }}>
        <h3 style={{ margin: 0 }}>{mode === 'create' ? 'Новый пользователь' : 'Редактировать'}</h3>

        {error && <div className="error-message">{error}</div>}

        <div>
          <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 4 }}>Имя</label>
          <input value={name} onChange={e => setName(e.target.value)} required
            style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
        </div>

        <div>
          <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 4 }}>Логин</label>
          <input value={login} onChange={e => setLogin(e.target.value)} required
            style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
        </div>

        <div>
          <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 4 }}>
            Пароль {mode === 'edit' && <span style={{ color: '#999' }}>(оставьте пустым, чтобы не менять)</span>}
          </label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            required={mode === 'create'} minLength={mode === 'create' ? 6 : undefined}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
        </div>

        <div>
          <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 4 }}>Роль</label>
          <select value={role} onChange={e => setRole(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }}>
            <option value="admin">Админ</option>
            <option value="master">Мастер</option>
            <option value="reception">Приёмщик</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 4 }}>
            % комиссии мастера {role !== 'master' && <span style={{ color: '#999' }}>(только для мастеров)</span>}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number" min={0} max={100}
              value={commissionPct}
              onChange={e => setCommissionPct(e.target.value)}
              style={{ width: 100, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }}
            />
            <span style={{ fontSize: 14, color: '#5f6368' }}>%</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'end', marginTop: 8 }}>
          <button type="button" className="btn-secondary" onClick={onClose}>Отмена</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Сохранение...' : mode === 'create' ? 'Создать' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  );
}
