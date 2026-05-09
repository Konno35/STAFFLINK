import { supabase } from './db.js';

export interface AdminContext {
  uid: string;
  tenantId: string;
  email: string;
}

export async function verifyAdminJwt(authHeader: string | undefined): Promise<AdminContext> {
  const jwt = authHeader?.replace('Bearer ', '');
  if (!jwt) throw new Error('認証トークンがありません');

  const { data: { user }, error } = await supabase.auth.getUser(jwt);
  if (error || !user) throw new Error('認証エラー: ' + (error?.message ?? '不明'));

  const { data: admin, error: adminErr } = await supabase
    .from('admin_accounts')
    .select('tenant_id, email')
    .eq('supabase_uid', user.id)
    .single();

  if (adminErr || !admin) throw new Error('アクセス権限がありません');

  return { uid: user.id, tenantId: admin.tenant_id, email: admin.email };
}
