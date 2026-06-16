-- ============================================================
-- Migration 0003: Fix procurement & inventory column gaps
--                 + backward-compat views for legacy table names
--                 + critical business-logic RPC functions
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- INVENTORY_ITEMS: add renamed / missing columns
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS store_type       TEXT,
  ADD COLUMN IF NOT EXISTS cost_price       NUMERIC(14,4)
    GENERATED ALWAYS AS (default_unit_cost) STORED,
  ADD COLUMN IF NOT EXISTS retail_price     NUMERIC(14,2)
    GENERATED ALWAYS AS (default_selling_price) STORED;

-- unit_of_measure alias (backend uses this name widely)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_items'
      AND column_name = 'unit_of_measure'
  ) THEN
    ALTER TABLE public.inventory_items ADD COLUMN unit_of_measure TEXT;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._sync_item_unit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.unit IS DISTINCT FROM OLD.unit THEN
    NEW.unit_of_measure := NEW.unit;
  END IF;
  IF TG_OP = 'INSERT' OR NEW.unit_of_measure IS DISTINCT FROM OLD.unit_of_measure THEN
    NEW.unit := NEW.unit_of_measure;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_item_unit ON public.inventory_items;
CREATE TRIGGER trg_sync_item_unit
  BEFORE INSERT OR UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public._sync_item_unit();

-- item_name alias (backend uses item_name; schema has item_name already — confirm)
-- Also add sku alias as item_sku for backward compat reads
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_items'
      AND column_name = 'item_sku'
  ) THEN
    ALTER TABLE public.inventory_items ADD COLUMN item_sku TEXT;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._sync_item_sku()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.item_sku := NEW.sku;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_item_sku ON public.inventory_items;
CREATE TRIGGER trg_sync_item_sku
  BEFORE INSERT OR UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public._sync_item_sku();

-- ─────────────────────────────────────────────────────────────
-- PURCHASE_ORDERS: add missing / renamed columns
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS payment_terms          TEXT,
  ADD COLUMN IF NOT EXISTS delivery_terms         TEXT,
  ADD COLUMN IF NOT EXISTS special_instructions   TEXT,
  ADD COLUMN IF NOT EXISTS sent_to_supplier       BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sent_at                TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_by_id             UUID REFERENCES public.users(id);

-- po_date alias (backend uses po_date, schema uses order_date)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchase_orders'
      AND column_name = 'po_date'
  ) THEN
    ALTER TABLE public.purchase_orders ADD COLUMN po_date DATE;
  END IF;
END $$;

-- Aliases for created_by_id / approved_by_id (schema uses created_by / approved_by)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchase_orders'
      AND column_name = 'created_by_id'
  ) THEN
    ALTER TABLE public.purchase_orders ADD COLUMN created_by_id UUID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchase_orders'
      AND column_name = 'approved_by_id'
  ) THEN
    ALTER TABLE public.purchase_orders ADD COLUMN approved_by_id UUID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._sync_po_cols()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.po_date        := COALESCE(NEW.po_date, NEW.order_date::DATE);
  NEW.order_date     := COALESCE(NEW.order_date, NEW.po_date);
  NEW.created_by_id  := NEW.created_by;
  NEW.approved_by_id := NEW.approved_by;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_po_cols ON public.purchase_orders;
CREATE TRIGGER trg_sync_po_cols
  BEFORE INSERT OR UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public._sync_po_cols();

-- ─────────────────────────────────────────────────────────────
-- GOODS_RECEIPTS: add missing / renamed columns
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.goods_receipts
  ADD COLUMN IF NOT EXISTS grn_approved   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS total_items    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vehicle_number TEXT,
  ADD COLUMN IF NOT EXISTS driver_name    TEXT,
  ADD COLUMN IF NOT EXISTS driver_phone   TEXT,
  ADD COLUMN IF NOT EXISTS attachments    JSONB DEFAULT '[]';

-- grn_date alias -> received_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'goods_receipts'
      AND column_name = 'grn_date'
  ) THEN
    ALTER TABLE public.goods_receipts ADD COLUMN grn_date TIMESTAMPTZ;
  END IF;
END $$;

