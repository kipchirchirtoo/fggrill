-- Cash change-giving support for the cashier module.
-- Records how much cash the customer tendered and how much change was
-- handed back, on the cleared-payment record and the order tables.

ALTER TABLE cashier_transactions
  ADD COLUMN IF NOT EXISTS change_given DECIMAL(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_tendered DECIMAL(12, 2) DEFAULT 0;

ALTER TABLE pos_shift_orders
  ADD COLUMN IF NOT EXISTS change_given DECIMAL(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_tendered DECIMAL(12, 2) DEFAULT 0;

ALTER TABLE pos_transactions
  ADD COLUMN IF NOT EXISTS change_given DECIMAL(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_tendered DECIMAL(12, 2) DEFAULT 0;

-- restaurant_orders / bar_orders already carry change_given; ensure tendered too.
ALTER TABLE restaurant_orders
  ADD COLUMN IF NOT EXISTS amount_tendered DECIMAL(12, 2) DEFAULT 0;

ALTER TABLE bar_orders
  ADD COLUMN IF NOT EXISTS amount_tendered DECIMAL(12, 2) DEFAULT 0;
