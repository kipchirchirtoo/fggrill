-- Create enum types
DO $$ BEGIN
    CREATE TYPE branch_enum AS ENUM ('Bomet', 'Kericho', 'Kapsoit', 'Litein');
    CREATE TYPE category_enum AS ENUM (
    'Food & Beverage',
    'Housekeeping',
    'Sauna & Wellness',
    'Administration',
    'Maintenance'
);
    CREATE TYPE subcategory_enum AS ENUM (
    'Bar Stock-Alcoholic',
    'Bar Stock-Non-alcoholic',
    'Kitchen Supplies',
    'Restaurant Items',
    'Linens & Bedding',
    'Cleaning Supplies',
    'Guest Amenities',
    'Towels & Robes',
    'Spa Products',
    'Maintenance Supplies',
    'Stationery',
    'Office Supplies',
    'Printing Materials',
    'Electrical',
    'Plumbing',
    'General Repair'
);
    CREATE TYPE transfer_status_enum AS ENUM ('pending', 'approved', 'in_transit', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create inventory_items table
CREATE TABLE IF NOT EXISTS inventory_items (
    id SERIAL PRIMARY KEY,
    item_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category category_enum NOT NULL,
    subcategory subcategory_enum NOT NULL,
    unit VARCHAR(50) NOT NULL,
    minimum_stock INTEGER NOT NULL DEFAULT 0,
    maximum_stock INTEGER NOT NULL,
    reorder_point INTEGER NOT NULL,
    unit_cost DECIMAL(10,2) NOT NULL,
    supplier_id INTEGER REFERENCES suppliers(id),
    is_active BOOLEAN DEFAULT true,
    is_bar_item BOOLEAN DEFAULT false,
    is_sauna_item BOOLEAN DEFAULT false,
    is_room_item BOOLEAN DEFAULT false,
    par_stock INTEGER,
    is_reusable BOOLEAN DEFAULT false,
    replacement_cycle INTEGER,
    is_minibar_item BOOLEAN DEFAULT false,
    is_amenity BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create branch_inventory table for tracking stock levels at each branch
CREATE TABLE IF NOT EXISTS branch_inventory (
    id SERIAL PRIMARY KEY,
    branch branch_enum NOT NULL,
    item_id INTEGER REFERENCES inventory_items(id),
    current_stock INTEGER NOT NULL DEFAULT 0,
    last_count_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(branch, item_id)
);

-- Create stock_transfers table
CREATE TABLE IF NOT EXISTS stock_transfers (
    id SERIAL PRIMARY KEY,
    transfer_number VARCHAR(50) UNIQUE NOT NULL,
    from_branch branch_enum NOT NULL,
    to_branch branch_enum NOT NULL,
    status transfer_status_enum NOT NULL DEFAULT 'pending',
    requested_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create stock_transfer_items table
CREATE TABLE IF NOT EXISTS stock_transfer_items (
    id SERIAL PRIMARY KEY,
    transfer_id INTEGER REFERENCES stock_transfers(id),
    item_id INTEGER REFERENCES inventory_items(id),
    quantity INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create consumption_records table
CREATE TABLE IF NOT EXISTS consumption_records (
    id SERIAL PRIMARY KEY,
    branch branch_enum NOT NULL,
    department VARCHAR(50) NOT NULL,
    item_id INTEGER REFERENCES inventory_items(id),
    quantity INTEGER NOT NULL,
    consumption_date TIMESTAMP WITH TIME ZONE NOT NULL,
    recorded_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create inventory_adjustments table
CREATE TABLE IF NOT EXISTS inventory_adjustments (
    id SERIAL PRIMARY KEY,
    branch branch_enum NOT NULL,
    item_id INTEGER REFERENCES inventory_items(id),
    adjustment_type VARCHAR(50) NOT NULL, -- 'addition', 'reduction', 'damage', 'loss', etc.
    quantity INTEGER NOT NULL,
    reason TEXT NOT NULL,
    adjusted_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create inventory_counts table
CREATE TABLE IF NOT EXISTS inventory_counts (
    id SERIAL PRIMARY KEY,
    branch branch_enum NOT NULL,
    count_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'in_progress', 'completed', 'cancelled'
    counted_by UUID REFERENCES users(id),
    verified_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create inventory_count_items table
CREATE TABLE IF NOT EXISTS inventory_count_items (
    id SERIAL PRIMARY KEY,
    count_id INTEGER REFERENCES inventory_counts(id),
    item_id INTEGER REFERENCES inventory_items(id),
    expected_quantity INTEGER NOT NULL,
    actual_quantity INTEGER NOT NULL,
    variance INTEGER GENERATED ALWAYS AS (actual_quantity - expected_quantity) STORED,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update_updated_at_column trigger to all tables
DROP TRIGGER IF EXISTS update_suppliers_updated_at ON suppliers;
CREATE TRIGGER update_suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_items_updated_at ON inventory_items;
CREATE TRIGGER update_inventory_items_updated_at
    BEFORE UPDATE ON inventory_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_branch_inventory_updated_at ON branch_inventory;
CREATE TRIGGER update_branch_inventory_updated_at
    BEFORE UPDATE ON branch_inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stock_transfers_updated_at ON stock_transfers;
CREATE TRIGGER update_stock_transfers_updated_at
    BEFORE UPDATE ON stock_transfers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stock_transfer_items_updated_at ON stock_transfer_items;
CREATE TRIGGER update_stock_transfer_items_updated_at
    BEFORE UPDATE ON stock_transfer_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_consumption_records_updated_at ON consumption_records;
CREATE TRIGGER update_consumption_records_updated_at
    BEFORE UPDATE ON consumption_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_adjustments_updated_at ON inventory_adjustments;
CREATE TRIGGER update_inventory_adjustments_updated_at
    BEFORE UPDATE ON inventory_adjustments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_counts_updated_at ON inventory_counts;
CREATE TRIGGER update_inventory_counts_updated_at
    BEFORE UPDATE ON inventory_counts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_count_items_updated_at ON inventory_count_items;
CREATE TRIGGER update_inventory_count_items_updated_at
    BEFORE UPDATE ON inventory_count_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