-- received_by_id / approved_by_id aliases
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'goods_receipts'
      AND column_name = 'received_by_id'
  ) THEN
    ALTER TABLE public.goods_receipts ADD COLUMN received_by_id UUID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'goods_receipts'
      AND column_name = 'approved_by_id'
  ) THEN
    ALTER TABLE public.goods_receipts ADD COLUMN approved_by_id UUID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._sync_grn_cols()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.grn_date       := COALESCE(NEW.grn_date, NEW.received_at);
  NEW.received_by_id := NEW.received_by;
  -- goods_receipts has no approved_by column; approved_by_id is set directly
  IF NEW.status IN ('partially_accepted','posted') THEN
    NEW.grn_approved := TRUE;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_grn_cols ON public.goods_receipts;
CREATE TRIGGER trg_sync_grn_cols
  BEFORE INSERT OR UPDATE ON public.goods_receipts
  FOR EACH ROW EXECUTE FUNCTION public._sync_grn_cols();

-- ─────────────────────────────────────────────────────────────
-- GOODS_RECEIPT_LINES: add missing / renamed columns
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.goods_receipt_lines
  ADD COLUMN IF NOT EXISTS quantity_damaged   NUMERIC(14,3) DEFAULT 0 CHECK (quantity_damaged >= 0),
  ADD COLUMN IF NOT EXISTS batch_number       TEXT,
  ADD COLUMN IF NOT EXISTS expiry_date        DATE;

-- po_item_id alias -> purchase_order_line_id
-- grn_id alias -> goods_receipt_id
-- total_value alias -> line_total
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'goods_receipt_lines'
      AND column_name = 'po_item_id'
  ) THEN
    ALTER TABLE public.goods_receipt_lines ADD COLUMN po_item_id UUID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'goods_receipt_lines'
      AND column_name = 'grn_id'
  ) THEN
    ALTER TABLE public.goods_receipt_lines ADD COLUMN grn_id UUID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'goods_receipt_lines'
      AND column_name = 'total_value'
  ) THEN
    ALTER TABLE public.goods_receipt_lines ADD COLUMN total_value NUMERIC(14,2);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._sync_grl_cols()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.po_item_id := NEW.purchase_order_line_id;
  NEW.grn_id     := NEW.goods_receipt_id;
  NEW.total_value:= NEW.line_total;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_grl_cols ON public.goods_receipt_lines;
CREATE TRIGGER trg_sync_grl_cols
  BEFORE INSERT OR UPDATE ON public.goods_receipt_lines
  FOR EACH ROW EXECUTE FUNCTION public._sync_grl_cols();

-- ─────────────────────────────────────────────────────────────
-- SUPPLIER_INVOICES: add missing / renamed columns
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.supplier_invoices
  ADD COLUMN IF NOT EXISTS vat_rate_type          TEXT,
  ADD COLUMN IF NOT EXISTS vat_amount             NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS submitted_by_id        UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS submitted_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by_id         UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS rejected_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason       TEXT,
  ADD COLUMN IF NOT EXISTS is_locked              BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS supplier_pin           TEXT,
  ADD COLUMN IF NOT EXISTS supplier_vat_registered BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS supplier_vat_number    TEXT,
  ADD COLUMN IF NOT EXISTS grni_cleared_id        UUID,
  ADD COLUMN IF NOT EXISTS invoice_document_url   TEXT;

-- Column aliases
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'supplier_invoices'
      AND column_name = 'grn_id'
  ) THEN
    ALTER TABLE public.supplier_invoices ADD COLUMN grn_id UUID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'supplier_invoices'
      AND column_name = 'po_id'
  ) THEN
    ALTER TABLE public.supplier_invoices ADD COLUMN po_id UUID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'supplier_invoices'
      AND column_name = 'created_by_id'
  ) THEN
    ALTER TABLE public.supplier_invoices ADD COLUMN created_by_id UUID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._sync_sinv_cols()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.grn_id       := NEW.goods_receipt_id;
  NEW.po_id        := NEW.purchase_order_id;
  NEW.created_by_id:= NEW.created_by;
  NEW.vat_amount   := COALESCE(NEW.vat_amount, NEW.tax_amount, 0);
  NEW.tax_amount   := COALESCE(NEW.tax_amount, NEW.vat_amount, 0);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_sinv_cols ON public.supplier_invoices;
CREATE TRIGGER trg_sync_sinv_cols
  BEFORE INSERT OR UPDATE ON public.supplier_invoices
  FOR EACH ROW EXECUTE FUNCTION public._sync_sinv_cols();

