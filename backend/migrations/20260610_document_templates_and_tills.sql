-- ============================================================================
-- Document Templates + per-outlet Till Numbers
-- Adds: configurable till numbers per POS outlet (with branch fallback) and a
-- document_templates override table. Template DEFAULTS live in code
-- (document-template.controller.ts); a row here is a SuperAdmin override, so
-- "reset to default" simply deletes the row.
-- ============================================================================

-- 1. Till numbers ------------------------------------------------------------
ALTER TABLE pos_outlets ADD COLUMN IF NOT EXISTS till_number text;
ALTER TABLE branches    ADD COLUMN IF NOT EXISTS default_till_number text;

-- Business rule: Bomet Town Restaurant POS outlet till number = 8118084
UPDATE pos_outlets
   SET till_number = '8118084'
 WHERE lower(coalesce(outlet_type, '')) = 'restaurant'
   AND branch_id IN (SELECT id FROM branches WHERE upper(coalesce(name, '')) LIKE 'BOMET TOWN%');

-- 2. Document template overrides --------------------------------------------
CREATE TABLE IF NOT EXISTS document_templates (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key text NOT NULL,                 -- e.g. customer_bill, customer_receipt
    branch_id   integer REFERENCES branches(id) ON DELETE CASCADE, -- NULL = global override
    name        text,
    sections    jsonb NOT NULL DEFAULT '[]'::jsonb,
    version     integer NOT NULL DEFAULT 1,
    updated_by  uuid,
    updated_at  timestamptz DEFAULT now(),
    created_at  timestamptz DEFAULT now()
);

-- One override per (template_key, branch) — global rows use branch_id = NULL.
CREATE UNIQUE INDEX IF NOT EXISTS document_templates_key_branch_uniq
    ON document_templates (template_key, COALESCE(branch_id, -1));

CREATE INDEX IF NOT EXISTS document_templates_key_idx
    ON document_templates (template_key);
