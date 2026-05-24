/**
 * Schema Audit Script
 * Identifies schema mismatches between code and database
 * Run with: node scripts/schema-audit.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ISSUES = {
  MISSING_COLUMNS: [],
  MISSING_TABLES: [],
  TYPE_MISMATCHES: [],
  FIELD_NAME_MISMATCHES: [],
  RAW_SQL_WORKAROUNDS: []
};

async function auditSchema() {
  console.log('🔍 Starting Schema Audit...\n');

  // 1. Check for missing tables
  console.log('📋 Checking for missing tables...');
  const expectedTables = [
    'notifications',
    'loyalty_transactions',
    'audit_config_consumption',
    'discrepancy_flags',
    'credit_bills',
    'branch_notifications',
    'branch_messages'
  ];

  for (const table of expectedTables) {
    const { error } = await supabase.from(table).select('*').limit(1);
    if (error && error.code === '42P01') {
      ISSUES.MISSING_TABLES.push(table);
      console.log(`  ❌ Missing table: ${table}`);
    } else {
      console.log(`  ✅ Table exists: ${table}`);
    }
  }

  // 2. Check for missing columns in key tables
  console.log('\n📋 Checking for missing columns...');
  
  // Check bookings table for payment_status
  const { data: bookingsColumns, error: bookingsError } = await supabase
    .rpc('get_table_columns', { table_name: 'bookings' });
  
  if (!bookingsError && bookingsColumns) {
    const hasPaymentStatus = bookingsColumns.some(col => col.column_name === 'payment_status');
    if (!hasPaymentStatus) {
      ISSUES.MISSING_COLUMNS.push({ table: 'bookings', column: 'payment_status' });
      console.log('  ❌ Missing column: bookings.payment_status');
    }
  }

  // Check payments table for branch_id
  const { data: paymentsColumns, error: paymentsError } = await supabase
    .rpc('get_table_columns', { table_name: 'payments' });
  
  if (!paymentsError && paymentsColumns) {
    const hasBranchId = paymentsColumns.some(col => col.column_name === 'branch_id');
    if (!hasBranchId) {
      ISSUES.MISSING_COLUMNS.push({ table: 'payments', column: 'branch_id' });
      console.log('  ❌ Missing column: payments.branch_id');
    }
  }

  // 3. Scan for raw SQL workarounds in controllers
  console.log('\n📋 Scanning for raw SQL workarounds...');
  const fs = require('fs');
  const path = require('path');
  
  function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && !file.includes('node_modules')) {
        scanDirectory(filePath);
      } else if (file.endsWith('.ts') && !file.includes('.backup')) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('executing raw SQL') || content.includes('raw SQL fix')) {
          ISSUES.RAW_SQL_WORKAROUNDS.push(filePath);
          console.log(`  ⚠️  Raw SQL workaround: ${filePath}`);
        }
      }
    });
  }
  
  scanDirectory('./src/controllers');

  // 4. Generate report
  console.log('\n' + '='.repeat(60));
  console.log('SCHEMA AUDIT REPORT');
  console.log('='.repeat(60));
  
  console.log(`\n❌ Missing Tables (${ISSUES.MISSING_TABLES.length}):`);
  ISSUES.MISSING_TABLES.forEach(table => console.log(`  - ${table}`));
  
  console.log(`\n❌ Missing Columns (${ISSUES.MISSING_COLUMNS.length}):`);
  ISSUES.MISSING_COLUMNS.forEach(({ table, column }) => console.log(`  - ${table}.${column}`));
  
  console.log(`\n⚠️  Raw SQL Workarounds (${ISSUES.RAW_SQL_WORKAROUNDS.length}):`);
  ISSUES.RAW_SQL_WORKAROUNDS.forEach(file => console.log(`  - ${file}`));
  
  console.log('\n' + '='.repeat(60));
  console.log('RECOMMENDATIONS:');
  console.log('='.repeat(60));
  console.log('1. Run migration to create missing tables');
  console.log('2. Add missing columns via ALTER TABLE statements');
  console.log('3. Replace raw SQL workarounds with Supabase queries');
  console.log('4. Clean up .backup files');
  
  // Save report to file
  fs.writeFileSync('./schema-audit-report.json', JSON.stringify(ISSUES, null, 2));
  console.log('\n📄 Detailed report saved to: schema-audit-report.json');
}

auditSchema().catch(console.error);
