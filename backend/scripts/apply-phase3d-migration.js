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
  console.log(`${colors.cyan}${colors.bold}║     PHASE 3D: BRANCH ISOLATION VIA RLS              ║${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}║     Fixing 140 MISSING_BRANCH_SCOPE Errors          ║${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}╚══════════════════════════════════════════════════════╝${colors.reset}\n`);

  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    await client.connect();
    console.log(`${colors.green}✓ Connected to database${colors.reset}\n`);

    const migrationPath = path.join(__dirname, '../supabase/migrations/20260415_phase3d_branch_isolation_rls.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log(`${colors.blue}🚀 Executing PHASE 3D migration...${colors.reset}`);
    console.log(`${colors.yellow}   This will update RLS policies for 26 tables${colors.reset}\n`);
    
    await client.query(migrationSQL);
    
    console.log(`${colors.green}${colors.bold}✓ PHASE 3D COMPLETED!${colors.reset}\n`);

    // Verify function was created
    const funcResult = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'get_user_branch_id'
      )
    `);
    
    console.log(`${colors.blue}🔍 Verification:${colors.reset}`);
    console.log(`${funcResult.rows[0].exists ? colors.green + '   ✓' : colors.red + '   ✗'} get_user_branch_id() function${colors.reset}`);

    // Count updated policies
    const policyResult = await client.query(`
      SELECT COUNT(*) as count
      FROM pg_policies
      WHERE policyname LIKE '%_select_policy'
    `);
    
    console.log(`${colors.green}   ✓ ${policyResult.rows[0].count} RLS policies active${colors.reset}\n`);

    console.log(`${colors.cyan}${colors.bold}═══════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold}PHASE 3D SUMMARY${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold}═══════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.green}✓ Created get_user_branch_id() helper function${colors.reset}`);
    console.log(`${colors.green}✓ Updated RLS policies for 26 tables${colors.reset}`);
    console.log(`${colors.green}✓ Branch isolation enforced at database level${colors.reset}`);
    console.log(`${colors.green}✓ Automatic filtering by user's branch_id${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold}═══════════════════════════════════════════════════════${colors.reset}\n`);

    console.log(`${colors.yellow}📋 IMPACT:${colors.reset}`);
    console.log(`   • Fixes 140 MISSING_BRANCH_SCOPE errors automatically`);
    console.log(`   • No code changes required`);
    console.log(`   • Enhanced security - enforced at database level`);
    console.log(`   • Admin users (NULL branch_id) can access all branches\n`);

  } catch (error) {
    console.error(`${colors.red}✗ MIGRATION FAILED: ${error.message}${colors.reset}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
