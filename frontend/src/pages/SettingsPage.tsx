import { useEffect, useState } from 'react';

export function SettingsPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  return (
    <div className="ro-dashboard">
      <div className="page-header"><h2>Настройки</h2></div>

      <div className="detail-card" style={{ marginBottom: 16 }}>
        <h3>О системе</h3>
        <div className="detail-row"><span>Версия</span><strong>0.1.0</strong></div>
        <div className="detail-row"><span>БД</span><strong>Supabase (PostgreSQL)</strong></div>
        <div className="detail-row"><span>Фронтенд</span><strong>React + Vite</strong></div>
        <div className="detail-row"><span>Бэкенд</span><strong>Express + TypeScript</strong></div>
      </div>
    </div>
  );
}
