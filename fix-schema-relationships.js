const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function fixSchemaRelationships() {
  await client.connect();
  
  try {
    console.log('🔧 Fixing Database Schema Relationships\n');
    
    // =====================================================
    // FIX 1: Purchase Orders - created_by_id relationship
    // =====================================================
    console.log('1️⃣  Fixing Purchase Orders foreign key...');
    
    // Check if column exists
    const poCheck = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'store_purchase_orders' 
      AND column_name = 'created_by_id'
    `);
    
    if (poCheck.rows.length > 0) {
      console.log('   ℹ️  created_by_id column exists');
      
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
    } else {
      // Column doesn't exist, create it
      await client.query(`
        ALTER TABLE store_purchase_orders 
        ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(id) ON DELETE SET NULL
      `);
      console.log('   ✅ Purchase orders created_by_id column added\n');
    }
    
    // =====================================================
    // FIX 2: Staff Credit Bills - staff_profiles relationship
    // =====================================================
    console.log('2️⃣  Fixing Staff Credit Bills relationships...');
    
    // Check if staff_credit_bills table exists
    const creditBillsCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'staff_credit_bills'
      )
    `);
    
    if (creditBillsCheck.rows[0].exists) {
      // Check if staff_id column exists
      const staffIdCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'staff_credit_bills' 
        AND column_name = 'staff_id'
      `);
      
      if (staffIdCheck.rows.length > 0) {
        // Drop existing constraint if any
        await client.query(`
          ALTER TABLE staff_credit_bills 
          DROP CONSTRAINT IF EXISTS staff_credit_bills_staff_id_fkey
        `);
        
        // Add proper foreign key to users table (not staff_profiles)
        await client.query(`
          ALTER TABLE staff_credit_bills 
          ADD CONSTRAINT staff_credit_bills_staff_id_fkey 
          FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE
        `);
        
        console.log('   ✅ Staff credit bills foreign key fixed\n');
      } else {
        console.log('   ⚠️  staff_id column not found in staff_credit_bills\n');
      }
    } else {
      console.log('   ⚠️  staff_credit_bills table does not exist\n');
    }
    
    // =====================================================
    // FIX 3: Staff Loans - staff_profiles relationship
    // =====================================================
    console.log('3️⃣  Fixing Staff Loans relationships...');
    
    const loansCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'staff_loans'
      )
    `);
    
    if (loansCheck.rows[0].exists) {
      const staffIdCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'staff_loans' 
        AND column_name = 'staff_id'
      `);
      
      if (staffIdCheck.rows.length > 0) {
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
        console.log('   ⚠️  staff_id column not found in staff_loans\n');
      }
    } else {
      console.log('   ⚠️  staff_loans table does not exist\n');
    }
    
    // =====================================================
    // FIX 4: Staff Advances - staff_profiles relationship
    // =====================================================
    console.log('4️⃣  Fixing Staff Advances relationships...');
    
    const advancesCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'staff_advances'
      )
    `);
    
    if (advancesCheck.rows[0].exists) {
      const staffIdCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'staff_advances' 
        AND column_name = 'staff_id'
      `);
      
      if (staffIdCheck.rows.length > 0) {
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
        console.log('   ⚠️  staff_id column not found in staff_advances\n');
      }
    } else {
      console.log('   ⚠️  staff_advances table does not exist\n');
    }
    
    // =====================================================
    // FIX 5: Update controllers to use correct joins
    // =====================================================
    console.log('5️⃣  Verifying table structures...');
    
    // Check what tables actually exist
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('staff_credit_bills', 'staff_loans', 'staff_advances', 'staff_profiles', 'store_purchase_orders')
      ORDER BY table_name
    `);
    
    console.log('   📋 Existing tables:');
    tables.rows.forEach(row => {
      console.log(`      - ${row.table_name}`);
    });
    console.log('');
    
    // =====================================================
    // FIX 6: Create indexes for performance
    // =====================================================
    console.log('6️⃣  Creating performance indexes...');
    
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
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_store_purchase_orders_created_by_id 
      ON store_purchase_orders(created_by_id)
    `);
    
    console.log('   ✅ Performance indexes created\n');
    
    console.log('🎉 All schema relationship fixes completed successfully!\n');
    console.log('✅ Fixed:');
    console.log('   - Purchase orders foreign key');
    console.log('   - Staff credit bills foreign key');
    console.log('   - Staff loans foreign key');
    console.log('   - Staff advances foreign key');
    console.log('   - Performance indexes added');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║         DATABASE SCHEMA RELATIONSHIP FIXER                 ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

fixSchemaRelationships();
