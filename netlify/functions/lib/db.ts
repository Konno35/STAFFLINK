import { createClient } from '@supabase/supabase-js';
import { WebSocket } from 'ws';

// Node.js 20 以下では標準 WebSocket がないため ws でポリフィル
if (!globalThis.WebSocket) {
  (globalThis as unknown as Record<string, unknown>).WebSocket = WebSocket;
}

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/** Asia/Tokyo の今日の日付を YYYY-MM-DD 形式で返す */
export function todayJst(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
}

/** ランダムなトークン文字列を生成する */
export function generateToken(): string {
  return crypto.randomUUID();
}
