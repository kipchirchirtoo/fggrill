-- =====================================================
-- POS TERMINAL REGISTRATION (Phase 0 + 1 foundation)
-- Migration: 20260828_pos_terminals.sql
-- Description:
--   Introduces device-bound POS terminals so a computer is cryptographically
--   registered to ONE branch. Login later becomes branch-aware (the terminal
--   supplies the branch, the client never does), which is what allows the same
--   POS PIN to exist in different branches.
--
--   This migration is ADDITIVE ONLY. It does NOT touch users.pos_pin or its
--   existing global-unique index — that flip happens in a later phase, gated
--   behind terminal enrollment + a feature flag, so no live terminal is locked
--   out on deploy.
-- =====================================================

-- 1. Registered terminals — one row per physical POS computer.
CREATE TABLE IF NOT EXISTS pos_terminals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_code VARCHAR(64) UNIQUE NOT NULL,        -- stable human id, e.g. FG-BMT-POS-01
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  terminal_name VARCHAR(120) NOT NULL,              -- e.g. "Bomet Main Counter POS 01"
  terminal_type VARCHAR(40) NOT NULL,               -- cashier / restaurant / main_bar / executive_bar / non_consumables / choma_zone / ...
  status VARCHAR(24) NOT NULL DEFAULT 'pending_registration'
    CHECK (status IN ('pending_registration', 'active', 'suspended', 'revoked')),

  -- Device identity (set at registration; the private key never leaves the POS).
  device_public_key TEXT,                           -- raw Ed25519 public key, base64 (SPKI reconstructed server-side)
  device_fingerprint VARCHAR(128),                  -- stable per-install hardware/app fingerprint
  device_registered_at TIMESTAMPTZ,

  -- Telemetry / audit.
  registered_by UUID REFERENCES users(id),
  last_seen_at TIMESTAMPTZ,
  last_ip VARCHAR(64),
  app_version VARCHAR(40),
  os_version VARCHAR(80),

  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_terminals_branch ON pos_terminals(branch_id);
CREATE INDEX IF NOT EXISTS idx_pos_terminals_status ON pos_terminals(status);

-- 2. One-time enrollment codes — the installer types this to bind the device.
--    The code itself is NEVER stored: enrollment_code_hash = HMAC-SHA256(pepper, code),
--    so a DB leak does not reveal codes, and lookup stays O(1) (deterministic HMAC).
CREATE TABLE IF NOT EXISTS pos_terminal_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_id UUID NOT NULL REFERENCES pos_terminals(id) ON DELETE CASCADE,
  branch_id INTEGER NOT NULL REFERENCES branches(id),   -- denormalized for the branch guard
  enrollment_code_hash VARCHAR(128) NOT NULL,
  code_hint VARCHAR(12),                                 -- non-secret display hint (e.g. last 2 digits) for the admin
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,                                   -- single-use: NULL until consumed
  attempts INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_enrollment_code_hash ON pos_terminal_enrollments(enrollment_code_hash);
CREATE INDEX IF NOT EXISTS idx_pos_enrollments_terminal ON pos_terminal_enrollments(terminal_id);

-- 3. updated_at touch trigger (mirrors the convention used elsewhere).
CREATE OR REPLACE FUNCTION touch_pos_terminals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_pos_terminals_updated_at ON pos_terminals;
CREATE TRIGGER trg_touch_pos_terminals_updated_at
BEFORE UPDATE ON pos_terminals
FOR EACH ROW
EXECUTE FUNCTION touch_pos_terminals_updated_at();

COMMENT ON TABLE pos_terminals IS 'Device-bound POS computers, each registered to exactly one branch. The branch a terminal supplies is server-authoritative.';
COMMENT ON TABLE pos_terminal_enrollments IS 'One-time, short-lived enrollment codes (stored as a peppered HMAC, never plaintext) that bind a device to a pending terminal.';
