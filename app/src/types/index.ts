export type AttendanceType =
  | 'day_before_confirmation'
  | 'departure_check'
  | 'clock_in'
  | 'clock_out'
  | 'overtime_request'
  | 'late_notification';

export interface User {
  lineUserId: string;
  displayName: string;
  role: 'admin' | 'staff';
  status: 'active' | 'inactive';
  registeredAt: string;
}

export interface TenantSettings {
  feature_day_before_confirmation: string;
  feature_departure_check: string;
  feature_clock_in: string;
  feature_clock_out: string;
  feature_overtime_request: string;
  feature_late_notification: string;
  company_name: string;
  timezone: string;
  [key: string]: string;
}
