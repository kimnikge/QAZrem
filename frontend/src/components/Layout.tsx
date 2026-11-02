import { useEffect, useState } from 'react';
import { BarChart3, ClipboardList, LogOut, Monitor, Package, Search, Settings, TrendingUp, Moon, Sun, Wrench, Users, FileText, FolderTree, ClipboardCheck, ShieldCheck, Bell } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { logout as apiLogout } from '../api';

type NavItem = {
  to: string;
  icon: typeof ClipboardList;
  label: string;
  adminOnly?: boolean;
  /** Если задано — пункт виден только этим ролям */
  roles?: string[];
};

const navItems: NavItem[] = [
  { to: '/', icon: ClipboardList, label: 'Заказы' },
  // Мастер не создаёт заказы, только ведёт существующие
  { to: '/create-order', icon: Search, label: 'Новый заказ', roles: ['admin', 'reception'] },
  { to: '/parts', icon: Package, label: 'Склад' },
  { to: '/catalog', icon: Monitor, label: 'Каталог' },
  { to: '/clients', icon: Users, label: 'Контакты' },
  { to: '/services', icon: Wrench, label: 'Услуги' },
  // Приёмщику финансы закрыты; мастеру доступен только его расчёт
  { to: '/finance', icon: TrendingUp, label: 'Финансы', roles: ['admin', 'master'] },
  { to: '/reports', icon: FileText, label: 'Отчёты', adminOnly: true },
  { to: '/warehouse/categories', icon: FolderTree, label: 'Категории', adminOnly: true },
  { to: '/warehouse/inventory', icon: ClipboardCheck, label: 'Инвентаризация', adminOnly: true },
  { to: '/permissions', icon: ShieldCheck, label: 'Права', adminOnly: true },
  { to: '/notifications', icon: Bell, label: 'Уведомления' },
  { to: '/analytics', icon: BarChart3, label: 'Аналитика', adminOnly: true },
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

  const handleLogout = async () => {
    // Сначала гасим httpOnly cookie на сервере, затем локальное состояние.
    // Если запрос не удался (нет сети) — всё равно выходим локально.
    try { await apiLogout(); } catch { /* локальный выход важнее */ }
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
          {navItems.filter(item =>
            (!item.adminOnly || user?.role === 'admin') &&
            (!item.roles || (user?.role && item.roles.includes(user.role)))
          ).map(({ to, icon: Icon, label }) => (
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
