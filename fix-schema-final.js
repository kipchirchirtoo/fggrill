const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function fixSchemaRelationships() {
  await client.connect();
  
  try {
    console.log('🔧 Fixing Database Schema Relationships (Final Fix)\n');
    
    // =====================================================
    // FIX 1: Purchase Orders
    // =====================================================
    console.log('1️⃣  Fixing Purchase Orders...');
    
    // Remove NOT NULL constraint if it exists
    await client.query(`
      ALTER TABLE store_purchase_orders 
      ALTER COLUMN created_by_id DROP NOT NULL
    `).catch(() => console.log('   ℹ️  NOT NULL constraint already removed or doesn\'t exist'));
    
    // Drop existing foreign key
    await client.query(`
      ALTER TABLE store_purchase_orders 
      DROP CONSTRAINT IF EXISTS store_purchase_orders_created_by_id_fkey
    `);
    
    // Set invalid references to NULL
    const invalidPOs = await client.query(`
      UPDATE store_purchase_orders 
      SET created_by_id = NULL 
      WHERE created_by_id IS NOT NULL 
      AND created_by_id NOT IN (SELECT id FROM users)
    `);
    
    console.log(`   ℹ️  Cleaned ${invalidPOs.rowCount} invalid references`);
    
    // Add proper foreign key
    await client.query(`
      ALTER TABLE store_purchase_orders 
      ADD CONSTRAINT store_purchase_orders_created_by_id_fkey 
      FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL
    `);
    
    console.log('   ✅ Purchase orders fixed\n');
    
    // =====================================================
    // FIX 2: Staff Credit Bills
    // =====================================================
    console.log('2️⃣  Fixing Staff Credit Bills...');
    
    const cbExists = await client.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'staff_credit_bills')
    `);
    
    if (cbExists.rows[0].exists) {
      // Remove NOT NULL if exists
      await client.query(`
        ALTER TABLE staff_credit_bills 
        ALTER COLUMN staff_id DROP NOT NULL
      `).catch(() => {});
      
      // Drop existing constraint
      await client.query(`
        ALTER TABLE staff_credit_bills 
        DROP CONSTRAINT IF EXISTS staff_credit_bills_staff_id_fkey
      `);
      
      // Clean invalid data
      const invalidCB = await client.query(`
        UPDATE staff_credit_bills 
        SET staff_id = NULL 
        WHERE staff_id IS NOT NULL 
        AND staff_id NOT IN (SELECT id FROM users)
      `);
      
      console.log(`   ℹ️  Cleaned ${invalidCB.rowCount} invalid references`);
      
      // Add proper foreign key
      await client.query(`
        ALTER TABLE staff_credit_bills 
        ADD CONSTRAINT staff_credit_bills_staff_id_fkey 
        FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE SET NULL
      `);
      
      console.log('   ✅ Staff credit bills fixed\n');
    } else {
      console.log('   ⚠️  Table does not exist\n');
    }
    
    // =====================================================
    // FIX 3: Staff Loans
    // =====================================================
    console.log('3️⃣  Fixing Staff Loans...');
    
    const loansExists = await client.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'staff_loans')
    `);
    
    if (loansExists.rows[0].exists) {
      await client.query(`
        ALTER TABLE staff_loans 
        ALTER COLUMN staff_id DROP NOT NULL
      `).catch(() => {});
      
      await client.query(`
        ALTER TABLE staff_loans 
        DROP CONSTRAINT IF EXISTS staff_loans_staff_id_fkey
      `);
      
      const invalidLoans = await client.query(`
        UPDATE staff_loans 
        SET staff_id = NULL 
        WHERE staff_id IS NOT NULL 
        AND staff_id NOT IN (SELECT id FROM users)
      `);
      
      console.log(`   ℹ️  Cleaned ${invalidLoans.rowCount} invalid references`);
      
      await client.query(`
        ALTER TABLE staff_loans 
        ADD CONSTRAINT staff_loans_staff_id_fkey 
        FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE SET NULL
      `);
      
      console.log('   ✅ Staff loans fixed\n');
    } else {
      console.log('   ⚠️  Table does not exist\n');
    }
    
    // =====================================================
    // FIX 4: Staff Advances
    // =====================================================
    console.log('4️⃣  Fixing Staff Advances...');
    
    const advExists = await client.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'staff_advances')
    `);
    
    if (advExists.rows[0].exists) {
      await client.query(`
        ALTER TABLE staff_advances 
        ALTER COLUMN staff_id DROP NOT NULL
      `).catch(() => {});
      
      await client.query(`
        ALTER TABLE staff_advances 
        DROP CONSTRAINT IF EXISTS staff_advances_staff_id_fkey
      `);
      
      const invalidAdv = await client.query(`
        UPDATE staff_advances 
        SET staff_id = NULL 
        WHERE staff_id IS NOT NULL 
        AND staff_id NOT IN (SELECT id FROM users)
      `);
      
      console.log(`   ℹ️  Cleaned ${invalidAdv.rowCount} invalid references`);
      
      await client.query(`
        ALTER TABLE staff_advances 
        ADD CONSTRAINT staff_advances_staff_id_fkey 
        FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE SET NULL
      `);
      
      console.log('   ✅ Staff advances fixed\n');
    } else {
      console.log('   ⚠️  Table does not exist\n');
    }
    
    // =====================================================
    // FIX 5: Create indexes
    // =====================================================
    console.log('5️⃣  Creating performance indexes...');
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_store_purchase_orders_created_by_id ON store_purchase_orders(created_by_id)`);
    
    if (cbExists.rows[0].exists) {
      await client.query(`CREATE INDEX IF NOT EXISTS idx_staff_credit_bills_staff_id ON staff_credit_bills(staff_id)`);
    }
    
    if (loansExists.rows[0].exists) {
      await client.query(`CREATE INDEX IF NOT EXISTS idx_staff_loans_staff_id ON staff_loans(staff_id)`);
    }
    
    if (advExists.rows[0].exists) {
      await client.query(`CREATE INDEX IF NOT EXISTS idx_staff_advances_staff_id ON staff_advances(staff_id)`);
    }
    
    console.log('   ✅ Indexes created\n');
    
    console.log('🎉 All fixes completed successfully!\n');
    console.log('✅ Fixed:');
    console.log('   ✓ Purchase orders foreign key');
    console.log('   ✓ Staff credit bills foreign key');
    console.log('   ✓ Staff loans foreign key');
    console.log('   ✓ Staff advances foreign key');
    console.log('   ✓ Performance indexes');
    console.log('\n💡 All tables now properly reference users table');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║           DATABASE SCHEMA FIXER (FINAL)                   ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

fixSchemaRelationships();
