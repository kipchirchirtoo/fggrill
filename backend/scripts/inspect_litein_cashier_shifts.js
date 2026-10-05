const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Users/user/OneDrive/Desktop/fggrill/backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('=== INSPECTING LITEIN BRANCH (ID: 7) ===\n');

  // 1. POS Outlets in Litein
  const { data: outlets, error: outletErr } = await supabase
    .from('pos_outlets')
    .select('*')
    .eq('branch_id', 7);
  console.log('POS Outlets in Litein:', outlets || outletErr);

  // 2. Outlets or Bar Locations from other tables if any
  const { data: barLocations } = await supabase
    .from('bar_drinks')
    .select('bar_location')
    .eq('branch_id', 7)
    .limit(10);
  console.log('Bar locations sample in bar_drinks:', barLocations);

  // 3. Cashier Shifts in Litein for Oct 3 & Oct 4, 2026 (and any recent)
  const { data: shifts, error: shiftsErr } = await supabase
    .from('cashier_shifts')
    .select('*')
    .eq('branch_id', 7)
    .order('start_time', { ascending: false })
    .limit(20);
  console.log('\nRecent Cashier Shifts in Litein (Total found: ' + (shifts ? shifts.length : 0) + '):');
  console.log(JSON.stringify(shifts, null, 2));

  // 4. Also check if there are cashier_shifts without branch_id or if branch_id is string/number
  // Let's check shifts filtered specifically by date >= '2026-10-02'
  const { data: recentShiftsAllBranches } = await supabase
    .from('cashier_shifts')
    .select('id, cashier_id, branch_id, outlet_id, status, shift_type, start_time, end_time, total_cash, total_mpesa, total_card, total_credit, total_sales, variance')
    .gte('start_time', '2026-10-02T00:00:00Z')
    .order('start_time', { ascending: false });
  console.log('\nAll cashier shifts across all branches since 2026-10-02:');
  console.log(recentShiftsAllBranches);

  // 5. Staff profiles in Litein with cashier or bar roles
  const { data: staff } = await supabase
    .from('staff_profiles')
    .select('id, employee_id, full_name, role, branch_id, is_active')
    .eq('branch_id', 7);
  console.log('\nStaff profiles in Litein:', staff);

  // Also users in Litein
  const { data: users } = await supabase
    .from('users')
    .select('id, name, username, email, role, branch_id, is_active')
    .eq('branch_id', 7);
  console.log('\nUsers in Litein:', users);
}

main().catch(console.error);
