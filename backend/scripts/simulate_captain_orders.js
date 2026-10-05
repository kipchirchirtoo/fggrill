require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { canAccessPosOutlet } = require('../dist/utils/posStationAccess');

const BAR_CASHIER_CAPTAIN_ORDER_OUTLET_TYPES = new Set([
  'main_bar',
  'executive_bar'
]);

async function simulateGetBarCaptainOrders(branchId, cashierRole, userId) {
  console.log(`\n--- Simulating getBarCaptainOrders for Branch ${branchId}, Role: ${cashierRole}, User: ${userId} ---`);

  const lookbackSince = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  let shiftQuery = supabase
    .from('pos_outlet_shifts')
    .select('id, branch_id, outlet_id, status, opened_at, outlet:pos_outlets(name, outlet_type)')
    .or(`status.eq.open,opened_at.gte.${lookbackSince}`)
    .order('opened_at', { ascending: false })
    .limit(250);

  if (branchId) shiftQuery = shiftQuery.eq('branch_id', branchId);

  const { data: outletShifts, error: shiftError } = await shiftQuery;
  if (shiftError) {
    console.error('shiftQuery error:', shiftError);
    return;
  }

  console.log(`Found ${outletShifts.length} shifts in branch ${branchId}`);

  const barShiftIds = (outletShifts || [])
    .filter((shift) => {
      const outlet = Array.isArray(shift.outlet) ? shift.outlet[0] : shift.outlet;
      const isBarOutlet = BAR_CASHIER_CAPTAIN_ORDER_OUTLET_TYPES.has(String(outlet?.outlet_type || ''));
      if (!isBarOutlet) {
        console.log(`  Shift ${shift.id} (${outlet?.name}, type=${outlet?.outlet_type}) is NOT in BAR_CASHIER_CAPTAIN_ORDER_OUTLET_TYPES`);
        return false;
      }
      const outletObj = {
        id: shift.outlet_id,
        outlet_type: outlet?.outlet_type,
        branch_id: shift.branch_id,
        name: outlet?.name,
      };
      const allowed = canAccessPosOutlet(cashierRole, outletObj, [], branchId);
      if (!allowed) {
        console.log(`  Shift ${shift.id} (${outlet?.name}) BLOCKED by canAccessPosOutlet for role ${cashierRole}`);
        return false;
      }
      console.log(`  Shift ${shift.id} (${outlet?.name}) ALLOWED for role ${cashierRole}`);
      return true;
    })
    .map((shift) => shift.id);

  console.log(`Matched bar shift IDs: ${barShiftIds.length}`);

  if (barShiftIds.length) {
    const { data: posOrders, error: posOrdersError } = await supabase
      .from('pos_shift_orders')
      .select('id, order_number, status, payment_status, kitchen_status, captain_printed_at, created_at, items')
      .in('shift_id', barShiftIds)
      .or('status.eq.open,status.eq.voided,payment_status.eq.voided,void_request_status.in.(pending,approved),kitchen_status.in.(void_requested,cancelled,voided,pending,preparing,ready,recalled)')
      .order('created_at', { ascending: true })
      .limit(500);

    if (posOrdersError) console.error('posOrdersError:', posOrdersError);
    else {
      console.log(`Found ${posOrders.length} candidate bar orders in pos_shift_orders`);
      posOrders.forEach(o => {
        console.log(`  Order #${o.order_number}: status=${o.status}, kitchen_status=${o.kitchen_status}, captain_printed_at=${o.captain_printed_at}`);
      });
    }
  }
}

async function run() {
  // Test Sotik
  await simulateGetBarCaptainOrders(4, 'main_bar_cashier', 'c7ba4004-0606-4717-b9d2-965f44e2ea3a');
  await simulateGetBarCaptainOrders(4, 'cashier', 'c7ba4004-0606-4717-b9d2-965f44e2ea3a');

  // Test Litein
  await simulateGetBarCaptainOrders(7, 'main_bar_cashier', '6aea7eda-5ce1-4a24-8573-93367fe2339d');
  await simulateGetBarCaptainOrders(7, 'restaurant_cashier', '6aea7eda-5ce1-4a24-8573-93367fe2339d');
  await simulateGetBarCaptainOrders(7, 'cashier', '6aea7eda-5ce1-4a24-8573-93367fe2339d');
}

run().catch(console.error);
