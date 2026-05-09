import { useEffect, useState } from 'react';
import { getShifts, createShift, updateShift, deleteShift, getAdminStaff, getAssignments } from '../lib/api';
import type { Shift, StaffUser, Assignment } from '../lib/api';
import '../components/Layout.css';
import './Shifts.css';

function getWeekDates(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toLocaleDateString('sv-SE');
  });
}

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];

export default function Shifts() {
  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() - dayOfWeek);
  thisMonday.setHours(0, 0, 0, 0);

  const [weekStart, setWeekStart] = useState(thisMonday);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [modal, setModal] = useState<{ shift?: Shift; defaultDate?: string; defaultUser?: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Shift | null>(null);
  const [form, setForm] = useState({ lineUserId: '', assignmentId: '', date: '', startTime: '09:00', endTime: '18:00', workLocation: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const weekDates = getWeekDates(weekStart);
  const weekStr = weekDates[0];

  useEffect(() => {
    Promise.all([
      getShifts({ weekStart: weekStr }),
      getAdminStaff(),
      getAssignments(),
    ]).then(([sh, s, a]) => {
      setShifts(sh.shifts);
      setStaff(s.users.filter(u => u.status === 'active'));
      setAssignments(a.assignments.filter(a => a.status === 'active'));
    }).finally(() => setLoading(false));
  }, [weekStr]);

  function showFlash(ok: boolean, msg: string) {
    setFlash({ ok, msg });
    setTimeout(() => setFlash(null), 3000);
  }

  function prevWeek() { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }
  function nextWeek() { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }

  function openCreate(date: string, userId?: string) {
    setForm({ lineUserId: userId ?? '', assignmentId: '', date, startTime: '09:00', endTime: '18:00', workLocation: '', notes: '' });
    setModal({ defaultDate: date, defaultUser: userId });
  }

  function openEdit(shift: Shift) {
    setForm({ lineUserId: shift.lineUserId, assignmentId: shift.assignmentId ?? '', date: shift.date, startTime: shift.startTime, endTime: shift.endTime, workLocation: shift.workLocation ?? '', notes: shift.notes ?? '' });
    setModal({ shift });
  }

  function handleAssignmentChange(id: string) {
    const asgn = assignments.find(a => a.id === id);
    setForm(p => ({ ...p, assignmentId: id, workLocation: asgn?.workLocation ?? p.workLocation }));
  }

  async function handleSave() {
    if (!form.lineUserId || !form.date || !form.startTime || !form.endTime) return;
    setSaving(true);
    try {
      if (modal?.shift) {
        await updateShift(modal.shift.id, { ...form, assignmentId: form.assignmentId || undefined, workLocation: form.workLocation || undefined, notes: form.notes || undefined });
        setShifts(prev => prev.map(s => s.id === modal.shift!.id ? { ...s, ...form, assignmentName: assignments.find(a => a.id === form.assignmentId)?.name, displayName: staff.find(u => u.lineUserId === form.lineUserId)?.displayName } : s));
        showFlash(true, 'シフトを更新しました');
      } else {
        const { shift } = await createShift({ ...form, assignmentId: form.assignmentId || undefined, workLocation: form.workLocation || undefined, notes: form.notes || undefined });
        setShifts(prev => [...prev, {
          ...shift,
          displayName: staff.find(u => u.lineUserId === form.lineUserId)?.displayName,
          assignmentName: assignments.find(a => a.id === form.assignmentId)?.name,
        }]);
        showFlash(true, 'シフトを作成しました');
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
      await deleteShift(deleteTarget.id);
      setShifts(prev => prev.filter(s => s.id !== deleteTarget.id));
      showFlash(true, 'シフトを削除しました');
    } finally {
      setSaving(false);
      setDeleteTarget(null);
    }
  }

  const shiftMap: Record<string, Record<string, Shift[]>> = {};
  for (const s of shifts) {
    if (!shiftMap[s.lineUserId]) shiftMap[s.lineUserId] = {};
    if (!shiftMap[s.lineUserId][s.date]) shiftMap[s.lineUserId][s.date] = [];
    shiftMap[s.lineUserId][s.date].push(s);
  }

  if (loading) return <div className="empty">読み込み中...</div>;

  const weekLabel = `${weekDates[0].slice(5).replace('-', '/')} 〜 ${weekDates[6].slice(5).replace('-', '/')}`;

  return (
    <div>
      <div className="page-title">シフト管理</div>
      {flash && <div className={`flash ${flash.ok ? 'flash-ok' : 'flash-err'}`}>{flash.msg}</div>}

      <div className="filters">
        <button type="button" className="btn btn-secondary btn-sm" onClick={prevWeek}>◀ 前週</button>
        <span className="shift-week-label">{weekLabel}</span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={nextWeek}>翌週 ▶</button>
      </div>

      <div className="shift-wrap">
        <table className="shift-table">
          <thead>
            <tr>
              <th className="shift-name-col">スタッフ名</th>
              {weekDates.map((d, i) => (
                <th key={d} className={`shift-day-col${i >= 5 ? ' shift-weekend' : ''}`}>
                  {WEEKDAYS[i]}<br /><span className="shift-day-num">{Number(d.slice(8))}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staff.map(u => (
              <tr key={u.lineUserId}>
                <td className="shift-name">{u.displayName}</td>
                {weekDates.map((d, i) => {
                  const dayShifts = shiftMap[u.lineUserId]?.[d] ?? [];
                  return (
                    <td key={d} className={`shift-cell${i >= 5 ? ' shift-weekend-cell' : ''}`}>
                      {dayShifts.map(sh => (
                        <div key={sh.id} className="shift-chip" onClick={() => openEdit(sh)}>
                          <span className="shift-time">{sh.startTime.slice(0, 5)}〜{sh.endTime.slice(0, 5)}</span>
                          {sh.assignmentName && <span className="shift-asgn">{sh.assignmentName}</span>}
                        </div>
                      ))}
                      <button type="button" className="shift-add-btn" onClick={() => openCreate(d, u.lineUserId)}>＋</button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal !== null && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-title">{modal.shift ? 'シフトを編集' : 'シフトを作成'}</div>
            <div className="form-row">
              <label className="form-label" htmlFor="sh-user">スタッフ *</label>
              <select id="sh-user" className="input select" value={form.lineUserId} onChange={e => setForm(p => ({ ...p, lineUserId: e.target.value }))}>
                <option value="">選択してください</option>
                {staff.map(u => <option key={u.lineUserId} value={u.lineUserId}>{u.displayName}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="sh-date">日付 *</label>
              <input id="sh-date" type="date" className="input" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="shift-time-row">
              <div className="form-row shift-time-field">
                <label className="form-label" htmlFor="sh-start">開始時刻 *</label>
                <input id="sh-start" type="time" className="input" value={form.startTime} onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))} />
              </div>
              <div className="form-row shift-time-field">
                <label className="form-label" htmlFor="sh-end">終了時刻 *</label>
                <input id="sh-end" type="time" className="input" value={form.endTime} onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="sh-asgn">案件</label>
              <select id="sh-asgn" className="input select" value={form.assignmentId} onChange={e => handleAssignmentChange(e.target.value)}>
                <option value="">未設定</option>
                {assignments.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="sh-loc">勤務場所</label>
              <input id="sh-loc" className="input" value={form.workLocation} onChange={e => setForm(p => ({ ...p, workLocation: e.target.value }))} placeholder="案件から自動入力" />
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="sh-notes">メモ</label>
              <input id="sh-notes" className="input" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="modal-footer">
              {modal.shift && (
                <button type="button" className="btn btn-danger" onClick={() => { setDeleteTarget(modal.shift!); setModal(null); }}>削除</button>
              )}
              <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>キャンセル</button>
              <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || !form.lineUserId || !form.date}>
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div className="modal">
            <div className="modal-title">シフトを削除しますか？</div>
            <p className="delete-confirm-msg">
              {deleteTarget.displayName}さんの {deleteTarget.date} のシフトを削除します。
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