-- ─────────────────────────────────────────────────────────────
-- BRANCH_REQUISITIONS: add missing / renamed columns
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.branch_requisitions
  ADD COLUMN IF NOT EXISTS request_type             TEXT DEFAULT 'ROUTINE',
  ADD COLUMN IF NOT EXISTS workflow_status          TEXT,
  ADD COLUMN IF NOT EXISTS submitted_to_auditor_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS document_number          TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by              UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_notes             TEXT,
  ADD COLUMN IF NOT EXISTS needed_by_date           DATE;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'branch_requisitions'
      AND column_name = 'requesting_branch_id'
  ) THEN
    ALTER TABLE public.branch_requisitions ADD COLUMN requesting_branch_id INTEGER;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._sync_breq_cols()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.requesting_branch_id := NEW.branch_id;
  NEW.workflow_status      := COALESCE(NEW.workflow_status, NEW.status);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_breq_cols ON public.branch_requisitions;
CREATE TRIGGER trg_sync_breq_cols
  BEFORE INSERT OR UPDATE ON public.branch_requisitions
  FOR EACH ROW EXECUTE FUNCTION public._sync_breq_cols();

-- ─────────────────────────────────────────────────────────────
-- BRANCH_REQUISITION_LINES: add missing / renamed columns
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.branch_requisition_lines
  ADD COLUMN IF NOT EXISTS item_sku             TEXT,
  ADD COLUMN IF NOT EXISTS current_branch_stock NUMERIC(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS workflow_status      TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'branch_requisition_lines'
      AND column_name = 'request_id'
  ) THEN
    ALTER TABLE public.branch_requisition_lines ADD COLUMN request_id UUID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'branch_requisition_lines'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public.branch_requisition_lines ADD COLUMN status TEXT;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._sync_brl_cols()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_sku TEXT;
BEGIN
  NEW.request_id      := NEW.branch_requisition_id;
  NEW.workflow_status := COALESCE(NEW.workflow_status, NEW.line_status);
  NEW.status          := COALESCE(NEW.status, NEW.line_status);
  -- Resolve item_sku from inventory_items if item_id is set
  IF NEW.item_sku IS NULL AND NEW.item_id IS NOT NULL THEN
    SELECT sku INTO v_sku FROM public.inventory_items WHERE id = NEW.item_id;
    NEW.item_sku := v_sku;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_brl_cols ON public.branch_requisition_lines;
CREATE TRIGGER trg_sync_brl_cols
  BEFORE INSERT OR UPDATE ON public.branch_requisition_lines
  FOR EACH ROW EXECUTE FUNCTION public._sync_brl_cols();

-- ─────────────────────────────────────────────────────────────
-- BRANCH_PAYMENTS: add missing columns
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.branch_payments
  ADD COLUMN IF NOT EXISTS payment_date         DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS reference_number     TEXT,
  ADD COLUMN IF NOT EXISTS currency             TEXT DEFAULT 'KES',
  ADD COLUMN IF NOT EXISTS requires_director    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_by_name      TEXT,
  ADD COLUMN IF NOT EXISTS manager_id           UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS manager_approved_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS director_id          UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS director_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS receipt_url          TEXT,
  ADD COLUMN IF NOT EXISTS description          TEXT,
  ADD COLUMN IF NOT EXISTS rejected_by          UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS rejected_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason     TEXT,
  ADD COLUMN IF NOT EXISTS payment_status       TEXT DEFAULT 'pending';

-- payment_amount alias -> amount
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'branch_payments'
      AND column_name = 'payment_amount'
  ) THEN
    ALTER TABLE public.branch_payments ADD COLUMN payment_amount NUMERIC(14,2);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._sync_bpay_cols()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.payment_amount := NEW.amount;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_bpay_cols ON public.branch_payments;
CREATE TRIGGER trg_sync_bpay_cols
  BEFORE INSERT OR UPDATE ON public.branch_payments
  FOR EACH ROW EXECUTE FUNCTION public._sync_bpay_cols();

