import { useState, useEffect } from 'react';
import { getTodayAttendance, getMyShifts } from '../lib/api';
import type { TodayLog, ShiftEntry } from '../lib/api';
import './UserCalendar.css';

const TYPE_LABEL: Record<string, string> = {
  clock_in: '出勤', clock_out: '退勤', departure_check: '出発',
  day_before_confirmation: '前日確認', overtime_request: '残業申請', late_notification: '遅刻連絡',
};

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

interface Props {
  onBack: () => void;
}

interface DayDetail {
  dateStr: string;
  shifts: ShiftEntry[];
  logs: TodayLog[];
}

export default function UserCalendar({ onBack }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [shifts, setShifts] = useState<ShiftEntry[]>([]);
  const [logsByDate, setLogsByDate] = useState<Record<string, TodayLog[]>>({});
  const [selected, setSelected] = useState<DayDetail | null>(null);

  useEffect(() => {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    getMyShifts(monthStr).then(r => setShifts(r.shifts)).catch(() => {});
  }, [year, month]);

  useEffect(() => {
    // Load logs for today only (API currently supports single-date fetch)
    const todayStr = today.toISOString().slice(0, 10);
    getTodayAttendance('today').then(r => {
      setLogsByDate(prev => ({ ...prev, [todayStr]: r.logs }));
    }).catch(() => {});
  }, []);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayStr = today.toISOString().slice(0, 10);

  function shiftsByDate(dateStr: string) {
    return shifts.filter(s => s.date === dateStr);
  }

  function logsForDate(dateStr: string) {
    return logsByDate[dateStr] ?? [];
  }

  function handleCellClick(day: number) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelected({ dateStr, shifts: shiftsByDate(dateStr), logs: logsForDate(dateStr) });
  }

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="cal-container">
      <button type="button" onClick={onBack} className="cal-back-btn">
        ← ホームに戻る
      </button>

      <div className="cal-header">
        <button type="button" onClick={prevMonth} className="cal-nav-btn">‹</button>
        <div className="cal-month-label">{year}年{month}月</div>
        <button type="button" onClick={nextMonth} className="cal-nav-btn">›</button>
      </div>

      <div className="cal-legend">
        <span><span className="cal-legend-dot cal-legend-shift" />シフト</span>
        <span><span className="cal-legend-dot cal-legend-log" />打刻</span>
      </div>

      <div className="cal-weekdays">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={i === 0 ? 'cal-weekday-sun' : i === 6 ? 'cal-weekday-sat' : ''}>
            {d}
          </div>
        ))}
      </div>

      <div className="cal-grid">
        {cells.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} className="cal-cell-empty" />;
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayOfWeek = (firstDay + day - 1) % 7;
          const hasShift = shiftsByDate(dateStr).length > 0;
          const hasLog = logsForDate(dateStr).length > 0;
          const isToday = dateStr === todayStr;

          return (
            <button
              key={day}
              type="button"
              className="cal-cell"
              onClick={() => handleCellClick(day)}
            >
              <span className={`cal-day-num${dayOfWeek === 0 ? ' cal-day-sun' : dayOfWeek === 6 ? ' cal-day-sat' : ''}${isToday ? ' cal-day-today' : ''}`}>
                {day}
              </span>
              <div className="cal-dots">
                {hasShift && <div className="cal-dot cal-dot-shift" />}
                {hasLog   && <div className="cal-dot cal-dot-log" />}
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="cal-modal-overlay">
          <div className="cal-modal-sheet">
            <div className="cal-modal-title">
              {selected.dateStr.replace(/-/g, '/')}
            </div>

            <div className="cal-section-title">シフト</div>
            {selected.shifts.length === 0 ? (
              <div className="cal-empty-msg">シフトなし</div>
            ) : (
              selected.shifts.map(s => (
                <div key={s.id} className="cal-shift-row">
                  <div className="cal-shift-time">{s.startTime} 〜 {s.endTime}</div>
                  {(s.assignmentName || s.workLocation) && (
                    <div className="cal-shift-loc">{s.assignmentName ?? ''}{s.workLocation ? ` / ${s.workLocation}` : ''}</div>
                  )}
                  {s.notes && <div className="cal-shift-loc">{s.notes}</div>}
                </div>
              ))
            )}

            <div className="cal-section-title cal-section-title-logs">打刻</div>
            {selected.logs.length === 0 ? (
              <div className="cal-empty-msg">打刻なし</div>
            ) : (
              selected.logs.map(l => (
                <div key={l.id} className="cal-log-row">
                  <span className="cal-log-check">✓</span>
                  <span>{TYPE_LABEL[l.type] ?? l.type}</span>
                  <span className="cal-log-time">
                    {new Date(l.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}

            <button type="button" onClick={() => setSelected(null)} className="cal-modal-close">
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
