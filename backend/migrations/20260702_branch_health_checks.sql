-- Branch Data-Health Checker: stores the last health-check result per branch.
-- raw_findings keeps the deterministic SQL check output for audit/debug even
-- when the AI interpretation succeeds; is_ai_interpreted=false means the AI
-- call failed schema validation and issues were derived directly from findings.

CREATE TABLE IF NOT EXISTS branch_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id integer NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  health_score integer NOT NULL CHECK (health_score >= 0 AND health_score <= 100),
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_findings jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_ai_interpreted boolean NOT NULL DEFAULT false,
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_branch_health_checks_branch_checked
  ON branch_health_checks (branch_id, checked_at DESC);
