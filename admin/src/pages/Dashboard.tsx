import { useEffect, useState } from 'react';
import { getAdminAttendance, getAdminStaff } from '../lib/api';
import type { AttendanceLog, StaffUser } from '../lib/api';
import '../components/Layout.css';
import './Dashboard.css';

const TYPE_LABEL: Record<string, string> = {
  clock_in: '出勤', clock_out: '退勤', departure_check: '出発',
  day_before_confirmation: '前日確認', overtime_request: '残業申請', late_notification: '遅刻連絡',
};

export default function Dashboard() {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
  const todayLabel = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });

  useEffect(() => {
    Promise.all([
      getAdminAttendance({ date: today }),
      getAdminStaff(),
    ]).then(([att, s]) => {
      setLogs(att.logs);
      setStaff(s.users.filter(u => u.status === 'active'));
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [today]);

  if (loading) return <div className="empty">読み込み中...</div>;
  if (error) return <div className="flash flash-err">{error}</div>;

  const clockedInIds = new Set(logs.filter(l => l.type === 'clock_in').map(l => l.lineUserId));
  const clockedIn = staff.filter(s => clockedInIds.has(s.lineUserId));
  const notIn = staff.filter(s => !clockedInIds.has(s.lineUserId));

  const byUser: Record<string, AttendanceLog[]> = {};
  for (const log of logs) {
    if (!byUser[log.lineUserId]) byUser[log.lineUserId] = [];
    byUser[log.lineUserId].push(log);
  }

  return (
    <div>
      <div className="page-title">ダッシュボード</div>
      <div className="dashboard-date">{todayLabel}</div>

      <div className="dashboard-summary">
        <div className="summary-card summary-in">
          <div className="summary-num">{clockedIn.length}</div>
          <div className="summary-lbl">出勤済み</div>
        </div>
        <div className="summary-card summary-out">
          <div className="summary-num">{notIn.length}</div>
          <div className="summary-lbl">未出勤</div>
        </div>
        <div className="summary-card summary-total">
          <div className="summary-num">{staff.length}</div>
          <div className="summary-lbl">在籍スタッフ</div>
        </div>
      </div>

      <div className="card dashboard-log-card">
        <div className="dashboard-section-title">本日の打刻一覧</div>
        {staff.length === 0 ? (
          <div className="empty">スタッフが登録されていません</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>スタッフ名</th>
                <th>打刻履歴</th>
              </tr>
            </thead>
            <tbody>
              {staff.map(s => (
                <tr key={s.lineUserId}>
                  <td>{s.displayName}</td>
                  <td>
                    {byUser[s.lineUserId]?.length > 0 ? (
                      <div className="dashboard-log-list">
                        {byUser[s.lineUserId].map(l => (
                          <span key={l.id} className="dashboard-log-item">
                            {TYPE_LABEL[l.type] ?? l.type}{' '}
                            {new Date(l.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="badge badge-gray">未出勤</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
