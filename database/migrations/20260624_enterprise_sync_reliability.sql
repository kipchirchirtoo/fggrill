-- Enterprise reliability foundation for offline-first operations.
-- Safe to apply on a running system: additive only.

CREATE TABLE IF NOT EXISTS public.request_idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_scope TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    request_method TEXT NOT NULL,
    request_path TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
    branch_id INTEGER NULL REFERENCES public.branches(id) ON DELETE SET NULL,
    device_id TEXT NULL,
    status TEXT NOT NULL DEFAULT 'processing',
    response_status INTEGER NULL,
    response_body JSONB NULL,
    resource_type TEXT NULL,
    resource_id TEXT NULL,
    locked_at TIMESTAMPTZ NULL,
    finalized_at TIMESTAMPTZ NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
    last_error TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT request_idempotency_keys_scope_key_unique UNIQUE (request_scope, idempotency_key),
    CONSTRAINT request_idempotency_keys_status_check CHECK (status IN ('processing', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_request_idempotency_status
    ON public.request_idempotency_keys(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_request_idempotency_expires
    ON public.request_idempotency_keys(expires_at);

CREATE INDEX IF NOT EXISTS idx_request_idempotency_user
    ON public.request_idempotency_keys(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.sync_operation_journal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_operation_id TEXT NOT NULL UNIQUE,
    operation_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NULL,
    user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
    branch_id INTEGER NULL REFERENCES public.branches(id) ON DELETE SET NULL,
    device_id TEXT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'accepted',
    attempts INTEGER NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMPTZ NULL,
    last_error TEXT NULL,
    acknowledged_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sync_operation_journal_status_check CHECK (status IN ('accepted', 'processing', 'applied', 'failed', 'dead_letter'))
);

CREATE INDEX IF NOT EXISTS idx_sync_operation_journal_status
    ON public.sync_operation_journal(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_operation_journal_user
    ON public.sync_operation_journal(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_operation_journal_branch
    ON public.sync_operation_journal(branch_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.active_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_info JSONB DEFAULT '{}'::jsonb,
    geo_country VARCHAR(100),
    geo_city VARCHAR(100),
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON public.active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_token ON public.active_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_active_sessions_active ON public.active_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_active_sessions_expires ON public.active_sessions(expires_at);

CREATE OR REPLACE FUNCTION public.set_updated_at_if_present()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW IS DISTINCT FROM OLD THEN
        NEW.updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_request_idempotency_keys_updated_at ON public.request_idempotency_keys;
CREATE TRIGGER trg_request_idempotency_keys_updated_at
BEFORE UPDATE ON public.request_idempotency_keys
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_if_present();

DROP TRIGGER IF EXISTS trg_sync_operation_journal_updated_at ON public.sync_operation_journal;
CREATE TRIGGER trg_sync_operation_journal_updated_at
BEFORE UPDATE ON public.sync_operation_journal
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_if_present();

COMMENT ON TABLE public.request_idempotency_keys IS 'Stores idempotency keys and serialized responses for replay-safe write APIs.';
COMMENT ON TABLE public.sync_operation_journal IS 'Append-only sync acceptance ledger for client operation replay and recovery.';
COMMENT ON TABLE public.active_sessions IS 'Session registry used for revocation, forced logout, and managed token rotation.';
