import { useEffect, useState } from 'react';
import { initLiff, ensureLoggedIn } from './lib/liff';
import { getMe, getSettings } from './lib/api';
import type { User, TenantSettings } from './types';
import Home from './pages/Home';
import Register from './pages/Register';
import UserCalendar from './pages/UserCalendar';
import './index.css';

type Screen = 'loading' | 'register' | 'home' | 'calendar' | 'no-invite' | 'error';

function getInviteParams() {
  const p = new URLSearchParams(window.location.search);
  const token = p.get('token');
  const tenant = p.get('tenant');
  return token && tenant ? { token, tenant } : null;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  async function load() {
    setScreen('loading');
    try {
      await initLiff();
      await ensureLoggedIn();
      const { user, tenantId } = await getMe();

      if (!user || !tenantId) {
        setScreen(getInviteParams() ? 'register' : 'no-invite');
        return;
      }

      const { settings } = await getSettings();
      setUser(user);
      setTenantId(tenantId);
      setSettings(settings);
      setScreen('home');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '初期化に失敗しました');
      setScreen('error');
    }
  }

  useEffect(() => { load(); }, []);

  const invite = getInviteParams();

  if (screen === 'loading') {
    return <div className="loading-screen"><div className="loading-text">読み込み中...</div></div>;
  }

  if (screen === 'error') {
    return <div className="error-screen">{errorMsg}</div>;
  }

  if (screen === 'no-invite') {
    return (
      <div className="no-invite-screen">
        <div className="no-invite-icon">🔗</div>
        <div className="no-invite-title">招待リンクからアクセスしてください</div>
        <div className="no-invite-sub">管理者から送られた招待URLを開いてください</div>
      </div>
    );
  }

  if (screen === 'register' && invite) {
    return <Register token={invite.token} tenantId={invite.tenant} onRegistered={load} />;
  }

  if (screen === 'calendar' && user && tenantId && settings) {
    return <UserCalendar onBack={() => setScreen('home')} />;
  }

  if (screen === 'home' && user && tenantId && settings) {
    return (
      <Home
        user={user}
        settings={settings}
        tenantId={tenantId}
        onCalendarClick={() => setScreen('calendar')}
      />
    );
  }

  return null;
}
