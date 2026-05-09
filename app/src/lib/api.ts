import { getAccessToken } from './liff';
import type { User, TenantSettings, AttendanceType } from '../types';

const BASE = import.meta.env.VITE_API_BASE ?? '/api';

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  const data = await res.json() as { error?: string } & T;
  if (!res.ok) throw new Error(data.error ?? `Request failed: ${res.status}`);
  return data;
}

export async function getMe() {
  return req<{ user: User | null; tenantId: string | null }>('/user');
}

export async function getSettings() {
  return req<{ settings: TenantSettings }>('/settings');
}

export async function recordAttendance(
  type: AttendanceType,
  extra?: { notes?: string; departureTime?: string }
) {
  return req('/attendance', { method: 'POST', body: JSON.stringify({ type, ...extra }) });
}

export async function validateInvite(tenant: string, token: string) {
  const params = new URLSearchParams({ tenant, token });
  const res = await fetch(`${BASE}/invite?${params}`);
  const data = await res.json() as { valid: boolean; reason?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Invite validation failed');
  return data;
}

export async function registerViaInvite(tenantId: string, inviteToken: string, displayName: string) {
  return req('/invite', {
    method: 'POST',
    body: JSON.stringify({ action: 'register', tenantId, inviteToken, displayName }),
  });
}

export async function createInvite(expiresInDays = 7) {
  return req<{ token: string; expiresAt: string }>('/invite', {
    method: 'POST',
    body: JSON.stringify({ action: 'create', expiresInDays }),
  });
}

export async function listUsers() {
  return req<{ users: User[] }>('/user/list');
}

export async function updateUser(lineUserId: string, updates: { status?: string; role?: string }) {
  return req('/user', { method: 'PUT', body: JSON.stringify({ lineUserId, ...updates }) });
}

export async function updateSettings(settings: Partial<TenantSettings>) {
  return req('/settings', { method: 'POST', body: JSON.stringify({ settings }) });
}
