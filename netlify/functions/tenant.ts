import type { Handler, HandlerEvent } from '@netlify/functions';
import { supabase, generateToken } from './lib/db.js';

// 開発者専用エンドポイント: ADMIN_SECRET ヘッダーで保護
// Usage: POST /api/tenant  { "name": "株式会社サンプル" }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
  if (event.httpMethod !== 'POST') return err(405, 'Method not allowed');

  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || event.headers['x-admin-secret'] !== adminSecret) {
    return err(401, 'Unauthorized');
  }

  try {
    const { name } = JSON.parse(event.body || '{}') as { name?: string };
    if (!name) return err(400, 'name は必須です');

    // テナント作成
    const { data: tenant, error: tErr } = await supabase
      .from('tenants')
      .insert({ name })
      .select()
      .single();
    if (tErr) throw tErr;

    // デフォルト設定を挿入
    await supabase.from('tenant_settings').insert(
      DEFAULT_SETTINGS.map(s => ({ tenant_id: tenant.id, ...s }))
    );

    // 最初の招待トークンを生成（7日有効）
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 86400_000).toISOString();
    await supabase.from('invites').insert({
      tenant_id:  tenant.id,
      token,
      created_by: 'developer',
      expires_at: expiresAt,
    });

    const liffId = process.env.VITE_LIFF_ID ?? 'YOUR_LIFF_ID';
    const inviteUrl = `https://miniapp.line.me/${liffId}?token=${token}&tenant=${tenant.id}`;

    return ok({ tenantId: tenant.id, tenantName: name, inviteUrl, inviteExpiresAt: expiresAt });
  } catch (e) {
    return err(500, e instanceof Error ? e.message : 'Internal error');
  }
};
