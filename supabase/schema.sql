-- StaffLink Database Schema
-- Run this in Supabase SQL Editor to initialize the database.
-- For existing DB: run schema-migrations.sql for ALTER statements only.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------
-- Tenants
-- -------------------------------------------------------
CREATE TABLE tenants (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT    NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- Admin Accounts (Google OAuth via Supabase Auth)
-- -------------------------------------------------------
CREATE TABLE admin_accounts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supabase_uid TEXT UNIQUE NOT NULL,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- Groups (所属グループ)
-- -------------------------------------------------------
CREATE TABLE groups (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- Users (one entry per LINE user per tenant)
-- -------------------------------------------------------
CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  line_user_id TEXT NOT NULL UNIQUE,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  group_id     UUID REFERENCES groups(id),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- Assignments (案件)
-- -------------------------------------------------------
CREATE TABLE assignments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  work_location TEXT,
  manager_id    UUID REFERENCES admin_accounts(id),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- User ↔ Assignment (many-to-many)
-- -------------------------------------------------------
CREATE TABLE user_assignments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  line_user_id  TEXT NOT NULL,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  start_date    DATE,
  end_date      DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (line_user_id, assignment_id)
);

-- -------------------------------------------------------
-- Invites
-- -------------------------------------------------------
CREATE TABLE invites (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token                TEXT NOT NULL UNIQUE,
  created_by           TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at           TIMESTAMPTZ NOT NULL,
  used_by              TEXT,
  used_at              TIMESTAMPTZ,
  status               TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'revoked')),
  default_group_id     UUID REFERENCES groups(id),
  default_assignment_id UUID REFERENCES assignments(id)
);

-- -------------------------------------------------------
-- Attendance Logs
-- -------------------------------------------------------
CREATE TABLE attendance_logs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  line_user_id          TEXT NOT NULL,
  type                  TEXT NOT NULL,
  timestamp             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date                  DATE NOT NULL,
  notes                 TEXT,
  departure_time        TEXT,
  late_reason           TEXT,
  estimated_arrival     TEXT,
  overtime_reason       TEXT,
  overtime_duration     TEXT,
  gps_lat               DOUBLE PRECISION,
  gps_lng               DOUBLE PRECISION,
  gps_discrepancy_meters INTEGER
);

-- -------------------------------------------------------
-- Shifts (シフト)
-- -------------------------------------------------------
CREATE TABLE shifts (
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

-- -------------------------------------------------------
-- Attendance Corrections (修正依頼)
-- -------------------------------------------------------
CREATE TABLE attendance_corrections (
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
-- Tenant Settings (key-value per tenant)
-- -------------------------------------------------------
CREATE TABLE tenant_settings (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key       TEXT NOT NULL,
  value     TEXT NOT NULL,
  PRIMARY KEY (tenant_id, key)
);

-- -------------------------------------------------------
-- Indexes
-- -------------------------------------------------------
CREATE INDEX idx_users_line_user_id      ON users(line_user_id);
CREATE INDEX idx_users_tenant_id         ON users(tenant_id);
CREATE INDEX idx_invites_token           ON invites(token);
CREATE INDEX idx_attendance_tenant_line  ON attendance_logs(tenant_id, line_user_id);
CREATE INDEX idx_attendance_date         ON attendance_logs(tenant_id, date);
CREATE INDEX idx_settings_tenant         ON tenant_settings(tenant_id);
CREATE INDEX idx_admin_accounts_tenant   ON admin_accounts(tenant_id);
CREATE INDEX idx_groups_tenant           ON groups(tenant_id);
CREATE INDEX idx_assignments_tenant      ON assignments(tenant_id);
CREATE INDEX idx_user_assignments_user   ON user_assignments(line_user_id, tenant_id);
CREATE INDEX idx_shifts_tenant_date      ON shifts(tenant_id, date);
CREATE INDEX idx_shifts_user             ON shifts(tenant_id, line_user_id);
CREATE INDEX idx_corrections_tenant      ON attendance_corrections(tenant_id, status);
