-- BAR MODULE WASTE & STOCK LOGS - Kyogong
-- Created: 2025-11-28

CREATE TABLE IF NOT EXISTS bar_stock_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stock_id UUID REFERENCES bar_stock(id),
  drink_id UUID REFERENCES bar_drinks(id),
  branch_id INTEGER,
  change_quantity INTEGER NOT NULL,
  reason VARCHAR(100), -- e.g., 'Restock', 'Spillage', 'Broken', 'Sale', 'Correction'
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bar_stock_logs_date ON bar_stock_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_bar_stock_logs_reason ON bar_stock_logs(reason);
CREATE INDEX IF NOT EXISTS idx_bar_stock_logs_branch ON bar_stock_logs(branch_id);

-- Enable RLS
ALTER TABLE bar_stock_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bar_stock_logs_read" ON bar_stock_logs;
CREATE POLICY "bar_stock_logs_read" ON bar_stock_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "bar_stock_logs_insert" ON bar_stock_logs;
CREATE POLICY "bar_stock_logs_insert" ON bar_stock_logs FOR INSERT WITH CHECK (true);

SELECT 'Bar stock logs table created successfully' AS status;
