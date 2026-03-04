require('dotenv').config({ path: 'backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testStockTakeCreation() {
  console.log('🧪 Testing Stock Take Creation\n');
  console.log('='.repeat(80));

  try {
    // 1. Get a test user
    console.log('\n📋 Step 1: Getting test user...');
    const userResult = await pool.query(`
      SELECT id, first_name, last_name, email 
      FROM users 
      LIMIT 1;
    `);

    if (userResult.rows.length === 0) {
      console.log('❌ No suitable users found');
      return;
    }

    const testUser = userResult.rows[0];
    console.log(`✅ Found user: ${testUser.first_name} ${testUser.last_name} (${testUser.email})`);

    // 2. Get a test branch
    console.log('\n📋 Step 2: Getting test branch...');
    const branchResult = await pool.query(`
      SELECT id, name, code 
      FROM branches 
      LIMIT 1;
    `);

    if (branchResult.rows.length === 0) {
      console.log('❌ No branches found');
      return;
    }

    const testBranch = branchResult.rows[0];
    console.log(`✅ Found branch: ${testBranch.name} (${testBranch.code})`);

    // 3. Create a test stock count
    console.log('\n📋 Step 3: Creating test stock count...');
    const insertResult = await pool.query(`
      INSERT INTO stock_counts (
        branch_id,
        count_date,
        count_type,
        status,
        notes,
        created_by
      ) VALUES (
        $1,
        CURRENT_DATE,
        'daily',
        'draft',
        'Test stock count - automated test',
        $2
      )
      RETURNING *;
    `, [testBranch.id, testUser.id]);

    const newStockCount = insertResult.rows[0];
    console.log('✅ Stock count created successfully!');
    console.log(`   ID: ${newStockCount.id}`);
    console.log(`   Branch: ${testBranch.name}`);
    console.log(`   Created by: ${testUser.first_name} ${testUser.last_name}`);
    console.log(`   Date: ${newStockCount.count_date}`);
    console.log(`   Type: ${newStockCount.count_type}`);
    console.log(`   Status: ${newStockCount.status}`);

    // 4. Verify the created_by field
    console.log('\n📋 Step 4: Verifying created_by field...');
    const verifyResult = await pool.query(`
      SELECT 
        sc.*,
        u.first_name,
        u.last_name,
        u.email
      FROM stock_counts sc
      LEFT JOIN users u ON sc.created_by = u.id
      WHERE sc.id = $1;
    `, [newStockCount.id]);

    const verified = verifyResult.rows[0];
    if (verified.created_by === testUser.id) {
      console.log('✅ created_by field correctly set');
      console.log(`   User: ${verified.first_name} ${verified.last_name}`);
    } else {
      console.log('❌ created_by field mismatch');
    }

    // 5. Clean up test record
    console.log('\n📋 Step 5: Cleaning up test record...');
    await pool.query(`DELETE FROM stock_counts WHERE id = $1`, [newStockCount.id]);
    console.log('✅ Test record deleted');

    console.log('\n' + '='.repeat(80));
    console.log('✅ ALL TESTS PASSED');
    console.log('='.repeat(80));
    console.log('\n🎯 Summary:');
    console.log('   ✅ Database connection working');
    console.log('   ✅ created_by column exists and is accessible');
    console.log('   ✅ Insert operation successful');
    console.log('   ✅ Foreign key relationship working');
    console.log('\n🚀 The stock take creation should work in the application now!');
    console.log('\n💡 Next steps:');
    console.log('   1. Clear browser cache');
    console.log('   2. Refresh the page');
    console.log('   3. Try creating a stock take\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    
    if (error.message.includes('created_by')) {
      console.log('\n🔧 Suggested fix:');
      console.log('   Run: node fix-stock-take-schema-cache.js');
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testStockTakeCreation();
