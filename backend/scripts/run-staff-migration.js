const { Client } = require('pg');
require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

async function runMigration() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database');

    console.log('\n📋 Running migration: Add branch_id to staff_profiles');
    
    // Step 1: Add branch_id column
    console.log('\n1️⃣ Adding branch_id column...');
    await client.query(`
      ALTER TABLE staff_profiles 
      ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);
    `);
    console.log('✅ Column added');

    // Step 2: Create index
    console.log('\n2️⃣ Creating index...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_staff_profiles_branch_id 
      ON staff_profiles(branch_id);
    `);
    console.log('✅ Index created');

    // Step 3: Update existing records
    console.log('\n3️⃣ Updating existing staff profiles...');
    const updateResult = await client.query(`
      UPDATE staff_profiles 
      SET branch_id = 1 
      WHERE branch_id IS NULL 
      AND EXISTS (SELECT 1 FROM branches WHERE id = 1);
    `);
    console.log(`✅ Updated ${updateResult.rowCount} staff profiles`);

    // Step 4: Verify migration
    console.log('\n4️⃣ Verifying migration...');
    const verifyResult = await client.query(`
      SELECT 
        COUNT(*) as total_staff,
        COUNT(branch_id) as staff_with_branch,
        COUNT(*) - COUNT(branch_id) as staff_without_branch
      FROM staff_profiles;
    `);
    
    const stats = verifyResult.rows[0];
    console.log('\n📊 Migration Statistics:');
    console.log(`   Total staff: ${stats.total_staff}`);
    console.log(`   Staff with branch: ${stats.staff_with_branch}`);
    console.log(`   Staff without branch: ${stats.staff_without_branch}`);

    // Step 5: Show staff by branch
    console.log('\n5️⃣ Staff distribution by branch:');
    const branchResult = await client.query(`
      SELECT 
        b.id as branch_id,
        b.name as branch_name,
        COUNT(sp.id) as staff_count
      FROM branches b
      LEFT JOIN staff_profiles sp ON sp.branch_id = b.id
      GROUP BY b.id, b.name
      ORDER BY b.id;
    `);
    
    branchResult.rows.forEach(row => {
      console.log(`   Branch ${row.branch_id} (${row.branch_name}): ${row.staff_count} staff`);
    });

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Restart your backend server (if not using nodemon)');
    console.log('   2. Uncomment branch_id filter in staff.controller.ts');
    console.log('   3. Staff management will now properly filter by branch');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

runMigration();
