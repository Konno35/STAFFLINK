import { supabase } from './supabase';

const BASE = import.meta.env.VITE_API_BASE ?? '/api';

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json() as { error?: string } & T;
  if (!res.ok) throw new Error(data.error ?? `Request failed: ${res.status}`);
  return data;
}

// Auth
export async function getMe() {
  return req<{ tenantId: string; email: string }>('/admin/me');
}

// Attendance
export async function getAdminAttendance(params: { date?: string; month?: string; tenantId?: string }) {
  const q = new URLSearchParams(params as Record<string, string>);
  return req<{ logs: AttendanceLog[] }>(`/admin/attendance?${q}`);
}

export async function updateAttendanceLog(id: string, updates: Partial<AttendanceLog>) {
  return req(`/admin/attendance`, { method: 'PUT', body: JSON.stringify({ id, ...updates }) });
}

// Staff
export async function getAdminStaff() {
  return req<{ users: StaffUser[] }>('/admin/staff');
}

export async function updateStaff(lineUserId: string, updates: { status?: string; role?: string; groupId?: string }) {
  return req('/admin/staff', { method: 'PUT', body: JSON.stringify({ lineUserId, ...updates }) });
}

// Groups
export async function getGroups() {
  return req<{ groups: Group[] }>('/admin/groups');
}

export async function createGroup(name: string) {
  return req<{ group: Group }>('/admin/groups', { method: 'POST', body: JSON.stringify({ name }) });
}

export async function updateGroup(id: string, name: string) {
  return req('/admin/groups', { method: 'PUT', body: JSON.stringify({ id, name }) });
}

export async function deleteGroup(id: string) {
  return req('/admin/groups', { method: 'DELETE', body: JSON.stringify({ id }) });
}

// Assignments
export async function getAssignments() {
  return req<{ assignments: Assignment[] }>('/admin/assignments');
}

export async function createAssignment(data: { name: string; workLocation?: string; managerId?: string }) {
  return req<{ assignment: Assignment }>('/admin/assignments', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateAssignment(id: string, data: { name?: string; workLocation?: string; managerId?: string; status?: string }) {
  return req('/admin/assignments', { method: 'PUT', body: JSON.stringify({ id, ...data }) });
}

export async function deleteAssignment(id: string) {
  return req('/admin/assignments', { method: 'DELETE', body: JSON.stringify({ id }) });
}

export async function getUserAssignments(lineUserId: string) {
  return req<{ assignments: Assignment[] }>(`/admin/assignments?lineUserId=${lineUserId}`);
}

export async function addUserAssignment(lineUserId: string, assignmentId: string) {
  return req('/admin/assignments', { method: 'POST', body: JSON.stringify({ action: 'assign', lineUserId, assignmentId }) });
}

export async function removeUserAssignment(lineUserId: string, assignmentId: string) {
  return req('/admin/assignments', { method: 'DELETE', body: JSON.stringify({ lineUserId, assignmentId }) });
}

// Shifts
export async function getShifts(params: { weekStart?: string; lineUserId?: string }) {
  const q = new URLSearchParams(params as Record<string, string>);
  return req<{ shifts: Shift[] }>(`/admin/shifts?${q}`);
}

export async function createShift(data: Omit<Shift, 'id' | 'tenantId' | 'createdAt'>) {
  return req<{ shift: Shift }>('/admin/shifts', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateShift(id: string, data: Partial<Shift>) {
  return req('/admin/shifts', { method: 'PUT', body: JSON.stringify({ id, ...data }) });
}

export async function deleteShift(id: string) {
  return req('/admin/shifts', { method: 'DELETE', body: JSON.stringify({ id }) });
}

// Corrections
export async function getCorrections(status?: string) {
  const q = status ? `?status=${status}` : '';
  return req<{ corrections: Correction[] }>(`/admin/corrections${q}`);
}

export async function reviewCorrection(id: string, status: 'approved' | 'rejected', reviewNotes?: string) {
  return req('/admin/corrections', { method: 'PUT', body: JSON.stringify({ id, status, reviewNotes }) });
}

// Invite
export async function createAdminInvite(opts: { expiresInDays?: number; groupId?: string; assignmentId?: string }) {
  return req<{ token: string; expiresAt: string }>('/admin/invite', { method: 'POST', body: JSON.stringify(opts) });
}

// Settings
export async function getAdminSettings() {
  return req<{ settings: Record<string, string> }>('/admin/settings');
}

export async function updateAdminSettings(settings: Record<string, string>) {
  return req('/admin/settings', { method: 'POST', body: JSON.stringify({ settings }) });
}

export async function regenerateApiKey() {
  return req<{ apiKey: string }>('/admin/settings', { method: 'POST', body: JSON.stringify({ action: 'regenerate_api_key' }) });
}

// Reports
export async function downloadCsv(params: { from: string; to: string; assignmentId?: string; groupId?: string; lineUserId?: string }) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const q = new URLSearchParams(params as Record<string, string>);
  const res = await fetch(`${BASE}/admin/reports?${q}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error('CSV生成に失敗しました');
  return res.blob();
}

// Types
export interface AttendanceLog {
  id: string;
  tenantId: string;
  lineUserId: string;
  type: string;
  timestamp: string;
  date: string;
  notes?: string;
  departureTime?: string;
  lateReason?: string;
  estimatedArrival?: string;
  overtimeReason?: string;
  overtimeDuration?: string;
  gpsLat?: number;
  gpsLng?: number;
  gpsDiscrepancyMeters?: number;
  displayName?: string;
}

export interface StaffUser {
  lineUserId: string;
  displayName: string;
  role: 'admin' | 'staff';
  status: 'active' | 'inactive';
  registeredAt: string;
  groupId?: string;
  groupName?: string;
  assignments?: Assignment[];
}

export interface Group {
  id: string;
  name: string;
}

export interface Assignment {
  id: string;
  name: string;
  workLocation?: string;
  managerId?: string;
  managerEmail?: string;
  status: 'active' | 'inactive';
}

export interface Shift {
  id: string;
  tenantId: string;
  lineUserId: string;
  displayName?: string;
  assignmentId?: string;
  assignmentName?: string;
  date: string;
  startTime: string;
  endTime: string;
  workLocation?: string;
  notes?: string;
  createdAt?: string;
}

export interface Correction {
  id: string;
  attendanceLogId?: string;
  requestedBy: string;
  displayName?: string;
  reason: string;
  correctionType: 'time_change' | 'type_change' | 'delete';
  requestedNewTime?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  requestedAt: string;
  logType?: string;
  logTimestamp?: string;
}
