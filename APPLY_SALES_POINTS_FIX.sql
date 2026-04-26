-- Check existing sales points
SELECT id, branch_id, name, code, is_active FROM sales_points ORDER BY branch_id, name;

-- If empty, insert sales points for branch 1
INSERT INTO sales_points (branch_id, name, code, is_active, supports_petty_cash) VALUES
(1, 'Spa', 'SPA', true, false),
(1, 'Executive Bar', 'EXEC_BAR', true, false),
(1, 'Sports Bar', 'SPORTS_BAR', true, false),
(1, 'Reception', 'RECEPTION', true, true)
ON CONFLICT (code) DO UPDATE SET
  branch_id = EXCLUDED.branch_id,
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active,
  supports_petty_cash = EXCLUDED.supports_petty_cash;

-- Verify insertion
SELECT id, branch_id, name, code, is_active FROM sales_points ORDER BY branch_id, name;
