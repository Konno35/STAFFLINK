import { useState } from 'react';
import type { User, TenantSettings, AttendanceType } from '../types';
import { recordAttendance } from '../lib/api';

const BUTTONS: { type: AttendanceType; label: string; featureKey: string; color: string }[] = [
  { type: 'day_before_confirmation', label: '前日確認', featureKey: 'feature_day_before_confirmation', color: '#6366f1' },
  { type: 'departure_check',         label: '出発',     featureKey: 'feature_departure_check',         color: '#0ea5e9' },
  { type: 'clock_in',                label: '出勤',     featureKey: 'feature_clock_in',                color: '#22c55e' },
  { type: 'clock_out',               label: '退勤',     featureKey: 'feature_clock_out',               color: '#f97316' },
  { type: 'overtime_request',        label: '残業申請', featureKey: 'feature_overtime_request',        color: '#a855f7' },
  { type: 'late_notification',       label: '遅刻連絡', featureKey: 'feature_late_notification',       color: '#ef4444' },
];

interface Props {
  user: User;
  settings: TenantSettings;
  tenantId: string;
  onAdminClick: () => void;
}

export default function Home({ user, settings, onAdminClick }: Props) {
  const [loading, setLoading] = useState<AttendanceType | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; message: string } | null>(null);
  const [showDayBefore, setShowDayBefore] = useState(false);
  const [departureTime, setDepartureTime] = useState('');

  const enabled = BUTTONS.filter(b => settings[b.featureKey] !== 'false');

  function showFlash(ok: boolean, message: string) {
    setFlash({ ok, message });
    setTimeout(() => setFlash(null), 3000);
  }

  async function submit(type: AttendanceType, extra?: { departureTime?: string }) {
    setLoading(type);
    try {
      await recordAttendance(type, extra);
      showFlash(true, `${BUTTONS.find(b => b.type === type)!.label}を記録しました`);
      setShowDayBefore(false);
      setDepartureTime('');
    } catch (e) {
      showFlash(false, e instanceof Error ? e.message : '記録に失敗しました');
    } finally {
      setLoading(null);
    }
  }

  function handlePress(type: AttendanceType) {
    if (type === 'day_before_confirmation') { setShowDayBefore(true); return; }
    submit(type);
  }

  const now = new Date();

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        {settings.company_name && (
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 2 }}>{settings.company_name}</div>
        )}
        <div style={{ fontSize: 17, fontWeight: 600 }}>{user.displayName}</div>
        <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-1px', margin: '8px 0 4px' }}>
          {now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          {now.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
        </div>
      </div>

      {flash && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 14,
          background: flash.ok ? '#f0fdf4' : '#fef2f2',
          color: flash.ok ? '#166534' : '#991b1b',
        }}>
          {flash.message}
        </div>
      )}

      {showDayBefore && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>明日の出勤確認</div>
          <div style={{ fontSize: 13, color: '#374151', marginBottom: 16 }}>
            明日の業務内容を確認し、出発予定時刻を入力してください。
          </div>
          <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>出発予定時刻</label>
          <input
            type="time"
            value={departureTime}
            onChange={e => setDepartureTime(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 16, marginBottom: 14 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setShowDayBefore(false); setDepartureTime(''); }}
              style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: 14 }}
            >
              キャンセル
            </button>
            <button
              onClick={() => submit('day_before_confirmation', { departureTime })}
              disabled={!departureTime || loading === 'day_before_confirmation'}
              style={{ flex: 2, padding: 12, borderRadius: 8, border: 'none', background: '#6366f1', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
            >
              {loading === 'day_before_confirmation' ? '送信中...' : '確認済み'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {enabled.filter(b => b.type !== 'day_before_confirmation' || !showDayBefore).map(({ type, label, color }) => (
          <button
            key={type}
            onClick={() => handlePress(type)}
            disabled={loading === type}
            style={{
              padding: '28px 16px', borderRadius: 14, border: 'none',
              background: loading === type ? '#e5e7eb' : color,
              color: loading === type ? '#9ca3af' : 'white',
              fontSize: 17, fontWeight: 700,
              cursor: loading === type ? 'not-allowed' : 'pointer',
              boxShadow: loading === type ? 'none' : `0 2px 8px ${color}55`,
            }}
          >
            {loading === type ? '送信中...' : label}
          </button>
        ))}
      </div>

      {user.role === 'admin' && (
        <button
          onClick={onAdminClick}
          style={{ marginTop: 28, width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: 13, cursor: 'pointer' }}
        >
          管理画面
        </button>
      )}
    </div>
  );
}
