import { useEffect, useState } from 'react';
import { BarChart3, ClipboardList, LogOut, Monitor, Package, Search, Settings, TrendingUp, Moon, Sun, Wrench } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/', icon: ClipboardList, label: 'Заказы' },
  { to: '/create-order', icon: Search, label: 'Новый заказ' },
  { to: '/parts', icon: Package, label: 'Склад' },
  { to: '/catalog', icon: Monitor, label: 'Каталог' },
  { to: '/services', icon: Wrench, label: 'Услуги' },
  { to: '/finance', icon: TrendingUp, label: 'Финансы' },
  { to: '/analytics', icon: BarChart3, label: 'Аналитика' },
  { to: '/settings', icon: Settings, label: 'Настройки', adminOnly: true },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('qazrem_theme');
    return saved === 'dark';
  });

  useEffect(() => {
    document.body.classList.toggle('dark', dark);
    localStorage.setItem('qazrem_theme', dark ? 'dark' : 'light');
  }, [dark]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="sidebar-logo">QAZRem</h1>
          <span className="sidebar-role">{user?.role === 'admin' ? 'Админ' : user?.role === 'master' ? 'Мастер' : 'Приёмщик'}</span>
        </div>
        <nav className="sidebar-nav">
          {navItems.filter(item => !item.adminOnly || user?.role === 'admin').map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="nav-link" onClick={handleLogout}>
            <LogOut size={20} />
            <span>Выйти</span>
          </span>
          <button className="theme-toggle" onClick={() => setDark(!dark)} title={dark ? 'Светлая тема' : 'Тёмная тема'}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
