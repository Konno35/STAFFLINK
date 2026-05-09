import type { Handler, HandlerEvent } from '@netlify/functions';
import { verifyAdminJwt } from './lib/admin-auth.js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const ok  = (body: unknown) => ({ statusCode: 200, headers: cors, body: JSON.stringify(body) });
const err = (s: number, m: string) => ({ statusCode: s, headers: cors, body: JSON.stringify({ error: m }) });

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'GET') return err(405, 'Method not allowed');

  try {
    const ctx = await verifyAdminJwt(event.headers.authorization);
    return ok({ tenantId: ctx.tenantId, email: ctx.email });
  } catch (e) {
    return err(401, e instanceof Error ? e.message : 'Unauthorized');
  }
};
