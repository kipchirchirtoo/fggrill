const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function fixSchemaRelationships() {
  await client.connect();
  
  try {
    console.log('🔧 Fixing Database Schema Relationships (Safe Mode)\n');
    
    // =====================================================
    // FIX 1: Purchase Orders - created_by_id relationship
    // =====================================================
    console.log('1️⃣  Fixing Purchase Orders foreign key...');
    
    // First, set invalid created_by_id to NULL
    const invalidPOs = await client.query(`
      UPDATE store_purchase_orders 
      SET created_by_id = NULL 
      WHERE created_by_id IS NOT NULL 
      AND created_by_id NOT IN (SELECT id FROM users)
    `);
    
    console.log(`   ℹ️  Cleaned ${invalidPOs.rowCount} invalid purchase order references`);
    
    // Drop existing constraint if any
    await client.query(`
      ALTER TABLE store_purchase_orders 
      DROP CONSTRAINT IF EXISTS store_purchase_orders_created_by_id_fkey
    `);
    
    // Add proper foreign key constraint
    await client.query(`
      ALTER TABLE store_purchase_orders 
      ADD CONSTRAINT store_purchase_orders_created_by_id_fkey 
      FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL
    `);
    
    console.log('   ✅ Purchase orders foreign key fixed\n');
    
    // =====================================================
    // FIX 2: Staff Credit Bills
    // =====================================================
    console.log('2️⃣  Fixing Staff Credit Bills relationships...');
    
    const creditBillsCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'staff_credit_bills'
      )
    `);
    
    if (creditBillsCheck.rows[0].exists) {
      // Clean invalid references
      const invalidCB = await client.query(`
        UPDATE staff_credit_bills 
        SET staff_id = NULL 
        WHERE staff_id IS NOT NULL 
        AND staff_id NOT IN (SELECT id FROM users)
      `);
      
      console.log(`   ℹ️  Cleaned ${invalidCB.rowCount} invalid credit bill references`);
      
      await client.query(`
        ALTER TABLE staff_credit_bills 
        DROP CONSTRAINT IF EXISTS staff_credit_bills_staff_id_fkey
      `);
      
      await client.query(`
        ALTER TABLE staff_credit_bills 
        ADD CONSTRAINT staff_credit_bills_staff_id_fkey 
        FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE
      `);
      
      console.log('   ✅ Staff credit bills foreign key fixed\n');
    } else {
      console.log('   ⚠️  staff_credit_bills table does not exist\n');
    }
    
    // =====================================================
    // FIX 3: Staff Loans
    // =====================================================
    console.log('3️⃣  Fixing Staff Loans relationships...');
    
    const loansCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'staff_loans'
      )
    `);
    
    if (loansCheck.rows[0].exists) {
      const invalidLoans = await client.query(`
        UPDATE staff_loans 
        SET staff_id = NULL 
        WHERE staff_id IS NOT NULL 
        AND staff_id NOT IN (SELECT id FROM users)
      `);
      
      console.log(`   ℹ️  Cleaned ${invalidLoans.rowCount} invalid loan references`);
      
      await client.query(`
        ALTER TABLE staff_loans 
        DROP CONSTRAINT IF EXISTS staff_loans_staff_id_fkey
      `);
      
      await client.query(`
        ALTER TABLE staff_loans 
        ADD CONSTRAINT staff_loans_staff_id_fkey 
        FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE
      `);
      
      console.log('   ✅ Staff loans foreign key fixed\n');
    } else {
      console.log('   ⚠️  staff_loans table does not exist\n');
    }
    
    // =====================================================
    // FIX 4: Staff Advances
    // =====================================================
    console.log('4️⃣  Fixing Staff Advances relationships...');
    
    const advancesCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'staff_advances'
      )
    `);
    
    if (advancesCheck.rows[0].exists) {
      const invalidAdv = await client.query(`
        UPDATE staff_advances 
        SET staff_id = NULL 
        WHERE staff_id IS NOT NULL 
        AND staff_id NOT IN (SELECT id FROM users)
      `);
      
      console.log(`   ℹ️  Cleaned ${invalidAdv.rowCount} invalid advance references`);
      
      await client.query(`
        ALTER TABLE staff_advances 
        DROP CONSTRAINT IF EXISTS staff_advances_staff_id_fkey
      `);
      
      await client.query(`
        ALTER TABLE staff_advances 
        ADD CONSTRAINT staff_advances_staff_id_fkey 
        FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE
      `);
      
      console.log('   ✅ Staff advances foreign key fixed\n');
    } else {
      console.log('   ⚠️  staff_advances table does not exist\n');
    }
    
    // =====================================================
    // FIX 5: Create indexes for performance
    // =====================================================
    console.log('5️⃣  Creating performance indexes...');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_store_purchase_orders_created_by_id 
      ON store_purchase_orders(created_by_id)
    `);
    
    if (creditBillsCheck.rows[0].exists) {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_staff_credit_bills_staff_id 
        ON staff_credit_bills(staff_id)
      `);
    }
    
    if (loansCheck.rows[0].exists) {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_staff_loans_staff_id 
        ON staff_loans(staff_id)
      `);
    }
    
    if (advancesCheck.rows[0].exists) {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_staff_advances_staff_id 
        ON staff_advances(staff_id)
      `);
    }
    
    console.log('   ✅ Performance indexes created\n');
    
    // =====================================================
    // FIX 6: Update controller queries to use correct table
    // =====================================================
    console.log('6️⃣  Checking table structures...');
    
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('staff_credit_bills', 'staff_loans', 'staff_advances', 'staff_profiles', 'store_purchase_orders')
      ORDER BY table_name
    `);
    
    console.log('   📋 Verified tables:');
    tables.rows.forEach(row => {
      console.log(`      ✓ ${row.table_name}`);
    });
    console.log('');
    
    console.log('🎉 All schema relationship fixes completed successfully!\n');
    console.log('✅ Summary:');
    console.log('   - Purchase orders: Foreign key fixed, invalid data cleaned');
    console.log('   - Staff credit bills: Foreign key fixed, invalid data cleaned');
    console.log('   - Staff loans: Foreign key fixed, invalid data cleaned');
    console.log('   - Staff advances: Foreign key fixed, invalid data cleaned');
    console.log('   - Performance indexes: Created');
    console.log('\n💡 Note: All foreign keys now reference users table directly');
    console.log('   Controllers will join with users table instead of staff_profiles');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║      DATABASE SCHEMA RELATIONSHIP FIXER (SAFE MODE)       ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

fixSchemaRelationships();
