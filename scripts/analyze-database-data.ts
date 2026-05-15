#!/usr/bin/env ts-node
/**
 * Database Data Analysis Script
 * 
 * Purpose: Analyze all tables in the database to identify:
 * - Total record counts per table
 * - Sample/test/demo data patterns
 * - Data relationships and dependencies
 * - Tables with potential mock data
 * 
 * Usage: ts-node scripts/analyze-database-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const SUPABASE_URL = process.env.SUPABASE_PROJECT_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_PROJECT_URL:', SUPABASE_URL ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_KEY ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface TableInfo {
  table_name: string;
  row_count: number;
  has_branch_id: boolean;
  has_created_at: boolean;
  sample_data?: any;
}

interface AnalysisReport {
  timestamp: string;
  total_tables: number;
  tables_with_data: number;
  tables_empty: number;
  total_records: number;
  tables: TableInfo[];
  potential_test_data: string[];
  recommendations: string[];
}

async function getAllTables(): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_all_tables', {});
  
  if (error) {
    // Fallback: query information_schema directly
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name NOT LIKE 'pg_%'
        AND table_name NOT LIKE 'sql_%'
      ORDER BY table_name;
    `;
    
    console.log('⚠️  RPC function not available, using direct query...');
    // We'll need to use raw SQL for this
    return [];
  }
  
  return data || [];
}

async function getTableColumns(tableName: string): Promise<string[]> {
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(0);
  
  if (error) {
    console.error(`Error getting columns for ${tableName}:`, error.message);
    return [];
  }
  
  return [];
}

async function analyzeTable(tableName: string): Promise<TableInfo> {
  console.log(`  Analyzing: ${tableName}...`);
  
  // Get row count
  const { count, error: countError } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });
  
  if (countError) {
    console.error(`    ❌ Error counting ${tableName}:`, countError.message);
    return {
      table_name: tableName,
      row_count: -1,
      has_branch_id: false,
      has_created_at: false,
    };
  }
  
  const rowCount = count || 0;
  
  // Get sample data if table has records
  let sampleData = null;
  let hasBranchId = false;
  let hasCreatedAt = false;
  
  if (rowCount > 0) {
    const { data, error: sampleError } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (!sampleError && data && data.length > 0) {
      sampleData = data[0];
      hasBranchId = 'branch_id' in sampleData;
      hasCreatedAt = 'created_at' in sampleData;
    }
  }
  
  console.log(`    ✓ ${rowCount} records`);
  
  return {
    table_name: tableName,
    row_count: rowCount,
    has_branch_id: hasBranchId,
    has_created_at: hasCreatedAt,
    sample_data: sampleData,
  };
}

async function identifyTestData(tables: TableInfo[]): Promise<string[]> {
  const testDataPatterns = [
    'test',
    'demo',
    'sample',
    'mock',
    'example',
    'seed',
  ];
  
  const potentialTestTables: string[] = [];
  
  for (const table of tables) {
    // Check table name
    const lowerName = table.table_name.toLowerCase();
    if (testDataPatterns.some(pattern => lowerName.includes(pattern))) {
      potentialTestTables.push(`${table.table_name} (name suggests test data)`);
      continue;
    }
    
    // Check sample data for test patterns
    if (table.sample_data) {
      const dataStr = JSON.stringify(table.sample_data).toLowerCase();
      if (testDataPatterns.some(pattern => dataStr.includes(pattern))) {
        potentialTestTables.push(`${table.table_name} (contains test-like data)`);
      }
    }
  }
  
  return potentialTestTables;
}

function generateRecommendations(tables: TableInfo[]): string[] {
  const recommendations: string[] = [];
  
  // Tables with data
  const tablesWithData = tables.filter(t => t.row_count > 0);
  const transactionalTables = tablesWithData.filter(t => 
    ['orders', 'bills', 'invoices', 'bookings', 'payments', 'sales', 
     'attendance', 'payroll', 'loans', 'communications', 'messages',
     'stock_requests', 'approvals', 'credit_bills'].some(keyword => 
      t.table_name.toLowerCase().includes(keyword)
    )
  );
  
  if (transactionalTables.length > 0) {
    recommendations.push(
      `Found ${transactionalTables.length} transactional tables with data: ${transactionalTables.map(t => t.table_name).join(', ')}`
    );
    recommendations.push(
      'Review these tables carefully - they may contain production data mixed with test data'
    );
  }
  
  // Tables with branch_id
  const branchTables = tablesWithData.filter(t => t.has_branch_id);
  if (branchTables.length > 0) {
    recommendations.push(
      `${branchTables.length} tables have branch_id - cleanup should be branch-aware`
    );
  }
  
  // Tables with timestamps
  const timestampTables = tablesWithData.filter(t => t.has_created_at);
  if (timestampTables.length > 0) {
    recommendations.push(
      `${timestampTables.length} tables have created_at - can use date filters for cleanup`
    );
  }
  
  return recommendations;
}

async function main() {
  console.log('🔍 Database Data Analysis');
  console.log('========================\n');
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Supabase URL: ${SUPABASE_URL}\n`);
  
  // Get all tables
  console.log('📋 Fetching table list...');
  
  // Hardcoded list of known tables (since RPC might not exist)
  const knownTables = [
    'users', 'branches', 'staff_profiles', 'departments', 'positions',
    'bookings', 'rooms', 'room_types', 'guests',
    'restaurant_orders', 'restaurant_menu_items', 'restaurant_menu_categories',
    'restaurant_bills', 'restaurant_tables', 'restaurant_sections',
    'bar_orders', 'bar_drinks', 'bar_drink_categories', 'bar_stock',
    'kitchen_orders', 'kitchen_menu_items', 'kitchen_usage_logs',
    'kitchen_food_controls', 'kitchen_variance_reasons',
    'inventory_items', 'stock_requests', 'stock_dispatches', 'stock_transfers',
    'purchase_orders', 'suppliers', 'warehouses',
    'payments', 'invoices', 'credit_bills',
    'payroll_records', 'payroll_policies', 'staff_loans', 'staff_advances',
    'attendance_records', 'leave_requests', 'overtime_records',
    'maintenance_requests', 'housekeeping_tasks',
    'approval_requests', 'notifications',
    'business_communications', 'communication_messages',
    'daily_financial_records', 'expense_records', 'revenue_records',
    'audit_logs', 'auth_logs', 'security_events',
  ];
  
  console.log(`Found ${knownTables.length} tables to analyze\n`);
  
  // Analyze each table
  console.log('📊 Analyzing tables...\n');
  const tableInfos: TableInfo[] = [];
  
  for (const tableName of knownTables) {
    try {
      const info = await analyzeTable(tableName);
      tableInfos.push(info);
    } catch (error) {
      console.error(`  ❌ Failed to analyze ${tableName}:`, error);
    }
  }
  
  // Generate report
  const tablesWithData = tableInfos.filter(t => t.row_count > 0);
  const tablesEmpty = tableInfos.filter(t => t.row_count === 0);
  const totalRecords = tableInfos.reduce((sum, t) => sum + (t.row_count > 0 ? t.row_count : 0), 0);
  
  const potentialTestData = await identifyTestData(tablesWithData);
  const recommendations = generateRecommendations(tableInfos);
  
  const report: AnalysisReport = {
    timestamp: new Date().toISOString(),
    total_tables: tableInfos.length,
    tables_with_data: tablesWithData.length,
    tables_empty: tablesEmpty.length,
    total_records: totalRecords,
    tables: tableInfos,
    potential_test_data: potentialTestData,
    recommendations,
  };
  
  // Print summary
  console.log('\n\n📈 ANALYSIS SUMMARY');
  console.log('==================\n');
  console.log(`Total Tables Analyzed: ${report.total_tables}`);
  console.log(`Tables with Data: ${report.tables_with_data}`);
  console.log(`Empty Tables: ${report.tables_empty}`);
  console.log(`Total Records: ${report.total_records.toLocaleString()}\n`);
  
  console.log('📊 TABLES WITH DATA:');
  console.log('-------------------');
  tablesWithData
    .sort((a, b) => b.row_count - a.row_count)
    .forEach(t => {
      const branchFlag = t.has_branch_id ? '🏢' : '  ';
      const timeFlag = t.has_created_at ? '📅' : '  ';
      console.log(`${branchFlag}${timeFlag} ${t.table_name.padEnd(40)} ${t.row_count.toLocaleString().padStart(10)} records`);
    });
  
  if (potentialTestData.length > 0) {
    console.log('\n⚠️  POTENTIAL TEST DATA:');
    console.log('----------------------');
    potentialTestData.forEach(item => console.log(`  • ${item}`));
  }
  
  console.log('\n💡 RECOMMENDATIONS:');
  console.log('------------------');
  recommendations.forEach((rec, i) => console.log(`${i + 1}. ${rec}`));
  
  // Save detailed report
  const fs = require('fs');
  const reportPath = path.join(__dirname, '../database-analysis-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n✅ Detailed report saved to: ${reportPath}`);
  
  console.log('\n🔍 Legend:');
  console.log('  🏢 = Has branch_id column (multi-branch data)');
  console.log('  📅 = Has created_at column (can filter by date)');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
