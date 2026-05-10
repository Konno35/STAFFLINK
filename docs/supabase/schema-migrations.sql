-- StaffLink Migration: Phase 2 additions
-- Run this in Supabase SQL Editor on an EXISTING database.
-- (schema.sql is for fresh installs only)

-- -------------------------------------------------------
-- New Tables
-- -------------------------------------------------------

CREATE TABLE IF NOT EXISTS admin_accounts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supabase_uid TEXT UNIQUE NOT NULL,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS groups (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assignments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  work_location TEXT,
  manager_id    UUID REFERENCES admin_accounts(id),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_assignments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  line_user_id  TEXT NOT NULL,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  start_date    DATE,
  end_date      DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (line_user_id, assignment_id)
);

CREATE TABLE IF NOT EXISTS shifts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  line_user_id  TEXT NOT NULL,
  assignment_id UUID REFERENCES assignments(id),
  date          DATE NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  work_location TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance_corrections (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  attendance_log_id  UUID REFERENCES attendance_logs(id),
  requested_by       TEXT NOT NULL,
  reason             TEXT NOT NULL,
  correction_type    TEXT NOT NULL CHECK (correction_type IN ('time_change', 'type_change', 'delete')),
  requested_new_time TIMESTAMPTZ,
  status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by        TEXT,
  reviewed_at        TIMESTAMPTZ,
  review_notes       TEXT,
  requested_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- Alter existing tables
-- -------------------------------------------------------

-- users: グループ所属
ALTER TABLE users ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id);

-- invites: 招待時のデフォルト案件・グループ
ALTER TABLE invites ADD COLUMN IF NOT EXISTS default_group_id      UUID REFERENCES groups(id);
ALTER TABLE invites ADD COLUMN IF NOT EXISTS default_assignment_id UUID REFERENCES assignments(id);

-- attendance_logs: GPS・遅刻理由・残業情報
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS late_reason            TEXT;
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS estimated_arrival      TEXT;
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS overtime_reason        TEXT;
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS overtime_duration      TEXT;
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS gps_lat                DOUBLE PRECISION;
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS gps_lng                DOUBLE PRECISION;
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS gps_discrepancy_meters INTEGER;

-- -------------------------------------------------------
-- New Indexes
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_admin_accounts_tenant ON admin_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_groups_tenant          ON groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assignments_tenant     ON assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_assignments_user  ON user_assignments(line_user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_shifts_tenant_date     ON shifts(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_shifts_user            ON shifts(tenant_id, line_user_id);
CREATE INDEX IF NOT EXISTS idx_corrections_tenant     ON attendance_corrections(tenant_id, status);
