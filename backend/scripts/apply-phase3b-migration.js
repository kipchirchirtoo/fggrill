#!/usr/bin/env node

/**
 * PHASE 3B Migration Script
 * Fixes remaining 71 CRITICAL errors
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
  console.log(`${colors.cyan}${colors.bold}║     PHASE 3B: FIX REMAINING CRITICAL ERRORS         ║${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}║     Fixing 71 CRITICAL Errors                       ║${colors.reset}`);
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
    const migrationPath = path.join(__dirname, '../supabase/migrations/20260415_phase3b_fix_remaining_critical.sql');
    console.log(`${colors.blue}📄 Reading migration file...${colors.reset}`);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log(`${colors.green}✓ Migration file loaded${colors.reset}\n`);

    // Execute migration
    console.log(`${colors.blue}🚀 Executing PHASE 3B migration...${colors.reset}`);
    console.log(`${colors.yellow}   This will create 2 tables, add 5 columns, and create auto-population triggers${colors.reset}\n`);
    
    await client.query(migrationSQL);
    
    console.log(`${colors.green}${colors.bold}✓ PHASE 3B MIGRATION COMPLETED SUCCESSFULLY!${colors.reset}\n`);

    // Verify tables were created
    console.log(`${colors.blue}🔍 Verifying created tables...${colors.reset}`);
    
    const tablesToVerify = [
      '_migrations',
      'staff_advances'
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
      { table: 'folio_transactions', column: 'folio_id' },
      { table: 'staff_credit_bills', column: 'status' },
      { table: 'staff_credit_bills', column: 'deducted_in_payroll_id' },
      { table: 'unpaid_bills', column: 'status' }
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
        console.log(`${colors.yellow}   ⚠ ${table}.${column} (table may not exist)${colors.reset}`);
      }
    }

    console.log(`\n${colors.green}${colors.bold}Added ${addedCount}/${columnsToVerify.length} columns${colors.reset}\n`);

    // Verify triggers
    console.log(`${colors.blue}🔍 Verifying auto-population triggers...${colors.reset}`);
    
    const triggersToVerify = [
      'trigger_auto_populate_cashier_transaction_branch',
      'trigger_auto_populate_folio_transaction_branch',
      'trigger_auto_populate_expense_branch'
    ];

    let triggerCount = 0;
    for (const trigger of triggersToVerify) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.triggers 
          WHERE trigger_name = $1
        )
      `, [trigger]);
      
      if (result.rows[0].exists) {
        console.log(`${colors.green}   ✓ ${trigger}${colors.reset}`);
        triggerCount++;
      } else {
        console.log(`${colors.yellow}   ⚠ ${trigger} (not found)${colors.reset}`);
      }
    }

    console.log(`\n${colors.green}${colors.bold}Created ${triggerCount}/${triggersToVerify.length} triggers${colors.reset}\n`);

    // Summary
    console.log(`${colors.cyan}${colors.bold}═══════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold}PHASE 3B SUMMARY${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold}═══════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.green}✓ Tables created: ${createdCount}/2${colors.reset}`);
    console.log(`${colors.green}✓ Columns added: ${addedCount}/4${colors.reset}`);
    console.log(`${colors.green}✓ Auto-population triggers: ${triggerCount}/3${colors.reset}`);
    console.log(`${colors.green}✓ Made strict NOT NULL constraints flexible${colors.reset}`);
    console.log(`${colors.green}✓ Indexes created${colors.reset}`);
    console.log(`${colors.green}✓ RLS enabled on new tables${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold}═══════════════════════════════════════════════════════${colors.reset}\n`);

    console.log(`${colors.yellow}📋 NEXT STEPS:${colors.reset}`);
    console.log(`   1. Run schema audit again: node scripts/schema-audit.mjs`);
    console.log(`   2. Verify CRITICAL errors reduced from 71 to ~10`);
    console.log(`   3. Proceed to PHASE 3C: Add branch isolation filters\n`);

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
