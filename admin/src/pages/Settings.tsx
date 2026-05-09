import { useEffect, useState } from 'react';
import { getAdminSettings, updateAdminSettings, getGroups, createGroup, updateGroup, deleteGroup } from '../lib/api';
import type { Group } from '../lib/api';
import '../components/Layout.css';
import './Settings.css';

const FEATURE_LABELS: [string, string][] = [
  ['feature_day_before_confirmation', '前日確認'],
  ['feature_departure_check',         '出発確認'],
  ['feature_clock_in',                '出勤'],
  ['feature_clock_out',               '退勤'],
  ['feature_overtime_request',        '残業申請'],
  ['feature_late_notification',       '遅刻連絡'],
];

export default function Settings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [groups, setGroups] = useState<Group[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    getAdminSettings().then(r => setSettings(r.settings));
    getGroups().then(r => setGroups(r.groups));
  }, []);

  function showFlash(ok: boolean, msg: string) {
    setFlash({ ok, msg });
    setTimeout(() => setFlash(null), 3000);
  }

  async function handleSaveSettings() {
    setSaving(true);
    try {
      await updateAdminSettings(settings);
      showFlash(true, '設定を保存しました');
    } catch (e) {
      showFlash(false, e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    const { group } = await createGroup(newGroupName.trim());
    setGroups(prev => [...prev, group]);
    setNewGroupName('');
    showFlash(true, 'グループを作成しました');
  }

  async function handleUpdateGroup() {
    if (!editGroup || !editGroupName.trim()) return;
    await updateGroup(editGroup.id, editGroupName.trim());
    setGroups(prev => prev.map(g => g.id === editGroup.id ? { ...g, name: editGroupName.trim() } : g));
    setEditGroup(null);
    showFlash(true, 'グループを更新しました');
  }

  async function handleDeleteGroup(g: Group) {
    if (!confirm(`グループ「${g.name}」を削除しますか？スタッフのグループ設定が解除されます。`)) return;
    await deleteGroup(g.id);
    setGroups(prev => prev.filter(gr => gr.id !== g.id));
    showFlash(true, 'グループを削除しました');
  }

  return (
    <div>
      <div className="page-title">設定</div>
      {flash && <div className={`flash ${flash.ok ? 'flash-ok' : 'flash-err'}`}>{flash.msg}</div>}

      <div className="card settings-section">
        <div className="settings-section-title">機能ボタンの表示設定</div>
        {FEATURE_LABELS.map(([key, label]) => (
          <label key={key} className="settings-toggle-row">
            <input
              type="checkbox"
              className="settings-checkbox"
              checked={settings[key] !== 'false'}
              onChange={e => setSettings(p => ({ ...p, [key]: e.target.checked ? 'true' : 'false' }))}
            />
            <span>{label}</span>
          </label>
        ))}
        <button type="button" className="btn btn-primary settings-save-btn" onClick={handleSaveSettings} disabled={saving}>
          {saving ? '保存中...' : '設定を保存'}
        </button>
      </div>

      <div className="card settings-section">
        <div className="settings-section-title">グループ管理</div>
        <div className="settings-group-list">
          {groups.map(g => (
            <div key={g.id} className="settings-group-row">
              {editGroup?.id === g.id ? (
                <>
                  <input
                    className="input settings-group-input"
                    value={editGroupName}
                    onChange={e => setEditGroupName(e.target.value)}
                  />
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleUpdateGroup}>保存</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditGroup(null)}>キャンセル</button>
                </>
              ) : (
                <>
                  <span className="settings-group-name">{g.name}</span>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setEditGroup(g); setEditGroupName(g.name); }}>編集</button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteGroup(g)}>削除</button>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="settings-group-add">
          <input
            id="new-group"
            className="input settings-group-input"
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            placeholder="新しいグループ名"
            onKeyDown={e => e.key === 'Enter' && handleCreateGroup()}
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={handleCreateGroup} disabled={!newGroupName.trim()}>追加</button>
        </div>
      </div>

      <div className="card settings-section">
        <div className="settings-section-title">Google スプレッドシート連携</div>
        <div className="form-row">
          <label className="form-label" htmlFor="sheets-id">スプレッドシートID</label>
          <input
            id="sheets-id"
            className="input"
            value={settings.google_sheets_id ?? ''}
            onChange={e => setSettings(p => ({ ...p, google_sheets_id: e.target.value }))}
            placeholder="例: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
          />
        </div>
        <p className="settings-sheets-note">
          スプレッドシートのURLの <code>/d/</code> と <code>/edit</code> の間の文字列がIDです。
        </p>
        <button type="button" className="btn btn-primary settings-save-btn" onClick={handleSaveSettings} disabled={saving}>
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  );
}
