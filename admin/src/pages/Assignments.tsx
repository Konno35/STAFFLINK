import { useEffect, useState } from 'react';
import { getAssignments, createAssignment, updateAssignment, deleteAssignment, getAdminStaff } from '../lib/api';
import type { Assignment } from '../lib/api';
import '../components/Layout.css';
import './Assignments.css';

interface AdminOption { id: string; email: string; }

export default function Assignments() {
  const [items, setItems] = useState<Assignment[]>([]);
  const [admins, setAdmins] = useState<AdminOption[]>([]);
  const [modal, setModal] = useState<'create' | Assignment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Assignment | null>(null);
  const [form, setForm] = useState({ name: '', workLocation: '', managerId: '', status: 'active' });
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    getAssignments().then(r => setItems(r.assignments));
    getAdminStaff().then(r => {
      const adminUsers = r.users.filter(u => u.role === 'admin');
      setAdmins(adminUsers.map(u => ({ id: u.lineUserId, email: u.displayName })));
    });
  }, []);

  function showFlash(ok: boolean, msg: string) {
    setFlash({ ok, msg });
    setTimeout(() => setFlash(null), 3000);
  }

  function openCreate() {
    setForm({ name: '', workLocation: '', managerId: '', status: 'active' });
    setModal('create');
  }

  function openEdit(item: Assignment) {
    setForm({ name: item.name, workLocation: item.workLocation ?? '', managerId: item.managerId ?? '', status: item.status });
    setModal(item);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (modal === 'create') {
        const { assignment } = await createAssignment({ name: form.name, workLocation: form.workLocation || undefined, managerId: form.managerId || undefined });
        setItems(prev => [assignment, ...prev]);
        showFlash(true, '案件を作成しました');
      } else if (modal) {
        await updateAssignment((modal as Assignment).id, { name: form.name, workLocation: form.workLocation || undefined, managerId: form.managerId || undefined, status: form.status });
        setItems(prev => prev.map(i => i.id === (modal as Assignment).id ? { ...i, ...form } : i));
        showFlash(true, '案件を更新しました');
      }
      setModal(null);
    } catch (e) {
      showFlash(false, e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteAssignment(deleteTarget.id);
      setItems(prev => prev.filter(i => i.id !== deleteTarget.id));
      showFlash(true, '案件を削除しました');
    } catch (e) {
      showFlash(false, e instanceof Error ? e.message : '削除に失敗しました');
    } finally {
      setSaving(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">案件管理</div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>＋ 新規作成</button>
      </div>

      {flash && <div className={`flash ${flash.ok ? 'flash-ok' : 'flash-err'}`}>{flash.msg}</div>}

      <div className="card">
        {items.length === 0 ? (
          <div className="empty">案件がありません。新規作成してください。</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>案件名</th>
                <th>勤務場所</th>
                <th>担当管理者</th>
                <th>ステータス</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.workLocation ?? '—'}</td>
                  <td>{item.managerEmail ?? '—'}</td>
                  <td>
                    <span className={`badge ${item.status === 'active' ? 'badge-green' : 'badge-gray'}`}>
                      {item.status === 'active' ? '有効' : '無効'}
                    </span>
                  </td>
                  <td className="table-actions">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(item)}>編集</button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(item)}>削除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal !== null && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-title">{modal === 'create' ? '案件を作成' : '案件を編集'}</div>
            <div className="form-row">
              <label className="form-label" htmlFor="asgn-name">案件名 *</label>
              <input id="asgn-name" className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="例: 株式会社〇〇 配送業務" />
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="asgn-loc">勤務場所</label>
              <input id="asgn-loc" className="input" value={form.workLocation} onChange={e => setForm(p => ({ ...p, workLocation: e.target.value }))} placeholder="例: 東京都渋谷区〇〇" />
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="asgn-mgr">担当管理者</label>
              <select id="asgn-mgr" className="input select" value={form.managerId} onChange={e => setForm(p => ({ ...p, managerId: e.target.value }))}>
                <option value="">未設定</option>
                {admins.map(a => <option key={a.id} value={a.id}>{a.email}</option>)}
              </select>
            </div>
            {modal !== 'create' && (
              <div className="form-row">
                <label className="form-label" htmlFor="asgn-status">ステータス</label>
                <select id="asgn-status" className="input select" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                  <option value="active">有効</option>
                  <option value="inactive">無効</option>
                </select>
              </div>
            )}
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>キャンセル</button>
              <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || !form.name.trim()}>
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div className="modal">
            <div className="modal-title">案件を削除しますか？</div>
            <p className="delete-confirm-msg">
              「{deleteTarget.name}」を削除します。この操作は元に戻せません。
              関連するシフトや割り当て情報も削除されます。
            </p>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>キャンセル</button>
              <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={saving}>
                {saving ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
