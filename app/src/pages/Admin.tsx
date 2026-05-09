import { useState, useEffect } from 'react';
import type { User, TenantSettings } from '../types';
import { listUsers, updateUser, createInvite, updateSettings } from '../lib/api';

const FEATURE_LABELS: [string, string][] = [
  ['feature_day_before_confirmation', '前日確認'],
  ['feature_departure_check',         '出発確認'],
  ['feature_clock_in',                '出勤'],
  ['feature_clock_out',               '退勤'],
  ['feature_overtime_request',        '残業申請'],
  ['feature_late_notification',       '遅刻連絡'],
];

const LIFF_ID = import.meta.env.VITE_LIFF_ID as string;

interface Props {
  currentUser: User;
  tenantId: string;
  settings: TenantSettings;
  onSettingsUpdated: (s: TenantSettings) => void;
  onBack: () => void;
}

export default function Admin({ currentUser, tenantId, settings, onSettingsUpdated, onBack }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [inviteUrl, setInviteUrl] = useState('');
  const [localSettings, setLocalSettings] = useState<TenantSettings>(settings);
  const [tab, setTab] = useState<'users' | 'settings'>('users');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listUsers().then(({ users }) => setUsers(users));
  }, []);

  async function handleCreateInvite() {
    const { token } = await createInvite(7);
    setInviteUrl(`https://miniapp.line.me/${LIFF_ID}?token=${token}&tenant=${tenantId}`);
  }

  async function handleToggleStatus(target: User) {
    const newStatus = target.status === 'active' ? 'inactive' : 'active';
    await updateUser(target.lineUserId, { status: newStatus });
    setUsers(prev => prev.map(u => u.lineUserId === target.lineUserId ? { ...u, status: newStatus } : u));
  }

  async function handleSaveSettings() {
    setSaving(true);
    try {
      await updateSettings(localSettings);
      onSettingsUpdated(localSettings);
    } finally {
      setSaving(false);
    }
  }

  const tabBtn = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '10px', border: 'none',
    borderBottom: active ? '2px solid #22c55e' : '2px solid transparent',
    background: 'white', fontWeight: active ? 700 : 400,
    cursor: 'pointer', fontSize: 14,
  });

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: 13 }}>← 戻る</button>
        <div style={{ fontWeight: 700, fontSize: 17 }}>管理画面</div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: 16 }}>
        <button style={tabBtn(tab === 'users')} onClick={() => setTab('users')}>スタッフ管理</button>
        <button style={tabBtn(tab === 'settings')} onClick={() => setTab('settings')}>機能設定</button>
      </div>

      {tab === 'users' && (
        <>
          <button
            onClick={handleCreateInvite}
            style={{ width: '100%', padding: 12, borderRadius: 8, border: 'none', background: '#22c55e', color: 'white', fontWeight: 600, cursor: 'pointer', marginBottom: 14, fontSize: 14 }}
          >
            招待リンクを発行（7日間有効）
          </button>

          {inviteUrl && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: '#166534', marginBottom: 4 }}>招待URL（このURLをスタッフに共有してください）</div>
              <div style={{ fontSize: 11, wordBreak: 'break-all', color: '#374151', marginBottom: 8 }}>{inviteUrl}</div>
              <button
                onClick={() => navigator.clipboard.writeText(inviteUrl)}
                style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6, border: '1px solid #22c55e', background: 'white', color: '#22c55e', cursor: 'pointer' }}
              >
                コピー
              </button>
            </div>
          )}

          <div>
            {users.map(u => (
              <div key={u.lineUserId} style={{ display: 'flex', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{u.displayName}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{u.role === 'admin' ? '管理者' : 'スタッフ'} · {u.status === 'active' ? '有効' : '無効'}</div>
                </div>
                <button
                  onClick={() => handleToggleStatus(u)}
                  disabled={u.lineUserId === currentUser.lineUserId}
                  style={{
                    padding: '6px 12px', borderRadius: 6, border: 'none', fontSize: 12,
                    background: u.status === 'active' ? '#fee2e2' : '#dcfce7',
                    color: u.status === 'active' ? '#dc2626' : '#16a34a',
                    cursor: u.lineUserId === currentUser.lineUserId ? 'not-allowed' : 'pointer',
                  }}
                >
                  {u.status === 'active' ? '無効化' : '有効化'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'settings' && (
        <>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>表示する機能ボタン</div>
            {FEATURE_LABELS.map(([key, label]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}>
                <input
                  type="checkbox"
                  checked={localSettings[key] !== 'false'}
                  onChange={e => setLocalSettings(prev => ({ ...prev, [key]: e.target.checked ? 'true' : 'false' }))}
                  style={{ width: 18, height: 18 }}
                />
                <span style={{ fontSize: 14 }}>{label}</span>
              </label>
            ))}
          </div>
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            style={{ width: '100%', padding: 12, borderRadius: 8, border: 'none', background: saving ? '#9ca3af' : '#6366f1', color: 'white', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14 }}
          >
            {saving ? '保存中...' : '設定を保存'}
          </button>
        </>
      )}
    </div>
  );
}
