-- Automated Daily Food Control Engine (Layer 1 + Layer 3 Stage 1).
--
-- food_control_processing_runs: one row per branch/commercial-day processed —
-- the idempotency marker for the pipeline and the monitoring source of truth
-- (UNIQUE(branch_id, control_date) makes reprocessing an upsert, never a dup).
--
-- variance_anomaly_flags: Stage-1 statistical anomaly output. The status field
-- captures the human-labeled investigation outcome from day one — it is the
-- training data a future Stage-2 model would need, even though Stage 2 is
-- deliberately NOT built yet.

CREATE TABLE IF NOT EXISTS food_control_processing_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id integer NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  control_date date NOT NULL,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed')),
  trigger_source text NOT NULL DEFAULT 'manual' CHECK (trigger_source IN ('event', 'fallback', 'manual')),
  duration_ms integer,
  anomalies_found integer NOT NULL DEFAULT 0,
  shorts_value numeric,
  error text,
  ai_summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, control_date)
);

CREATE INDEX IF NOT EXISTS idx_fc_runs_branch_date
  ON food_control_processing_runs (branch_id, control_date DESC);

CREATE TABLE IF NOT EXISTS variance_anomaly_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id integer NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  -- Item reference: the raw item sku for yield-tracked items, or the item
  -- name for directly-tracked finished items (matches food_control_variance.item_sku).
  item_ref text NOT NULL,
  item_name text,
  date date NOT NULL,
  anomaly_type text NOT NULL CHECK (anomaly_type IN ('single_day_outlier', 'sustained_trend', 'low_confidence')),
  z_score numeric,
  trend_days integer,
  current_value numeric,
  rolling_mean numeric,
  rolling_stddev numeric,
  confidence text NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN (
    'new', 'investigated_theft', 'investigated_waste',
    'investigated_false_alarm', 'recalibration_needed')),
  investigated_by uuid REFERENCES users(id),
  investigated_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, date, item_ref, anomaly_type)
);

CREATE INDEX IF NOT EXISTS idx_anomaly_flags_branch_status
  ON variance_anomaly_flags (branch_id, status, date DESC);
