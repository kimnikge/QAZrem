import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { getPermissions, setPermission, resetPermissionOverride, type PermissionsState } from '../api/permissions';
import { getAllUsers } from '../api/users';

const ROLE_LABELS: Record<string, string> = { master: 'Мастер', reception: 'Приёмщик', admin: 'Админ' };

export function AdminPermissionsPage() {
  const [state, setState] = useState<PermissionsState | null>(null);
  const [users, setUsers] = useState<Array<{ id: number; name: string; login: string; role: string }>>([]);
  const [selectedUserId, setSelectedUserId] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [perm, allUsers] = await Promise.all([getPermissions(), getAllUsers()]);
      setState(perm);
      setUsers(allUsers.filter((u) => u.role !== 'admin'));
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки прав');
    }
  };

  useEffect(() => { load(); }, []);

  const roleHas = (role: string, permission: string) =>
    state?.roles.some((r) => r.role === role && r.permission === permission) ?? false;

  const toggleRole = async (role: 'master' | 'reception', permission: string, allowed: boolean) => {
    setBusy(true); setError('');
    try {
      await setPermission({ role, permission, allowed });
      await load();
    } catch (e: any) { setError(e?.message || 'Ошибка сохранения'); }
    finally { setBusy(false); }
  };

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) || null,
    [users, selectedUserId],
  );

  const overrideFor = (permission: string) =>
    state?.overrides.find((o) => o.user_id === selectedUserId && o.permission === permission) ?? null;

  const changeUserOverride = async (permission: string, value: '' | 'true' | 'false') => {
    setBusy(true); setError('');
    try {
      if (value === '') {
        await resetPermissionOverride(selectedUserId, permission);
      } else {
        await setPermission({ user_id: selectedUserId, permission, allowed: value === 'true' });
      }
      await load();
    } catch (e: any) { setError(e?.message || 'Ошибка сохранения'); }
    finally { setBusy(false); }
  };

  return (
    <div className="page">
      <div className="page-title">
        <ShieldCheck size={20} />
        <h2 style={{ margin: 0, fontSize: 18 }}>Права доступа</h2>
      </div>
      {error && <div className="error-banner" style={{ color: '#c0392b', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Права по ролям</h3>
        <p style={{ fontSize: 12, color: '#5f6368', margin: '0 0 12px' }}>
          Админ имеет все права. Включите право для роли — оно появится у всех её участников.
        </p>
        <table className="table" style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th>Право</th>
              <th>Мастер</th>
              <th>Приёмщик</th>
            </tr>
          </thead>
          <tbody>
            {(state?.permissions || []).map((p) => (
              <tr key={p.code}>
                <td>{p.label}</td>
                {(['master', 'reception'] as const).map((role) => (
                  <td key={role}>
                    <input
                      type="checkbox"
                      disabled={busy}
                      checked={roleHas(role, p.code)}
                      onChange={(e) => toggleRole(role, p.code, e.target.checked)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Индивидуальные права пользователей</h3>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
          <label style={{ fontSize: 13, color: '#5f6368' }}>Пользователь</label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(Number(e.target.value))}
            style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, background: '#fff' }}
          >
            <option value={0}>— выберите —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name} ({ROLE_LABELS[u.role] || u.role})</option>
            ))}
          </select>
        </div>
        {selectedUser && (
          <table className="table" style={{ fontSize: 13 }}>
            <thead>
              <tr><th>Право</th><th>Доступ</th></tr>
            </thead>
            <tbody>
              {(state?.permissions || []).map((p) => {
                const ov = overrideFor(p.code);
                const value = ov ? (ov.allowed ? 'true' : 'false') : '';
                return (
                  <tr key={p.code}>
                    <td>{p.label}</td>
                    <td>
                      <select
                        value={value}
                        disabled={busy}
                        onChange={(e) => changeUserOverride(p.code, e.target.value as '' | 'true' | 'false')}
                        style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: '#fff' }}
                      >
                        <option value="">Как у роли</option>
                        <option value="true">Разрешить</option>
                        <option value="false">Запретить</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!selectedUser && <p style={{ fontSize: 12, color: '#9ca3af' }}>Выберите пользователя, чтобы настроить его права.</p>}
      </div>
    </div>
  );
}
