-- Create table for pool table token sales
CREATE TABLE IF NOT EXISTS restaurant_pool_token_sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    amount_per_token DECIMAL(10, 2) NOT NULL DEFAULT 100.00,
    total_amount DECIMAL(10, 2) GENERATED ALWAYS AS (quantity * amount_per_token) STORED,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'mpesa', 'card', 'room_charge')),
    cashier_id UUID REFERENCES users(id),
    status TEXT DEFAULT 'pending_audit' CHECK (status IN ('pending_audit', 'verified', 'disputed')),
    audit_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE restaurant_pool_token_sales ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for authenticated users" ON restaurant_pool_token_sales
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON restaurant_pool_token_sales
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for admins and auditors" ON restaurant_pool_token_sales
    FOR UPDATE
    USING (
        auth.uid() IN (
            SELECT id FROM users 
            WHERE role IN ('super_admin', 'general_manager', 'auditor')
        )
    );

-- Grant permissions
GRANT ALL ON restaurant_pool_token_sales TO authenticated;
GRANT ALL ON restaurant_pool_token_sales TO service_role;
