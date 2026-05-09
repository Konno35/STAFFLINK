import { useState, useEffect } from 'react';
import type { User, TenantSettings, AttendanceType } from '../types';
import { recordAttendance, getTodayAttendance, submitCorrection } from '../lib/api';
import type { TodayLog } from '../lib/api';
import './Home.css';

const BUTTONS: { type: AttendanceType; label: string; featureKey: string; color: string; shadow: string; singleUse: boolean }[] = [
  { type: 'day_before_confirmation', label: '前日確認', featureKey: 'feature_day_before_confirmation', color: '#6366f1', shadow: '#6366f155', singleUse: true },
  { type: 'departure_check',         label: '出発',     featureKey: 'feature_departure_check',         color: '#0ea5e9', shadow: '#0ea5e955', singleUse: true },
  { type: 'clock_in',                label: '出勤',     featureKey: 'feature_clock_in',                color: '#22c55e', shadow: '#22c55e55', singleUse: true },
  { type: 'clock_out',               label: '退勤',     featureKey: 'feature_clock_out',               color: '#f97316', shadow: '#f9731655', singleUse: true },
  { type: 'overtime_request',        label: '残業申請', featureKey: 'feature_overtime_request',        color: '#a855f7', shadow: '#a855f755', singleUse: false },
  { type: 'late_notification',       label: '遅刻連絡', featureKey: 'feature_late_notification',       color: '#ef4444', shadow: '#ef444455', singleUse: false },
];

const TYPE_LABEL: Record<string, string> = {
  clock_in: '出勤', clock_out: '退勤', departure_check: '出発',
  day_before_confirmation: '前日確認', overtime_request: '残業申請', late_notification: '遅刻連絡',
};

interface Props {
  user: User;
  settings: TenantSettings;
  tenantId: string;
  onCalendarClick: () => void;
}

type ModalType = 'day_before' | 'late' | 'overtime' | 'correction' | null;

