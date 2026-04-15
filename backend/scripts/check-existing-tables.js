const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Client } = require('pg');

const tablesToCheck = [
  'branches',
  'reservations',
  'pos_transactions',
  'cashier_transactions',
  'expenses',
  'simple_items',
  'stock_requests',
  'stock_request_items',
  'branch_stock_movements',
  'branch_stock',
  'approval_requests',
  'conference_halls',
  'outside_catering_bookings',
  'bar_tabs',
  'audit_logs',
  'store_inventory',
  'audit_approvals',
  'bar_stock_records',
  'folio_transactions',
  'payment_verifications',
  'inventory_items',
  'stock_movements',
  'inventory_transfers',
  'inventory_transfer_items',
  'bar_order_items',
  'kitchen_food_control_logs',
  'finance_daily_log_lines'
];

async function checkTables() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    console.log('Checking which tables exist...\n');
    
    const existing = [];
    const missing = [];
    
    for (const table of tablesToCheck) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = $1
        )
      `, [table]);
      
      if (result.rows[0].exists) {
        existing.push(table);
        console.log(`✓ ${table}`);
      } else {
        missing.push(table);
        console.log(`✗ ${table} (MISSING)`);
      }
    }
    
    console.log(`\n\nSUMMARY:`);
    console.log(`Existing: ${existing.length}/${tablesToCheck.length}`);
    console.log(`Missing: ${missing.length}/${tablesToCheck.length}`);
    console.log(`\nMissing tables:`);
    missing.forEach(t => console.log(`  - ${t}`));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkTables();
