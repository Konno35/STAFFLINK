import type { Handler, HandlerEvent } from '@netlify/functions';
import { supabase, generateToken } from './lib/db.js';
import { verifyAdminJwt } from './lib/admin-auth.js';

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
    const ctx = await verifyAdminJwt(event.headers.authorization);

    if (event.httpMethod === 'GET') {
      const { data } = await supabase.from('tenant_settings').select('key, value').eq('tenant_id', ctx.tenantId);
      const settings: Record<string, string> = {};
      for (const row of data ?? []) settings[row.key] = row.value;

      if (!settings.api_key) {
        const newKey = generateToken();
        await supabase.from('tenant_settings').upsert({ tenant_id: ctx.tenantId, key: 'api_key', value: newKey });
        settings.api_key = newKey;
      }

      return ok({ settings });
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}') as { action?: string; settings?: Record<string, string> };

      if (body.action === 'regenerate_api_key') {
        const newKey = generateToken();
        await supabase.from('tenant_settings').upsert({ tenant_id: ctx.tenantId, key: 'api_key', value: newKey });
        return ok({ apiKey: newKey });
      }

      if (!body.settings) return err(400, 'settings は必須です');
      const rows = Object.entries(body.settings).map(([key, value]) => ({ tenant_id: ctx.tenantId, key, value }));
      const { error } = await supabase.from('tenant_settings').upsert(rows);
      if (error) throw error;
      return ok({ success: true });
    }

    return err(405, 'Method not allowed');
  } catch (e) {
    return err(e instanceof Error && e.message.includes('権限') ? 403 : 500, e instanceof Error ? e.message : 'Internal error');
  }
};
