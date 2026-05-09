import { useEffect, useState } from 'react';
import { getCorrections, reviewCorrection } from '../lib/api';
import type { Correction } from '../lib/api';
import '../components/Layout.css';
import './Corrections.css';

const TYPE_LABEL: Record<string, string> = {
  clock_in: '出勤', clock_out: '退勤', departure_check: '出発',
  day_before_confirmation: '前日確認', overtime_request: '残業申請', late_notification: '遅刻連絡',
  time_change: '時刻修正', type_change: '種別修正', delete: '削除依頼',
};

const STATUS_FILTER = ['all', 'pending', 'approved', 'rejected'] as const;
const STATUS_LABEL: Record<string, string> = { all: 'すべて', pending: '未対応', approved: '承認済み', rejected: '却下済み' };

export default function Corrections() {
  const [items, setItems] = useState<Correction[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [reviewModal, setReviewModal] = useState<Correction | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCorrections(statusFilter === 'all' ? undefined : statusFilter)
      .then(r => setItems(r.corrections))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  function showFlash(ok: boolean, msg: string) {
    setFlash({ ok, msg });
    setTimeout(() => setFlash(null), 3000);
  }

  async function handleReview(status: 'approved' | 'rejected') {
    if (!reviewModal) return;
    setSaving(true);
    try {
      await reviewCorrection(reviewModal.id, status, reviewNotes || undefined);
      setItems(prev => prev.map(c => c.id === reviewModal.id ? { ...c, status, reviewNotes } : c));
      showFlash(true, status === 'approved' ? '承認しました' : '却下しました');
      setReviewModal(null);
      setReviewNotes('');
    } catch (e) {
      showFlash(false, e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="empty">読み込み中...</div>;

  return (
    <div>
      <div className="page-title">修正依頼</div>
      {flash && <div className={`flash ${flash.ok ? 'flash-ok' : 'flash-err'}`}>{flash.msg}</div>}

      <div className="filters">
        {STATUS_FILTER.map(s => (
          <button
            key={s}
            type="button"
            className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter(s)}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="card">
        {items.length === 0 ? (
          <div className="empty">修正依頼はありません</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>スタッフ</th>
                <th>対象打刻</th>
                <th>依頼種別</th>
                <th>理由</th>
                <th>依頼日時</th>
                <th>ステータス</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map(c => (
                <tr key={c.id}>
                  <td>{c.displayName ?? c.requestedBy.slice(0, 8)}</td>
                  <td>
                    {c.logType && <span className="badge badge-blue">{TYPE_LABEL[c.logType] ?? c.logType}</span>}
                    {c.logTimestamp && (
                      <span className="correction-time">
                        {new Date(c.logTimestamp).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </td>
                  <td><span className="badge badge-gray">{TYPE_LABEL[c.correctionType] ?? c.correctionType}</span></td>
                  <td className="correction-reason">{c.reason}</td>
                  <td className="correction-time">
                    {new Date(c.requestedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td>
                    <span className={`badge ${c.status === 'pending' ? 'badge-yellow' : c.status === 'approved' ? 'badge-green' : 'badge-red'}`}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </td>
                  <td>
                    {c.status === 'pending' && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setReviewModal(c); setReviewNotes(''); }}>
                        対応する
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {reviewModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setReviewModal(null)}>
          <div className="modal">
            <div className="modal-title">修正依頼への対応</div>
            <div className="review-detail">
              <div className="review-row"><span className="review-label">スタッフ</span><span>{reviewModal.displayName}</span></div>
              <div className="review-row"><span className="review-label">依頼種別</span><span>{TYPE_LABEL[reviewModal.correctionType]}</span></div>
              <div className="review-row"><span className="review-label">理由</span><span>{reviewModal.reason}</span></div>
              {reviewModal.requestedNewTime && (
                <div className="review-row">
                  <span className="review-label">希望時刻</span>
                  <span>{new Date(reviewModal.requestedNewTime).toLocaleString('ja-JP')}</span>
                </div>
              )}
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="review-notes">レビューコメント（任意）</label>
              <textarea
                id="review-notes"
                className="input corrections-textarea"
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                placeholder="承認・却下の理由など"
                rows={3}
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setReviewModal(null)}>キャンセル</button>
              <button type="button" className="btn btn-danger" onClick={() => handleReview('rejected')} disabled={saving}>却下</button>
              <button type="button" className="btn btn-primary" onClick={() => handleReview('approved')} disabled={saving}>承認</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
