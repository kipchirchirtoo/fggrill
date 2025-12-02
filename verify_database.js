const { Client } = require('pg');

const connectionString = 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan@13900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function verifyDatabase() {
  try {
    console.log('🔌 Connecting to database...\n');
    await client.connect();
    
    // Check storekeeping tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'store_%'
      ORDER BY table_name;
    `);
    
    console.log(`✅ Found ${tablesResult.rows.length} storekeeping tables:`);
    tablesResult.rows.forEach(row => console.log(`   ✓ ${row.table_name}`));
    
    // Check functions
    const functionsResult = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND (routine_name LIKE 'generate_%' OR routine_name LIKE 'process_%')
      ORDER BY routine_name;
    `);
    
    console.log(`\n✅ Found ${functionsResult.rows.length} storekeeping functions:`);
    functionsResult.rows.slice(0, 10).forEach(row => console.log(`   ✓ ${row.routine_name}`));
    if (functionsResult.rows.length > 10) {
      console.log(`   ... and ${functionsResult.rows.length - 10} more`);
    }
    
    // Check sample data in key tables
    const itemsCount = await client.query('SELECT COUNT(*) FROM store_items');
    const suppliersCount = await client.query('SELECT COUNT(*) FROM store_suppliers');
    const branchesResult = await client.query('SELECT id, name, code FROM branches ORDER BY id LIMIT 6');
    
    console.log('\n📊 Database Status:');
    console.log(`   • Items: ${itemsCount.rows[0].count}`);
    console.log(`   • Suppliers: ${suppliersCount.rows[0].count}`);
    console.log(`   • Branches: ${branchesResult.rows.length}`);
    
    if (branchesResult.rows.length > 0) {
      console.log('\n🏢 Branches configured:');
      branchesResult.rows.forEach(branch => {
        console.log(`   ✓ ${branch.name} (${branch.code})`);
      });
    }
    
    console.log('\n✅ ✅ ✅ DATABASE IS READY!');
    console.log('\n🎯 Next steps:');
    console.log('   1. Frontend is running at http://localhost:3000');
    console.log('   2. Start backend: cd backend && npm run dev');
    console.log('   3. Login and test the storekeeping module\n');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

verifyDatabase();
