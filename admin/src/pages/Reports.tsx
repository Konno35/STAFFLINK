import { useEffect, useState } from 'react';
import { getGroups, getAssignments, getAdminStaff } from '../lib/api';
import type { Group, Assignment, StaffUser } from '../lib/api';
import ReportModal from '../components/ReportModal';
import '../components/Layout.css';
import './Reports.css';

export default function Reports() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [sheetsId, setSheetsId] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([getGroups(), getAssignments(), getAdminStaff()])
      .then(([g, a, s]) => { setGroups(g.groups); setAssignments(a.assignments); setStaff(s.users); });
    import('../lib/api').then(({ getAdminSettings }) =>
      getAdminSettings().then(r => {
        setApiKey(r.settings.api_key ?? '');
        setSheetsId(r.settings.google_sheets_id ?? '');
      })
    );
  }, []);

  async function handleCopyApiKey() {
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRegenerate() {
    if (!confirm('APIキーを再生成すると、既存のGASスクリプトは動作しなくなります。続行しますか？')) return;
    const { regenerateApiKey } = await import('../lib/api');
    const { apiKey: newKey } = await regenerateApiKey();
    setApiKey(newKey);
  }

  function handleDownloadGas() {
    const url = '/gas-template/StaffLink.gs';
    const a = document.createElement('a');
    a.href = url;
    a.download = 'StaffLink.gs';
    a.click();
  }

  return (
    <div>
      <div className="page-title">レポート</div>

      <div className="card reports-section">
        <div className="reports-section-title">CSV エクスポート</div>
        <p className="reports-desc">期間・案件・グループ・氏名でフィルタリングして勤怠データをCSV出力できます。</p>
        <button type="button" className="btn btn-primary" onClick={() => setShowModal(true)}>
          CSVをダウンロード
        </button>
      </div>

      <div className="card reports-section">
        <div className="reports-section-title">Google スプレッドシート連携 (GAS)</div>
        <p className="reports-desc">
          GASスクリプトを使って、勤怠データを指定のスプレッドシートに自動同期できます。
        </p>

        <div className="reports-steps">
          <div className="reports-step">
            <span className="step-num">1</span>
            <span>GASスクリプトをダウンロードする</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleDownloadGas}>ダウンロード</button>
          </div>
          <div className="reports-step">
            <span className="step-num">2</span>
            <span>Googleスプレッドシートを開き、「拡張機能 → Apps Script」にスクリプトを貼り付ける</span>
          </div>
          <div className="reports-step">
            <span className="step-num">3</span>
            <span>スクリプト内の <code>API_KEY</code> に下記のAPIキーを入力する</span>
          </div>
          <div className="reports-step">
            <span className="step-num">4</span>
            <span>時間ベーストリガー（毎日23時など）を設定して完了</span>
          </div>
        </div>

        <div className="form-row reports-api-row">
          <label className="form-label" htmlFor="api-key-display">APIキー</label>
          <div className="reports-api-key-wrap">
            <input
              id="api-key-display"
              className="input reports-api-key-input"
              value={apiKey || '（未設定）'}
              readOnly
            />
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopyApiKey}>
              {copied ? 'コピー済み' : 'コピー'}
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={handleRegenerate}>再生成</button>
          </div>
        </div>

        <div className="form-row">
          <label className="form-label" htmlFor="sheets-id">スプレッドシートID（参考）</label>
          <input
            id="sheets-id"
            className="input"
            value={sheetsId}
            readOnly
            placeholder="Settingsページで設定してください"
          />
        </div>
      </div>

      {showModal && (
        <ReportModal
          groups={groups}
          assignments={assignments}
          staff={staff}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
