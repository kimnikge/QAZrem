import { ClipboardList, LogOut, Package, Search, TrendingUp, Users } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/', icon: ClipboardList, label: 'Заказы' },
  { to: '/create-order', icon: Search, label: 'Новый заказ' },
  { to: '/parts', icon: Package, label: 'Склад' },
  { to: '/finance', icon: TrendingUp, label: 'Финансы' },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="nav-link" onClick={handleLogout}>
            <LogOut size={20} />
            <span>Выйти</span>
          </span>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
