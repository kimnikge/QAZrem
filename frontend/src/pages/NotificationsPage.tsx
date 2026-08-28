import { useEffect, useState } from 'react';
import { Bell, CheckCheck, RefreshCw } from 'lucide-react';
import {
  getNotifications, markNotificationRead, markAllRead,
  getNotificationTypes, getNotificationSettings, saveNotificationSetting, runStaleCheck,
  type NotificationItem, type NotificationType, type NotificationSetting,
} from '../api/notifications';
import { getAllUsers } from '../api/users';
import { useAuth } from '../context/AuthContext';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function NotificationsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [types, setTypes] = useState<NotificationType[]>([]);
  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [users, setUsers] = useState<Array<{ id: number; name: string; role: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const feed = await getNotifications();
      setItems(feed.notifications);
      setUnreadCount(feed.unread_count);
      const t = await getNotificationTypes();
      setTypes(t);
      if (isAdmin) {
        const [s, u] = await Promise.all([getNotificationSettings(), getAllUsers()]);
        setSettings(s);
        setUsers(u.filter((x) => x.role !== 'admin'));
      }
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [isAdmin]);

  const readOne = async (id: number) => {
    try {
      await markNotificationRead(id);
      await load();
    } catch (e: any) { setError(e?.message || 'Ошибка'); }
  };

  const readAll = async () => {
    try {
      await markAllRead();
      await load();
    } catch (e: any) { setError(e?.message || 'Ошибка'); }
  };

  const settingValue = (userId: number, typeCode: string): NotificationSetting | undefined =>
    settings.find((s) => s.user_id === userId && s.type_code === typeCode);

  const changeSetting = async (userId: number, typeCode: string, patch: Partial<NotificationSetting>) => {
    const cur = settingValue(userId, typeCode);
    try {
      await saveNotificationSetting({
        user_id: userId,
        type_code: typeCode,
        channel: patch.channel ?? cur?.channel ?? 'app',
        enabled: patch.enabled ?? cur?.enabled ?? true,
      });
      await load();
    } catch (e: any) { setError(e?.message || 'Ошибка сохранения'); }
  };

  const handleStaleCheck = async () => {
    try {
      const res = await runStaleCheck(30);
      setError('');
      await load();
      setError(res.message);
    } catch (e: any) { setError(e?.message || 'Ошибка'); }
  };

  return (
    <div className="page">
      <div className="page-title">
        <Bell size={20} />
        <h2 style={{ margin: 0, fontSize: 18 }}>Уведомления</h2>
        {unreadCount > 0 && <span className="badge" style={{ background: '#e74c3c' }}>{unreadCount}</span>}
        <button className="btn" style={{ marginLeft: 'auto', fontSize: 12 }} onClick={readAll} disabled={unreadCount === 0}>
          <CheckCheck size={14} /> Прочитать все
        </button>
      </div>
      {error && <div style={{ color: '#c0392b', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {loading ? (
        <div className="loading">Загрузка...</div>
      ) : (
        <div className="card" style={{ padding: 12 }}>
          {items.length === 0 && <p style={{ fontSize: 13, color: '#9ca3af' }}>Уведомлений пока нет</p>}
          {items.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.read_at && readOne(n.id)}
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                cursor: n.read_at ? 'default' : 'pointer',
                background: n.read_at ? undefined : 'var(--accent-soft, #eef4ff)',
                borderRadius: 6,
                marginBottom: 6,
              }}
            >
              <span className="badge" style={{ background: '#6b7280', fontSize: 10, whiteSpace: 'nowrap' }}>{n.type_title}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: n.read_at ? 400 : 600 }}>{n.title}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{formatDate(n.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isAdmin && (
        <div className="card" style={{ padding: 16, marginTop: 16 }}>
          <div className="page-title" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>Настройки получателей</h3>
            <button className="btn" style={{ marginLeft: 'auto', fontSize: 12 }} onClick={handleStaleCheck}>
              <RefreshCw size={14} /> Проверить залежавшиеся
            </button>
          </div>
          <p style={{ fontSize: 12, color: '#5f6368', margin: '0 0 12px' }}>
            Подпишите пользователей на типы событий и выберите канал доставки. Telegram использует общий бот-чат из настроек.
          </p>
          <table className="table" style={{ fontSize: 12 }}>
            <thead>
              <tr><th>Пользователь</th><th>Тип</th><th>Канал</th><th>Вкл.</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                types.map((t) => {
                  const s = settingValue(u.id, t.code);
                  return (
                    <tr key={`${u.id}-${t.code}`}>
                      <td>{u.name}</td>
                      <td>{t.title}</td>
                      <td>
                        <select
                          value={s?.channel ?? 'app'}
                          onChange={(e) => changeSetting(u.id, t.code, { channel: e.target.value as 'telegram' | 'whatsapp' | 'app' })}
                          style={{ padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, background: '#fff' }}
                        >
                          <option value="app">В приложении</option>
                          <option value="telegram">Telegram</option>
                          <option value="whatsapp">WhatsApp</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={s?.enabled ?? false}
                          onChange={(e) => changeSetting(u.id, t.code, { enabled: e.target.checked })}
                        />
                      </td>
                    </tr>
                  );
                })
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
