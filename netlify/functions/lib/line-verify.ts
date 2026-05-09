import type { LineProfile } from './types.js';

const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID!;

export async function verifyLineToken(idToken: string): Promise<LineProfile> {
  const body = new URLSearchParams({
    id_token: idToken,
    client_id: LINE_CHANNEL_ID,
  });

  const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = await res.json() as {
    sub?: string;
    name?: string;
    picture?: string;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || data.error) {
    throw new Error(data.error_description ?? data.error ?? 'LINEトークンが無効です');
  }

  return {
    userId: data.sub!,
    displayName: data.name ?? '',
    pictureUrl: data.picture,
  };
}
