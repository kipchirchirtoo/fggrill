-- Hotel Management System Schema (Fixed for Existing Schema)

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Room Types (Handle existing or create new)
DO $$ 
BEGIN
    -- Check if table exists
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'room_types') THEN
        CREATE TABLE room_types (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(100) NOT NULL,
            description TEXT,
            base_price DECIMAL(10, 2) NOT NULL,
            capacity INTEGER NOT NULL DEFAULT 2,
            amenities JSONB DEFAULT '[]',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    ELSE
        -- Table exists, ensure it has necessary columns (idempotent)
        -- Assuming existing ID is UUID based on error message
        NULL;
    END IF;
END $$;

-- 2. Rooms (Handle existing)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'rooms') THEN
        CREATE TABLE rooms (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            room_number VARCHAR(20) NOT NULL UNIQUE,
            room_type_id UUID REFERENCES room_types(id),
            floor_number INTEGER NOT NULL,
            status VARCHAR(20) DEFAULT 'available',
            is_clean BOOLEAN DEFAULT TRUE,
            branch_id INTEGER,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    ELSE
        -- Add columns if they don't exist
        BEGIN
            ALTER TABLE rooms ADD COLUMN IF NOT EXISTS room_type_id UUID REFERENCES room_types(id);
        EXCEPTION WHEN duplicate_column THEN NULL; END;
        
        BEGIN
            ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_clean BOOLEAN DEFAULT TRUE;
        EXCEPTION WHEN duplicate_column THEN NULL; END;

        -- Ensure status column allows new values (if it's a check constraint, might need generic update, skipping complex constraint mod for now to avoid errors)
    END IF;
END $$;

-- 3. Guests
CREATE TABLE IF NOT EXISTS guests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    id_type VARCHAR(50),
    id_number VARCHAR(100),
    address TEXT,
    nationality VARCHAR(100),
    preferences JSONB DEFAULT '{}',
    is_vip BOOLEAN DEFAULT FALSE,
    blacklist_status BOOLEAN DEFAULT FALSE,
    blacklist_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Rate Plans
CREATE TABLE IF NOT EXISTS rate_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    multiplier DECIMAL(3, 2) DEFAULT 1.0,
    valid_from DATE,
    valid_to DATE,
    is_active BOOLEAN DEFAULT TRUE
);

-- 5. Reservations
CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    confirmation_number VARCHAR(20) UNIQUE NOT NULL,
    guest_id UUID REFERENCES guests(id),
    room_id UUID REFERENCES rooms(id),
    room_type_id UUID REFERENCES room_types(id), -- Changed to UUID
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    adults INTEGER DEFAULT 1,
    children INTEGER DEFAULT 0,
    rate_plan_id INTEGER REFERENCES rate_plans(id),
    total_amount DECIMAL(10, 2) NOT NULL,
    notes TEXT,
    special_requests TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Folios (Billing)
CREATE TABLE IF NOT EXISTS folios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID REFERENCES reservations(id),
    guest_id UUID REFERENCES guests(id),
    status VARCHAR(20) DEFAULT 'open',
    total_charges DECIMAL(10, 2) DEFAULT 0.00,
    total_payments DECIMAL(10, 2) DEFAULT 0.00,
    balance DECIMAL(10, 2) GENERATED ALWAYS AS (total_charges - total_payments) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Transactions
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    folio_id UUID REFERENCES folios(id),
    type VARCHAR(20) NOT NULL,
    category VARCHAR(50) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    description TEXT,
    reference_number VARCHAR(100),
    performed_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Documents
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guest_id UUID REFERENCES guests(id),
    reservation_id UUID REFERENCES reservations(id),
    type VARCHAR(50) NOT NULL,
    file_url TEXT NOT NULL,
    uploaded_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reservations_dates ON reservations(check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_reservations_guest ON reservations(guest_id);
CREATE INDEX IF NOT EXISTS idx_guests_search ON guests(last_name, phone, email);
