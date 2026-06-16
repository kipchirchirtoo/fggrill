-- ============================================================
-- 0021_stocksheet_columns.sql
-- Add issued_quantity, spoilage_quantity, stock_out_quantity
-- to stock_take_lines and central_stock_take_items so the
-- stocksheet PDF can show the new layout:
--   Item Code | Item Name | Reorder Lvl | Cost Price |
--   Opening Stock | Adds | Total Stock | Issued Stock |
--   Spoilages | Stock Out | Physical Bal | Variance
-- ============================================================

ALTER TABLE public.stock_take_lines
  ADD COLUMN IF NOT EXISTS issued_quantity    NUMERIC(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spoilage_quantity  NUMERIC(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_out_quantity NUMERIC(14,3) NOT NULL DEFAULT 0;

ALTER TABLE public.central_stock_take_items
  ADD COLUMN IF NOT EXISTS opening_quantity   NUMERIC(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS added_quantity     NUMERIC(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS issued_quantity    NUMERIC(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spoilage_quantity  NUMERIC(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_out_quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reorder_level      NUMERIC(14,3) NOT NULL DEFAULT 0;

-- Recompute variance trigger for stock_take_lines to use new formula:
-- variance = physical_bal - (opening + adds - issued - spoilages - stock_out)
CREATE OR REPLACE FUNCTION public._compute_stl_variance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.counted_quantity IS NOT NULL THEN
    NEW.variance_quantity :=
      NEW.counted_quantity - (
        COALESCE(NEW.opening_quantity, 0)
        + COALESCE(NEW.added_quantity, 0)
        - COALESCE(NEW.issued_quantity, 0)
        - COALESCE(NEW.spoilage_quantity, 0)
        - COALESCE(NEW.stock_out_quantity, 0)
      );
    NEW.variance_value := NEW.variance_quantity * COALESCE(NEW.cost_price, 0);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_compute_stl_variance ON public.stock_take_lines;
CREATE TRIGGER trg_compute_stl_variance
  BEFORE INSERT OR UPDATE ON public.stock_take_lines
  FOR EACH ROW EXECUTE FUNCTION public._compute_stl_variance();

-- Recompute variance trigger for central_stock_take_items
CREATE OR REPLACE FUNCTION public._compute_cst_item_variance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.counted_quantity IS NOT NULL THEN
    NEW.variance :=
      NEW.counted_quantity - (
        COALESCE(NEW.opening_quantity, 0)
        + COALESCE(NEW.added_quantity, 0)
        - COALESCE(NEW.issued_quantity, 0)
        - COALESCE(NEW.spoilage_quantity, 0)
        - COALESCE(NEW.stock_out_quantity, 0)
      );
    NEW.variance_value := NEW.variance * COALESCE(NEW.unit_cost, 0);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_compute_cst_item_variance ON public.central_stock_take_items;
CREATE TRIGGER trg_compute_cst_item_variance
  BEFORE INSERT OR UPDATE ON public.central_stock_take_items
  FOR EACH ROW EXECUTE FUNCTION public._compute_cst_item_variance();

-- Rebuild stock_take_items VIEW to expose new columns
DROP VIEW IF EXISTS public.stock_take_items;
CREATE VIEW public.stock_take_items AS
  SELECT * FROM public.stock_take_lines;