-- ─────────────────────────────────────────────────────────────
-- STOCK_TAKES: add missing / renamed columns
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.stock_takes
  ADD COLUMN IF NOT EXISTS store_type   TEXT,
  ADD COLUMN IF NOT EXISTS outlet_code  TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_takes'
      AND column_name = 'count_date'
  ) THEN
    ALTER TABLE public.stock_takes ADD COLUMN count_date DATE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_takes'
      AND column_name = 'count_type'
  ) THEN
    ALTER TABLE public.stock_takes ADD COLUMN count_type TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_takes'
      AND column_name = 'counted_by'
  ) THEN
    ALTER TABLE public.stock_takes ADD COLUMN counted_by UUID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_takes'
      AND column_name = 'count_number'
  ) THEN
    ALTER TABLE public.stock_takes ADD COLUMN count_number TEXT;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._sync_st_cols()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.count_date   := COALESCE(NEW.count_date, NEW.created_at::DATE);
  NEW.count_type   := COALESCE(NEW.count_type, NEW.stock_take_type);
  NEW.counted_by   := COALESCE(NEW.counted_by, NEW.prepared_by);
  NEW.count_number := COALESCE(NEW.count_number, NEW.stock_take_number);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_st_cols ON public.stock_takes;
CREATE TRIGGER trg_sync_st_cols
  BEFORE INSERT OR UPDATE ON public.stock_takes
  FOR EACH ROW EXECUTE FUNCTION public._sync_st_cols();

-- ─────────────────────────────────────────────────────────────
-- STOCK_TAKE_LINES: add missing / renamed columns
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.stock_take_lines
  ADD COLUMN IF NOT EXISTS store_type          TEXT,
  ADD COLUMN IF NOT EXISTS issued_quantity     NUMERIC(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS system_closing_stock NUMERIC(14,3),
  ADD COLUMN IF NOT EXISTS unit_cost           NUMERIC(14,4),
  ADD COLUMN IF NOT EXISTS variance_reason     TEXT,
  ADD COLUMN IF NOT EXISTS variance_percentage NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS variance_severity   TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_take_lines'
      AND column_name = 'item_sku'
  ) THEN
    ALTER TABLE public.stock_take_lines ADD COLUMN item_sku TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_take_lines'
      AND column_name = 'stock_count_id'
  ) THEN
    ALTER TABLE public.stock_take_lines ADD COLUMN stock_count_id UUID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_take_lines'
      AND column_name = 'opening_stock'
  ) THEN
    ALTER TABLE public.stock_take_lines ADD COLUMN opening_stock NUMERIC(14,3);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_take_lines'
      AND column_name = 'additions'
  ) THEN
    ALTER TABLE public.stock_take_lines ADD COLUMN additions NUMERIC(14,3);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_take_lines'
      AND column_name = 'system_quantity'
  ) THEN
    ALTER TABLE public.stock_take_lines ADD COLUMN system_quantity NUMERIC(14,3);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_take_lines'
      AND column_name = 'physical_quantity'
  ) THEN
    ALTER TABLE public.stock_take_lines ADD COLUMN physical_quantity NUMERIC(14,3);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._sync_stl_cols()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_sku TEXT;
BEGIN
  NEW.stock_count_id   := NEW.stock_take_id;
  NEW.opening_stock    := COALESCE(NEW.opening_stock, NEW.opening_quantity);
  NEW.additions        := COALESCE(NEW.additions, NEW.added_quantity);
  NEW.system_quantity  := COALESCE(NEW.system_quantity, 0);
  NEW.physical_quantity:= COALESCE(NEW.physical_quantity, NEW.counted_quantity);
  NEW.unit_cost        := COALESCE(NEW.unit_cost, NEW.cost_price);
  IF NEW.item_sku IS NULL AND NEW.item_id IS NOT NULL THEN
    SELECT sku INTO v_sku FROM public.inventory_items WHERE id = NEW.item_id;
    NEW.item_sku := v_sku;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_stl_cols ON public.stock_take_lines;
CREATE TRIGGER trg_sync_stl_cols
  BEFORE INSERT OR UPDATE ON public.stock_take_lines
  FOR EACH ROW EXECUTE FUNCTION public._sync_stl_cols();

-- ─────────────────────────────────────────────────────────────
-- Backward-compat VIEWS for legacy table names
-- These are updatable where possible; controllers that INSERT
-- must be updated to use the canonical names eventually.
-- ─────────────────────────────────────────────────────────────

-- store_purchase_orders -> purchase_orders
CREATE OR REPLACE VIEW public.store_purchase_orders AS
  SELECT *, order_date AS po_date FROM public.purchase_orders;

-- store_po_items -> purchase_order_lines
CREATE OR REPLACE VIEW public.store_po_items AS
  SELECT * FROM public.purchase_order_lines;

