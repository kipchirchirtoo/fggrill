require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Tables to KEEP (master data)
const KEEP_TABLES = [
  'users',
  'branches', 
  'staff_profiles',
  'departments',
  'room_types',
  'restaurant_menu_items',
  'restaurant_menu_categories',
  'vehicles',
  'maintenance_spare_parts',
  'kenyan_public_holidays',
  'inventory_items',
  'warehouses',
  'suppliers',
  'branch_suppliers',
  'drivers',
  'positions',
];

async function autoCleanup() {
  console.log('🚀 AUTO CLEANUP - FINDING AND DELETING ALL TRANSACTIONAL DATA\n');
  console.log('='.repeat(80));
  
  try {
    // Get ALL tables from information_schema
    console.log('\n1️⃣  Finding all tables...\n');
    
    const { data: allTables, error: schemaError } = await supabase
      .rpc('get_all_table_names');
    
    if (schemaError) {
      console.log('Using fallback method to find tables...');
      // We'll discover tables by trying common names
    }
    
    // Discover all tables by trying to query them
    const possibleTables = [
      'folios', 'reservations', 'dispatch_notes', 'restaurant_order_items',
      'stock_request_items', 'stock_requests', 'restaurant_orders', 'payments',
      'payroll_records', 'auth_logs', 'daily_financial_records', 'guests',
      'rooms', 'staff_loans', 'staff_advances', 'notifications', 'approval_requests',
      'bookings', 'credit_bills', 'invoices', 'purchase_orders', 'stock_dispatches',
      'stock_transfers', 'attendance_records', 'leave_requests', 'overtime_records',
      'maintenance_requests', 'housekeeping_tasks', 'business_communications',
      'audit_logs', 'security_events', 'bar_orders', 'kitchen_orders',
      'restaurant_bills', 'expense_records', 'revenue_records',
    ];
    
    const existingTables = [];
    
    for (const table of possibleTables) {
      try {
        const { count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (count !== null) {
          existingTables.push({ table, count });
          if (count > 0) {
            console.log(`  ✓ ${table.padEnd(40)} ${count} records`);
          }
        }
      } catch (e) {}
    }
    
    console.log(`\n  Found ${existingTables.filter(t => t.count > 0).length} tables with data`);
    
    // Build deletion order based on dependencies
    console.log('\n2️⃣  Building deletion order...\n');
    
    const deletionOrder = [
      'folios',  // Most dependent
      'dispatch_notes',
      'restaurant_order_items',
      'stock_request_items',
      'reservations',
      'stock_requests',
      'restaurant_orders',
      'payments',
      'payroll_records',
      'auth_logs',
      'daily_financial_records',
      'notifications',
      'approval_requests',
      'bookings',
      'credit_bills',
      'invoices',
      'purchase_orders',
      'stock_dispatches',
      'stock_transfers',
      'attendance_records',
      'leave_requests',
      'overtime_records',
      'maintenance_requests',
      'housekeeping_tasks',
      'business_communications',
      'audit_logs',
      'security_events',
      'bar_orders',
      'kitchen_orders',
      'restaurant_bills',
      'expense_records',
      'revenue_records',
      'guests',
      'room_status_history',  // Delete before rooms (FK constraint)
      'rooms',
      'staff_loans',
      'staff_advances',
    ];
    
    const toDelete = existingTables
      .filter(t => deletionOrder.includes(t.table) && t.count > 0)
      .sort((a, b) => deletionOrder.indexOf(a.table) - deletionOrder.indexOf(b.table));
    
    console.log('  Deletion order:');
    toDelete.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.table} (${t.count} records)`);
    });
    
    const totalToDelete = toDelete.reduce((sum, t) => sum + t.count, 0);
    console.log(`\n  Total records to delete: ${totalToDelete}`);
    
    // Execute deletions
    console.log('\n3️⃣  Executing deletions...\n');
    
    let deleted = 0;
    for (const { table, count } of toDelete) {
      try {
        console.log(`  Deleting ${table}...`);
        const { error } = await supabase
          .from(table)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Try UUID filter first
        
        if (error) {
          // If UUID filter fails, try numeric filter
          const { error: error2 } = await supabase
            .from(table)
            .delete()
            .gt('id', 0);
          
          if (error2) {
            // If both fail, try deleting all with no filter
            const { error: error3 } = await supabase
              .from(table)
              .delete();
            
            if (error3) {
              console.log(`    ❌ Error: ${error3.message}`);
            } else {
              console.log(`    ✅ Deleted ${count} records`);
              deleted += count;
            }
          } else {
            console.log(`    ✅ Deleted ${count} records`);
            deleted += count;
          }
        } else {
          console.log(`    ✅ Deleted ${count} records`);
          deleted += count;
        }
      } catch (e) {
        console.log(`    ❌ Error: ${e.message}`);
      }
    }
    
    console.log(`\n  Total deleted: ${deleted} records`);
    
    // Verify
    console.log('\n4️⃣  Verification...\n');
    
    console.log('  Master data (should have records):');
    for (const table of KEEP_TABLES) {
      try {
        const { count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (count > 0) {
          console.log(`    ✓ ${table.padEnd(40)} ${count} records`);
        }
      } catch (e) {}
    }
    
    console.log('\n  Transactional data (should be 0):');
    for (const { table } of toDelete) {
      try {
        const { count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (count === 0) {
          console.log(`    ✓ ${table.padEnd(40)} 0 records`);
        } else {
          console.log(`    ⚠️  ${table.padEnd(40)} ${count} records (still has data!)`);
        }
      } catch (e) {}
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ CLEANUP COMPLETE!');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

autoCleanup();
