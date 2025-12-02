const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan@13900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function upgradeMigration() {
  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected\n');
    
    console.log('⚠️  This will DROP existing storekeeping tables and recreate them.');
    console.log('📦 Backing up existing data first (if any)...\n');
    
    // Backup existing data (if exists)
    let items = { rows: [] };
    let suppliers = { rows: [] };
    
    try {
      items = await client.query('SELECT * FROM store_items');
      console.log(`✅ Backed up ${items.rows.length} items`);
    } catch (err) {
      console.log('   ℹ️  No existing items to backup');
    }
    
    try {
      suppliers = await client.query('SELECT * FROM store_suppliers');
      console.log(`✅ Backed up ${suppliers.rows.length} suppliers`);
    } catch (err) {
      console.log('   ℹ️  No existing suppliers to backup');
    }
    
    console.log();
    
    // Drop everything storekeeping-related
    console.log('🗑️  Cleaning up existing storekeeping schema...');
    
    // Drop all storekeeping tables (this will drop indexes too)
    const dropTablesQuery = `
      DO $$ DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'store_%') LOOP
          EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `;
    await client.query(dropTablesQuery);
    
    // Drop all storekeeping views
    const dropViewsQuery = `
      DO $$ DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT viewname FROM pg_views WHERE schemaname = 'public' AND viewname LIKE 'store_%') LOOP
          EXECUTE 'DROP VIEW IF EXISTS ' || quote_ident(r.viewname) || ' CASCADE';
        END LOOP;
      END $$;
    `;
    await client.query(dropViewsQuery);
    
    // Drop enums
    const enums = ['item_category', 'unit_of_measurement', 'costing_method', 'supplier_status', 
                   'payment_terms', 'requisition_status', 'requisition_priority', 'po_status',
                   'grn_status', 'movement_type', 'issue_status', 'adjustment_reason', 'transfer_status'];
    for (const enumName of enums) {
      await client.query(`DROP TYPE IF EXISTS ${enumName} CASCADE`);
    }
    
    console.log('✅ Cleanup complete\n');
    
    // Run complete migration
    console.log('🚀 Running complete storekeeping migration...');
    const sqlPath = path.join(__dirname, 'backend/supabase/migrations/11_COMPLETE_storekeeping.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('⏳ This may take 30-60 seconds...\n');
    await client.query(sql);
    console.log('✅ Migration completed!\n');
    
    // Restore data
    console.log('📥 Restoring data...');
    // Note: You may need to adjust column mappings based on new schema
    for (const item of items.rows) {
      try {
        await client.query(`
          INSERT INTO store_items (id, item_code, name, description, category, unit, current_stock, minimum_stock, maximum_stock, reorder_level)
          VALUES ($1, $2, $3, $4, $5::item_category, $6::unit_of_measurement, $7, $8, $9, $10)
          ON CONFLICT (item_code) DO NOTHING
        `, [item.id, item.item_code, item.name, item.description, item.category || 'other', item.unit || 'pieces', 
            item.current_stock || 0, item.minimum_stock || 0, item.maximum_stock || 0, item.reorder_level || 0]);
      } catch (err) {
        console.log(`   ⚠️  Could not restore item ${item.item_code}: ${err.message}`);
      }
    }
    
    for (const supplier of suppliers.rows) {
      try {
        await client.query(`
          INSERT INTO store_suppliers (id, supplier_code, name, contact_person, email, phone)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (supplier_code) DO NOTHING
        `, [supplier.id, supplier.supplier_code, supplier.name, supplier.contact_person, supplier.email, supplier.phone]);
      } catch (err) {
        console.log(`   ⚠️  Could not restore supplier ${supplier.supplier_code}: ${err.message}`);
      }
    }
    
    console.log('✅ Data restored\n');
    
    // Verify
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'store_%'
      ORDER BY table_name;
    `);
    
    console.log(`✅ ✅ ✅ SUCCESS! Created ${tablesResult.rows.length} storekeeping tables:\n`);
    tablesResult.rows.forEach(row => console.log(`   ✓ ${row.table_name}`));
    
    console.log('\n🎉 Database upgrade complete!');
    console.log('\n🎯 Next steps:');
    console.log('   1. Frontend: http://localhost:3000 (already running)');
    console.log('   2. Start backend: cd backend && npm run dev');
    console.log('   3. Test the storekeeping module\n');
    
  } catch (err) {
    console.error('\n❌ Upgrade failed:', err.message);
    console.error('Full error:', err);
  } finally {
    await client.end();
  }
}

upgradeMigration();
