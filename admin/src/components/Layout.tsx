import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import './Layout.css';

const NAV = [
  { to: '/dashboard',   label: 'ダッシュボード' },
  { to: '/calendar',    label: '勤怠カレンダー' },
  { to: '/staff',       label: 'スタッフ管理' },
  { to: '/assignments', label: '案件管理' },
  { to: '/shifts',      label: 'シフト管理' },
  { to: '/corrections', label: '修正依頼' },
  { to: '/reports',     label: 'レポート' },
  { to: '/settings',    label: '設定' },
];

interface Props { session: Session; }

export default function Layout({ session }: Props) {
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">StaffLink</div>
        <nav className="sidebar-nav">
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-email">{session.user.email}</div>
          <button className="sidebar-logout" onClick={handleLogout}>ログアウト</button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
