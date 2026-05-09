import type { Handler, HandlerEvent } from '@netlify/functions';
import { supabase, generateToken } from './lib/db.js';
import { verifyLineToken } from './lib/line-verify.js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const ok  = (body: unknown) => ({ statusCode: 200, headers: cors, body: JSON.stringify(body) });
const err = (s: number, m: string) => ({ statusCode: s, headers: cors, body: JSON.stringify({ error: m }) });

const DEFAULT_SETTINGS = [
  { key: 'feature_day_before_confirmation', value: 'false' },
  { key: 'feature_departure_check',         value: 'true'  },
  { key: 'feature_clock_in',                value: 'true'  },
  { key: 'feature_clock_out',               value: 'true'  },
  { key: 'feature_overtime_request',        value: 'true'  },
  { key: 'feature_late_notification',       value: 'true'  },
  { key: 'company_name',                    value: ''      },
  { key: 'timezone',                        value: 'Asia/Tokyo' },
];

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };

  try {
    // ── GET: 招待トークン検証（認証不要）───────────────────
    if (event.httpMethod === 'GET') {
      const { token, tenant } = event.queryStringParameters ?? {};
      if (!token || !tenant) return err(400, 'token と tenant は必須です');

      const { data: invite } = await supabase
        .from('invites')
        .select('status, expires_at')
        .eq('token', token)
        .eq('tenant_id', tenant)
        .single();

      if (!invite)                    return ok({ valid: false, reason: '招待リンクが見つかりません' });
      if (invite.status !== 'active') return ok({ valid: false, reason: 'この招待リンクはすでに使用済みです' });
      if (new Date() > new Date(invite.expires_at)) return ok({ valid: false, reason: '招待リンクの有効期限が切れています' });

      return ok({ valid: true });
    }

    // ── POST ─────────────────────────────────────────────
    if (event.httpMethod === 'POST') {
      const lineToken = event.headers.authorization?.replace('Bearer ', '');
      if (!lineToken) return err(401, '認証トークンがありません');

      const profile = await verifyLineToken(lineToken);
      const body = JSON.parse(event.body || '{}') as {
        action?: string;
        tenantId?: string;
        inviteToken?: string;
        displayName?: string;
        expiresInDays?: number;
      };

      // ── 招待リンク発行（管理者のみ）──
      if (body.action === 'create') {
        const { data: admin } = await supabase
          .from('users')
          .select('tenant_id, role')
          .eq('line_user_id', profile.userId)
          .eq('role', 'admin')
          .single();

        if (!admin) return err(403, '管理者権限が必要です');

        const days = body.expiresInDays ?? 7;
        const expiresAt = new Date(Date.now() + days * 86400_000).toISOString();
        const token = generateToken();

        const { error } = await supabase.from('invites').insert({
          tenant_id:  admin.tenant_id,
          token,
          created_by: profile.userId,
          expires_at: expiresAt,
        });
        if (error) throw error;

        return ok({ token, expiresAt });
      }

      // ── スタッフ登録 ──
      if (body.action === 'register') {
        const { tenantId, inviteToken, displayName } = body;
        if (!tenantId || !inviteToken || !displayName) {
          return err(400, 'tenantId, inviteToken, displayName は必須です');
        }

        // 招待トークン検証
        const { data: invite } = await supabase
          .from('invites')
          .select('id, status, expires_at')
          .eq('token', inviteToken)
          .eq('tenant_id', tenantId)
          .single();

        if (!invite || invite.status !== 'active') return err(400, '招待リンクが無効です');
        if (new Date() > new Date(invite.expires_at)) return err(400, '招待リンクの有効期限が切れています');

        // すでに登録済みチェック
        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('line_user_id', profile.userId)
          .single();
        if (existing) return err(409, 'すでに登録済みです');

        // テナントの既存ユーザー数を確認（初ユーザーはadmin）
        const { count } = await supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId);

        const role = (count ?? 0) === 0 ? 'admin' : 'staff';

        // ユーザー登録
        const { data: newUser, error: uErr } = await supabase
          .from('users')
          .insert({ line_user_id: profile.userId, tenant_id: tenantId, display_name: displayName, role })
          .select()
          .single();
        if (uErr) throw uErr;

        // 招待を使用済みに更新
        await supabase
          .from('invites')
          .update({ status: 'used', used_by: profile.userId, used_at: new Date().toISOString() })
          .eq('id', invite.id);

        return ok({ success: true, user: newUser });
      }

      return err(400, '不正な action です');
    }

    return err(405, 'Method not allowed');
  } catch (e) {
    return err(500, e instanceof Error ? e.message : 'Internal error');
  }
};
