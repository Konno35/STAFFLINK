-- StaffLink Database Schema
-- Run this in Supabase SQL Editor to initialize the database.

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
-- Users (one entry per LINE user per tenant)
-- -------------------------------------------------------
CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  line_user_id TEXT NOT NULL UNIQUE,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- Invites
-- -------------------------------------------------------
CREATE TABLE invites (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_by    TEXT,
  used_at    TIMESTAMPTZ,
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'revoked'))
);

-- -------------------------------------------------------
-- Attendance Logs
-- -------------------------------------------------------
CREATE TABLE attendance_logs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  line_user_id   TEXT NOT NULL,
  type           TEXT NOT NULL,
  timestamp      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date           DATE NOT NULL,
  notes          TEXT,
  departure_time TEXT
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
CREATE INDEX idx_users_line_user_id    ON users(line_user_id);
CREATE INDEX idx_users_tenant_id       ON users(tenant_id);
CREATE INDEX idx_invites_token         ON invites(token);
CREATE INDEX idx_attendance_tenant_line ON attendance_logs(tenant_id, line_user_id);
CREATE INDEX idx_attendance_date        ON attendance_logs(tenant_id, date);
CREATE INDEX idx_settings_tenant        ON tenant_settings(tenant_id);
