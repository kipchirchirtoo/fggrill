-- Central Store Stock Take Sessions + Items (Foodstuffs vs Bar Store)
-- Safe additive schema (separate tables to avoid conflicts with branch stock take schemas)

BEGIN;

-- 1. Session table (one per store_type per stock take)
CREATE TABLE IF NOT EXISTS central_stock_take_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_number VARCHAR(30) NOT NULL UNIQUE, -- FGH-CST-YYYYMMDD-0001

    store_type TEXT NOT NULL CHECK (store_type IN ('foodstuffs', 'bar_store')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 'in_progress', 'submitted', 'approved', 'rejected', 'cancelled'
    )),

    notes TEXT,

    total_items_counted INT DEFAULT 0,
    items_with_variance INT DEFAULT 0,
    total_variance_value DECIMAL(12,2) DEFAULT 0,

    started_by UUID REFERENCES users(id),
    submitted_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),

    started_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_central_stock_take_sessions_type ON central_stock_take_sessions(store_type);
CREATE INDEX IF NOT EXISTS idx_central_stock_take_sessions_status ON central_stock_take_sessions(status);

-- 2. Line items (central store items mapped by SKU)
CREATE TABLE IF NOT EXISTS central_stock_take_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES central_stock_take_sessions(id) ON DELETE CASCADE,
    item_sku VARCHAR(100) NOT NULL REFERENCES simple_items(sku) ON DELETE RESTRICT,

    system_quantity INT NOT NULL DEFAULT 0,
    counted_quantity INT,
    unit_cost DECIMAL(10,2) DEFAULT 0,

    variance INT GENERATED ALWAYS AS (counted_quantity - system_quantity) STORED,
    variance_value DECIMAL(12,2) GENERATED ALWAYS AS ((counted_quantity - system_quantity) * unit_cost) STORED,

    variance_reason TEXT,
    notes TEXT,

    counted_by UUID REFERENCES users(id),
    counted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_central_stock_take_item UNIQUE (session_id, item_sku),
    CONSTRAINT counted_quantity_non_negative CHECK (counted_quantity IS NULL OR counted_quantity >= 0),
    CONSTRAINT variance_reason_required CHECK (variance IS NULL OR variance = 0 OR variance_reason IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_central_stock_take_items_session ON central_stock_take_items(session_id);
CREATE INDEX IF NOT EXISTS idx_central_stock_take_items_variance ON central_stock_take_items(variance) WHERE variance IS NOT NULL AND variance != 0;

-- 3. Sequence helper for session numbers
CREATE OR REPLACE FUNCTION get_central_stock_take_number()
RETURNS VARCHAR(30) AS $$
BEGIN
    RETURN get_next_simple_sequence('CENTRAL_STOCK_TAKE', 'FGH-CST');
END;
$$ LANGUAGE plpgsql;

-- 4. Updated-at triggers
DROP TRIGGER IF EXISTS update_central_stock_take_sessions_timestamp ON central_stock_take_sessions;
CREATE TRIGGER update_central_stock_take_sessions_timestamp
BEFORE UPDATE ON central_stock_take_sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_central_stock_take_items_timestamp ON central_stock_take_items;
CREATE TRIGGER update_central_stock_take_items_timestamp
BEFORE UPDATE ON central_stock_take_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. RLS
ALTER TABLE central_stock_take_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE central_stock_take_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "central_stock_take_access" ON central_stock_take_sessions;
CREATE POLICY "central_stock_take_access" ON central_stock_take_sessions
    FOR ALL
    TO authenticated
    USING (
        (SELECT role FROM public.users WHERE id = auth.uid()) IN (
            'super_admin', 'general_manager', 'central_storekeeper', 'auditor', 'central_operations_manager'
        )
    );

DROP POLICY IF EXISTS "central_stock_take_items_access" ON central_stock_take_items;
CREATE POLICY "central_stock_take_items_access" ON central_stock_take_items
    FOR ALL
    TO authenticated
    USING (
        (SELECT role FROM public.users WHERE id = auth.uid()) IN (
            'super_admin', 'general_manager', 'central_storekeeper', 'auditor', 'central_operations_manager'
        )
    );

DROP POLICY IF EXISTS "central_stock_take_service_role" ON central_stock_take_sessions;
CREATE POLICY "central_stock_take_service_role" ON central_stock_take_sessions
    FOR ALL
    TO service_role
    USING (true);

DROP POLICY IF EXISTS "central_stock_take_items_service_role" ON central_stock_take_items;
CREATE POLICY "central_stock_take_items_service_role" ON central_stock_take_items
    FOR ALL
    TO service_role
    USING (true);

-- 6. Optional accounting accounts (only if chart table exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'accounting_chart_of_accounts'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'accounting_chart_of_accounts'
              AND column_name = 'account_type'
        ) THEN
            INSERT INTO accounting_chart_of_accounts (account_code, account_name, account_type)
            VALUES
                ('1350', 'Central Store Inventory', 'asset'),
                ('5900', 'Inventory Variance', 'expense')
            ON CONFLICT (account_code) DO NOTHING;
        ELSIF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'accounting_chart_of_accounts'
              AND column_name = 'category_id'
        ) THEN
            INSERT INTO accounting_chart_of_accounts (account_code, account_name, category_id)
            VALUES
                ('1350', 'Central Store Inventory', (SELECT id FROM accounting_account_categories WHERE name='ASSETS' LIMIT 1)),
                ('5900', 'Inventory Variance', (SELECT id FROM accounting_account_categories WHERE name='EXPENSES' LIMIT 1))
            ON CONFLICT (account_code) DO NOTHING;
        END IF;
    END IF;
END $$;

COMMIT;
