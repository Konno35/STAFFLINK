import type { LineProfile } from './types.js';

const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID!;

export async function verifyLineToken(accessToken: string): Promise<LineProfile> {
  const verifyRes = await fetch(
    `https://api.line.me/oauth2/v2.1/verify?access_token=${encodeURIComponent(accessToken)}`
  );

  if (!verifyRes.ok) throw new Error('LINEトークンが無効です');

  const verify = (await verifyRes.json()) as { client_id: string; expires_in: number };

  if (verify.client_id !== LINE_CHANNEL_ID) {
    throw new Error('トークンのチャンネルが一致しません');
  }
  if (verify.expires_in <= 0) throw new Error('LINEトークンの有効期限が切れています');

  const profileRes = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!profileRes.ok) throw new Error('LINEプロフィールの取得に失敗しました');

  return (await profileRes.json()) as LineProfile;
}
