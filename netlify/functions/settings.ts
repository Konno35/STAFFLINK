import type { Handler, HandlerEvent } from '@netlify/functions';
import { supabase } from './lib/db.js';
import { verifyLineToken } from './lib/line-verify.js';

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
    const token = event.headers.authorization?.replace('Bearer ', '');
    if (!token) return err(401, '認証トークンがありません');

    const profile = await verifyLineToken(token);

    const { data: me } = await supabase
      .from('users')
      .select('tenant_id, role')
      .eq('line_user_id', profile.userId)
      .single();

    if (!me) return err(403, 'ユーザー登録が完了していません');

    // ── GET ──────────────────────────────────────────────
    if (event.httpMethod === 'GET') {
      const { data: rows } = await supabase
        .from('tenant_settings')
        .select('key, value')
        .eq('tenant_id', me.tenant_id);

      const settings = Object.fromEntries((rows ?? []).map(r => [r.key, r.value]));
      return ok({ settings });
    }

    // ── POST: 設定更新（管理者のみ）──────────────────────
    if (event.httpMethod === 'POST') {
      if (me.role !== 'admin') return err(403, '管理者権限が必要です');

      const body = JSON.parse(event.body || '{}') as { settings?: Record<string, string> };
      if (!body.settings) return err(400, 'settings は必須です');

      const upserts = Object.entries(body.settings).map(([key, value]) => ({
        tenant_id: me.tenant_id,
        key,
        value,
      }));

      const { error } = await supabase
        .from('tenant_settings')
        .upsert(upserts, { onConflict: 'tenant_id,key' });

      if (error) throw error;
      return ok({ success: true });
    }

    return err(405, 'Method not allowed');
  } catch (e) {
    return err(500, e instanceof Error ? e.message : 'Internal error');
  }
};
