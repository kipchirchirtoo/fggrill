require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const fs = require('fs');
const path = require('path');

async function extractLiveSchema() {
  console.log('🔍 Connecting to Supabase and extracting live schema...\n');

  const output = {
    extractedAt: new Date().toISOString(),
    tables: [],
    indexes: [],
    policies: [],
    functions: [],
    triggers: [],
    rowCounts: {}
  };

  // 1. Get all tables
  console.log('📋 Fetching tables...');
  const { data: tables, error: tablesError } = await supabase
    .rpc('exec_sql', { sql: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name` })
    .catch(() => supabase.rpc('pg_catalog.exec_sql', { sql: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name` }));

  // Fallback: direct query via postgres
  const { data: tablesList, error: tablesListError } = await supabase.rpc('pg_catalog.exec_sql', {
    sql: "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename"
  }).catch(() => ({ data: null, error: true }));

  // Try alternative approach
  let tableNames = [];
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/?apikey=${process.env.SUPABASE_SERVICE_ROLE_KEY}`, {
      headers: { 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` }
    });
    // This won't work, let's use a different approach
  } catch (e) {}

  // Use postgres direct connection approach
  const { data: allTables, error: allTablesError } = await supabase.rpc('exec_sql', {
    sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
  });

  if (allTablesError) {
    console.log('Trying alternative table query...');
    const altQuery = await supabase.rpc('pg_catalog.to_regclass', { text: 'public.users' });
  }

  // Direct SQL execution via anon key won't work for information_schema
  // Let's try a different approach - query via service role with raw query
  
  console.log('Fetching tables via direct query...');
  
  // Since Supabase JS client doesn't support direct SQL, we'll query via REST API
  const tablesResult = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({ sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name" })
  }).then(r => r.json()).catch(() => null);

  // Try querying a known table to get table list
  console.log('Trying alternative approach...');
  
  // Query pg_tables directly
  const pgTablesQuery = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/pg_catalog.exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({ sql: "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'" })
  }).then(r => r.json()).catch(e => ({ error: e.message }));

  // Let's try a simpler approach - query a few known tables to verify connection
  console.log('Testing connection...');
  const testQuery = await supabase.from('branches').select('*').limit(1);
  if (testQuery.error) {
    console.log('Connection test failed:', testQuery.error.message);
  } else {
    console.log('✅ Connection successful');
  }

  // Get list of tables by querying for row counts on known tables
  // First, let's get all tables we know about from the codebase
  const knownTables = [
    'users', 'branches', 'roles', 'permissions', 'user_roles',
    'rooms', 'room_types', 'bookings', 'guests', 'payments',
    'restaurant_orders', 'bar_orders', 'pos_shift_orders', 'pos_outlets', 'pos_transactions',
    'cashier_shifts', 'cashier_shift_logs', 'cashier_transactions', 'pos_outlet_shifts', 'cashier_logbooks', 'shift_transactions',
    'simple_items', 'inventory_items', 'store_items', 'stock_counts', 'stock_takes',
    'staff_credit_bills', 'unpaid_bills', 'restaurant_bills',
    'menu_items', 'menu_categories', 'orders', 'order_items',
    'housekeeping_tasks', 'housekeeping_logs',
    'staff_profiles', 'attendance_records', 'payroll_items',
    'audit_logs', 'notifications', 'loyalty_transactions'
  ];

  console.log('\n📊 Querying table schemas and row counts...\n');
  
  for (const tableName of knownTables) {
    try {
      // Get row count
      const { count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      
      // Get columns
      const { data: sample } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      const columns = sample ? Object.keys(sample[0] || {}) : [];
      
      output.tables.push({
        name: tableName,
        rowCount: count || 0,
        columns: columns
      });
      
      output.rowCounts[tableName] = count || 0;
      console.log(`  ✅ ${tableName}: ${count || 0} rows, ${columns.length} columns`);
    } catch (err) {
      console.log(`  ❌ ${tableName}: ${err.message}`);
    }
  }

  console.log('\n📄 Writing schema to LIVE_SCHEMA.json...');
  
  fs.writeFileSync(
    path.join(__dirname, '../../LIVE_SCHEMA.json'),
    JSON.stringify(output, null, 2)
  );

  console.log('\n✅ Schema extraction complete!');
  console.log(`Total tables found: ${output.tables.length}`);
  console.log(`Output: LIVE_SCHEMA.json`);
  
  // Summary of tables with data
  const tablesWithData = output.tables.filter(t => t.rowCount > 0).sort((a, b) => b.rowCount - a.rowCount);
  console.log('\n📈 Top 20 tables by row count:');
  tablesWithData.slice(0, 20).forEach((t, i) => {
    console.log(`  ${i+1}. ${t.name}: ${t.rowCount.toLocaleString()} rows`);
  });

  return output;
}

extractLiveSchema()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
