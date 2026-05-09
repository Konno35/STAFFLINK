import type { Handler, HandlerEvent } from '@netlify/functions';
import { supabase } from './lib/db.js';
import { verifyLineToken } from './lib/line-verify.js';

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
    const token = event.headers.authorization?.replace('Bearer ', '');
    if (!token) return err(401, '認証トークンがありません');

    const profile = await verifyLineToken(token);

    const { data: me } = await supabase
      .from('users')
      .select('id, line_user_id, tenant_id, display_name, role, status, registered_at')
      .eq('line_user_id', profile.userId)
      .single();

    // ── GET ──────────────────────────────────────────────
    if (event.httpMethod === 'GET') {
      // スタッフ一覧（管理者のみ）
      if (event.path.endsWith('/list')) {
        if (!me || me.role !== 'admin') return err(403, '管理者権限が必要です');
        const { data: users } = await supabase
          .from('users')
          .select('id, line_user_id, display_name, role, status, registered_at')
          .eq('tenant_id', me.tenant_id)
          .order('registered_at');
        return ok({ users: users ?? [] });
      }

      // 自分のプロフィール
      return ok({
        user: me
          ? { lineUserId: me.line_user_id, displayName: me.display_name, role: me.role, status: me.status, registeredAt: me.registered_at }
          : null,
        tenantId: me?.tenant_id ?? null,
      });
    }

    // ── PUT: ユーザー情報更新（管理者のみ）──────────────────
    if (event.httpMethod === 'PUT') {
      if (!me || me.role !== 'admin') return err(403, '管理者権限が必要です');

      const body = JSON.parse(event.body || '{}') as {
        lineUserId?: string;
        status?: string;
        role?: string;
      };
      if (!body.lineUserId) return err(400, 'lineUserId は必須です');

      const updates: Record<string, string> = {};
      if (body.status) updates.status = body.status;
      if (body.role)   updates.role   = body.role;

      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('line_user_id', body.lineUserId)
        .eq('tenant_id', me.tenant_id);

      if (error) throw error;
      return ok({ success: true });
    }

    return err(405, 'Method not allowed');
  } catch (e) {
    return err(500, e instanceof Error ? e.message : 'Internal error');
  }
};
