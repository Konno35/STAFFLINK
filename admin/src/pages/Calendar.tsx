import { useEffect, useState } from 'react';
import { getAdminAttendance, getAdminStaff, getAssignments, getGroups, getShifts, updateAttendanceLog } from '../lib/api';
import type { AttendanceLog, StaffUser, Assignment, Group, Shift } from '../lib/api';
import '../components/Layout.css';
import './Calendar.css';

const TYPE_LABEL: Record<string, string> = {
  clock_in: '出勤', clock_out: '退勤', departure_check: '出発',
  day_before_confirmation: '前日確認', overtime_request: '残業申請', late_notification: '遅刻連絡',
};

interface DayDetail {
  date: string;
  user: StaffUser;
  logs: AttendanceLog[];
  shift?: Shift;
}

interface EditLog {
  log: AttendanceLog;
  newTime: string;
}

export default function Calendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [filterGroup, setFilterGroup] = useState('');
  const [filterAssignment, setFilterAssignment] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [detail, setDetail] = useState<DayDetail | null>(null);
  const [editLog, setEditLog] = useState<EditLog | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  useEffect(() => {
    Promise.all([
      getAdminAttendance({ month: monthStr }),
      getAdminStaff(),
      getAssignments(),
      getGroups(),
      getShifts({}),
    ]).then(([att, s, asgn, grp, sh]) => {
      setLogs(att.logs);
      setStaff(s.users.filter(u => u.status === 'active'));
      setAssignments(asgn.assignments);
      setGroups(grp.groups);
      setShifts(sh.shifts);
    }).finally(() => setLoading(false));
  }, [monthStr]);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  });

  const filteredStaff = staff.filter(s => {
    if (filterGroup && s.groupId !== filterGroup) return false;
    if (filterAssignment && !s.assignments?.some(a => a.id === filterAssignment)) return false;
    if (filterUser && s.lineUserId !== filterUser) return false;
    return true;
  });

  const logMap: Record<string, Record<string, AttendanceLog[]>> = {};
  for (const log of logs) {
    if (!logMap[log.lineUserId]) logMap[log.lineUserId] = {};
    if (!logMap[log.lineUserId][log.date]) logMap[log.lineUserId][log.date] = [];
    logMap[log.lineUserId][log.date].push(log);
  }

  const shiftMap: Record<string, Record<string, Shift>> = {};
  for (const s of shifts) {
    if (!shiftMap[s.lineUserId]) shiftMap[s.lineUserId] = {};
    shiftMap[s.lineUserId][s.date] = s;
  }

  function getCellStatus(lineUserId: string, date: string) {
    const dayLogs = logMap[lineUserId]?.[date] ?? [];
    const hasShift = !!shiftMap[lineUserId]?.[date];
    const hasClockIn = dayLogs.some(l => l.type === 'clock_in');
    if (hasClockIn) return 'present';
    if (hasShift) return 'shift-only';
    return 'none';
  }

  function openDetail(user: StaffUser, date: string) {
    const dayLogs = logMap[user.lineUserId]?.[date] ?? [];
    const shift = shiftMap[user.lineUserId]?.[date];
    setDetail({ date, user, logs: dayLogs, shift });
  }

  async function saveEdit() {
    if (!editLog || !detail) return;
    setSaving(true);
    try {
      await updateAttendanceLog(editLog.log.id, { timestamp: editLog.newTime });
      const updated = logs.map(l => l.id === editLog.log.id ? { ...l, timestamp: editLog.newTime } : l);
      setLogs(updated);
      const newDetailLogs = updated.filter(l => l.lineUserId === detail.user.lineUserId && l.date === detail.date);
      setDetail({ ...detail, logs: newDetailLogs });
      setEditLog(null);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="empty">読み込み中...</div>;

  return (
    <div>
      <div className="page-title">勤怠カレンダー</div>

      <div className="filters">
        <button type="button" className="btn btn-secondary btn-sm" onClick={prevMonth}>◀</button>
        <span className="cal-month-label">{year}年{month}月</span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={nextMonth}>▶</button>
        <select title="グループで絞り込み" className="select" value={filterGroup} onChange={e => setFilterGroup(e.target.value)}>
          <option value="">全グループ</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select title="案件で絞り込み" className="select" value={filterAssignment} onChange={e => setFilterAssignment(e.target.value)}>
          <option value="">全案件</option>
          {assignments.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select title="スタッフで絞り込み" className="select" value={filterUser} onChange={e => setFilterUser(e.target.value)}>
          <option value="">全員</option>
          {staff.map(s => <option key={s.lineUserId} value={s.lineUserId}>{s.displayName}</option>)}
        </select>
      </div>

      <div className="cal-wrap">
        <table className="cal-table">
          <thead>
            <tr>
              <th className="cal-name-col">スタッフ名</th>
              {days.map(d => (
                <th key={d} className={`cal-day-col${new Date(d).getDay() === 0 ? ' cal-sun' : new Date(d).getDay() === 6 ? ' cal-sat' : ''}`}>
                  {Number(d.slice(8))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredStaff.map(s => (
              <tr key={s.lineUserId}>
                <td className="cal-name">{s.displayName}</td>
                {days.map(d => {
                  const status = getCellStatus(s.lineUserId, d);
                  return (
                    <td
                      key={d}
                      className={`cal-cell cal-cell-${status}`}
                      onClick={() => openDetail(s, d)}
                      title={d}
                    >
                      {status === 'present' ? '○' : status === 'shift-only' ? '△' : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="cal-legend">
        <span className="legend-item"><span className="cal-cell-present legend-dot">○</span> 出勤あり</span>
        <span className="legend-item"><span className="cal-cell-shift-only legend-dot">△</span> シフトのみ</span>
        <span className="legend-item"><span className="cal-cell-none legend-dot">&nbsp;</span> なし</span>
      </div>

      {detail && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setDetail(null); setEditLog(null); } }}>
          <div className="modal">
            <div className="modal-title">{detail.user.displayName} / {detail.date}</div>
            {detail.shift && (
              <div className="detail-shift">
                シフト: {detail.shift.startTime}〜{detail.shift.endTime}
                {detail.shift.assignmentName && ` （${detail.shift.assignmentName}）`}
                {detail.shift.workLocation && ` @ ${detail.shift.workLocation}`}
              </div>
            )}
            <div className="detail-logs-title">打刻記録</div>
            {detail.logs.length === 0 ? (
              <div className="empty">打刻なし</div>
            ) : (
              <div className="detail-logs">
                {detail.logs.map(log => (
                  <div key={log.id} className="detail-log-row">
                    <div className="detail-log-info">
                      <span className="badge badge-blue">{TYPE_LABEL[log.type] ?? log.type}</span>
                      {editLog?.log.id === log.id ? (
                        <input
                          type="datetime-local"
                          title="修正後の日時"
                          className="input detail-time-input"
                          value={editLog.newTime.slice(0, 16)}
                          onChange={e => setEditLog({ log, newTime: e.target.value + ':00' })}
                        />
                      ) : (
                        <span className="detail-log-time">
                          {new Date(log.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                          {log.gpsDiscrepancyMeters != null && <span className="detail-gps"> GPS:{log.gpsDiscrepancyMeters}m</span>}
                        </span>
                      )}
                      {log.lateReason && <span className="detail-note">遅刻理由: {log.lateReason}</span>}
                      {log.overtimeReason && <span className="detail-note">残業理由: {log.overtimeReason}</span>}
                    </div>
                    <div className="detail-log-actions">
                      {editLog?.log.id === log.id ? (
                        <>
                          <button type="button" className="btn btn-primary btn-sm" onClick={saveEdit} disabled={saving}>保存</button>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditLog(null)}>キャンセル</button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setEditLog({ log, newTime: log.timestamp })}
                        >
                          編集
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => { setDetail(null); setEditLog(null); }}>閉じる</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
