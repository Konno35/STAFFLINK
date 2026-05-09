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
      const { data: users } = await supabase
        .from('users')
        .select('id, line_user_id, display_name, role, status, group_id, registered_at, groups(name)')
        .eq('tenant_id', ctx.tenantId)
        .order('registered_at');

      const { data: userAssignments } = await supabase
        .from('user_assignments')
        .select('line_user_id, assignment_id, assignments(id, name)')
        .eq('tenant_id', ctx.tenantId);

      const assignMap: Record<string, { id: string; name: string }[]> = {};
      for (const ua of userAssignments ?? []) {
        const uid = ua.line_user_id as string;
        if (!assignMap[uid]) assignMap[uid] = [];
        if (ua.assignments) assignMap[uid].push(ua.assignments as { id: string; name: string });
      }

      const mapped = (users ?? []).map((u: Record<string, unknown>) => ({
        lineUserId: u.line_user_id,
        displayName: u.display_name,
        role: u.role,
        status: u.status,
        registeredAt: u.registered_at,
        groupId: u.group_id,
        groupName: (u.groups as { name: string } | null)?.name,
        assignments: assignMap[u.line_user_id as string] ?? [],
      }));

      return ok({ users: mapped });
    }

    if (event.httpMethod === 'PUT') {
      const body = JSON.parse(event.body || '{}') as { lineUserId?: string; status?: string; role?: string; groupId?: string };
      if (!body.lineUserId) return err(400, 'lineUserId は必須です');

      const updates: Record<string, unknown> = {};
      if (body.status) updates.status = body.status;
      if (body.role)   updates.role   = body.role;
      if (body.groupId !== undefined) updates.group_id = body.groupId || null;

      const { error } = await supabase.from('users').update(updates).eq('line_user_id', body.lineUserId).eq('tenant_id', ctx.tenantId);
      if (error) throw error;
      return ok({ success: true });
    }

    return err(405, 'Method not allowed');
  } catch (e) {
    return err(e instanceof Error && e.message.includes('権限') ? 403 : 500, e instanceof Error ? e.message : 'Internal error');
  }
};
