const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Direct connection string
const connectionString = 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan@13900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Run the complete storekeeping migration
    const sqlPath = path.join(__dirname, 'backend/supabase/migrations/11_COMPLETE_storekeeping.sql');
    
    if (!fs.existsSync(sqlPath)) {
      console.error('❌ Migration file not found:', sqlPath);
      process.exit(1);
    }
    
    console.log('📄 Reading migration file...');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log(`✅ Loaded migration file (${sql.length} bytes)\n`);
    
    console.log('🚀 Running migration...');
    console.log('⏳ This may take 30-60 seconds...\n');
    
    await client.query(sql);
    
    console.log('✅ ✅ ✅ Migration completed successfully!\n');
    console.log('📊 Verifying tables created...');
    
    // Verify tables
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'store_%'
      ORDER BY table_name;
    `);
    
    console.log(`\n✅ Created ${result.rows.length} storekeeping tables:`);
    result.rows.forEach(row => console.log(`   - ${row.table_name}`));
    
    console.log('\n🎉 Migration complete! You can now:');
    console.log('   1. Start the backend: cd backend && npm run dev');
    console.log('   2. Test API endpoints');
    console.log('   3. Use the frontend storekeeping module\n');
    
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    console.error('Full error:', err);
    console.log('\n📝 Alternative: Run migration manually in Supabase Dashboard:');
    console.log('   1. Go to https://app.supabase.com');
    console.log('   2. Open SQL Editor');
    console.log('   3. Copy content from: backend/supabase/migrations/11_COMPLETE_storekeeping.sql');
    console.log('   4. Paste and run in SQL Editor\n');
  } finally {
    await client.end();
  }
}

runMigration();
