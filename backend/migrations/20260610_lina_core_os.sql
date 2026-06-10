-- ============================================================================
-- Lina Core OS
-- Durable remediation, execution, memory, snapshot, and audit tables for Lina's
-- governed operating-system workflow.
-- ============================================================================

CREATE TABLE IF NOT EXISTS lina_remediation_proposals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    severity text NOT NULL DEFAULT 'LOW'
        CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
    risk_classification text NOT NULL DEFAULT 'READ_ONLY'
        CHECK (risk_classification IN ('READ_ONLY', 'SAFE_AUTO', 'APPROVAL_REQUIRED', 'MANUAL_ONLY')),
    execution_classification text NOT NULL DEFAULT 'READ_ONLY'
        CHECK (execution_classification IN ('READ_ONLY', 'SAFE_AUTO', 'APPROVAL_REQUIRED', 'MANUAL_ONLY')),
    action text NOT NULL,
    target text,
    module text,
    kpi_impact text,
    affected_branch_id integer REFERENCES branches(id) ON DELETE SET NULL,
    affected_service text,
    source_event jsonb NOT NULL DEFAULT '{}'::jsonb,
    evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
    blast_radius jsonb NOT NULL DEFAULT '{}'::jsonb,
    rollback_plan text,
    approval_status text NOT NULL DEFAULT 'pending'
        CHECK (approval_status IN ('pending', 'approved', 'rejected', 'manual_only', 'not_required')),
    execution_status text NOT NULL DEFAULT 'not_queued'
        CHECK (execution_status IN ('not_queued', 'queued', 'running', 'succeeded', 'failed', 'blocked')),
    verification_status text NOT NULL DEFAULT 'not_verified'
        CHECK (verification_status IN ('not_verified', 'pending', 'verified', 'failed')),
    verification_result jsonb NOT NULL DEFAULT '{}'::jsonb,
    execution_result jsonb NOT NULL DEFAULT '{}'::jsonb,
    confidence numeric(5,2),
    created_by uuid,
    approved_by uuid,
    rejected_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    approved_at timestamptz,
    rejected_at timestamptz,
    queued_at timestamptz,
    executed_at timestamptz,
    verified_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lina_remediation_status_idx
    ON lina_remediation_proposals (approval_status, execution_status, created_at DESC);

CREATE INDEX IF NOT EXISTS lina_remediation_branch_idx
    ON lina_remediation_proposals (affected_branch_id, created_at DESC);

CREATE TABLE IF NOT EXISTS lina_remediation_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id uuid REFERENCES lina_remediation_proposals(id) ON DELETE CASCADE,
    actor_id uuid,
    event_type text NOT NULL,
    event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lina_remediation_events_proposal_idx
    ON lina_remediation_events (proposal_id, created_at DESC);

CREATE TABLE IF NOT EXISTS lina_remediation_executions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id uuid REFERENCES lina_remediation_proposals(id) ON DELETE CASCADE,
    job_type text NOT NULL,
    status text NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'blocked')),
    attempts integer NOT NULL DEFAULT 0,
    max_attempts integer NOT NULL DEFAULT 3,
    input jsonb NOT NULL DEFAULT '{}'::jsonb,
    result jsonb NOT NULL DEFAULT '{}'::jsonb,
    error text,
    queued_by uuid,
    started_at timestamptz,
    finished_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lina_remediation_executions_status_idx
    ON lina_remediation_executions (status, created_at DESC);

CREATE TABLE IF NOT EXISTS lina_agent_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id uuid,
    actor_role text,
    action text NOT NULL,
    tool_name text,
    risk_classification text
        CHECK (risk_classification IS NULL OR risk_classification IN ('READ_ONLY', 'SAFE_AUTO', 'APPROVAL_REQUIRED', 'MANUAL_ONLY')),
    input jsonb NOT NULL DEFAULT '{}'::jsonb,
    output jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'recorded',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lina_agent_logs_actor_idx
    ON lina_agent_logs (actor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS lina_memory (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_type text NOT NULL DEFAULT 'long_term'
        CHECK (memory_type IN ('short_term', 'long_term')),
    scope text NOT NULL DEFAULT 'global',
    branch_id integer REFERENCES branches(id) ON DELETE CASCADE,
    key text NOT NULL,
    value jsonb NOT NULL DEFAULT '{}'::jsonb,
    confidence numeric(5,2),
    source text,
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS lina_memory_scope_key_branch_uniq
    ON lina_memory (scope, key, COALESCE(branch_id, -1));

CREATE TABLE IF NOT EXISTS lina_system_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_type text NOT NULL,
    branch_id integer REFERENCES branches(id) ON DELETE SET NULL,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    generated_by uuid,
    generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lina_system_snapshots_type_idx
    ON lina_system_snapshots (snapshot_type, generated_at DESC);
