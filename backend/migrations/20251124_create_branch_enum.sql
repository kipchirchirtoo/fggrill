-- Create branch enum type
DO $$ BEGIN
    CREATE TYPE branch AS ENUM (
      'Bomet',      -- Main Branch
      'Kapsoit',
      'Kericho',
      'Mogogosiek',
      'Litein',
      'Bomet Town',
      'Kaplong'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update existing tables to use branch enum
DROP VIEW IF EXISTS v_current_stock_levels CASCADE;
DROP VIEW IF EXISTS v_low_stock_alerts CASCADE;
DROP VIEW IF EXISTS v_inventory_valuation CASCADE;
DROP VIEW IF EXISTS v_purchase_order_summary CASCADE;
DROP VIEW IF EXISTS v_requisition_summary CASCADE;
DROP VIEW IF EXISTS v_inventory_alerts CASCADE;
DROP VIEW IF EXISTS v_supplier_performance CASCADE;

ALTER TABLE IF EXISTS purchase_orders
  ALTER COLUMN branch TYPE branch USING branch::text::branch;

ALTER TABLE IF EXISTS requisitions
  ALTER COLUMN branch TYPE branch USING branch::text::branch;

ALTER TABLE IF EXISTS branch_inventory
  ALTER COLUMN branch TYPE branch USING branch::text::branch;

DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='branch_inventory' AND column_name='current_stock') THEN
    ALTER TABLE branch_inventory RENAME COLUMN current_stock TO quantity;
  END IF;
END $$;
