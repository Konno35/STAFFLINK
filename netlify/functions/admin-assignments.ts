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
      const lineUserId = event.queryStringParameters?.lineUserId;

      if (lineUserId) {
        const { data } = await supabase
          .from('user_assignments')
          .select('assignment_id, assignments(id, name, work_location, status)')
          .eq('line_user_id', lineUserId)
          .eq('tenant_id', ctx.tenantId);
        const assignments = (data ?? []).map((r: Record<string, unknown>) => r.assignments).filter(Boolean);
        return ok({ assignments });
      }

      const { data } = await supabase
        .from('assignments')
        .select('id, name, work_location, manager_id, status, admin_accounts(email)')
        .eq('tenant_id', ctx.tenantId)
        .order('name');

      const mapped = (data ?? []).map((a: Record<string, unknown>) => ({
        id: a.id,
        name: a.name,
        workLocation: a.work_location,
        managerId: a.manager_id,
        managerEmail: (a.admin_accounts as { email: string } | null)?.email,
        status: a.status,
      }));
      return ok({ assignments: mapped });
    }

    const body = JSON.parse(event.body || '{}') as {
      action?: string;
      id?: string;
      name?: string;
      workLocation?: string;
      managerId?: string;
      status?: string;
      lineUserId?: string;
      assignmentId?: string;
    };

    if (event.httpMethod === 'POST') {
      if (body.action === 'assign') {
        if (!body.lineUserId || !body.assignmentId) return err(400, 'lineUserId と assignmentId は必須です');
        const { error } = await supabase.from('user_assignments').insert({ line_user_id: body.lineUserId, tenant_id: ctx.tenantId, assignment_id: body.assignmentId });
        if (error) throw error;
        return ok({ success: true });
      }
      if (!body.name?.trim()) return err(400, 'name は必須です');
      const { data, error } = await supabase
        .from('assignments')
        .insert({ tenant_id: ctx.tenantId, name: body.name.trim(), work_location: body.workLocation ?? null, manager_id: body.managerId ?? null })
        .select('id, name, work_location, manager_id, status')
        .single();
      if (error) throw error;
      return ok({ assignment: { id: data.id, name: data.name, workLocation: data.work_location, managerId: data.manager_id, status: data.status } });
    }

    if (event.httpMethod === 'PUT') {
      if (!body.id) return err(400, 'id は必須です');
      const updates: Record<string, unknown> = {};
      if (body.name) updates.name = body.name;
      if (body.workLocation !== undefined) updates.work_location = body.workLocation || null;
      if (body.managerId !== undefined) updates.manager_id = body.managerId || null;
      if (body.status) updates.status = body.status;
      const { error } = await supabase.from('assignments').update(updates).eq('id', body.id).eq('tenant_id', ctx.tenantId);
      if (error) throw error;
      return ok({ success: true });
    }

    if (event.httpMethod === 'DELETE') {
      if (body.lineUserId && body.assignmentId) {
        const { error } = await supabase.from('user_assignments').delete().eq('line_user_id', body.lineUserId).eq('assignment_id', body.assignmentId);
        if (error) throw error;
        return ok({ success: true });
      }
      if (!body.id) return err(400, 'id は必須です');
      const { error } = await supabase.from('assignments').delete().eq('id', body.id).eq('tenant_id', ctx.tenantId);
      if (error) throw error;
      return ok({ success: true });
    }

    return err(405, 'Method not allowed');
  } catch (e) {
    return err(e instanceof Error && e.message.includes('権限') ? 403 : 500, e instanceof Error ? e.message : 'Internal error');
  }
};