-- store_grn -> goods_receipts
CREATE OR REPLACE VIEW public.store_grn AS
  SELECT *, received_at AS grn_date FROM public.goods_receipts;

-- store_grn_items -> goods_receipt_lines
CREATE OR REPLACE VIEW public.store_grn_items AS
  SELECT *, goods_receipt_id AS grn_id, purchase_order_line_id AS po_item_id FROM public.goods_receipt_lines;

-- store_suppliers -> suppliers
CREATE OR REPLACE VIEW public.store_suppliers AS
  SELECT * FROM public.suppliers;

-- store_supplier_invoices -> supplier_invoices
CREATE OR REPLACE VIEW public.store_supplier_invoices AS
  SELECT *, goods_receipt_id AS grn_id, purchase_order_id AS po_id FROM public.supplier_invoices;

-- store_supplier_invoice_items -> supplier_invoice_lines
CREATE OR REPLACE VIEW public.store_supplier_invoice_items AS
  SELECT * FROM public.supplier_invoice_lines;

-- store_supplier_payments -> supplier_payments
CREATE OR REPLACE VIEW public.store_supplier_payments AS
  SELECT * FROM public.supplier_payments;

-- store_supplier_ledger -> supplier_ledger
CREATE OR REPLACE VIEW public.store_supplier_ledger AS
  SELECT * FROM public.supplier_ledger;

-- stock_requests -> branch_requisitions
CREATE OR REPLACE VIEW public.stock_requests AS
  SELECT *, branch_id AS requesting_branch_id FROM public.branch_requisitions;

-- stock_request_items -> branch_requisition_lines
CREATE OR REPLACE VIEW public.stock_request_items AS
  SELECT * FROM public.branch_requisition_lines;

-- simple_items -> inventory_items
CREATE OR REPLACE VIEW public.simple_items AS
  SELECT
    id, sku, sku AS item_sku, item_name, description, category,
    unit AS unit_of_measure, unit, default_unit_cost AS cost_price,
    default_selling_price AS retail_price, reorder_level, is_active,
    store_type, metadata, created_at, updated_at
  FROM public.inventory_items;

-- inventory_items view for legacy name (it already exists but add aliases)
-- branch_stock -> simplified view over inventory_balances + inventory_locations
CREATE OR REPLACE VIEW public.branch_stock AS
  SELECT
    il.branch_id,
    ii.sku AS item_sku,
    ib.current_quantity AS quantity,
    ib.updated_at AS last_stock_in,
    ib.updated_at
  FROM public.inventory_balances ib
  JOIN public.inventory_items ii ON ii.id = ib.item_id
  JOIN public.inventory_locations il ON il.id = ib.location_id
  WHERE il.location_type = 'branch_store';

-- ─────────────────────────────────────────────────────────────
-- Missing support tables for procurement flow
-- ─────────────────────────────────────────────────────────────

