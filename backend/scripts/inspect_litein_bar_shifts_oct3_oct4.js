const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Users/user/OneDrive/Desktop/fggrill/backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('================================================================');
  console.log('=== LITEIN BRANCH (ID: 7) - MAIN BAR CASHIER SHIFTS INSPECTION ===');
  console.log('=== Target Dates: Yesterday (2026-10-03) & Today (2026-10-04) ===');
  console.log('================================================================\n');

  // 1. Fetch ALL shifts for Litein since Oct 2nd
  const { data: shifts, error: shiftsError } = await supabase
    .from('cashier_shift_logs')
    .select('*')
    .eq('branch_id', 7)
    .gte('created_at', '2026-10-02T00:00:00Z')
    .order('shift_start', { ascending: false });

  if (shiftsError) {
    console.error('Error fetching shifts:', shiftsError);
    return;
  }

  console.log(`Found ${shifts.length} total cashier shift(s) in Litein since 2026-10-02.\n`);

  for (const s of shifts) {
    console.log('----------------------------------------------------------------');
    console.log(`Shift Number:   ${s.shift_number} (ID: ${s.id})`);
    console.log(`Cashier:        ${s.cashier_name} (ID: ${s.cashier_id})`);
    console.log(`Status:         ${s.status.toUpperCase()}`);
    console.log(`Start Time:     ${s.shift_start} EAT`);
    console.log(`End Time:       ${s.shift_end || 'STILL OPEN / ONGOING'}`);
    console.log(`Opening Float:  KES ${s.opening_float}`);
    console.log(`Closing Float:  KES ${s.closing_float ?? s.cash_at_hand}`);
    console.log(`Expected Float: KES ${s.expected_closing_float}`);
    console.log(`Variance:       KES ${s.variance}`);
    console.log(`Total Sales:    KES ${s.total_sales}`);
    console.log(` - Cash Sales:  KES ${s.total_cash_sales} (Actual Counted: KES ${s.actual_cash_counted})`);
    console.log(` - M-Pesa Sales:KES ${s.total_mpesa_sales} (Actual Logged: KES ${s.actual_mpesa_logged})`);
    console.log(` - Card Sales:  KES ${s.total_card_sales} (Actual Logged: KES ${s.actual_card_logged})`);
    console.log(`Revenue Split:`);
    console.log(` - Bar Revenue:        KES ${s.bar_revenue}`);
    console.log(` - Restaurant Revenue: KES ${s.restaurant_revenue}`);
    console.log(` - Other Revenue:      KES ${s.other_revenue}`);
    console.log(`Transactions:   ${s.transaction_count} transactions`);
    console.log(`Credit Bills:   KES ${s.credit_bills_taken} taken, KES ${s.paid_bills_value} paid`);
    console.log(`Reconciliation: ${s.reconciliation_status}`);
    console.log(`Opening Notes:  ${s.opening_review_notes}`);
  }

  // 2. Also check POS outlet shifts for Litein Main Bar
  console.log('\n================================================================');
  console.log('=== POS OUTLET SHIFTS (pos_outlet_shifts) FOR LITEIN ===');
  console.log('================================================================');

  const { data: posShifts, error: posShiftsError } = await supabase
    .from('pos_outlet_shifts')
    .select('*')
    .eq('branch_id', 7)
    .gte('created_at', '2026-10-02T00:00:00Z')
    .order('created_at', { ascending: false });

  if (posShiftsError) {
    console.log('pos_outlet_shifts error:', posShiftsError);
  } else {
    console.log(`Found ${posShifts?.length || 0} pos_outlet_shifts records:`);
    console.log(JSON.stringify(posShifts, null, 2));
  }

  // 3. Check Litein Main Bar POS orders on Oct 3 and Oct 4
  console.log('\n================================================================');
  console.log('=== POS ORDERS IN LITEIN FOR 2026-10-03 & 2026-10-04 ===');
  console.log('================================================================');

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, order_number, branch_id, outlet_id, cashier_id, status, payment_status, total_amount, payment_method, created_at')
    .eq('branch_id', 7)
    .gte('created_at', '2026-10-03T00:00:00Z')
    .order('created_at', { ascending: false })
    .limit(20);

  if (ordersError) {
    console.log('orders query error:', ordersError);
  } else {
    console.log(`Found ${orders?.length || 0} recent orders in orders table.`);
    console.log(orders);
  }

  // 4. Also check pos_orders if that table exists
  const { data: posOrders, error: posOrdersError } = await supabase
    .from('pos_orders')
    .select('id, order_number, branch_id, outlet_id, cashier_id, status, payment_status, total_amount, payment_method, created_at')
    .eq('branch_id', 7)
    .gte('created_at', '2026-10-03T00:00:00Z')
    .order('created_at', { ascending: false })
    .limit(20);

  if (!posOrdersError && posOrders && posOrders.length > 0) {
    console.log(`Found ${posOrders.length} pos_orders:`, posOrders);
  }

  // 5. Check staff profiles in Litein with role containing 'bar' or 'cashier'
  console.log('\n================================================================');
  console.log('=== LITEIN CASHIER & BAR STAFF PROFILES ===');
  console.log('================================================================');

  const { data: barStaff, error: barStaffErr } = await supabase
    .from('staff_profiles')
    .select('id, user_id, employee_number, first_name, last_name, role, department, status, branch_id')
    .eq('branch_id', 7);

  if (barStaff) {
    console.log(barStaff);
  }
}

main().catch(console.error);
