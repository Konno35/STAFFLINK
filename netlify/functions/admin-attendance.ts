import type { Handler, HandlerEvent } from '@netlify/functions';
import { supabase } from './lib/db.js';
import { verifyAdminJwt } from './lib/admin-auth.js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
};

const ok  = (body: unknown) => ({ statusCode: 200, headers: cors, body: JSON.stringify(body) });
const err = (s: number, m: string) => ({ statusCode: s, headers: cors, body: JSON.stringify({ error: m }) });

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };

  try {
    const ctx = await verifyAdminJwt(event.headers.authorization);

    if (event.httpMethod === 'GET') {
      const { date, month } = event.queryStringParameters ?? {};
      let query = supabase
        .from('attendance_logs')
        .select('id, line_user_id, type, timestamp, date, notes, departure_time, late_reason, estimated_arrival, overtime_reason, overtime_duration, gps_lat, gps_lng, gps_discrepancy_meters, users(display_name)')
        .eq('tenant_id', ctx.tenantId);

      if (date)  query = query.eq('date', date);
      if (month) query = query.gte('date', `${month}-01`).lte('date', `${month}-31`);

      const { data } = await query.order('timestamp');
      const logs = (data ?? []).map((l: Record<string, unknown>) => ({
        id: l.id,
        tenantId: ctx.tenantId,
        lineUserId: l.line_user_id,
        displayName: (l.users as { display_name: string } | null)?.display_name,
        type: l.type,
        timestamp: l.timestamp,
        date: l.date,
        notes: l.notes,
        departureTime: l.departure_time,
        lateReason: l.late_reason,
        estimatedArrival: l.estimated_arrival,
        overtimeReason: l.overtime_reason,
        overtimeDuration: l.overtime_duration,
        gpsLat: l.gps_lat,
        gpsLng: l.gps_lng,
        gpsDiscrepancyMeters: l.gps_discrepancy_meters,
      }));
      return ok({ logs });
    }

    if (event.httpMethod === 'PUT') {
      const body = JSON.parse(event.body || '{}') as { id?: string; timestamp?: string; type?: string; notes?: string };
      if (!body.id) return err(400, 'id は必須です');

      const updates: Record<string, unknown> = {};
      if (body.timestamp) updates.timestamp = body.timestamp;
      if (body.type)      updates.type = body.type;
      if (body.notes !== undefined) updates.notes = body.notes;

      const { error } = await supabase.from('attendance_logs').update(updates).eq('id', body.id).eq('tenant_id', ctx.tenantId);
      if (error) throw error;
      return ok({ success: true });
    }

    return err(405, 'Method not allowed');
  } catch (e) {
    return err(e instanceof Error && e.message.includes('権限') ? 403 : 500, e instanceof Error ? e.message : 'Internal error');
  }
};