-- GRN control account (3-way match)
CREATE TABLE IF NOT EXISTS public.store_grni_control_account (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER REFERENCES public.branches(id),
  grn_id          UUID REFERENCES public.goods_receipts(id),
  invoice_id      UUID REFERENCES public.supplier_invoices(id),
  amount          NUMERIC(14,2) DEFAULT 0,
  cleared         BOOLEAN DEFAULT FALSE,
  cleared_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Branch payment audit
CREATE TABLE IF NOT EXISTS public.branch_payment_audit (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id  UUID REFERENCES public.branch_payments(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  actor_id    UUID REFERENCES public.users(id),
  actor_name  TEXT,
  actor_role  TEXT,
  ip_address  TEXT,
  details     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bpaudit_payment ON public.branch_payment_audit(payment_id);

-- Branch payment receipts
CREATE TABLE IF NOT EXISTS public.branch_payment_receipts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id      UUID REFERENCES public.branch_payments(id) ON DELETE CASCADE,
  branch_id       INTEGER REFERENCES public.branches(id),
  receipt_number  TEXT UNIQUE NOT NULL,
  payment_number  TEXT,
  supplier_name   TEXT,
  amount          NUMERIC(14,2) DEFAULT 0,
  currency        TEXT DEFAULT 'KES',
  receipt_url     TEXT,
  generated_by    UUID REFERENCES public.users(id),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- CRITICAL RPC: approve_grn_and_update_all
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_grn_and_update_all(
  p_grn_id    UUID,
  p_approver  UUID,
  p_branch_id INT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_grn     public.goods_receipts%ROWTYPE;
  v_line    public.goods_receipt_lines%ROWTYPE;
  v_item    public.inventory_items%ROWTYPE;
  v_loc_id  UUID;
  v_bal_id  UUID;
  v_mov_num TEXT;
BEGIN
  -- Fetch GRN
  SELECT * INTO v_grn FROM public.goods_receipts WHERE id = p_grn_id;
  IF NOT FOUND THEN RETURN '{"ok":false,"error":"GRN not found"}'::JSONB; END IF;
  IF v_grn.status NOT IN ('draft','posted') THEN
    RETURN jsonb_build_object('ok',false,'error','GRN already approved or voided');
  END IF;

  -- Resolve branch store location
  SELECT id INTO v_loc_id
  FROM public.inventory_locations
  WHERE branch_id = COALESCE(p_branch_id, v_grn.branch_id)
    AND location_type = 'branch_store'
  LIMIT 1;

  IF v_loc_id IS NULL THEN
    -- Auto-create location
    INSERT INTO public.inventory_locations(branch_id, location_code, name, location_type)
    VALUES (COALESCE(p_branch_id, v_grn.branch_id),
            'STORE-' || COALESCE(p_branch_id, v_grn.branch_id)::TEXT,
            'Branch Store',
            'branch_store')
    RETURNING id INTO v_loc_id;
  END IF;

  -- Process each GRN line
  FOR v_line IN SELECT * FROM public.goods_receipt_lines WHERE goods_receipt_id = p_grn_id LOOP
    v_mov_num := 'MOV-GRN-' || p_grn_id::TEXT || '-' || v_line.id::TEXT;

    -- Upsert inventory balance
    INSERT INTO public.inventory_balances(item_id, location_id, current_quantity, unit_cost)
    VALUES (v_line.item_id, v_loc_id, v_line.quantity_accepted, v_line.unit_price)
    ON CONFLICT (item_id, location_id, batch_id) DO UPDATE
      SET current_quantity = inventory_balances.current_quantity + EXCLUDED.current_quantity,
          unit_cost        = EXCLUDED.unit_cost,
          updated_at       = NOW();

    -- Record movement
    INSERT INTO public.inventory_movements(
      movement_number, branch_id, movement_type, item_id,
      destination_location_id, quantity, unit_cost,
      reason, document_type, document_id, document_number, actor_id
    ) VALUES (
      v_mov_num,
      COALESCE(p_branch_id, v_grn.branch_id),
      'grn_posting',
      v_line.item_id,
      v_loc_id,
      v_line.quantity_accepted,
      v_line.unit_price,
      'GRN receipt: ' || v_grn.grn_number,
      'goods_receipt',
      p_grn_id,
      v_grn.grn_number,
      p_approver
    );

    -- Update PO line quantities
    IF v_line.purchase_order_line_id IS NOT NULL THEN
      UPDATE public.purchase_order_lines
      SET quantity_received = LEAST(quantity_ordered,
            quantity_received + v_line.quantity_accepted),
          quantity_pending  = GREATEST(0,
            quantity_ordered - quantity_received - v_line.quantity_accepted),
          updated_at        = NOW()
      WHERE id = v_line.purchase_order_line_id;
    END IF;
  END LOOP;

  -- Mark GRN approved
  UPDATE public.goods_receipts
  SET status = 'posted', grn_approved = TRUE,
      approved_by = p_approver, approved_at = NOW(),
      updated_at  = NOW()
  WHERE id = p_grn_id;

  -- Update PO status
  UPDATE public.purchase_orders SET
    status = CASE
      WHEN (SELECT COUNT(*) FROM public.purchase_order_lines
            WHERE purchase_order_id = v_grn.purchase_order_id
              AND quantity_pending > 0) = 0
      THEN 'fully_received' ELSE 'partially_received' END,
    updated_at = NOW()
  WHERE id = v_grn.purchase_order_id;

  -- Audit
  PERFORM public.create_audit_log(
    COALESCE(p_branch_id, v_grn.branch_id), p_approver,
    'storekeeping', 'grn_approved', 'goods_receipt', p_grn_id,
    NULL, jsonb_build_object('grn_number', v_grn.grn_number), NULL, 'info'
  );

  RETURN jsonb_build_object('ok', true, 'grn_number', v_grn.grn_number);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- CRITICAL RPC: approve_supplier_invoice_and_update_ledger
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_supplier_invoice_and_update_ledger(
  p_invoice_id UUID,
  p_approver   UUID
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_inv public.supplier_invoices%ROWTYPE;
BEGIN
  SELECT * INTO v_inv FROM public.supplier_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RETURN '{"ok":false,"error":"Invoice not found"}'::JSONB; END IF;

  -- Update invoice status
  UPDATE public.supplier_invoices
  SET status      = 'approved_for_payment',
      approved_by = p_approver,
      approved_at = NOW(),
      updated_at  = NOW()
  WHERE id = p_invoice_id;

  -- Add ledger entry
  INSERT INTO public.supplier_ledger(
    branch_id, supplier_id, entry_type, document_type, document_id,
    document_number, debit, credit, notes
  ) VALUES (
    v_inv.branch_id, v_inv.supplier_id,
    'invoice', 'supplier_invoice', p_invoice_id,
    v_inv.invoice_number, v_inv.total_amount, 0,
    'Invoice approved for payment'
  );

  -- Update linked PO finance_status
  IF v_inv.purchase_order_id IS NOT NULL THEN
    UPDATE public.purchase_orders
    SET finance_status = 'billed', updated_at = NOW()
    WHERE id = v_inv.purchase_order_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'invoice_number', v_inv.invoice_number);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- CRITICAL RPC: update_branch_stock
-- Replaces the old RPC that operated on branch_stock table.
-- Now updates inventory_balances via location lookup.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_branch_stock(
  p_branch_id   INT,
  p_item_sku    TEXT,
  p_qty_delta   NUMERIC,
  p_reason      TEXT DEFAULT 'manual',
  p_actor_id    UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_item_id UUID;
  v_loc_id  UUID;
  v_mov_num TEXT;
BEGIN
  -- Resolve item_id from SKU
  SELECT id INTO v_item_id FROM public.inventory_items WHERE sku = p_item_sku;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','Item SKU not found: ' || p_item_sku); END IF;

  -- Resolve branch store location
  SELECT id INTO v_loc_id
  FROM public.inventory_locations
  WHERE branch_id = p_branch_id AND location_type = 'branch_store'
  LIMIT 1;

  IF v_loc_id IS NULL THEN
    INSERT INTO public.inventory_locations(branch_id, location_code, name, location_type)
    VALUES (p_branch_id, 'STORE-' || p_branch_id::TEXT, 'Branch Store', 'branch_store')
    RETURNING id INTO v_loc_id;
  END IF;

  -- Upsert balance
  INSERT INTO public.inventory_balances(item_id, location_id, current_quantity)
  VALUES (v_item_id, v_loc_id, GREATEST(0, p_qty_delta))
  ON CONFLICT (item_id, location_id, batch_id) DO UPDATE
    SET current_quantity = GREATEST(0, inventory_balances.current_quantity + p_qty_delta),
        updated_at       = NOW();

  -- Movement record
  v_mov_num := 'MOV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::TEXT, 1, 8);
  INSERT INTO public.inventory_movements(
    movement_number, branch_id, movement_type, item_id,
    destination_location_id, source_location_id,
    quantity, reason, document_type, document_number, actor_id
  ) VALUES (
    v_mov_num, p_branch_id,
    CASE WHEN p_qty_delta >= 0 THEN 'stock_take_adjustment' ELSE 'write_off' END,
    v_item_id,
    CASE WHEN p_qty_delta >= 0 THEN v_loc_id ELSE NULL END,
    CASE WHEN p_qty_delta < 0  THEN v_loc_id ELSE NULL END,
    ABS(p_qty_delta), p_reason, 'manual_adjustment', v_mov_num, p_actor_id
  );

  RETURN jsonb_build_object('ok', true, 'new_qty',
    (SELECT current_quantity FROM public.inventory_balances
     WHERE item_id = v_item_id AND location_id = v_loc_id));
END;
$$;

-- update_stock_level (alias)
CREATE OR REPLACE FUNCTION public.update_stock_level(
  p_branch_id INT,
  p_item_sku  TEXT,
  p_new_qty   NUMERIC,
  p_reason    TEXT DEFAULT 'set',
  p_actor_id  UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_current NUMERIC := 0;
  v_item_id UUID;
  v_loc_id  UUID;
BEGIN
  SELECT id INTO v_item_id FROM public.inventory_items WHERE sku = p_item_sku;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','SKU not found'); END IF;

  SELECT id INTO v_loc_id FROM public.inventory_locations
  WHERE branch_id = p_branch_id AND location_type = 'branch_store' LIMIT 1;

  IF v_loc_id IS NOT NULL THEN
    SELECT current_quantity INTO v_current FROM public.inventory_balances
    WHERE item_id = v_item_id AND location_id = v_loc_id;
  END IF;

  RETURN public.update_branch_stock(p_branch_id, p_item_sku, p_new_qty - COALESCE(v_current,0), p_reason, p_actor_id);
END;
$$;

-- min_stock_level
CREATE OR REPLACE FUNCTION public.min_stock_level(p_item_id UUID)
RETURNS NUMERIC LANGUAGE sql STABLE AS $$
  SELECT reorder_level FROM public.inventory_items WHERE id = p_item_id;
$$;

-- receive_purchase_order (marks PO as received)
CREATE OR REPLACE FUNCTION public.receive_purchase_order(p_po_id UUID, p_actor UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.purchase_orders
  SET status = 'fully_received', updated_at = NOW()
  WHERE id = p_po_id;
  RETURN '{"ok":true}'::JSONB;
END;
$$;

-- submit_stock_take_with_lock
CREATE OR REPLACE FUNCTION public.submit_stock_take_with_lock(
  p_stock_take_id UUID,
  p_actor         UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.stock_takes
  SET status = 'submitted', updated_at = NOW()
  WHERE id = p_stock_take_id AND status IN ('draft','started','counting');

  IF NOT FOUND THEN
    RETURN '{"ok":false,"error":"Cannot submit: wrong status or not found"}'::JSONB;
  END IF;
  RETURN '{"ok":true}'::JSONB;
END;
$$;

-- calculate_bill_totals
CREATE OR REPLACE FUNCTION public.calculate_bill_totals(p_order_id UUID)
RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'subtotal',     subtotal,
    'tax_amount',   tax_amount,
    'total_amount', total_amount
  ) FROM public.pos_orders WHERE id = p_order_id;
$$;

-- calculate_shift_summary
CREATE OR REPLACE FUNCTION public.calculate_shift_summary(p_shift_id UUID)
RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'total_sales',    COALESCE(SUM(total_amount),0),
    'order_count',    COUNT(*),
    'avg_order',      COALESCE(AVG(total_amount),0)
  ) FROM public.pos_orders WHERE shift_id = p_shift_id AND status = 'completed';
$$;

-- get_shift_reconciliation_totals
CREATE OR REPLACE FUNCTION public.get_shift_reconciliation_totals(p_shift_id UUID)
RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'cash',  COALESCE(SUM(amount) FILTER (WHERE method='cash'),0),
    'mpesa', COALESCE(SUM(amount) FILTER (WHERE method='mpesa'),0),
    'card',  COALESCE(SUM(amount) FILTER (WHERE method='card'),0),
    'total', COALESCE(SUM(amount),0)
  ) FROM public.pos_payments WHERE shift_id = p_shift_id AND status = 'completed';
$$;

-- calculate_conference_invoice_with_attendance (stub — needs conference tables in Phase 4)
CREATE OR REPLACE FUNCTION public.calculate_conference_invoice_with_attendance(
  p_booking_id UUID
) RETURNS JSONB LANGUAGE plpgsql AS $$
BEGIN
  RETURN jsonb_build_object('ok', false, 'error',
    'Conference module not yet migrated. Run Phase 4 migration first.');
END;
$$;

-- update_tab_total (stub — needs bar tables in Phase 4)
CREATE OR REPLACE FUNCTION public.update_tab_total(p_tab_id UUID)
RETURNS JSONB LANGUAGE plpgsql AS $$
BEGIN
  RETURN jsonb_build_object('ok', false, 'error',
    'Bar module not yet migrated. Run Phase 4 migration first.');
END;
$$;

-- decrement_bar_stock (stub — needs bar tables in Phase 4)
CREATE OR REPLACE FUNCTION public.decrement_bar_stock(
  p_item_id UUID,
  p_qty     NUMERIC,
  p_outlet_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql AS $$
BEGIN
  RETURN jsonb_build_object('ok', false, 'error',
    'Bar module not yet migrated. Run Phase 4 migration first.');
END;
$$;
