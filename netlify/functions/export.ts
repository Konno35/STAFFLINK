import type { Handler, HandlerEvent } from '@netlify/functions';
import { supabase } from './lib/db.js';

const TYPE_LABEL: Record<string, string> = {
  clock_in: '出勤', clock_out: '退勤', departure_check: '出発',
  day_before_confirmation: '前日確認', overtime_request: '残業申請', late_notification: '遅刻連絡',
};

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };
const err  = (s: number, m: string) => ({ statusCode: s, headers: cors, body: JSON.stringify({ error: m }) });

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'GET') return err(405, 'Method not allowed');

  const { api_key, from, to } = event.queryStringParameters ?? {};
  if (!api_key) return err(401, 'api_key は必須です');
  if (!from || !to) return err(400, 'from と to は必須です');

  const { data: setting } = await supabase
    .from('tenant_settings')
    .select('tenant_id')
    .eq('key', 'api_key')
    .eq('value', api_key)
    .single();

  if (!setting) return err(401, 'APIキーが無効です');

  const { data, error } = await supabase
    .from('attendance_logs')
    .select('line_user_id, type, timestamp, date, notes, overtime_reason, late_reason, gps_lat, gps_lng, gps_discrepancy_meters, users(display_name)')
    .eq('tenant_id', setting.tenant_id)
    .gte('date', from)
    .lte('date', to)
    .order('date')
    .order('timestamp');

  if (error) return err(500, error.message);

  const records = (data ?? []).map((l: Record<string, unknown>) => ({
    date: l.date,
    lineUserId: l.line_user_id,
    displayName: (l.users as { display_name?: string } | null)?.display_name ?? '',
    type: l.type,
    typeLabel: TYPE_LABEL[l.type as string] ?? l.type,
    timestamp: l.timestamp,
    notes: l.notes,
    overtimeReason: l.overtime_reason,
    lateReason: l.late_reason,
    gpsLat: l.gps_lat,
    gpsLng: l.gps_lng,
    gpsDiscrepancyMeters: l.gps_discrepancy_meters,
  }));

  return { statusCode: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ records }) };
};
