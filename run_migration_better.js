// Direct PostgreSQL migration runner with better error handling
require('dotenv').config({ path: './backend/.env' });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🚀 Starting restaurant enhancement migration...\n');
  
  // Parse DATABASE_URL to fix any issues
  const dbUrl = process.env.DATABASE_URL;
  console.log('Using DB URL:', dbUrl.replace(/:[^:@]+@/, ':****@'));
  
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('📡 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!\n');
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'backend/supabase/migrations/12_restaurant_enhancements.sql'),
      'utf8'
    );
    
    console.log('📄 Migration file loaded, executing...');
    console.log(`   File size: ${migrationSQL.length} bytes\n`);
    
    // Execute migration within a transaction
    await client.query('BEGIN');
    
    try {
      await client.query(migrationSQL);
      await client.query('COMMIT');
      console.log('✅ Migration executed successfully!\n');
    } catch (execError) {
      await client.query('ROLLBACK');
      console.error('❌ Migration failed, rolled back:', execError.message);
      console.error('\nError details:', execError);
      throw execError;
    }
    
    // Verify tables created
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'restaurant_%'
      ORDER BY table_name
    `);
    
    console.log(`📊 Restaurant tables in database: ${result.rows.length}`);
    if (result.rows.length > 0) {
      result.rows.forEach((row, i) => {
        if (i < 10 || i >= result.rows.length - 3) {
          console.log(`   - ${row.table_name}`);
        } else if (i === 10) {
          console.log(`   ... (${result.rows.length - 13} more tables) ...`);
        }
      });
    }
    
    // Verify sample data
    try {
      const sections = await client.query('SELECT COUNT(*) FROM restaurant_sections');
      console.log(`\n✅ Sample data: ${sections.rows[0].count} sections created`);
    } catch (e) {
      console.log('\n⚠️  Sample data may not be created yet');
    }
    
    // Verify views
    const views = await client.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'restaurant_%'
    `);
    console.log(`📊 Views created: ${views.rows.length}`);
    views.rows.forEach(row => console.log(`   - ${row.table_name}`));
    
    console.log('\n🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error('Message:', error.message);
    if (error.code) console.error('Code:', error.code);
    if (error.position) console.error('Position:', error.position);
    if (error.detail) console.error('Detail:', error.detail);
    if (error.hint) console.error('Hint:', error.hint);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n📡 Database connection closed');
  }
}

runMigration();
