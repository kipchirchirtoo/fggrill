// Direct PostgreSQL migration runner
require('dotenv').config({ path: './backend/.env' });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🚀 Starting restaurant enhancement migration...\n');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'backend/supabase/migrations/12_restaurant_enhancements.sql'),
      'utf8'
    );
    
    console.log('📄 Executing migration...\n');
    
    await client.query(migrationSQL);
    
    console.log('✅ Migration executed successfully!\n');
    
    // Verify tables created
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'restaurant_%'
      ORDER BY table_name
    `);
    
    console.log(`📊 Restaurant tables created: ${result.rows.length}`);
    result.rows.forEach(row => console.log(`   - ${row.table_name}`));
    
    // Verify sample data
    const sections = await client.query('SELECT COUNT(*) FROM restaurant_sections');
    console.log(`\n✅ Sample data: ${sections.rows[0].count} sections created`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
