import type { Handler, HandlerEvent } from '@netlify/functions';
import { supabase } from './lib/db.js';
import { verifyLineToken } from './lib/line-verify.js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ok  = (body: unknown) => ({ statusCode: 200, headers: cors, body: JSON.stringify(body) });
const err = (s: number, m: string) => ({ statusCode: s, headers: cors, body: JSON.stringify({ error: m }) });

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return err(405, 'Method not allowed');

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

    const body = JSON.parse(event.body || '{}') as {
      attendanceLogId?: string;
      reason?: string;
      correctionType?: string;
      requestedNewTime?: string;
    };

    if (!body.reason?.trim()) return err(400, 'reason は必須です');
    if (!body.correctionType) return err(400, 'correctionType は必須です');

    const { data, error } = await supabase
      .from('attendance_corrections')
      .insert({
        tenant_id: user.tenant_id,
        attendance_log_id: body.attendanceLogId ?? null,
        requested_by: profile.userId,
        reason: body.reason.trim(),
        correction_type: body.correctionType,
        requested_new_time: body.requestedNewTime ?? null,
      })
      .select('id')
      .single();

    if (error) throw error;
    return ok({ success: true, id: data.id });
  } catch (e) {
    return err(500, e instanceof Error ? e.message : 'Internal error');
  }
};
