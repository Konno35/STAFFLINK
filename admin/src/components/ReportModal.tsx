import { useState } from 'react';
import type { Group, Assignment, StaffUser } from '../lib/api';
import { downloadCsv } from '../lib/api';
import './ReportModal.css';

interface Props {
  groups: Group[];
  assignments: Assignment[];
  staff: StaffUser[];
  defaultFrom?: string;
  defaultTo?: string;
  onClose: () => void;
}

export default function ReportModal({ groups, assignments, staff, defaultFrom, defaultTo, onClose }: Props) {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
  const firstOfMonth = today.slice(0, 7) + '-01';

  const [from, setFrom] = useState(defaultFrom ?? firstOfMonth);
  const [to, setTo] = useState(defaultTo ?? today);
  const [groupId, setGroupId] = useState('');
  const [assignmentId, setAssignmentId] = useState('');
  const [lineUserId, setLineUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleDownload() {
    setLoading(true);
    setError('');
    try {
      const blob = await downloadCsv({
        from, to,
        ...(groupId ? { groupId } : {}),
        ...(assignmentId ? { assignmentId } : {}),
        ...(lineUserId ? { lineUserId } : {}),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_${from}_${to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">CSVエクスポート</div>

        {error && <div className="flash flash-err">{error}</div>}

        <div className="form-row">
          <label className="form-label">期間（開始）</label>
          <input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div className="form-row">
          <label className="form-label">期間（終了）</label>
          <input type="date" className="input" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <div className="form-row">
          <label className="form-label">グループ</label>
          <select className="input select" value={groupId} onChange={e => setGroupId(e.target.value)}>
            <option value="">全グループ</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label className="form-label">案件</label>
          <select className="input select" value={assignmentId} onChange={e => setAssignmentId(e.target.value)}>
            <option value="">全案件</option>
            {assignments.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label className="form-label">氏名</label>
          <select className="input select" value={lineUserId} onChange={e => setLineUserId(e.target.value)}>
            <option value="">全員</option>
            {staff.map(s => <option key={s.lineUserId} value={s.lineUserId}>{s.displayName}</option>)}
          </select>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>キャンセル</button>
          <button className="btn btn-primary" onClick={handleDownload} disabled={loading || !from || !to}>
            {loading ? '生成中...' : 'CSVをダウンロード'}
          </button>
        </div>
      </div>
    </div>
  );
}
