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
      const { data } = await supabase.from('groups').select('id, name').eq('tenant_id', ctx.tenantId).order('name');
      return ok({ groups: data ?? [] });
    }

    const body = JSON.parse(event.body || '{}') as { id?: string; name?: string };

    if (event.httpMethod === 'POST') {
      if (!body.name?.trim()) return err(400, 'name は必須です');
      const { data, error } = await supabase.from('groups').insert({ tenant_id: ctx.tenantId, name: body.name.trim() }).select('id, name').single();
      if (error) throw error;
      return ok({ group: data });
    }

    if (event.httpMethod === 'PUT') {
      if (!body.id || !body.name?.trim()) return err(400, 'id と name は必須です');
      const { error } = await supabase.from('groups').update({ name: body.name.trim() }).eq('id', body.id).eq('tenant_id', ctx.tenantId);
      if (error) throw error;
      return ok({ success: true });
    }

    if (event.httpMethod === 'DELETE') {
      if (!body.id) return err(400, 'id は必須です');
      const { error } = await supabase.from('groups').delete().eq('id', body.id).eq('tenant_id', ctx.tenantId);
      if (error) throw error;
      return ok({ success: true });
    }

    return err(405, 'Method not allowed');
  } catch (e) {
    return err(e instanceof Error && e.message.includes('権限') ? 403 : 500, e instanceof Error ? e.message : 'Internal error');
  }
};
