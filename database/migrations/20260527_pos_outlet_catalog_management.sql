-- Ensure every branch has all standard POS outlets configured for the generic
-- outlet POS screen and SuperAdmin catalog management.

ALTER TABLE IF EXISTS pos_outlets
  DROP CONSTRAINT IF EXISTS pos_outlets_outlet_type_check;

ALTER TABLE IF EXISTS pos_outlets
  ADD CONSTRAINT pos_outlets_outlet_type_check CHECK (outlet_type IN (
    'restaurant',
    'main_bar',
    'executive_bar',
    'non_consumables',
    'cashier',
    'kyogong_reception',
    'kyogong_spa',
    'kyogong_executive_bar',
    'kyogong_sports_bar'
  ));

ALTER TABLE IF EXISTS pos_outlets
  DROP CONSTRAINT IF EXISTS pos_outlets_pin_prefix_check;

ALTER TABLE IF EXISTS pos_outlets
  ADD CONSTRAINT pos_outlets_pin_prefix_check CHECK (pin_prefix IN (
    'R', 'M', 'E', 'N', 'C', 'K', 'S', 'X', 'Y'
  ));

INSERT INTO pos_outlets (branch_id, outlet_type, name, pin_prefix)
SELECT id, 'restaurant', name || ' Restaurant POS', 'R'
FROM branches
ON CONFLICT (branch_id, outlet_type) DO NOTHING;

INSERT INTO pos_outlets (branch_id, outlet_type, name, pin_prefix)
SELECT id, 'main_bar', name || ' Main Bar POS', 'M'
FROM branches
ON CONFLICT (branch_id, outlet_type) DO NOTHING;

INSERT INTO pos_outlets (branch_id, outlet_type, name, pin_prefix)
SELECT id, 'executive_bar', name || ' Executive Bar POS', 'E'
FROM branches
ON CONFLICT (branch_id, outlet_type) DO NOTHING;

INSERT INTO pos_outlets (branch_id, outlet_type, name, pin_prefix)
SELECT id, 'non_consumables', name || ' Non-consumables POS', 'N'
FROM branches
ON CONFLICT (branch_id, outlet_type) DO NOTHING;

INSERT INTO pos_outlets (branch_id, outlet_type, name, pin_prefix)
SELECT id, 'cashier', name || ' Cashier POS', 'C'
FROM branches
ON CONFLICT (branch_id, outlet_type) DO NOTHING;
