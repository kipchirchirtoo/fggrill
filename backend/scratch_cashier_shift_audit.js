const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load .env from backend directory
const backendDir = 'c:\\Users\\user\\OneDrive\\Desktop\\fggrill\\backend';
dotenv.config({ path: path.join(backendDir, '.env') });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in env!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('=== Live Cashier Shifts Audit ===\n');

  // 1. Fetch all cashier shifts
  const { data: shifts, error: shiftsError } = await supabase
    .from('cashier_shift_logs')
    .select('*')
    .order('created_at', { ascending: false });

  if (shiftsError) {
    console.error('Error fetching cashier shifts:', shiftsError.message);
    process.exit(1);
  }

  console.log(`Found ${shifts.length} cashier shifts in database.`);

  // 2. Fetch all cashiers (users with cashier-related roles)
  const { data: cashiers, error: cashiersError } = await supabase
    .from('users')
    .select('id, first_name, last_name, role, branch_id');

  if (cashiersError) {
    console.error('Error fetching cashiers:', cashiersError.message);
    process.exit(1);
  }

  const cashierMap = {};
  for (const c of cashiers || []) {
    cashierMap[c.id] = c;
  }

  // 3. Process shift breakdowns
  const statusSummary = {};
  const branchSummary = {};
  const roleSummary = {};
  
  const shiftList = [];

  for (const s of shifts) {
    statusSummary[s.status] = (statusSummary[s.status] || 0) + 1;
    branchSummary[s.branch_id] = (branchSummary[s.branch_id] || 0) + 1;

    const cashier = cashierMap[s.cashier_id] || {};
    const role = cashier.role || 'unknown';
    roleSummary[role] = (roleSummary[role] || 0) + 1;

    shiftList.push({
      id: s.id,
      shift_number: s.shift_number,
      cashier_id: s.cashier_id,
      cashier_name: s.cashier_name || `${cashier.first_name || ''} ${cashier.last_name || ''}`.trim() || 'Unknown',
      cashier_role: role,
      branch_id: s.branch_id,
      status: s.status,
      shift_start: s.shift_start,
      shift_end: s.shift_end,
      opening_float: s.opening_float,
      closing_float: s.closing_float,
      total_sales: s.total_sales,
      total_cash_sales: s.total_cash_sales,
      total_mpesa_sales: s.total_mpesa_sales,
      total_card_sales: s.total_card_sales,
      variance: s.variance,
      cash_deposited: s.cash_deposited,
      restaurant_revenue: s.restaurant_revenue,
      bar_revenue: s.bar_revenue,
      room_booking_revenue: s.room_booking_revenue,
      conference_revenue: s.conference_revenue,
      swimming_pool_revenue: s.swimming_pool_revenue,
      other_revenue: s.other_revenue
    });
  }

  console.log('\n--- Status Summary ---');
  console.log(statusSummary);

  console.log('\n--- Branch Summary ---');
  console.log(branchSummary);

  console.log('\n--- Role Summary for Cashiers in Shifts ---');
  console.log(roleSummary);

  console.log('\n--- Open / Active Shifts ---');
  const openShifts = shiftList.filter(s => s.status === 'open');
  if (openShifts.length === 0) {
    console.log('No active open shifts.');
  } else {
    console.log(openShifts);
  }

  console.log('\n--- Detailed Shifts List (Most Recent First) ---');
  console.log(shiftList.slice(0, 10)); // Top 10 shifts

  // Save audit results
  const auditPath = path.join(backendDir, 'cashier_shifts_audit.json');
  fs.writeFileSync(auditPath, JSON.stringify({
    stats: {
      total_shifts: shifts.length,
      statuses: statusSummary,
      branches: branchSummary,
      roles: roleSummary
    },
    open_shifts: openShifts,
    recent_shifts: shiftList
  }, null, 2));
  console.log(`\nAudit completed! Log written to ${auditPath}`);
}

run();
