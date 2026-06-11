-- ============================================================================
-- Branch outbound payments (buy essentials / pay people / vendor & petty cash)
-- with a maker-checker approval workflow and an unalterable audit trail.
--   Branch Accountant initiates -> Branch Manager approves
--   -> Director signs off high-value (> threshold) -> Treasury releases.
-- ============================================================================

CREATE TABLE IF NOT EXISTS branch_payments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id          integer NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  payment_number     text UNIQUE,
  category           text NOT NULL,         -- vendor | petty_cash | inter_branch | staff_payout | utility | other
  payment_method     text NOT NULL,         -- eft | rtgs | cheque | mpesa | cash | bank | wallet
  payee_name         text NOT NULL,
  payee_account      text,
  amount             numeric(14, 2) NOT NULL,
  currency           text DEFAULT 'KES',
  description        text,
  reference          text,
  receipt_url        text,                  -- mandatory document vault link
  po_id              uuid,                  -- three-way match references
  grn_id             uuid,
  invoice_id         uuid,
  status             text NOT NULL DEFAULT 'pending',
                       -- pending | manager_approved | director_approved | released | rejected
  requires_director  boolean DEFAULT false,
  created_by         uuid REFERENCES users(id),
  created_by_name    text,
  manager_id         uuid,
  manager_approved_at timestamptz,
  director_id        uuid,
  director_approved_at timestamptz,
  released_by        uuid,
  released_at        timestamptz,
  rejected_by        uuid,
  rejected_at        timestamptz,
  rejection_reason   text,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS branch_payments_branch_idx ON branch_payments (branch_id);
CREATE INDEX IF NOT EXISTS branch_payments_status_idx ON branch_payments (status);
CREATE INDEX IF NOT EXISTS branch_payments_created_idx ON branch_payments (created_at);

-- Forensic, append-only audit trail (who did what, when).
CREATE TABLE IF NOT EXISTS branch_payment_audit (
  id          bigserial PRIMARY KEY,
  payment_id  uuid REFERENCES branch_payments(id) ON DELETE CASCADE,
  action      text NOT NULL,                -- created | manager_approved | director_approved | released | rejected
  actor_id    uuid,
  actor_name  text,
  actor_role  text,
  ip_address  text,
  details     jsonb,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS branch_payment_audit_payment_idx ON branch_payment_audit (payment_id);
