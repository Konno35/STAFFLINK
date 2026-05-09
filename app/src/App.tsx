import { useEffect, useState } from 'react';
import { initLiff, ensureLoggedIn } from './lib/liff';
import { getMe, getSettings } from './lib/api';
import type { User, TenantSettings } from './types';
import Home from './pages/Home';
import Register from './pages/Register';
import Admin from './pages/Admin';

type Screen = 'loading' | 'register' | 'home' | 'admin' | 'no-invite' | 'error';

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
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100svh' }}>
        <div style={{ color: '#6b7280', fontSize: 14 }}>読み込み中...</div>
      </div>
    );
  }

  if (screen === 'error') {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#dc2626', fontSize: 14 }}>
        {errorMsg}
      </div>
    );
  }

  if (screen === 'no-invite') {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔗</div>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>招待リンクからアクセスしてください</div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>管理者から送られた招待URLを開いてください</div>
      </div>
    );
  }

  if (screen === 'register' && invite) {
    return <Register token={invite.token} tenantId={invite.tenant} onRegistered={load} />;
  }

  if ((screen === 'home' || screen === 'admin') && user && tenantId && settings) {
    if (screen === 'admin') {
      return (
        <Admin
          currentUser={user}
          tenantId={tenantId}
          settings={settings}
          onSettingsUpdated={s => setSettings(s)}
          onBack={() => setScreen('home')}
        />
      );
    }
    return (
      <Home
        user={user}
        settings={settings}
        tenantId={tenantId}
        onAdminClick={() => setScreen('admin')}
      />
    );
  }

  return null;
}
