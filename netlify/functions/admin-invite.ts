import type { Handler, HandlerEvent } from '@netlify/functions';
import { supabase, generateToken } from './lib/db.js';
import { verifyAdminJwt } from './lib/admin-auth.js';

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
    const ctx = await verifyAdminJwt(event.headers.authorization);
    const body = JSON.parse(event.body || '{}') as { expiresInDays?: number; groupId?: string; assignmentId?: string };
    const days = body.expiresInDays ?? 7;
    const expiresAt = new Date(Date.now() + days * 86400_000).toISOString();
    const token = generateToken();

    const { error } = await supabase.from('invites').insert({
      tenant_id: ctx.tenantId,
      token,
      created_by: ctx.email,
      expires_at: expiresAt,
      default_group_id: body.groupId ?? null,
      default_assignment_id: body.assignmentId ?? null,
    });
    if (error) throw error;

    return ok({ token, expiresAt });
  } catch (e) {
    return err(e instanceof Error && e.message.includes('権限') ? 403 : 500, e instanceof Error ? e.message : 'Internal error');
  }
};
