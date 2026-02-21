const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function fixStaffRelationships() {
  await client.connect();
  
  try {
    console.log('🔧 Fixing Staff Relationships (CORRECT FIX)\n');
    console.log('💡 staff_id should reference staff_profiles.id, not users.id\n');
    
    // =====================================================
    // FIX 1: Staff Credit Bills
    // =====================================================
    console.log('1️⃣  Fixing Staff Credit Bills...');
    
    const cbExists = await client.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'staff_credit_bills')
    `);
    
    if (cbExists.rows[0].exists) {
      // Remove NOT NULL
      await client.query(`
        ALTER TABLE staff_credit_bills 
        ALTER COLUMN staff_id DROP NOT NULL
      `).catch(() => {});
      
      // Drop existing constraint
      await client.query(`
        ALTER TABLE staff_credit_bills 
        DROP CONSTRAINT IF EXISTS staff_credit_bills_staff_id_fkey
      `);
      
      // Clean invalid data (staff_id not in staff_profiles)
      const invalidCB = await client.query(`
        UPDATE staff_credit_bills 
        SET staff_id = NULL 
        WHERE staff_id IS NOT NULL 
        AND staff_id NOT IN (SELECT id FROM staff_profiles)
      `);
      
      console.log(`   ℹ️  Cleaned ${invalidCB.rowCount} invalid references`);
      
      // Add correct foreign key to staff_profiles
      await client.query(`
        ALTER TABLE staff_credit_bills 
        ADD CONSTRAINT staff_credit_bills_staff_id_fkey 
        FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON DELETE CASCADE
      `);
      
      console.log('   ✅ Staff credit bills now references staff_profiles\n');
    }
    
    // =====================================================
    // FIX 2: Staff Loans
    // =====================================================
    console.log('2️⃣  Fixing Staff Loans...');
    
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
        AND staff_id NOT IN (SELECT id FROM staff_profiles)
      `);
      
      console.log(`   ℹ️  Cleaned ${invalidLoans.rowCount} invalid references`);
      
      await client.query(`
        ALTER TABLE staff_loans 
        ADD CONSTRAINT staff_loans_staff_id_fkey 
        FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON DELETE CASCADE
      `);
      
      console.log('   ✅ Staff loans now references staff_profiles\n');
    }
    
    // =====================================================
    // FIX 3: Staff Advances
    // =====================================================
    console.log('3️⃣  Fixing Staff Advances...');
    
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
        AND staff_id NOT IN (SELECT id FROM staff_profiles)
      `);
      
      console.log(`   ℹ️  Cleaned ${invalidAdv.rowCount} invalid references`);
      
      await client.query(`
        ALTER TABLE staff_advances 
        ADD CONSTRAINT staff_advances_staff_id_fkey 
        FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON DELETE CASCADE
      `);
      
      console.log('   ✅ Staff advances now references staff_profiles\n');
    }
    
    // =====================================================
    // FIX 4: Create indexes
    // =====================================================
    console.log('4️⃣  Creating performance indexes...');
    
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
    
    console.log('🎉 All staff relationship fixes completed!\n');
    console.log('✅ Summary:');
    console.log('   ✓ Staff credit bills -> staff_profiles.id');
    console.log('   ✓ Staff loans -> staff_profiles.id');
    console.log('   ✓ Staff advances -> staff_profiles.id');
    console.log('   ✓ Performance indexes created');
    console.log('\n💡 Controllers can now join with staff_profiles correctly');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║        STAFF RELATIONSHIPS FIXER (CORRECT)                ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

fixStaffRelationships();
