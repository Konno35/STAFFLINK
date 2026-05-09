import { useEffect, useState } from 'react';
import {
  getAdminStaff, updateStaff, getGroups, getAssignments,
  createAdminInvite, addUserAssignment, removeUserAssignment,
} from '../lib/api';
import type { StaffUser, Group, Assignment } from '../lib/api';
import '../components/Layout.css';
import './Staff.css';


const LIFF_ID = import.meta.env.VITE_LIFF_ID as string;

export default function Staff() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteGroupId, setInviteGroupId] = useState('');
  const [inviteAssignmentId, setInviteAssignmentId] = useState('');
  const [assignModal, setAssignModal] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    Promise.all([getAdminStaff(), getGroups(), getAssignments()])
      .then(([s, g, a]) => { setStaff(s.users); setGroups(g.groups); setAssignments(a.assignments); })
      .finally(() => setLoading(false));
  }, []);

  function showFlash(ok: boolean, msg: string) {
    setFlash({ ok, msg });
    setTimeout(() => setFlash(null), 3000);
  }

  async function handleToggleStatus(u: StaffUser) {
    const newStatus = u.status === 'active' ? 'inactive' : 'active';
    await updateStaff(u.lineUserId, { status: newStatus });
    setStaff(prev => prev.map(s => s.lineUserId === u.lineUserId ? { ...s, status: newStatus } : s));
    showFlash(true, `${u.displayName}を${newStatus === 'active' ? '有効' : '無効'}にしました`);
  }

  async function handleGroupChange(u: StaffUser, groupId: string) {
    await updateStaff(u.lineUserId, { groupId: groupId || undefined });
    setStaff(prev => prev.map(s => s.lineUserId === u.lineUserId
      ? { ...s, groupId, groupName: groups.find(g => g.id === groupId)?.name }
      : s
    ));
  }

  async function handleCreateInvite() {
    const { token } = await createAdminInvite({
      expiresInDays: 7,
      groupId: inviteGroupId || undefined,
      assignmentId: inviteAssignmentId || undefined,
    });
    setInviteUrl(`https://miniapp.line.me/${LIFF_ID}?token=${token}`);
  }

  async function handleAddAssignment(assignmentId: string) {
    if (!assignModal) return;
    await addUserAssignment(assignModal.lineUserId, assignmentId);
    const added = assignments.find(a => a.id === assignmentId)!;
    setStaff(prev => prev.map(s => s.lineUserId === assignModal.lineUserId
      ? { ...s, assignments: [...(s.assignments ?? []), added] }
      : s
    ));
    setAssignModal(prev => prev ? { ...prev, assignments: [...(prev.assignments ?? []), added] } : null);
  }

  async function handleRemoveAssignment(assignmentId: string) {
    if (!assignModal) return;
    await removeUserAssignment(assignModal.lineUserId, assignmentId);
    setStaff(prev => prev.map(s => s.lineUserId === assignModal.lineUserId
      ? { ...s, assignments: (s.assignments ?? []).filter(a => a.id !== assignmentId) }
      : s
    ));
    setAssignModal(prev => prev
      ? { ...prev, assignments: (prev.assignments ?? []).filter(a => a.id !== assignmentId) }
      : null
    );
  }

  if (loading) return <div className="empty">読み込み中...</div>;

  return (
    <div>
      <div className="page-title">スタッフ管理</div>
      {flash && <div className={`flash ${flash.ok ? 'flash-ok' : 'flash-err'}`}>{flash.msg}</div>}

      <div className="card staff-invite-card">
        <div className="staff-invite-title">招待リンクを発行</div>
        <div className="staff-invite-filters">
          <div className="form-row staff-invite-row">
            <label className="form-label" htmlFor="invite-group">デフォルトグループ（任意）</label>
            <select id="invite-group" className="input select" value={inviteGroupId} onChange={e => setInviteGroupId(e.target.value)}>
              <option value="">グループなし</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="form-row staff-invite-row">
            <label className="form-label" htmlFor="invite-assignment">デフォルト案件（任意）</label>
            <select id="invite-assignment" className="input select" value={inviteAssignmentId} onChange={e => setInviteAssignmentId(e.target.value)}>
              <option value="">案件なし</option>
              {assignments.filter(a => a.status === 'active').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={handleCreateInvite}>
          招待リンクを発行（7日間有効）
        </button>
        {inviteUrl && (
          <div className="staff-invite-result">
            <div className="staff-invite-url-label">招待URL（スタッフに共有してください）</div>
            <div className="staff-invite-url">{inviteUrl}</div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigator.clipboard.writeText(inviteUrl)}>
              コピー
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>氏名</th>
              <th>グループ</th>
              <th>所属案件</th>
              <th>ロール</th>
              <th>ステータス</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {staff.map(u => (
              <tr key={u.lineUserId}>
                <td>{u.displayName}</td>
                <td>
                  <select
                    title="グループを変更"
                    className="select select-sm"
                    value={u.groupId ?? ''}
                    onChange={e => handleGroupChange(u, e.target.value)}
                  >
                    <option value="">未設定</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </td>
                <td>
                  <div className="staff-assignments">
                    {u.assignments?.map(a => (
                      <span key={a.id} className="badge badge-blue">{a.name}</span>
                    ))}
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAssignModal(u)}>
                      編集
                    </button>
                  </div>
                </td>
                <td>
                  <span className={`badge ${u.role === 'admin' ? 'badge-blue' : 'badge-gray'}`}>
                    {u.role === 'admin' ? '管理者' : 'スタッフ'}
                  </span>
                </td>
                <td>
                  <span className={`badge ${u.status === 'active' ? 'badge-green' : 'badge-red'}`}>
                    {u.status === 'active' ? '有効' : '無効'}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className={`btn btn-sm ${u.status === 'active' ? 'btn-danger' : 'btn-primary'}`}
                    onClick={() => handleToggleStatus(u)}
                  >
                    {u.status === 'active' ? '無効化' : '有効化'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {assignModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setAssignModal(null)}>
          <div className="modal">
            <div className="modal-title">{assignModal.displayName} — 案件割り当て</div>
            <div className="assign-modal-current">
              <div className="form-label">現在の案件</div>
              {assignModal.assignments?.length ? (
                assignModal.assignments.map(a => (
                  <div key={a.id} className="assign-row">
                    <span>{a.name}</span>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleRemoveAssignment(a.id)}>外す</button>
                  </div>
                ))
              ) : <div className="empty assign-empty">割り当てなし</div>}
            </div>
            <div className="form-label assign-add-label">案件を追加</div>
            {assignments
              .filter(a => a.status === 'active' && !assignModal.assignments?.some(ua => ua.id === a.id))
              .map(a => (
                <div key={a.id} className="assign-row">
                  <span>{a.name}</span>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => handleAddAssignment(a.id)}>追加</button>
                </div>
              ))
            }
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setAssignModal(null)}>閉じる</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
