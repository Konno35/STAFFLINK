import type { Handler, HandlerEvent } from '@netlify/functions';
import { supabase, todayJst } from './lib/db.js';
import { verifyLineToken } from './lib/line-verify.js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const ok  = (body: unknown) => ({ statusCode: 200, headers: cors, body: JSON.stringify(body) });
const err = (s: number, m: string) => ({ statusCode: s, headers: cors, body: JSON.stringify({ error: m }) });

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };

  try {
    const token = event.headers.authorization?.replace('Bearer ', '');
    if (!token) return err(401, '認証トークンがありません');

    const profile = await verifyLineToken(token);

    const { data: user } = await supabase
      .from('users')
      .select('id, tenant_id, role, status')
      .eq('line_user_id', profile.userId)
      .eq('status', 'active')
      .single();

    if (!user) return err(403, 'ユーザー登録が完了していないか、アカウントが無効です');

    // ── GET: 指定日の自分の打刻ログ ─────────────────────────
    if (event.httpMethod === 'GET') {
      const dateParam = event.queryStringParameters?.date;
      const date = dateParam === 'today' ? todayJst() : (dateParam ?? todayJst());

      const { data } = await supabase
        .from('attendance_logs')
        .select('id, type, timestamp, date, notes, late_reason, estimated_arrival, overtime_reason, overtime_duration')
        .eq('tenant_id', user.tenant_id)
        .eq('line_user_id', profile.userId)
        .eq('date', date)
        .order('timestamp');

      return ok({ logs: data ?? [], date });
    }

    // ── POST: 打刻記録 ────────────────────────────────────────
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}') as {
        type?: string;
        notes?: string;
        departureTime?: string;
        lateReason?: string;
        estimatedArrival?: string;
        overtimeReason?: string;
        overtimeDuration?: string;
        gpsLat?: number;
        gpsLng?: number;
        gpsDiscrepancyMeters?: number;
      };
      if (!body.type) return err(400, 'type は必須です');

      const { data: setting } = await supabase
        .from('tenant_settings')
        .select('value')
        .eq('tenant_id', user.tenant_id)
        .eq('key', `feature_${body.type}`)
        .single();

      if (setting?.value === 'false') return err(403, `この機能は無効です: ${body.type}`);

      const { data, error } = await supabase
        .from('attendance_logs')
        .insert({
          tenant_id:            user.tenant_id,
          line_user_id:         profile.userId,
          type:                 body.type,
          date:                 todayJst(),
          notes:                body.notes ?? null,
          departure_time:       body.departureTime ?? null,
          late_reason:          body.lateReason ?? null,
          estimated_arrival:    body.estimatedArrival ?? null,
          overtime_reason:      body.overtimeReason ?? null,
          overtime_duration:    body.overtimeDuration ?? null,
          gps_lat:              body.gpsLat ?? null,
          gps_lng:              body.gpsLng ?? null,
          gps_discrepancy_meters: body.gpsDiscrepancyMeters ?? null,
        })
        .select('id, timestamp')
        .single();

      if (error) throw error;
      return ok({ success: true, id: data.id, timestamp: data.timestamp });
    }

    return err(405, 'Method not allowed');
  } catch (e) {
    return err(500, e instanceof Error ? e.message : 'Internal error');
  }
};
