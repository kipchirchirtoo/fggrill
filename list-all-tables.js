require('dotenv').config({ path: './backend/.env' });
const { Client } = require('pg');

async function listAllTables() {
  console.log('📋 ALL TABLES IN DATABASE\n');
  console.log('='.repeat(80));
  
  const connectionString = process.env.DATABASE_URL;
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log(`Found ${result.rows.length} tables:\n`);
    
    for (const row of result.rows) {
      const tableName = row.table_name;
      try {
        const countResult = await client.query(`SELECT COUNT(*) FROM ${tableName}`);
        const count = parseInt(countResult.rows[0].count);
        console.log(`  ${tableName.padEnd(50)} ${count} records`);
      } catch (e) {
        console.log(`  ${tableName.padEnd(50)} (error counting)`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

listAllTables();
