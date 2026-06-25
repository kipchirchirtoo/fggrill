-- ============================================================================
-- Bar Stock Ledger for Branch Storekeeper
-- ============================================================================
-- PURPOSE:
--   bar_stock (drink_id, branch_id, quantity, ...) is the table actually
--   decremented when a bar order completes (see decrement_bar_stock()), but
--   nothing creates/maintains an opening balance for it today, and it has no
--   uniqueness guarantee per drink+branch. This migration:
--     1. De-duplicates any existing bar_stock rows per (drink_id, branch_id),
--        keeping the most recently updated one.
--     2. Adds a unique constraint so the storekeeper restock/stock-take
--        endpoints can safely upsert.
--     3. Adds bar_stock_movements, a clean audit log for restocks and stock
--        takes (NOT reusing bar_stock_records, which has multiple
--        contradictory CREATE TABLE definitions elsewhere in this repo).
-- ============================================================================

DO $$
BEGIN
  DELETE FROM bar_stock a
  USING bar_stock b
  WHERE a.drink_id = b.drink_id
    AND a.branch_id = b.branch_id
    AND a.id <> b.id
    AND (
      a.updated_at < b.updated_at
      OR (a.updated_at = b.updated_at AND a.id < b.id)
    );
END $$;

ALTER TABLE bar_stock
  ADD CONSTRAINT bar_stock_drink_branch_unique UNIQUE (drink_id, branch_id);

CREATE TABLE IF NOT EXISTS bar_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  drink_id UUID NOT NULL REFERENCES bar_drinks(id),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('addition', 'closing_count')),
  quantity NUMERIC(14, 3) NOT NULL,
  system_quantity_before NUMERIC(14, 3),
  resulting_quantity NUMERIC(14, 3) NOT NULL,
  variance NUMERIC(14, 3),
  notes TEXT,
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bar_stock_movements_branch_drink
  ON bar_stock_movements(branch_id, drink_id);

-- Reconciles a whole stock-take worksheet (one physical count per drink) in a
-- single transaction, so a failure partway through can't leave some drinks
-- reconciled to their physical count and others still on stale system stock.
CREATE OR REPLACE FUNCTION submit_bar_stock_take(
  p_branch_id INTEGER,
  p_counts JSONB,
  p_recorded_by UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS SETOF bar_stock
LANGUAGE plpgsql
AS $$
DECLARE
  v_line JSONB;
  v_drink_id UUID;
  v_physical NUMERIC;
  v_before NUMERIC;
  v_variance NUMERIC;
BEGIN
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_counts)
  LOOP
    v_drink_id := (v_line->>'drink_id')::uuid;
    v_physical := (v_line->>'physical_quantity')::numeric;

    SELECT quantity INTO v_before FROM bar_stock
    WHERE drink_id = v_drink_id AND branch_id = p_branch_id
    FOR UPDATE;

    IF NOT FOUND THEN
      v_before := 0;
      INSERT INTO bar_stock (drink_id, branch_id, quantity, updated_at)
      VALUES (v_drink_id, p_branch_id, v_physical, NOW());
    ELSE
      UPDATE bar_stock SET quantity = v_physical, updated_at = NOW()
      WHERE drink_id = v_drink_id AND branch_id = p_branch_id;
    END IF;

    v_variance := v_physical - v_before;

    INSERT INTO bar_stock_movements (
      branch_id, drink_id, movement_type, quantity,
      system_quantity_before, resulting_quantity, variance, notes, recorded_by
    ) VALUES (
      p_branch_id, v_drink_id, 'closing_count', v_physical,
      v_before, v_physical, v_variance,
      COALESCE(v_line->>'notes', p_notes), p_recorded_by
    );
  END LOOP;

  RETURN QUERY SELECT * FROM bar_stock WHERE branch_id = p_branch_id
    AND drink_id IN (SELECT (elem->>'drink_id')::uuid FROM jsonb_array_elements(p_counts) elem);
END;
$$;
