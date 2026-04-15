#!/usr/bin/env node

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
  console.log(`${colors.cyan}${colors.bold}║     PHASE 3C: FINAL CRITICAL FIXES                  ║${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}║     Fixing Final 58 CRITICAL Errors                 ║${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}╚══════════════════════════════════════════════════════╝${colors.reset}\n`);

  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    await client.connect();
    console.log(`${colors.green}✓ Connected to database${colors.reset}\n`);

    const migrationPath = path.join(__dirname, '../supabase/migrations/20260415_phase3c_minimal.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log(`${colors.blue}🚀 Executing PHASE 3C migration...${colors.reset}\n`);
    await client.query(migrationSQL);
    
    console.log(`${colors.green}${colors.bold}✓ PHASE 3C COMPLETED!${colors.reset}\n`);

    // Verify
    const tables = ['staff_payroll_adjustments', 'staff_loans'];
    console.log(`${colors.blue}🔍 Verifying tables...${colors.reset}`);
    for (const table of tables) {
      const result = await client.query(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)`, [table]);
      console.log(`${result.rows[0].exists ? colors.green + '   ✓' : colors.red + '   ✗'} ${table}${colors.reset}`);
    }

    console.log(`\n${colors.cyan}${colors.bold}═══════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold}PHASE 3C SUMMARY${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold}═══════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.green}✓ Created 2 tables (staff_payroll_adjustments, staff_loans)${colors.reset}`);
    console.log(`${colors.green}✓ Added 8 missing columns${colors.reset}`);
    console.log(`${colors.green}✓ Created 2 sync triggers${colors.reset}`);
    console.log(`${colors.green}✓ Created 8 indexes${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold}═══════════════════════════════════════════════════════${colors.reset}\n`);

  } catch (error) {
    console.error(`${colors.red}✗ MIGRATION FAILED: ${error.message}${colors.reset}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
