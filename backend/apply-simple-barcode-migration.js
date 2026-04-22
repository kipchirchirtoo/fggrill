/**
 * Apply Simple Barcode System Migration (without complex RLS)
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function applyMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting Simple Barcode System Migration...\n');
    
    // NO TRANSACTION - run each statement independently
    
    // 1. Create dispatch_status enum
    console.log('Creating dispatch_status enum...');
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE dispatch_status AS ENUM (
          'pending',
          'in_transit',
          'completed',
          'audited',
          'cancelled'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    // 2. Create item_barcodes table
    console.log('Creating item_barcodes table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS item_barcodes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
        barcode_value VARCHAR(100) UNIQUE NOT NULL,
        barcode_type VARCHAR(20) NOT NULL DEFAULT 'item',
        generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        printed_at TIMESTAMPTZ,
        created_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_item_barcodes_item_id ON item_barcodes(item_id);
      CREATE INDEX IF NOT EXISTS idx_item_barcodes_barcode_value ON item_barcodes(barcode_value);
    `);
    
    // 3. Create dispatches table
    console.log('Creating dispatches table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS dispatches (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        dispatch_number VARCHAR(50) UNIQUE NOT NULL,
        status dispatch_status NOT NULL DEFAULT 'pending',
        source_branch VARCHAR(50) NOT NULL DEFAULT 'Bomet',
        destination_branch VARCHAR(50) NOT NULL,
        driver_id UUID,
        notes TEXT,
        created_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        dispatched_at TIMESTAMPTZ,
        in_transit_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        audited_at TIMESTAMPTZ
      );
      
      CREATE INDEX IF NOT EXISTS idx_dispatches_status ON dispatches(status);
      CREATE INDEX IF NOT EXISTS idx_dispatches_destination_branch ON dispatches(destination_branch);
    `);
    
    // 4. Create dispatch_items table
    console.log('Creating dispatch_items table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS dispatch_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        dispatch_id UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
        item_id INTEGER NOT NULL REFERENCES inventory_items(id),
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_dispatch_items_dispatch_id ON dispatch_items(dispatch_id);
      CREATE INDEX IF NOT EXISTS idx_dispatch_items_item_id ON dispatch_items(item_id);
    `);
    
    // 5. Create dispatch_otps table
    console.log('Creating dispatch_otps table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS dispatch_otps (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        dispatch_id UUID NOT NULL UNIQUE REFERENCES dispatches(id) ON DELETE CASCADE,
        driver_otp VARCHAR(10) NOT NULL CHECK (driver_otp ~ '^D-[0-9]{4}$'),
        branch_otp VARCHAR(10) NOT NULL CHECK (branch_otp ~ '^B-[0-9]{4}$'),
        driver_otp_used_at TIMESTAMPTZ,
        branch_otp_used_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_dispatch_otps_dispatch_id ON dispatch_otps(dispatch_id);
    `);
    
    // 6. Create dispatch_documents table
    console.log('Creating dispatch_documents table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS dispatch_documents (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        dispatch_id UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
        document_url TEXT NOT NULL,
        document_type VARCHAR(50) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        uploaded_by UUID,
        uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_dispatch_documents_dispatch_id ON dispatch_documents(dispatch_id);
    `);
    
    // 7. Create dispatch_audit_log table
    console.log('Creating dispatch_audit_log table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS dispatch_audit_log (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        dispatch_id UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
        action VARCHAR(100) NOT NULL,
        performed_by UUID,
        notes TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_dispatch_audit_log_dispatch_id ON dispatch_audit_log(dispatch_id);
    `);
    
    // 8. Create auditor_reviews table
    console.log('Creating auditor_reviews table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS auditor_reviews (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        dispatch_id UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
        auditor_id UUID,
        review_status VARCHAR(20) NOT NULL CHECK (review_status IN ('approved', 'flagged')),
        notes TEXT,
        flagged_reason TEXT,
        reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_auditor_reviews_dispatch_id ON auditor_reviews(dispatch_id);
    `);
    
    // 9. Create pos_barcodes table
    console.log('Creating pos_barcodes table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS pos_barcodes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        transaction_id VARCHAR(100),
        order_id UUID,
        bill_id UUID,
        barcode_value VARCHAR(100) UNIQUE NOT NULL,
        generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        generated_by UUID
      );
      
      CREATE INDEX IF NOT EXISTS idx_pos_barcodes_barcode_value ON pos_barcodes(barcode_value);
    `);
    
    // 10. Create functions
    console.log('Creating helper functions...');
    await client.query(`
      CREATE OR REPLACE FUNCTION generate_barcode(prefix TEXT DEFAULT 'ITEM')
      RETURNS TEXT AS $$
      DECLARE
        uuid_part TEXT;
        barcode TEXT;
      BEGIN
        uuid_part := REPLACE(SUBSTRING(uuid_generate_v4()::TEXT, 1, 15), '-', '');
        barcode := prefix || '-' || UPPER(uuid_part);
        RETURN barcode;
      END;
      $$ LANGUAGE plpgsql;
      
      CREATE OR REPLACE FUNCTION generate_otp(prefix TEXT)
      RETURNS TEXT AS $$
      DECLARE
        otp_digits TEXT;
        otp TEXT;
      BEGIN
        otp_digits := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
        otp := prefix || '-' || otp_digits;
        RETURN otp;
      END;
      $$ LANGUAGE plpgsql;
      
      CREATE OR REPLACE FUNCTION generate_dispatch_number()
      RETURNS TEXT AS $$
      DECLARE
        year TEXT;
        month TEXT;
        counter INT;
        dispatch_num TEXT;
      BEGIN
        year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
        month := LPAD(EXTRACT(MONTH FROM CURRENT_DATE)::TEXT, 2, '0');
        
        SELECT COALESCE(MAX(SUBSTRING(dispatch_number FROM '\\d+$')::INT), 0) + 1
        INTO counter
        FROM dispatches
        WHERE dispatch_number LIKE 'DISP-' || year || month || '-%';
        
        dispatch_num := 'DISP-' || year || month || '-' || LPAD(counter::TEXT, 4, '0');
        RETURN dispatch_num;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('  1. Create Supabase Storage bucket: dispatch-documents');
    console.log('  2. Test barcode generation: SELECT generate_barcode(\'ITEM\');');
    console.log('  3. Test OTP generation: SELECT generate_otp(\'D\'), generate_otp(\'B\');');
    
  } catch (error) {
    console.error('\n❌ Migration failed!');
    console.error('Error:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
