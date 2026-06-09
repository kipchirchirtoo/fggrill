-- Per-bar station routing: tag each bar order with the POS station
-- (e.g. main_bar / executive_bar / sports_bar) it was placed at, so the
-- correct station cashier handles its bill.

ALTER TABLE bar_orders
  ADD COLUMN IF NOT EXISTS outlet_type VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_bar_orders_outlet_type ON bar_orders(outlet_type);
