/**
 * Bar Module Migration Runner
 * Run with: node run-bar-migration.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/fggrill'
});

async function runMigration() {
  console.log('=========================================');
  console.log('Running Bar Module Migration');
  console.log('Famous Gate Hotel');
  console.log('=========================================\n');

  const client = await pool.connect();
  
  try {
    // Read migration files
    const barModuleSql = fs.readFileSync(
      path.join(__dirname, 'src/database/migrations/20251128_bar_module.sql'),
      'utf8'
    );
    
    const barSeedSql = fs.readFileSync(
      path.join(__dirname, 'src/database/migrations/20251128_bar_seed_data.sql'),
      'utf8'
    );

    // Run bar module migration
    console.log('Step 1: Creating bar tables...');
    await client.query(barModuleSql);
    console.log('✓ Bar tables created successfully\n');

    // Run seed data
    console.log('Step 2: Seeding drink data...');
    await client.query(barSeedSql);
    console.log('✓ Drink data seeded successfully\n');

    // Verify tables
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name LIKE 'bar_%' 
      ORDER BY table_name
    `);
    
    console.log('=========================================');
    console.log('Bar Module Migration Complete!');
    console.log('=========================================\n');
    console.log('Tables created:');
    result.rows.forEach(row => console.log(`  - ${row.table_name}`));
    
    // Count drinks
    const drinksCount = await client.query('SELECT COUNT(*) FROM bar_drinks');
    console.log(`\nDrinks seeded: ${drinksCount.rows[0].count}`);
    
    console.log('\nYou can now login as bartender:');
    console.log('  Email: bartender@famousgate.com');
    console.log('  Password: bar123\n');

  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