export default function Home({ user, settings, onCalendarClick }: Props) {
  const [loading, setLoading] = useState<AttendanceType | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; message: string } | null>(null);
  const [modal, setModal] = useState<ModalType>(null);
  const [todayLogs, setTodayLogs] = useState<TodayLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  const [departureTime, setDepartureTime] = useState('');
  const [lateReason, setLateReason] = useState('');
  const [estimatedArrival, setEstimatedArrival] = useState('');
  const [overtimeReason, setOvertimeReason] = useState('');
  const [overtimeDuration, setOvertimeDuration] = useState('');
  const [correctionLogId, setCorrectionLogId] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionNewTime, setCorrectionNewTime] = useState('');

  useEffect(() => {
    getTodayAttendance().then(r => setTodayLogs(r.logs)).catch(() => {}).finally(() => setLogsLoading(false));
  }, []);

  const now = new Date();
  const enabled = BUTTONS.filter(b => settings[b.featureKey] !== 'false');

  function showFlash(ok: boolean, message: string) {
    setFlash({ ok, message });
    setTimeout(() => setFlash(null), 3000);
  }

  function isUsed(type: AttendanceType) {
    const btn = BUTTONS.find(b => b.type === type);
    if (!btn?.singleUse) return false;
    return todayLogs.some(l => l.type === type);
  }

  async function getGpsInfo(): Promise<{ gpsLat?: number; gpsLng?: number }> {
    return new Promise(resolve => {
      if (!navigator.geolocation) { resolve({}); return; }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ gpsLat: pos.coords.latitude, gpsLng: pos.coords.longitude }),
        () => resolve({}),
        { timeout: 5000 }
      );
    });
  }

  async function submit(type: AttendanceType, extra?: Record<string, unknown>) {
    setLoading(type);
    try {
      const gpsExtra = type === 'clock_in' ? await getGpsInfo() : {};
      await recordAttendance(type, { ...gpsExtra, ...extra } as Parameters<typeof recordAttendance>[1]);
      const label = BUTTONS.find(b => b.type === type)!.label;
      showFlash(true, `${label}を記録しました`);
      const updated = await getTodayAttendance();
      setTodayLogs(updated.logs);
      setModal(null);
      setDepartureTime(''); setLateReason(''); setEstimatedArrival('');
      setOvertimeReason(''); setOvertimeDuration('');
    } catch (e) {
      showFlash(false, e instanceof Error ? e.message : '記録に失敗しました');
    } finally {
      setLoading(null);
    }
  }

  function handlePress(type: AttendanceType) {
    if (type === 'day_before_confirmation') { setModal('day_before'); return; }
    if (type === 'late_notification')       { setModal('late'); return; }
    if (type === 'overtime_request')        { setModal('overtime'); return; }
    submit(type);
  }

  async function handleCorrection() {
    if (!correctionReason.trim()) return;
    try {
      await submitCorrection({
        attendanceLogId: correctionLogId || undefined,
        reason: correctionReason.trim(),
        correctionType: 'time_change',
        requestedNewTime: correctionNewTime || undefined,
      });
      showFlash(true, '修正依頼を送信しました');
      setModal(null);
      setCorrectionLogId(''); setCorrectionReason(''); setCorrectionNewTime('');
    } catch (e) {
      showFlash(false, e instanceof Error ? e.message : '送信に失敗しました');
    }
  }

  return (
    <div className="home-container">
      <div className="home-header">
        {settings.company_name && (
          <div className="home-company">{settings.company_name}</div>
        )}
        <div className="home-username">{user.displayName}</div>
        <div className="home-clock">
          {now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div className="home-date">
          {now.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
        </div>
      </div>

      {!logsLoading && todayLogs.length > 0 && (
        <div className="today-logs">
          <div className="today-logs-title">本日の記録</div>
          {todayLogs.map(log => (
            <div key={log.id} className="today-log-row">
              <span className="today-log-check">✓</span>
              <span>{TYPE_LABEL[log.type] ?? log.type}</span>
              <span className="today-log-time">
                {new Date(log.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}

      {flash && (
        <div className={`flash ${flash.ok ? 'flash-ok' : 'flash-err'}`}>
          {flash.message}
        </div>
      )}

      <div className="btn-grid">
        {enabled.map(({ type, label, color, shadow }) => {
          const used = isUsed(type);
          const isLoading = loading === type;
          const inactive = isLoading || used;
          return (
            <button
              key={type}
              type="button"
              onClick={() => !inactive && handlePress(type)}
              disabled={isLoading || used}
              className={`btn-attendance${inactive ? ' btn-attendance-used' : ''}`}
              style={inactive ? {} : { background: color, color: 'white', boxShadow: `0 2px 8px ${shadow}` }}
            >
              {isLoading ? '送信中...' : used ? `✓ ${label}` : label}
            </button>
          );
        })}
      </div>

      <div className="home-actions">
        <button type="button" onClick={onCalendarClick} className="btn-calendar">
          カレンダー
        </button>
        <button type="button" onClick={() => setModal('correction')} className="btn-correction">
          修正依頼
        </button>
      </div>

      {modal === 'day_before' && (
        <div className="modal-overlay">
          <div className="modal-sheet">
            <div className="modal-title">明日の出勤確認</div>
            <label className="modal-label" htmlFor="departure-time">出発予定時刻</label>
            <input
              id="departure-time"
              type="time"
              value={departureTime}
              onChange={e => setDepartureTime(e.target.value)}
              className="modal-input"
            />
            <div className="modal-footer">
              <button type="button" onClick={() => setModal(null)} className="btn-cancel">キャンセル</button>
              <button
                type="button"
                onClick={() => submit('day_before_confirmation', { departureTime })}
                disabled={!departureTime || loading === 'day_before_confirmation'}
                className="btn-primary btn-green"
              >確認済み</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'late' && (
        <div className="modal-overlay">
          <div className="modal-sheet">
            <div className="modal-title">遅刻連絡</div>
            <label className="modal-label" htmlFor="late-reason">遅刻理由 *</label>
            <textarea
              id="late-reason"
              value={lateReason}
              onChange={e => setLateReason(e.target.value)}
              placeholder="理由を入力してください"
              className="modal-textarea"
            />
            <label className="modal-label" htmlFor="estimated-arrival">到着予想時刻</label>
            <input
              id="estimated-arrival"
              type="time"
              value={estimatedArrival}
              onChange={e => setEstimatedArrival(e.target.value)}
              className="modal-input"
            />
            <div className="modal-footer">
              <button type="button" onClick={() => setModal(null)} className="btn-cancel">キャンセル</button>
              <button
                type="button"
                onClick={() => submit('late_notification', { lateReason, estimatedArrival })}
                disabled={!lateReason.trim() || loading === 'late_notification'}
                className="btn-primary btn-red-light"
              >送信</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'overtime' && (
        <div className="modal-overlay">
          <div className="modal-sheet">
            <div className="modal-title">残業申請</div>
            <label className="modal-label" htmlFor="overtime-reason">残業理由 *</label>
            <textarea
              id="overtime-reason"
              value={overtimeReason}
              onChange={e => setOvertimeReason(e.target.value)}
              placeholder="理由を入力してください"
              className="modal-textarea"
            />
            <label className="modal-label" htmlFor="overtime-duration">残業見込み時間</label>
            <select
              id="overtime-duration"
              title="残業見込み時間を選択"
              value={overtimeDuration}
              onChange={e => setOvertimeDuration(e.target.value)}
              className="modal-select"
            >
              <option value="">選択してください</option>
              <option value="30分">30分</option>
              <option value="1時間">1時間</option>
              <option value="1.5時間">1.5時間</option>
              <option value="2時間">2時間</option>
              <option value="3時間以上">3時間以上</option>
            </select>
            <div className="modal-footer">
              <button type="button" onClick={() => setModal(null)} className="btn-cancel">キャンセル</button>
              <button
                type="button"
                onClick={() => submit('overtime_request', { overtimeReason, overtimeDuration })}
                disabled={!overtimeReason.trim() || loading === 'overtime_request'}
                className="btn-primary btn-purple"
              >申請</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'correction' && (
        <div className="modal-overlay">
          <div className="modal-sheet">
            <div className="modal-title">修正依頼</div>
            <label className="modal-label" htmlFor="correction-log">対象の打刻（任意）</label>
            <select
              id="correction-log"
              title="修正対象の打刻を選択"
              value={correctionLogId}
              onChange={e => setCorrectionLogId(e.target.value)}
              className="modal-select"
            >
              <option value="">選択してください</option>
              {todayLogs.map(l => (
                <option key={l.id} value={l.id}>
                  {TYPE_LABEL[l.type] ?? l.type} {new Date(l.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                </option>
              ))}
            </select>
            <label className="modal-label" htmlFor="correction-reason">修正内容・理由 *</label>
            <textarea
              id="correction-reason"
              value={correctionReason}
              onChange={e => setCorrectionReason(e.target.value)}
              placeholder="修正したい内容を入力してください"
              className="modal-textarea"
            />
            <label className="modal-label" htmlFor="correction-new-time">希望する修正後の時刻（任意）</label>
            <input
              id="correction-new-time"
              type="datetime-local"
              title="修正後の時刻を選択"
              value={correctionNewTime}
              onChange={e => setCorrectionNewTime(e.target.value)}
              className="modal-input"
            />
            <div className="modal-footer">
              <button type="button" onClick={() => setModal(null)} className="btn-cancel">キャンセル</button>
              <button
                type="button"
                onClick={handleCorrection}
                disabled={!correctionReason.trim()}
                className="btn-primary btn-red"
              >送信</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
