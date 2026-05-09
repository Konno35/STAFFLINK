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
      const status = event.queryStringParameters?.status;
      let query = supabase
        .from('attendance_corrections')
        .select('id, attendance_log_id, requested_by, reason, correction_type, requested_new_time, status, reviewed_by, reviewed_at, review_notes, requested_at, users(display_name), attendance_logs(type, timestamp)')
        .eq('tenant_id', ctx.tenantId);
      if (status) query = query.eq('status', status);

      const { data } = await query.order('requested_at', { ascending: false });
      const corrections = (data ?? []).map((c: Record<string, unknown>) => ({
        id: c.id,
        attendanceLogId: c.attendance_log_id,
        requestedBy: c.requested_by,
        displayName: (c.users as { display_name: string } | null)?.display_name,
        reason: c.reason,
        correctionType: c.correction_type,
        requestedNewTime: c.requested_new_time,
        status: c.status,
        reviewedBy: c.reviewed_by,
        reviewedAt: c.reviewed_at,
        reviewNotes: c.review_notes,
        requestedAt: c.requested_at,
        logType: (c.attendance_logs as { type: string } | null)?.type,
        logTimestamp: (c.attendance_logs as { timestamp: string } | null)?.timestamp,
      }));
      return ok({ corrections });
    }

    if (event.httpMethod === 'PUT') {
      const body = JSON.parse(event.body || '{}') as { id?: string; status?: string; reviewNotes?: string };
      if (!body.id || !body.status) return err(400, 'id と status は必須です');
      if (!['approved', 'rejected'].includes(body.status)) return err(400, 'status は approved または rejected のみ');

      const { error } = await supabase
        .from('attendance_corrections')
        .update({ status: body.status, reviewed_by: ctx.uid, reviewed_at: new Date().toISOString(), review_notes: body.reviewNotes ?? null })
        .eq('id', body.id)
        .eq('tenant_id', ctx.tenantId);
      if (error) throw error;
      return ok({ success: true });
    }

    return err(405, 'Method not allowed');
  } catch (e) {
    return err(e instanceof Error && e.message.includes('権限') ? 403 : 500, e instanceof Error ? e.message : 'Internal error');
  }
};
