/**
 * Apply Barcode System Migration - Clean Install
 * 
 * This script drops existing conflicting tables and creates fresh schema
 * for the Central Store Scanning & Inventory Workflow system
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
    console.log('🚀 Starting Barcode System Migration (Clean Install)...\n');
    
    // Step 1: Drop existing conflicting tables
    console.log('Step 1: Dropping existing conflicting tables...');
    await client.query(`
      DROP TABLE IF EXISTS auditor_reviews CASCADE;
      DROP TABLE IF EXISTS dispatch_audit_log CASCADE;
      DROP TABLE IF EXISTS dispatch_documents CASCADE;
      DROP TABLE IF EXISTS dispatch_otps CASCADE;
      DROP TABLE IF EXISTS dispatch_items CASCADE;
      DROP TABLE IF EXISTS item_barcodes CASCADE;
      DROP TABLE IF EXISTS pos_barcodes CASCADE;
      DROP TABLE IF EXISTS dispatches CASCADE;
      DROP TYPE IF EXISTS dispatch_status CASCADE;
    `);
    console.log('✅ Old tables dropped\n');
    
    // Step 2: Create dispatch_status enum
    console.log('Step 2: Creating dispatch_status enum...');
    await client.query(`
      CREATE TYPE dispatch_status AS ENUM (
        'pending',
        'in_transit',
        'completed',
        'audited',
        'cancelled'
      );
    `);
    console.log('✅ Enum created\n');
    
    // Step 3: Create item_barcodes table
    console.log('Step 3: Creating item_barcodes table...');
    await client.query(`
      CREATE TABLE item_barcodes (
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
      
      CREATE INDEX idx_item_barcodes_item_id ON item_barcodes(item_id);
      CREATE INDEX idx_item_barcodes_barcode_value ON item_barcodes(barcode_value);
    `);
    console.log('✅ item_barcodes table created\n');
    
    // Step 4: Create dispatches table
    console.log('Step 4: Creating dispatches table...');
    await client.query(`
      CREATE TABLE dispatches (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        dispatch_number VARCHAR(50) UNIQUE NOT NULL,
        status dispatch_status NOT NULL DEFAULT 'pending',
        source_branch VARCHAR(50) NOT NULL DEFAULT 'Bomet',
        destination_branch VARCHAR(50) NOT NULL,
        driver_id UUID,
        driver_name VARCHAR(100),
        vehicle_registration VARCHAR(50),
        notes TEXT,
        created_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        dispatched_at TIMESTAMPTZ,
        in_transit_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        audited_at TIMESTAMPTZ
      );
      
      CREATE INDEX idx_dispatches_status ON dispatches(status);
      CREATE INDEX idx_dispatches_destination_branch ON dispatches(destination_branch);
      CREATE INDEX idx_dispatches_source_branch ON dispatches(source_branch);
      CREATE INDEX idx_dispatches_created_at ON dispatches(created_at);
    `);
    console.log('✅ dispatches table created\n');
    
    // Step 5: Create dispatch_items table (NEW SCHEMA with item_id)
    console.log('Step 5: Creating dispatch_items table...');
    await client.query(`
      CREATE TABLE dispatch_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        dispatch_id UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
        item_id INTEGER NOT NULL REFERENCES inventory_items(id),
        item_name VARCHAR(255) NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        unit VARCHAR(50) NOT NULL,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX idx_dispatch_items_dispatch_id ON dispatch_items(dispatch_id);
      CREATE INDEX idx_dispatch_items_item_id ON dispatch_items(item_id);
    `);
    console.log('✅ dispatch_items table created\n');
    
    // Step 6: Create dispatch_otps table
    console.log('Step 6: Creating dispatch_otps table...');
    await client.query(`
      CREATE TABLE dispatch_otps (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        dispatch_id UUID NOT NULL UNIQUE REFERENCES dispatches(id) ON DELETE CASCADE,
        driver_otp VARCHAR(10) NOT NULL CHECK (driver_otp ~ '^D-[0-9]{4}$'),
        branch_otp VARCHAR(10) NOT NULL CHECK (branch_otp ~ '^B-[0-9]{4}$'),
        driver_otp_used_at TIMESTAMPTZ,
        branch_otp_used_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX idx_dispatch_otps_dispatch_id ON dispatch_otps(dispatch_id);
      CREATE INDEX idx_dispatch_otps_expires_at ON dispatch_otps(expires_at);
    `);
    console.log('✅ dispatch_otps table created\n');
    
    // Step 7: Create dispatch_documents table
    console.log('Step 7: Creating dispatch_documents table...');
    await client.query(`
      CREATE TABLE dispatch_documents (
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
      
      CREATE INDEX idx_dispatch_documents_dispatch_id ON dispatch_documents(dispatch_id);
    `);
    console.log('✅ dispatch_documents table created\n');
    
    // Step 8: Create dispatch_audit_log table
    console.log('Step 8: Creating dispatch_audit_log table...');
    await client.query(`
      CREATE TABLE dispatch_audit_log (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        dispatch_id UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
        action VARCHAR(100) NOT NULL,
        performed_by UUID,
        performed_by_name VARCHAR(100),
        notes TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX idx_dispatch_audit_log_dispatch_id ON dispatch_audit_log(dispatch_id);
      CREATE INDEX idx_dispatch_audit_log_created_at ON dispatch_audit_log(created_at);
    `);
    console.log('✅ dispatch_audit_log table created\n');
    
    // Step 9: Create auditor_reviews table
    console.log('Step 9: Creating auditor_reviews table...');
    await client.query(`
      CREATE TABLE auditor_reviews (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        dispatch_id UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
        auditor_id UUID,
        auditor_name VARCHAR(100),
        review_status VARCHAR(20) NOT NULL CHECK (review_status IN ('approved', 'flagged')),
        notes TEXT,
        flagged_reason TEXT,
        reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX idx_auditor_reviews_dispatch_id ON auditor_reviews(dispatch_id);
      CREATE INDEX idx_auditor_reviews_review_status ON auditor_reviews(review_status);
    `);
    console.log('✅ auditor_reviews table created\n');
    
    // Step 10: Create pos_barcodes table
    console.log('Step 10: Creating pos_barcodes table...');
    await client.query(`
      CREATE TABLE pos_barcodes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        transaction_id VARCHAR(100),
        order_id UUID,
        bill_id UUID,
        barcode_value VARCHAR(100) UNIQUE NOT NULL,
        branch_id INTEGER,
        generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        generated_by UUID
      );
      
      CREATE INDEX idx_pos_barcodes_barcode_value ON pos_barcodes(barcode_value);
      CREATE INDEX idx_pos_barcodes_transaction_id ON pos_barcodes(transaction_id);
    `);
    console.log('✅ pos_barcodes table created\n');
    
    // Step 11: Create helper functions
    console.log('Step 11: Creating helper functions...');
    await client.query(`
      -- Generate unique barcode with prefix
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
      
      -- Generate OTP with prefix (D- for driver, B- for branch)
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
      
      -- Generate dispatch number (DISP-YYYYMM-XXXX)
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
    console.log('✅ Helper functions created\n');
    
    // Step 12: Create trigger for auto-generating dispatch_number
    console.log('Step 12: Creating triggers...');
    await client.query(`
      CREATE OR REPLACE FUNCTION set_dispatch_number()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.dispatch_number IS NULL OR NEW.dispatch_number = '' THEN
          NEW.dispatch_number := generate_dispatch_number();
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      DROP TRIGGER IF EXISTS trigger_set_dispatch_number ON dispatches;
      CREATE TRIGGER trigger_set_dispatch_number
        BEFORE INSERT ON dispatches
        FOR EACH ROW
        EXECUTE FUNCTION set_dispatch_number();
      
      -- Trigger to log status changes
      CREATE OR REPLACE FUNCTION log_dispatch_status_change()
      RETURNS TRIGGER AS $$
      BEGIN
        IF OLD.status IS DISTINCT FROM NEW.status THEN
          INSERT INTO dispatch_audit_log (dispatch_id, action, notes, metadata)
          VALUES (
            NEW.id,
            'Status changed from ' || OLD.status || ' to ' || NEW.status,
            'Automatic status change log',
            jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
          );
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      DROP TRIGGER IF EXISTS trigger_log_dispatch_status_change ON dispatches;
      CREATE TRIGGER trigger_log_dispatch_status_change
        AFTER UPDATE ON dispatches
        FOR EACH ROW
        EXECUTE FUNCTION log_dispatch_status_change();
    `);
    console.log('✅ Triggers created\n');
    
    // Step 13: Test functions
    console.log('Step 13: Testing functions...');
    const testBarcode = await client.query(`SELECT generate_barcode('ITEM') as barcode`);
    console.log('  ✓ Barcode generation:', testBarcode.rows[0].barcode);
    
    const testDriverOtp = await client.query(`SELECT generate_otp('D') as otp`);
    console.log('  ✓ Driver OTP generation:', testDriverOtp.rows[0].otp);
    
    const testBranchOtp = await client.query(`SELECT generate_otp('B') as otp`);
    console.log('  ✓ Branch OTP generation:', testBranchOtp.rows[0].otp);
    
    const testDispatchNum = await client.query(`SELECT generate_dispatch_number() as dispatch_number`);
    console.log('  ✓ Dispatch number generation:', testDispatchNum.rows[0].dispatch_number);
    
    console.log('\n✅ Migration completed successfully!\n');
    console.log('📝 Next steps:');
    console.log('  1. Create Supabase Storage bucket: dispatch-documents (5MB limit)');
    console.log('  2. Configure RLS policies in Supabase Dashboard');
    console.log('  3. Test backend API endpoints');
    console.log('  4. Test mobile app screens');
    console.log('  5. Test web dashboard pages\n');
    
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
