-- ============================================================
-- Migration 0005d: Maintenance, Housekeeping extended, System config,
--                  Fleet, Cashier extended, Finance daily, Audit/Compliance
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- MAINTENANCE MODULE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.maintenance_assets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     INTEGER NOT NULL REFERENCES public.branches(id),
  asset_code    TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  category      TEXT,
  location      TEXT,
  purchase_date DATE,
  purchase_cost NUMERIC(14,2) DEFAULT 0,
  status        TEXT DEFAULT 'active'
    CHECK (status IN ('active','under_maintenance','decommissioned','disposed')),
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.maintenance_asset_history (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id   UUID NOT NULL REFERENCES public.maintenance_assets(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  notes      TEXT,
  recorded_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.maintenance_contractors (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    INTEGER REFERENCES public.branches(id),
  name         TEXT NOT NULL,
  company      TEXT,
  phone        TEXT,
  email        TEXT,
  speciality   TEXT,
  status       TEXT DEFAULT 'active',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.maintenance_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER NOT NULL REFERENCES public.branches(id),
  request_number  TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT,
  location        TEXT,
  asset_id        UUID REFERENCES public.maintenance_assets(id),
  priority        TEXT DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high','urgent')),
  status          TEXT DEFAULT 'open'
    CHECK (status IN ('open','assigned','in_progress','completed','cancelled','on_hold')),
  requested_by    UUID REFERENCES public.users(id),
  assigned_to     UUID REFERENCES public.users(id),
  contractor_id   UUID REFERENCES public.maintenance_contractors(id),
  estimated_cost  NUMERIC(14,2) DEFAULT 0,
  actual_cost     NUMERIC(14,2) DEFAULT 0,
  due_date        DATE,
  completed_at    TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_maint_req_branch ON public.maintenance_requests(branch_id, status);

CREATE TABLE IF NOT EXISTS public.maintenance_work_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER NOT NULL REFERENCES public.branches(id),
  wo_number       TEXT UNIQUE NOT NULL,
  request_id      UUID REFERENCES public.maintenance_requests(id),
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT DEFAULT 'open'
    CHECK (status IN ('open','in_progress','completed','cancelled')),
  assigned_to     UUID REFERENCES public.users(id),
  contractor_id   UUID REFERENCES public.maintenance_contractors(id),
  estimated_cost  NUMERIC(14,2) DEFAULT 0,
  actual_cost     NUMERIC(14,2) DEFAULT 0,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.maintenance_work_order_tasks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_id      UUID NOT NULL REFERENCES public.maintenance_work_orders(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  status     TEXT DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.maintenance_work_order_attachments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_id      UUID NOT NULL REFERENCES public.maintenance_work_orders(id) ON DELETE CASCADE,
  file_url   TEXT NOT NULL,
  file_name  TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.maintenance_issues (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   INTEGER REFERENCES public.branches(id),
  request_id  UUID REFERENCES public.maintenance_requests(id),
  issue_type  TEXT NOT NULL,
  description TEXT,
  severity    TEXT DEFAULT 'medium',
  status      TEXT DEFAULT 'open',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.maintenance_spare_parts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     INTEGER REFERENCES public.branches(id),
  part_code     TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  unit          TEXT DEFAULT 'piece',
  current_stock NUMERIC(14,3) DEFAULT 0,
  min_stock     NUMERIC(14,3) DEFAULT 0,
  unit_cost     NUMERIC(14,4) DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.maintenance_parts_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   INTEGER REFERENCES public.branches(id),
  part_id     UUID NOT NULL REFERENCES public.maintenance_spare_parts(id),
  wo_id       UUID REFERENCES public.maintenance_work_orders(id),
  txn_type    TEXT NOT NULL,
  quantity    NUMERIC(14,3) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.maintenance_part_usage (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_id       UUID REFERENCES public.maintenance_work_orders(id),
  part_id     UUID REFERENCES public.maintenance_spare_parts(id),
  quantity    NUMERIC(14,3) NOT NULL,
  used_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.maintenance_preventive_schedules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     INTEGER REFERENCES public.branches(id),
  asset_id      UUID REFERENCES public.maintenance_assets(id),
  title         TEXT NOT NULL,
  frequency     TEXT NOT NULL, -- daily | weekly | monthly | quarterly | annual
  next_due_date DATE,
  last_done_at  TIMESTAMPTZ,
  status        TEXT DEFAULT 'active',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.maintenance_task_history (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.maintenance_requests(id),
  action     TEXT NOT NULL,
  actor_id   UUID REFERENCES public.users(id),
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.maintenance_tools (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   INTEGER REFERENCES public.branches(id),
  name        TEXT NOT NULL,
  category    TEXT,
  serial_no   TEXT,
  status      TEXT DEFAULT 'available',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.maintenance_tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  UUID REFERENCES public.maintenance_requests(id),
  title       TEXT NOT NULL,
  status      TEXT DEFAULT 'pending',
  assigned_to UUID REFERENCES public.users(id),
  due_date    DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.maintenance_meter_readings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     INTEGER REFERENCES public.branches(id),
  asset_id      UUID REFERENCES public.maintenance_assets(id),
  reading_type  TEXT NOT NULL,
  reading_value NUMERIC(14,3) NOT NULL,
  reading_date  DATE DEFAULT CURRENT_DATE,
  recorded_by   UUID REFERENCES public.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- HOUSEKEEPING EXTENDED (hk_* tables)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hk_tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    INTEGER REFERENCES public.branches(id),
  room_id      UUID REFERENCES public.rooms(id),
  room_number  TEXT,
  task_type    TEXT DEFAULT 'cleaning',
  status       TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','cancelled','skipped')),
  priority     TEXT DEFAULT 'normal',
  assigned_to  UUID REFERENCES public.users(id),
  completed_at TIMESTAMPTZ,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hk_task_checklists (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL REFERENCES public.hk_tasks(id) ON DELETE CASCADE,
  item       TEXT NOT NULL,
  completed  BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hk_inspections (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id          INTEGER REFERENCES public.branches(id),
  room_id            UUID REFERENCES public.rooms(id),
  task_id            UUID REFERENCES public.hk_tasks(id),
  inspector_id       UUID REFERENCES public.users(id),
  cleanliness_score  NUMERIC(5,2),
  bathroom_score     NUMERIC(5,2),
  overall_score      NUMERIC(5,2),
  result             TEXT DEFAULT 'pass' CHECK (result IN ('pass','fail','needs_attention')),
  notes              TEXT,
  inspected_at       TIMESTAMPTZ DEFAULT NOW(),
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hk_linen_types (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id  INTEGER REFERENCES public.branches(id),
  name       TEXT NOT NULL,
  category   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hk_linen_inventory (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER NOT NULL REFERENCES public.branches(id),
  linen_type_id   UUID REFERENCES public.hk_linen_types(id),
  status          TEXT DEFAULT 'clean'
    CHECK (status IN ('clean','dirty','in_wash','damaged','retired')),
  use_count       INTEGER DEFAULT 0,
  current_room_id UUID REFERENCES public.rooms(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hk_linen_transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linen_id     UUID REFERENCES public.hk_linen_inventory(id),
  txn_type     TEXT NOT NULL,
  room_id      UUID REFERENCES public.rooms(id),
  performed_by UUID REFERENCES public.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hk_lost_found (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER REFERENCES public.branches(id),
  item_name       TEXT NOT NULL,
  description     TEXT,
  found_location  TEXT,
  found_date      DATE DEFAULT CURRENT_DATE,
  found_by        UUID REFERENCES public.users(id),
  estimated_value NUMERIC(14,2) DEFAULT 0,
  status          TEXT DEFAULT 'holding'
    CHECK (status IN ('holding','returned','donated','disposed','claimed')),
  guest_id        UUID REFERENCES public.guests(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hk_maintenance_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    INTEGER REFERENCES public.branches(id),
  room_id      UUID REFERENCES public.rooms(id),
  reported_by  UUID REFERENCES public.users(id),
  category     TEXT NOT NULL,
  description  TEXT,
  priority     TEXT DEFAULT 'normal',
  status       TEXT DEFAULT 'open',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hk_guest_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    INTEGER REFERENCES public.branches(id),
  room_id      UUID REFERENCES public.rooms(id),
  guest_id     UUID REFERENCES public.guests(id),
  request_type TEXT NOT NULL,
  description  TEXT,
  status       TEXT DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hk_guest_service_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    INTEGER REFERENCES public.branches(id),
  guest_id     UUID REFERENCES public.guests(id),
  service_type TEXT NOT NULL,
  notes        TEXT,
  status       TEXT DEFAULT 'pending',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hk_shift_definitions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id  INTEGER REFERENCES public.branches(id),
  name       TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL,
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hk_staff_schedules (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id   UUID REFERENCES public.users(id),
  branch_id  INTEGER REFERENCES public.branches(id),
  shift_id   UUID REFERENCES public.hk_shift_definitions(id),
  schedule_date DATE NOT NULL,
  check_in_time  TIMESTAMPTZ,
  break_start_time TIMESTAMPTZ,
  status     TEXT DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hk_leave_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     UUID REFERENCES public.users(id),
  branch_id    INTEGER REFERENCES public.branches(id),
  leave_type   TEXT NOT NULL,
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  status       TEXT DEFAULT 'pending',
  approved_by  UUID REFERENCES public.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hk_shift_swaps (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id   UUID REFERENCES public.users(id),
  requested_id   UUID REFERENCES public.users(id),
  schedule_id    UUID REFERENCES public.hk_staff_schedules(id),
  status         TEXT DEFAULT 'pending',
  approved_by    UUID REFERENCES public.users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hk_daily_metrics (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id         INTEGER REFERENCES public.branches(id),
  metric_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  tasks_completed   INTEGER DEFAULT 0,
  inspections_passed INTEGER DEFAULT 0,
  avg_quality_score NUMERIC(5,2),
  occupancy_rate    NUMERIC(5,2),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hk_staff_daily_metrics (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id          UUID REFERENCES public.users(id),
  branch_id         INTEGER REFERENCES public.branches(id),
  metric_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  tasks_completed   INTEGER DEFAULT 0,
  avg_quality_score NUMERIC(5,2),
  points_earned     INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hk_quality_alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   INTEGER REFERENCES public.branches(id),
  room_id     UUID REFERENCES public.rooms(id),
  alert_type  TEXT NOT NULL,
  severity    TEXT DEFAULT 'warning',
  message     TEXT,
  status      TEXT DEFAULT 'open',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hk_room_status_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      UUID REFERENCES public.rooms(id),
  old_status   TEXT,
  new_status   TEXT NOT NULL,
  changed_by   UUID REFERENCES public.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hk_supply_predictions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    INTEGER REFERENCES public.branches(id),
  item_name    TEXT NOT NULL,
  predicted_qty NUMERIC(14,3) DEFAULT 0,
  prediction_date DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hk_demand_forecasts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     INTEGER REFERENCES public.branches(id),
  forecast_date DATE NOT NULL,
  occupancy_rate NUMERIC(5,2),
  task_load     INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hk_staff_predictions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     INTEGER REFERENCES public.branches(id),
  prediction_date DATE NOT NULL,
  staff_needed  INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hk_achievements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  points      INTEGER DEFAULT 0,
  badge_icon  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hk_staff_achievements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id       UUID REFERENCES public.users(id),
  achievement_id UUID REFERENCES public.hk_achievements(id),
  earned_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hk_staff_points (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id   UUID REFERENCES public.users(id),
  points     INTEGER DEFAULT 0,
  reason     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hk_team_challenges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   INTEGER REFERENCES public.branches(id),
  title       TEXT NOT NULL,
  description TEXT,
  start_date  DATE,
  end_date    DATE,
  status      TEXT DEFAULT 'active',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hk_sustainability_metrics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   INTEGER REFERENCES public.branches(id),
  metric_type TEXT NOT NULL,
  value       NUMERIC(14,4),
  unit        TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hk_sustainability_daily (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   INTEGER REFERENCES public.branches(id),
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  water_usage NUMERIC(14,2),
  energy_usage NUMERIC(14,2),
  waste_kg    NUMERIC(14,2),
  linen_reuses INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hk_staff_locations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id   UUID REFERENCES public.users(id),
  floor      TEXT,
  zone       TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hk_notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     UUID REFERENCES public.users(id),
  branch_id    INTEGER REFERENCES public.branches(id),
  title        TEXT NOT NULL,
  body         TEXT,
  is_read      BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hk_booking_sync (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id),
  room_id    UUID REFERENCES public.rooms(id),
  synced_at  TIMESTAMPTZ DEFAULT NOW(),
  status     TEXT DEFAULT 'synced'
);

CREATE TABLE IF NOT EXISTS public.hk_green_guests (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id   UUID REFERENCES public.guests(id),
  opt_in_at  TIMESTAMPTZ DEFAULT NOW(),
  preferences JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.hk_guest_preferences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id    UUID REFERENCES public.guests(id),
  preference  TEXT NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- SYSTEM CONFIG
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.simple_app_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   INTEGER REFERENCES public.branches(id),
  key         TEXT NOT NULL,
  value       TEXT,
  data_type   TEXT DEFAULT 'string',
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (branch_id, key)
);

CREATE TABLE IF NOT EXISTS public.system_config_values (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT UNIQUE NOT NULL,
  value       TEXT,
  description TEXT,
  updated_by  UUID REFERENCES public.users(id),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_config_history (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id  UUID REFERENCES public.system_config_values(id),
  old_value  TEXT,
  new_value  TEXT,
  changed_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key   TEXT UNIQUE NOT NULL,
  enabled    BOOLEAN DEFAULT FALSE,
  branch_id  INTEGER REFERENCES public.branches(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.security_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   INTEGER REFERENCES public.branches(id),
  key         TEXT NOT NULL,
  value       TEXT,
  UNIQUE (branch_id, key)
);

CREATE TABLE IF NOT EXISTS public.security_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   INTEGER REFERENCES public.branches(id),
  event_type  TEXT NOT NULL,
  actor_id    UUID REFERENCES public.users(id),
  ip_address  TEXT,
  user_agent  TEXT,
  details     JSONB DEFAULT '{}',
  severity    TEXT DEFAULT 'info',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.blocked_ips (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address  TEXT UNIQUE NOT NULL,
  reason      TEXT,
  blocked_by  UUID REFERENCES public.users(id),
  blocked_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ
);

-- ─────────────────────────────────────────────────────────────
-- FLEET / VEHICLES / DISPATCH SUPPORT
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vehicles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id           INTEGER REFERENCES public.branches(id),
  registration_number TEXT UNIQUE NOT NULL,
  make                TEXT,
  model               TEXT,
  type                TEXT,
  capacity_kg         NUMERIC(14,2),
  status              TEXT DEFAULT 'active'
    CHECK (status IN ('active','maintenance','retired')),
  insurance_expiry    DATE,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.drivers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER REFERENCES public.branches(id),
  name            TEXT NOT NULL,
  phone           TEXT,
  license_number  TEXT,
  license_expiry  DATE,
  status          TEXT DEFAULT 'active',
  basic_salary    NUMERIC(14,2) DEFAULT 0,
  bank_name       TEXT,
  account_number  TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vehicle_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id  UUID REFERENCES public.vehicles(id),
  driver_id   UUID REFERENCES public.drivers(id),
  branch_id   INTEGER REFERENCES public.branches(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  returned_at TIMESTAMPTZ,
  status      TEXT DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS public.dispatch_tracking (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id  UUID REFERENCES public.dispatches(id),
  status       TEXT NOT NULL,
  location     TEXT,
  notes        TEXT,
  updated_by   UUID REFERENCES public.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- CASHIER EXTENDED
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cashier_logbooks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     INTEGER NOT NULL REFERENCES public.branches(id),
  shift_id      UUID REFERENCES public.cashier_shifts(id),
  cashier_id    UUID REFERENCES public.users(id),
  logbook_number TEXT UNIQUE NOT NULL,
  period_start  TIMESTAMPTZ NOT NULL,
  period_end    TIMESTAMPTZ,
  opening_float NUMERIC(14,2) DEFAULT 0,
  closing_float NUMERIC(14,2) DEFAULT 0,
  total_sales   NUMERIC(14,2) DEFAULT 0,
  status        TEXT DEFAULT 'open'
    CHECK (status IN ('open','submitted','approved','closed')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cashier_logbook_lines (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logbook_id  UUID NOT NULL REFERENCES public.cashier_logbooks(id) ON DELETE CASCADE,
  line_type   TEXT NOT NULL, -- cash | mpesa | card | credit
  description TEXT,
  amount      NUMERIC(14,2) DEFAULT 0,
  reference   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cashier_shift_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id   UUID REFERENCES public.cashier_shifts(id),
  action     TEXT NOT NULL,
  actor_id   UUID REFERENCES public.users(id),
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.float_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   INTEGER REFERENCES public.branches(id),
  shift_id    UUID REFERENCES public.cashier_shifts(id),
  cashier_id  UUID REFERENCES public.users(id),
  action      TEXT NOT NULL CHECK (action IN ('float_in','float_out','opening','closing')),
  amount      NUMERIC(14,2) NOT NULL,
  reference   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.petty_cash_transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    INTEGER NOT NULL REFERENCES public.branches(id),
  txn_number   TEXT UNIQUE NOT NULL,
  txn_type     TEXT NOT NULL CHECK (txn_type IN ('income','expense')),
  description  TEXT NOT NULL,
  amount       NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  status       TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','paid')),
  requested_by UUID REFERENCES public.users(id),
  approved_by  UUID REFERENCES public.users(id),
  paid_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.petty_cash_ledger (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   INTEGER REFERENCES public.branches(id),
  txn_id      UUID REFERENCES public.petty_cash_transactions(id),
  debit       NUMERIC(14,2) DEFAULT 0,
  credit      NUMERIC(14,2) DEFAULT 0,
  balance     NUMERIC(14,2) DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- FINANCE DAILY LOGS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.finance_daily_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     INTEGER NOT NULL REFERENCES public.branches(id),
  log_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  log_number    TEXT UNIQUE NOT NULL,
  status        TEXT DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','approved','rejected')),
  total_revenue NUMERIC(14,2) DEFAULT 0,
  total_expenses NUMERIC(14,2) DEFAULT 0,
  net_amount    NUMERIC(14,2) DEFAULT 0,
  prepared_by   UUID REFERENCES public.users(id),
  approved_by   UUID REFERENCES public.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.finance_daily_log_lines (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id       UUID NOT NULL REFERENCES public.finance_daily_logs(id) ON DELETE CASCADE,
  category     TEXT NOT NULL,
  description  TEXT,
  amount       NUMERIC(14,2) DEFAULT 0,
  line_type    TEXT NOT NULL CHECK (line_type IN ('revenue','expense')),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.financial_daily_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER NOT NULL REFERENCES public.branches(id),
  snapshot_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  total_revenue   NUMERIC(14,2) DEFAULT 0,
  total_expenses  NUMERIC(14,2) DEFAULT 0,
  net_profit      NUMERIC(14,2) DEFAULT 0,
  room_revenue    NUMERIC(14,2) DEFAULT 0,
  fnb_revenue     NUMERIC(14,2) DEFAULT 0,
  other_revenue   NUMERIC(14,2) DEFAULT 0,
  occupancy_rate  NUMERIC(5,2) DEFAULT 0,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (branch_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS public.financial_workspace_submissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     INTEGER REFERENCES public.branches(id),
  period_from   DATE NOT NULL,
  period_to     DATE NOT NULL,
  submitted_by  UUID REFERENCES public.users(id),
  status        TEXT DEFAULT 'submitted',
  data          JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- revenue_targets (used by revenue-oversight.controller)
CREATE TABLE IF NOT EXISTS public.revenue_targets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    INTEGER NOT NULL REFERENCES public.branches(id),
  target_date  DATE NOT NULL,
  target_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  category     TEXT DEFAULT 'overall',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (branch_id, target_date, category)
);

-- ─────────────────────────────────────────────────────────────
-- AUDIT / COMPLIANCE TABLES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_exceptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   INTEGER REFERENCES public.branches(id),
  exception_type TEXT NOT NULL,
  description TEXT,
  severity    TEXT DEFAULT 'warning',
  status      TEXT DEFAULT 'open',
  created_by  UUID REFERENCES public.users(id),
  resolved_by UUID REFERENCES public.users(id),
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_findings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   INTEGER REFERENCES public.branches(id),
  finding_type TEXT NOT NULL,
  description TEXT,
  severity    TEXT DEFAULT 'medium',
  status      TEXT DEFAULT 'open',
  auditor_id  UUID REFERENCES public.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_night_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   INTEGER REFERENCES public.branches(id),
  auditor_id  UUID REFERENCES public.users(id),
  session_date DATE DEFAULT CURRENT_DATE,
  status      TEXT DEFAULT 'active',
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   INTEGER REFERENCES public.branches(id),
  title       TEXT NOT NULL,
  audit_type  TEXT,
  planned_date DATE,
  status      TEXT DEFAULT 'planned',
  created_by  UUID REFERENCES public.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_config_consumption (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   INTEGER REFERENCES public.branches(id),
  config_key  TEXT NOT NULL,
  consumed_at TIMESTAMPTZ DEFAULT NOW(),
  actor_id    UUID REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.auditor_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   INTEGER REFERENCES public.branches(id),
  auditor_id  UUID REFERENCES public.users(id),
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  decision    TEXT CHECK (decision IN ('approved','rejected','returned')),
  notes       TEXT,
  reviewed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.auditor_watchlist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   INTEGER REFERENCES public.branches(id),
  auditor_id  UUID REFERENCES public.users(id),
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  reason      TEXT,
  status      TEXT DEFAULT 'active',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.void_bills (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   INTEGER REFERENCES public.branches(id),
  bill_ref    TEXT NOT NULL,
  bill_type   TEXT NOT NULL,
  amount      NUMERIC(14,2) DEFAULT 0,
  reason      TEXT,
  voided_by   UUID REFERENCES public.users(id),
  voided_at   TIMESTAMPTZ DEFAULT NOW(),
  status      TEXT DEFAULT 'voided'
);

CREATE TABLE IF NOT EXISTS public.void_bills_audit (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  void_id    UUID REFERENCES public.void_bills(id),
  action     TEXT NOT NULL,
  actor_id   UUID REFERENCES public.users(id),
  details    JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.void_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    INTEGER REFERENCES public.branches(id),
  bill_ref     TEXT NOT NULL,
  bill_type    TEXT NOT NULL,
  amount       NUMERIC(14,2) DEFAULT 0,
  reason       TEXT,
  requested_by UUID REFERENCES public.users(id),
  status       TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  approved_by  UUID REFERENCES public.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.discrepancy_flags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER REFERENCES public.branches(id),
  record_date     DATE DEFAULT CURRENT_DATE,
  flag_type       TEXT NOT NULL,
  severity        TEXT DEFAULT 'warning',
  description     TEXT,
  metadata        JSONB DEFAULT '{}',
  auditor_id      UUID REFERENCES public.users(id),
  accountant_id   UUID REFERENCES public.users(id),
  accountant_response TEXT,
  status          TEXT DEFAULT 'open'
    CHECK (status IN ('open','investigating','resolved','dismissed')),
  resolved_by     UUID REFERENCES public.users(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_discrepancy_branch ON public.discrepancy_flags(branch_id, status);

CREATE TABLE IF NOT EXISTS public.rls_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name  TEXT NOT NULL,
  action      TEXT NOT NULL,
  user_id     UUID,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.attendance_audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    UUID REFERENCES public.staff_profiles(id),
  action      TEXT NOT NULL,
  actor_id    UUID REFERENCES public.users(id),
  details     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- automation runs
CREATE TABLE IF NOT EXISTS public.automation_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name     TEXT NOT NULL,
  status       TEXT DEFAULT 'running'
    CHECK (status IN ('running','completed','failed')),
  started_at   TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  result       JSONB DEFAULT '{}',
  error        TEXT
);

-- communication tables
CREATE TABLE IF NOT EXISTS public.communication_channels (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id  INTEGER REFERENCES public.branches(id),
  name       TEXT NOT NULL,
  channel_type TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.channel_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  UUID REFERENCES public.communication_channels(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES public.users(id),
  joined_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.channel_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  UUID REFERENCES public.communication_channels(id) ON DELETE CASCADE,
  sender_id   UUID REFERENCES public.users(id),
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.message_reactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.channel_messages(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES public.users(id),
  emoji      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   INTEGER REFERENCES public.branches(id),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  posted_by   UUID REFERENCES public.users(id),
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
