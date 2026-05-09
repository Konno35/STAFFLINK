import type { Handler, HandlerEvent } from '@netlify/functions';
import { supabase } from './lib/db.js';
import { verifyAdminJwt } from './lib/admin-auth.js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const ok  = (body: unknown) => ({ statusCode: 200, headers: cors, body: JSON.stringify(body) });
const err = (s: number, m: string) => ({ statusCode: s, headers: cors, body: JSON.stringify({ error: m }) });

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };

  try {
    const ctx = await verifyAdminJwt(event.headers.authorization);

    if (event.httpMethod === 'GET') {
      const { weekStart, lineUserId } = event.queryStringParameters ?? {};
      let query = supabase
        .from('shifts')
        .select('id, line_user_id, assignment_id, date, start_time, end_time, work_location, notes, created_at, assignments(name), users(display_name)')
        .eq('tenant_id', ctx.tenantId);

      if (weekStart) {
        const end = new Date(weekStart);
        end.setDate(end.getDate() + 6);
        const endStr = end.toLocaleDateString('sv-SE');
        query = query.gte('date', weekStart).lte('date', endStr);
      }
      if (lineUserId) query = query.eq('line_user_id', lineUserId);

      const { data } = await query.order('date').order('start_time');
      const shifts = (data ?? []).map((s: Record<string, unknown>) => ({
        id: s.id,
        tenantId: ctx.tenantId,
        lineUserId: s.line_user_id,
        displayName: (s.users as { display_name: string } | null)?.display_name,
        assignmentId: s.assignment_id,
        assignmentName: (s.assignments as { name: string } | null)?.name,
        date: s.date,
        startTime: s.start_time,
        endTime: s.end_time,
        workLocation: s.work_location,
        notes: s.notes,
        createdAt: s.created_at,
      }));
      return ok({ shifts });
    }

    const body = JSON.parse(event.body || '{}') as {
      id?: string;
      lineUserId?: string;
      assignmentId?: string;
      date?: string;
      startTime?: string;
      endTime?: string;
      workLocation?: string;
      notes?: string;
    };

    if (event.httpMethod === 'POST') {
      if (!body.lineUserId || !body.date || !body.startTime || !body.endTime) return err(400, 'lineUserId, date, startTime, endTime は必須です');
      const { data, error } = await supabase
        .from('shifts')
        .insert({ tenant_id: ctx.tenantId, line_user_id: body.lineUserId, assignment_id: body.assignmentId ?? null, date: body.date, start_time: body.startTime, end_time: body.endTime, work_location: body.workLocation ?? null, notes: body.notes ?? null })
        .select('id, line_user_id, assignment_id, date, start_time, end_time, work_location, notes')
        .single();
      if (error) throw error;
      return ok({ shift: { id: data.id, tenantId: ctx.tenantId, lineUserId: data.line_user_id, assignmentId: data.assignment_id, date: data.date, startTime: data.start_time, endTime: data.end_time, workLocation: data.work_location, notes: data.notes } });
    }

    if (event.httpMethod === 'PUT') {
      if (!body.id) return err(400, 'id は必須です');
      const updates: Record<string, unknown> = {};
      if (body.lineUserId) updates.line_user_id = body.lineUserId;
      if (body.assignmentId !== undefined) updates.assignment_id = body.assignmentId || null;
      if (body.date) updates.date = body.date;
      if (body.startTime) updates.start_time = body.startTime;
      if (body.endTime) updates.end_time = body.endTime;
      if (body.workLocation !== undefined) updates.work_location = body.workLocation || null;
      if (body.notes !== undefined) updates.notes = body.notes || null;
      const { error } = await supabase.from('shifts').update(updates).eq('id', body.id).eq('tenant_id', ctx.tenantId);
      if (error) throw error;
      return ok({ success: true });
    }

    if (event.httpMethod === 'DELETE') {
      if (!body.id) return err(400, 'id は必須です');
      const { error } = await supabase.from('shifts').delete().eq('id', body.id).eq('tenant_id', ctx.tenantId);
      if (error) throw error;
      return ok({ success: true });
    }

    return err(405, 'Method not allowed');
  } catch (e) {
    return err(e instanceof Error && e.message.includes('権限') ? 403 : 500, e instanceof Error ? e.message : 'Internal error');
  }
};
