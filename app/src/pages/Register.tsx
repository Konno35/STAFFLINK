import { useState, useEffect } from 'react';
import { validateInvite, registerViaInvite } from '../lib/api';
import { getLineProfile } from '../lib/liff';

interface Props {
  token: string;
  tenantId: string;
  onRegistered: () => void;
}

type Step = 'validating' | 'form' | 'done' | 'error';

export default function Register({ token, tenantId, onRegistered }: Props) {
  const [step, setStep] = useState<Step>('validating');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    validateInvite(tenantId, token)
      .then(({ valid, reason }) => {
        if (!valid) { setStep('error'); setError(reason ?? '招待リンクが無効です'); return; }
        setStep('form');
        getLineProfile().then(p => setDisplayName(p.displayName)).catch(() => {});
      })
      .catch(() => { setStep('error'); setError('招待リンクの確認に失敗しました'); });
  }, [token, tenantId]);

  async function handleSubmit() {
    if (!displayName.trim()) return;
    setLoading(true);
    try {
      await registerViaInvite(tenantId, token, displayName.trim());
      setStep('done');
      setTimeout(onRegistered, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : '登録に失敗しました');
    } finally {
      setLoading(false);
    }
  }

  const wrap: React.CSSProperties = { maxWidth: 480, margin: '0 auto', padding: '56px 24px', textAlign: 'center' };

  if (step === 'validating') return <div style={wrap}>招待リンクを確認中...</div>;

  if (step === 'error') return (
    <div style={wrap}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
      <div style={{ color: '#dc2626', fontWeight: 600 }}>{error}</div>
    </div>
  );

  if (step === 'done') return (
    <div style={wrap}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
      <div style={{ fontWeight: 700, fontSize: 18 }}>登録完了しました！</div>
    </div>
  );

  return (
    <div style={wrap}>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>スタッフ登録</div>
      <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 32 }}>
        表示名を確認・編集してから登録してください
      </div>
      <input
        type="text"
        value={displayName}
        onChange={e => setDisplayName(e.target.value)}
        placeholder="表示名"
        style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 16, marginBottom: 14 }}
      />
      {error && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <button
        onClick={handleSubmit}
        disabled={!displayName.trim() || loading}
        style={{ width: '100%', padding: 14, borderRadius: 8, border: 'none', background: loading ? '#9ca3af' : '#22c55e', color: 'white', fontSize: 16, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}
      >
        {loading ? '登録中...' : '登録する'}
      </button>
    </div>
  );
}
