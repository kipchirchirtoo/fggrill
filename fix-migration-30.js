const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function fixMigration30() {
  await client.connect();
  
  try {
    console.log('🔧 Fixing Migration #30 - Comprehensive Enhancements\n');
    
    // 1. Create catering_bookings
    console.log('1️⃣  Creating catering_bookings table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS catering_bookings (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
        booking_number TEXT UNIQUE NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT,
        customer_email TEXT,
        event_type TEXT,
        event_date DATE NOT NULL,
        event_time TIME,
        venue_address TEXT NOT NULL,
        num_guests INTEGER NOT NULL,
        menu_details JSONB,
        special_requirements TEXT,
        total_amount DECIMAL(10,2) DEFAULT 0,
        amount_paid DECIMAL(10,2) DEFAULT 0,
        payment_status TEXT DEFAULT 'pending',
        booking_status TEXT DEFAULT 'confirmed',
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ catering_bookings created\n');
    
    // 2. Create payroll_deduction_rates
    console.log('2️⃣  Creating payroll_deduction_rates table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS payroll_deduction_rates (
        id SERIAL PRIMARY KEY,
        deduction_type TEXT NOT NULL,
        rate_type TEXT,
        rate_value DECIMAL(10,4),
        min_amount DECIMAL(10,2),
        max_amount DECIMAL(10,2),
        effective_from DATE,
        effective_to DATE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ payroll_deduction_rates created\n');
    
    // 3. Insert default deduction rates
    console.log('3️⃣  Inserting default deduction rates...');
    await client.query(`
      INSERT INTO payroll_deduction_rates (deduction_type, rate_type, rate_value, is_active, effective_from) 
      VALUES
        ('SHA', 'percentage', 2.75, TRUE, '2024-01-01'),
        ('NSSF', 'percentage', 6.00, TRUE, '2024-01-01')
      ON CONFLICT DO NOTHING
    `);
    console.log('   ✅ Default rates inserted\n');
    
    // 4. Add payroll columns
    console.log('4️⃣  Adding enhanced payroll columns...');
    await client.query(`
      ALTER TABLE payroll 
      ADD COLUMN IF NOT EXISTS sha_deduction DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS nssf_deduction DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS uniform_deduction DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS contributions_deduction DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS absent_days INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS absent_days_deduction DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS net_salary DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS working_days INTEGER DEFAULT 26
    `);
    console.log('   ✅ Payroll columns added\n');
    
    // 5. Add supplier columns
    console.log('5️⃣  Adding supplier columns...');
    await client.query(`
      ALTER TABLE suppliers 
      ADD COLUMN IF NOT EXISTS category TEXT,
      ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2)
    `);
    console.log('   ✅ Supplier columns added\n');
    
    // 6. Create supplier_products
    console.log('6️⃣  Creating supplier_products table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS supplier_products (
        id SERIAL PRIMARY KEY,
        supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
        product_name TEXT NOT NULL,
        product_code TEXT,
        unit_price DECIMAL(10,2),
        minimum_order_quantity INTEGER DEFAULT 1,
        lead_time_days INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ supplier_products created\n');
    
    // 7. Create indexes
    console.log('7️⃣  Creating indexes...');
    await client.query('CREATE INDEX IF NOT EXISTS idx_catering_bookings_branch_id ON catering_bookings(branch_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_catering_bookings_event_date ON catering_bookings(event_date)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_catering_bookings_status ON catering_bookings(booking_status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_suppliers_category ON suppliers(category)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier_id ON supplier_products(supplier_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_payroll_deduction_rates_type ON payroll_deduction_rates(deduction_type)');
    console.log('   ✅ Indexes created\n');
    
    console.log('🎉 Migration #30 completed successfully!');
    console.log('\n✅ Created:');
    console.log('   - catering_bookings table');
    console.log('   - payroll_deduction_rates table');
    console.log('   - supplier_products table');
    console.log('   - Enhanced payroll columns (SHA, NSSF, etc.)');
    console.log('   - Supplier category and rating columns');
    console.log('   - All necessary indexes');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

fixMigration30();
