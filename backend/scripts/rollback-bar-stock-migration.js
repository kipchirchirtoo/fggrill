const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_NEW;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL or DATABASE_URL_NEW not found in .env');
  process.exit(1);
}

console.log('🔗 Connecting to database...');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function rollbackMigration() {
  const client = await pool.connect();
  
  try {
    console.log('\n🔄 Rolling back bar stock migration...\n');
    
    await client.query('BEGIN');
    
    // Delete inventory mappings
    console.log('🗑️  Deleting pos_inventory_mappings...');
    const result1 = await client.query(`
      DELETE FROM pos_inventory_mappings 
      WHERE item_sku LIKE 'FGH-BAR-%'
      AND outlet_id = '145b570d-6d9b-46bb-9b75-614ab8fedb59'::uuid
    `);
    console.log(`   Deleted ${result1.rowCount} inventory mappings`);
    
    // Delete outlet items
    console.log('🗑️  Deleting pos_outlet_items...');
    const result2 = await client.query(`
      DELETE FROM pos_outlet_items 
      WHERE sku LIKE 'FGH-BAR-%'
      AND outlet_id = '145b570d-6d9b-46bb-9b75-614ab8fedb59'::uuid
    `);
    console.log(`   Deleted ${result2.rowCount} outlet items`);
    
    // Delete branch stock
    console.log('🗑️  Deleting branch_stock...');
    const result3 = await client.query(`
      DELETE FROM branch_stock 
      WHERE branch_id = 2 
      AND item_sku LIKE 'FGH-BAR-%'
    `);
    console.log(`   Deleted ${result3.rowCount} branch stock records`);
    
    // Delete simple items
    console.log('🗑️  Deleting simple_items...');
    const result4 = await client.query(`
      DELETE FROM simple_items 
      WHERE sku LIKE 'FGH-BAR-%'
    `);
    console.log(`   Deleted ${result4.rowCount} simple items`);
    
    await client.query('COMMIT');
    
    console.log('\n✅ Rollback completed successfully!');
    console.log(`📊 Total items deleted: ${result4.rowCount}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Rollback failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

rollbackMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
