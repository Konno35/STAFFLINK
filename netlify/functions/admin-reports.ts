import type { Handler, HandlerEvent } from '@netlify/functions';
import { supabase } from './lib/db.js';
import { verifyAdminJwt } from './lib/admin-auth.js';

const TYPE_LABEL: Record<string, string> = {
  clock_in: '出勤', clock_out: '退勤', departure_check: '出発',
  day_before_confirmation: '前日確認', overtime_request: '残業申請', late_notification: '遅刻連絡',
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const err = (s: number, m: string) => ({ statusCode: s, headers: cors, body: JSON.stringify({ error: m }) });

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'GET') return err(405, 'Method not allowed');

  try {
    const ctx = await verifyAdminJwt(event.headers.authorization);
    const { from, to, groupId, assignmentId, lineUserId } = event.queryStringParameters ?? {};
    if (!from || !to) return err(400, 'from と to は必須です');

    let query = supabase
      .from('attendance_logs')
      .select('line_user_id, type, timestamp, date, notes, overtime_reason, late_reason, users(display_name, group_id, groups(name)), user_assignments(assignment_id, assignments(name))')
      .eq('tenant_id', ctx.tenantId)
      .gte('date', from)
      .lte('date', to);

    if (lineUserId) query = query.eq('line_user_id', lineUserId);

    const { data, error } = await query.order('date').order('timestamp');
    if (error) throw error;

    const rows = (data ?? []).filter((l: Record<string, unknown>) => {
      const u = l.users as { group_id?: string } | null;
      if (groupId && u?.group_id !== groupId) return false;
      return true;
    });

    const csvLines = [
      '日付,氏名,グループ,案件,種別,打刻時刻,メモ,残業理由,遅刻理由',
      ...rows.map((l: Record<string, unknown>) => {
        const u = l.users as { display_name?: string; groups?: { name?: string } } | null;
        const displayName = u?.display_name ?? '';
        const groupName = (u?.groups as { name?: string } | null)?.name ?? '';
        const ua = Array.isArray(l.user_assignments) ? l.user_assignments : [];
        const assignName = assignmentId
          ? ua.filter((a: Record<string, unknown>) => a.assignment_id === assignmentId).map((a: Record<string, unknown>) => (a.assignments as { name?: string } | null)?.name ?? '').join('|')
          : ua.map((a: Record<string, unknown>) => (a.assignments as { name?: string } | null)?.name ?? '').join('|');
        const time = new Date(l.timestamp as string).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
        const row = [l.date, displayName, groupName, assignName, TYPE_LABEL[l.type as string] ?? l.type, time, l.notes ?? '', l.overtime_reason ?? '', l.late_reason ?? ''];
        return row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
      }),
    ];

    const bom = '﻿';
    return {
      statusCode: 200,
      headers: {
        ...cors,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="attendance_${from}_${to}.csv"`,
      },
      body: bom + csvLines.join('\n'),
    };
  } catch (e) {
    return err(e instanceof Error && e.message.includes('権限') ? 403 : 500, e instanceof Error ? e.message : 'Internal error');
  }
};
