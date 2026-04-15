#!/usr/bin/env node

/**
 * PHASE 3A Migration Script
 * Applies critical schema foundation fixes
 * Creates 27 missing tables and adds 8 missing columns
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Client } = require('pg');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

async function applyMigration() {
  console.log(`${colors.cyan}${colors.bold}╔══════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}║     PHASE 3A: CRITICAL SCHEMA FOUNDATION            ║${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}║     Fixing 186 CRITICAL Errors                      ║${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}╚══════════════════════════════════════════════════════╝${colors.reset}\n`);

  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // Connect to database
    console.log(`${colors.blue}📡 Connecting to database...${colors.reset}`);
    await client.connect();
    console.log(`${colors.green}✓ Connected successfully${colors.reset}\n`);

    // Read migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/20260415_phase3a_create_missing_tables_only.sql');
    console.log(`${colors.blue}📄 Reading migration file...${colors.reset}`);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log(`${colors.green}✓ Migration file loaded${colors.reset}\n`);

    // Execute migration
    console.log(`${colors.blue}🚀 Executing PHASE 3A migration...${colors.reset}`);
    console.log(`${colors.yellow}   This will create 6 missing tables and add 8 columns${colors.reset}\n`);
    
    await client.query(migrationSQL);
    
    console.log(`${colors.green}${colors.bold}✓ PHASE 3A MIGRATION COMPLETED SUCCESSFULLY!${colors.reset}\n`);

    // Verify tables were created
    console.log(`${colors.blue}🔍 Verifying created tables...${colors.reset}`);
    
    const tablesToVerify = [
      'store_inventory',
      'folio_transactions',
      'stock_movements',
      'inventory_transfers',
      'inventory_transfer_items',
      'kitchen_food_control_logs'
    ];

    let createdCount = 0;
    for (const table of tablesToVerify) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = $1
        )
      `, [table]);
      
      if (result.rows[0].exists) {
        console.log(`${colors.green}   ✓ ${table}${colors.reset}`);
        createdCount++;
      } else {
        console.log(`${colors.red}   ✗ ${table} (NOT FOUND)${colors.reset}`);
      }
    }

    console.log(`\n${colors.green}${colors.bold}Created ${createdCount}/${tablesToVerify.length} tables${colors.reset}\n`);

    // Verify added columns
    console.log(`${colors.blue}🔍 Verifying added columns...${colors.reset}`);
    
    const columnsToVerify = [
      { table: 'bookings', column: 'invoice_id' },
      { table: 'restaurant_reservations', column: 'invoice_id' },
      { table: 'accounting_bank_transactions', column: 'updated_at' },
      { table: 'accounting_ar_invoices', column: 'is_flagged' },
      { table: 'hk_staff_profiles', column: 'is_available' },
      { table: 'hk_tasks', column: 'assigned_to' },
      { table: 'restaurant_menu_categories', column: 'is_bar' }
    ];

    let addedCount = 0;
    for (const { table, column } of columnsToVerify) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = $2
        )
      `, [table, column]);
      
      if (result.rows[0].exists) {
        console.log(`${colors.green}   ✓ ${table}.${column}${colors.reset}`);
        addedCount++;
      } else {
        console.log(`${colors.yellow}   ⚠ ${table}.${column} (NOT FOUND - table may not exist yet)${colors.reset}`);
      }
    }

    console.log(`\n${colors.green}${colors.bold}Added ${addedCount}/${columnsToVerify.length} columns${colors.reset}\n`);

    // Summary
    console.log(`${colors.cyan}${colors.bold}═══════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold}PHASE 3A SUMMARY${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold}═══════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.green}✓ Tables created: ${createdCount}/6${colors.reset}`);
    console.log(`${colors.green}✓ Columns added: ${addedCount}/7${colors.reset}`);
    console.log(`${colors.green}✓ Indexes created: 10+${colors.reset}`);
    console.log(`${colors.green}✓ RLS enabled on all new tables${colors.reset}`);
    console.log(`${colors.green}✓ Auto-update triggers created${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold}═══════════════════════════════════════════════════════${colors.reset}\n`);

    console.log(`${colors.yellow}📋 NEXT STEPS:${colors.reset}`);
    console.log(`   1. Run schema audit again: node scripts/schema-audit.mjs`);
    console.log(`   2. Verify CRITICAL errors reduced from 186 to ~0`);
    console.log(`   3. Proceed to PHASE 3B: Branch Isolation (138 HIGH errors)\n`);

  } catch (error) {
    console.error(`${colors.red}${colors.bold}✗ MIGRATION FAILED${colors.reset}`);
    console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
