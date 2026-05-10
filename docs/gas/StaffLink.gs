// StaffLink GAS Integration Script
// ============================================================
// 設定方法:
// 1. 下記の定数を入力してください
// 2. [トリガー] → [トリガーを追加] → syncAttendance を時間ベースで実行
//    (例: 毎日 06:00 ~ 07:00)
// ============================================================

/** StaffLink 管理画面の「設定」ページに表示されるAPIキー */
const API_KEY = 'YOUR_API_KEY_HERE';

/** データを書き込むスプレッドシートID（URLの /d/XXXX/edit の XXXX 部分） */
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';

/** データを書き込むシート名 */
const SHEET_NAME = '勤怠データ';

/** StaffLink のベースURL（末尾スラッシュなし） */
const API_BASE = 'https://stafflink-app.netlify.app';

// ============================================================

/**
 * 前日分の勤怠データを取得してスプレッドシートに追記します。
 * トリガーから自動実行されます。
 */
function syncAttendance() {
  const yesterday = getPreviousDate_(new Date(), 1);
  fetchAndWrite_(yesterday, yesterday);
}

/**
 * 指定期間の勤怠データを手動で取得します。
 * スクリプトエディタから直接実行してください。
 * fromDate / toDate を書き換えて使用します。
 */
function syncManual() {
  const fromDate = '2026-05-01'; // 開始日 (YYYY-MM-DD)
  const toDate   = '2026-05-31'; // 終了日 (YYYY-MM-DD)
  fetchAndWrite_(fromDate, toDate);
}

// ---- 内部関数 -----------------------------------------------

function fetchAndWrite_(from, to) {
  const url = `${API_BASE}/api/export/attendance?api_key=${API_KEY}&from=${from}&to=${to}`;
  const res  = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const code = res.getResponseCode();

  if (code !== 200) {
    Logger.log(`StaffLink API error ${code}: ${res.getContentText()}`);
    return;
  }

  const json = JSON.parse(res.getContentText());
  const logs = json.logs;

  if (!logs || logs.length === 0) {
    Logger.log(`${from} 〜 ${to}: データなし`);
    return;
  }

  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  let   sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // ヘッダー行
    sheet.appendRow([
      '日付', '氏名', 'グループ', '案件', '種別', '打刻時刻',
      'メモ', '残業理由', '遅刻理由', 'GPS緯度', 'GPS経度',
    ]);
    sheet.setFrozenRows(1);
  }

  const rows = logs.map(l => [
    l.date,
    l.displayName,
    l.groupName    ?? '',
    l.assignmentName ?? '',
    l.type,
    l.timestamp    ? formatTimestamp_(l.timestamp) : '',
    l.notes        ?? '',
    l.overtimeReason ?? '',
    l.lateReason   ?? '',
    l.gpsLat       ?? '',
    l.gpsLng       ?? '',
  ]);

  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  Logger.log(`${rows.length} 件を書き込みました (${from} 〜 ${to})`);
}

function getPreviousDate_(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() - days);
  return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
}

function formatTimestamp_(iso) {
  const d = new Date(iso);
  return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
}
