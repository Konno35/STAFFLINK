import type { Handler, HandlerEvent } from '@netlify/functions';
import { supabase } from './lib/db.js';
import { verifyLineToken } from './lib/line-verify.js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const ok  = (body: unknown) => ({ statusCode: 200, headers: cors, body: JSON.stringify(body) });
const err = (s: number, m: string) => ({ statusCode: s, headers: cors, body: JSON.stringify({ error: m }) });

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'GET') return err(405, 'Method not allowed');

  try {
    const token = event.headers.authorization?.replace('Bearer ', '');
    if (!token) return err(401, '認証トークンがありません');

    const profile = await verifyLineToken(token);

    const { data: user } = await supabase
      .from('users')
      .select('tenant_id, status')
      .eq('line_user_id', profile.userId)
      .single();

    if (!user || user.status !== 'active') return err(403, 'ユーザーが無効です');

    const month = event.queryStringParameters?.month;
    if (!month) return err(400, 'month パラメータが必要です（例: 2026-05）');

    const from = `${month}-01`;
    const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
    const to = `${month}-${String(lastDay).padStart(2, '0')}`;

    const { data } = await supabase
      .from('shifts')
      .select('id, date, start_time, end_time, work_location, notes, assignments(name)')
      .eq('tenant_id', user.tenant_id)
      .eq('line_user_id', profile.userId)
      .gte('date', from)
      .lte('date', to)
      .order('date');

    const shifts = (data ?? []).map((s: Record<string, unknown>) => ({
      id: s.id,
      date: s.date,
      startTime: s.start_time,
      endTime: s.end_time,
      workLocation: s.work_location,
      notes: s.notes,
      assignmentName: (s.assignments as { name?: string } | null)?.name,
    }));

    return ok({ shifts });
  } catch (e) {
    return err(500, e instanceof Error ? e.message : 'Internal error');
  }
};
