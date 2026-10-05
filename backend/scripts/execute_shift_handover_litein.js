const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config({ path: 'c:/Users/user/OneDrive/Desktop/fggrill/backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function execute() {
  console.log('====================================================================');
  console.log('=== EXECUTING LITEIN MAIN BAR SHIFT CLOSE & HANDOVER TO JUDY CHEROTICH ===');
  console.log('====================================================================\n');

  const cheronoCashierShiftId = '0d6049da-651e-4cba-bda1-a4c23a227ead';
  const cheronoOutletShiftId = 'a9d4d2c8-7940-4253-98bd-c3f78e59a787';
  const judyCashierShiftId = '4c0cdff5-581d-4714-a7eb-1fafd7778453';
  const judyCashierId = '8cf735e3-1658-43e6-b34a-d2e3c14daf24';
  const outletId = '36da1937-ece7-45d3-b719-0bd010125467'; // LITEIN Main Bar POS
  const branchId = 7;
  const cutoffTime = '2026-10-04T04:00:00.000Z'; // 7:00 AM EAT

  // 1. Identify post-7am transactions
  const { data: post7amTxs, error: txErr } = await supabase
    .from('cashier_shift_transactions')
    .select('*')
    .eq('shift_id', cheronoCashierShiftId)
    .gte('transaction_time', cutoffTime);

  if (txErr) throw txErr;
  console.log(`1. Found ${post7amTxs.length} transactions from 7:00 AM EAT to transfer to Judy.`);

  // 2. Identify post-7am orders in pos_shift_orders
  const { data: post7amOrders, error: ordErr } = await supabase
    .from('pos_shift_orders')
    .select('*')
    .eq('shift_id', cheronoOutletShiftId)
    .gte('created_at', cutoffTime);

  if (ordErr) throw ordErr;
  console.log(`2. Found ${post7amOrders.length} orders from 7:00 AM EAT to transfer to Judy.`);

  // 3. Move transactions to Judy's cashier shift log
  if (post7amTxs.length > 0) {
    const post7amTxIds = post7amTxs.map(t => t.id);
    const { error: moveTxErr } = await supabase
      .from('cashier_shift_transactions')
      .update({ shift_id: judyCashierShiftId })
      .in('id', post7amTxIds);

    if (moveTxErr) throw moveTxErr;
    console.log(`3. Successfully moved ${post7amTxIds.length} transactions to Judy's cashier shift (${judyCashierShiftId}).`);
  }

  // 4. Create new pos_outlet_shifts for Judy on LITEIN Main Bar POS
  const newJudyOutletShiftId = crypto.randomUUID();
  const { data: newOutletShift, error: createOutletErr } = await supabase
    .from('pos_outlet_shifts')
    .insert({
      id: newJudyOutletShiftId,
      outlet_id: outletId,
      branch_id: branchId,
      cashier_id: judyCashierId,
      status: 'open',
      opening_float: 0,
      opened_at: cutoffTime,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select('*')
    .single();

  if (createOutletErr) throw createOutletErr;
  console.log(`4. Created new active pos_outlet_shifts for Judy Cherotich: ${newJudyOutletShiftId}`);

  // Seed stock counts for Judy's outlet shift
  const { data: outletItems } = await supabase
    .from('pos_outlet_items')
    .select('*')
    .eq('outlet_id', outletId)
    .eq('is_active', true);

  if (outletItems && outletItems.length > 0) {
    const stockRows = outletItems.map(item => ({
      shift_id: newJudyOutletShiftId,
      outlet_id: outletId,
      outlet_item_id: item.id,
      item_name: item.name,
      sku: item.sku,
      unit: item.unit || 'each',
      cost_price: item.cost_price || 0,
      selling_price: item.selling_price || 0,
      opening_stock: item.current_stock ?? item.opening_stock ?? 0,
      additions: 0,
      sold_quantity: 0,
      system_closing_stock: item.current_stock ?? item.opening_stock ?? 0,
      track_stock: item.track_stock !== false
    }));
    await supabase.from('pos_shift_stock_counts').insert(stockRows);
    console.log(`   Seeded ${stockRows.length} stock count records for Judy's outlet shift.`);
  }

  // 5. Move post-7am orders to Judy's new outlet shift
  if (post7amOrders.length > 0) {
    const post7amOrderIds = post7amOrders.map(o => o.id);
    const { error: moveOrdErr } = await supabase
      .from('pos_shift_orders')
      .update({ shift_id: newJudyOutletShiftId })
      .in('id', post7amOrderIds);

    if (moveOrdErr) throw moveOrdErr;
    console.log(`5. Successfully moved ${post7amOrderIds.length} orders in pos_shift_orders to Judy's outlet shift.`);
  }

  // 6. Close Cherono's outlet shift
  const { error: closeOutletErr } = await supabase
    .from('pos_outlet_shifts')
    .update({
      status: 'closed',
      closed_at: cutoffTime,
      closing_cash_counted: 35271,
      expected_cash: 170580,
      cash_variance: 35271 - 170580,
      updated_at: new Date().toISOString()
    })
    .eq('id', cheronoOutletShiftId);

  if (closeOutletErr) throw closeOutletErr;
  console.log(`6. Successfully closed Cherono's pos_outlet_shifts (${cheronoOutletShiftId}).`);

  // 7. Upsert shift_actual_collections for Cherono's shift
  // Declared values: mpesa 312,699, cash 35,271, card 3,440
  const actualCollections = [
    {
      shift_id: cheronoCashierShiftId,
      branch_id: branchId,
      payment_method: 'mpesa',
      system_amount: 137440,
      actual_amount: 312699,
      entered_by: '6aea7eda-5ce1-4a24-8573-93367fe2339d', // Cherono Augustica
      entered_at: new Date().toISOString(),
      entry_source: 'blind_shift_close'
    },
    {
      shift_id: cheronoCashierShiftId,
      branch_id: branchId,
      payment_method: 'cash',
      system_amount: 170580,
      actual_amount: 35271,
      entered_by: '6aea7eda-5ce1-4a24-8573-93367fe2339d',
      entered_at: new Date().toISOString(),
      entry_source: 'blind_shift_close'
    },
    {
      shift_id: cheronoCashierShiftId,
      branch_id: branchId,
      payment_method: 'card',
      system_amount: 1590,
      actual_amount: 3440,
      entered_by: '6aea7eda-5ce1-4a24-8573-93367fe2339d',
      entered_at: new Date().toISOString(),
      entry_source: 'blind_shift_close'
    }
  ];

  const { error: actualErr } = await supabase
    .from('shift_actual_collections')
    .upsert(actualCollections, { onConflict: 'shift_id,payment_method' });

  if (actualErr) throw actualErr;
  console.log('7. Upserted shift_actual_collections with user specified declared amounts.');

  // 8. Close Cherono Augustica's cashier_shift_logs
  // Pre-7am transactions: 243
  // Pre-7am totals: Cash 170,580, M-Pesa 137,440, Card 1,590, Total 309,610
  const cheronoClosingPayload = {
    status: 'closed',
    shift_end: cutoffTime,
    opening_float: 0,
    closing_float: 35271,
    cash_at_hand: 35271,
    actual_cash_counted: 35271,
    actual_mpesa_logged: 312699,
    actual_card_logged: 3440,
    expected_closing_float: 170580,
    variance: 35271 - 170580, // -135309 cash shortage
    total_sales: 309610,
    total_cash_sales: 170580,
    total_mpesa_sales: 137440,
    total_card_sales: 1590,
    bar_revenue: 309610,
    restaurant_revenue: 0,
    other_revenue: 0,
    transaction_count: 243,
    reconciliation_status: 'pending_reconciliation',
    notes: 'Shift closed at 07:00 AM EAT. Handed over to Judy Cherotich. Actual collections recorded: M-Pesa KES 312,699, Cash KES 35,271, Card KES 3,440.',
    updated_at: new Date().toISOString()
  };

  const { error: cheronoCloseErr } = await supabase
    .from('cashier_shift_logs')
    .update(cheronoClosingPayload)
    .eq('id', cheronoCashierShiftId);

  if (cheronoCloseErr) throw cheronoCloseErr;
  console.log('8. Successfully closed Cherono Augustica cashier_shift_logs.');

  // 9. Update Judy Cherotich's cashier_shift_logs
  // 41 transactions transferred: Cash 16,760, Credit 2,570, Total 19,330
  const judyUpdatePayload = {
    shift_start: cutoffTime,
    status: 'open',
    opening_float: 0,
    total_sales: 19330,
    total_cash_sales: 16760,
    total_mpesa_sales: 0,
    total_card_sales: 0,
    credit_bills_taken: 2570,
    bar_revenue: 19330,
    restaurant_revenue: 0,
    other_revenue: 0,
    transaction_count: 41,
    expected_closing_float: 16760,
    opening_review_notes: 'Shift handed over from Cherono Augustica at 07:00 AM EAT with 41 active orders/transactions.',
    updated_at: new Date().toISOString()
  };

  const { error: judyUpdateErr } = await supabase
    .from('cashier_shift_logs')
    .update(judyUpdatePayload)
    .eq('id', judyCashierShiftId);

  if (judyUpdateErr) throw judyUpdateErr;
  console.log("9. Successfully updated Judy Cherotich's cashier_shift_logs with transferred transactions.");

  // 10. Generate Cashier Logbook for Cherono's shift
  const logbookPayload = {
    branch_id: branchId,
    cashier_id: '6aea7eda-5ce1-4a24-8573-93367fe2339d',
    type: 'cashier',
    log_date: '2026-10-03',
    opening_float: 0,
    closing_float: 35271,
    cashier_shift_id: cheronoCashierShiftId,
    sales_breakdown: {
      source: 'cashier_shift_logs',
      shift_id: cheronoCashierShiftId,
      shift_number: 'SHF-20261003-0008',
      cashier_name: 'CHERONO AUGUSTICA',
      total_cash: 170580,
      total_mpesa: 137440,
      total_card: 1590,
      total_sales: 309610,
      expected_closing_float: 170580,
      variance: 35271 - 170580,
      actual_cash_counted: 35271,
      actual_mpesa_logged: 312699,
      actual_card_logged: 3440,
      cash_drops: 0,
      payouts: 0,
      expense_total: 0,
      transaction_count: 243,
      restaurant_revenue: 0,
      bar_revenue: 309610,
      room_booking_revenue: 0,
      conference_revenue: 0,
      swimming_pool_revenue: 0,
      other_revenue: 0,
      unpaid_bills_value: 0,
      unpaid_bills_count: 0,
      paid_bills_value: 0,
      paid_bills_count: 0,
      total_credit_bills: 0,
      credit_bills_count: 0,
      credit_bills_details: [],
      paid_bills_details: [],
      gross_sales: 309610,
      net_sales: 309610,
      handover_time: '2026-10-04T07:00:00 EAT',
      handover_to: 'JUDY CHEROTICH'
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { error: logbookErr } = await supabase
    .from('cashier_logbooks')
    .insert(logbookPayload);

  if (logbookErr) {
    console.warn('Logbook insert notice:', logbookErr.message);
  } else {
    console.log('10. Successfully generated cashier logbook for Cherono Augustica.');
  }

  console.log('\n====================================================================');
  console.log('=== EXECUTION COMPLETE! VERIFYING FINAL STATE ===');
  console.log('====================================================================');

  // Verification queries
  const { data: vCherono } = await supabase
    .from('cashier_shift_logs')
    .select('id, shift_number, status, shift_start, shift_end, total_sales, total_cash_sales, total_mpesa_sales, total_card_sales, closing_float, actual_cash_counted, actual_mpesa_logged, actual_card_logged, variance, transaction_count')
    .eq('id', cheronoCashierShiftId)
    .single();
  console.log('\nCherono Augustica Shift (Final):', vCherono);

  const { data: vJudy } = await supabase
    .from('cashier_shift_logs')
    .select('id, shift_number, status, shift_start, total_sales, total_cash_sales, total_mpesa_sales, total_card_sales, transaction_count')
    .eq('id', judyCashierShiftId)
    .single();
  console.log('\nJudy Cherotich Shift (Final):', vJudy);

  const { data: vOutletShifts } = await supabase
    .from('pos_outlet_shifts')
    .select('id, outlet_id, cashier_id, status, opened_at, closed_at, closing_cash_counted')
    .eq('branch_id', branchId)
    .eq('outlet_id', outletId)
    .order('opened_at', { ascending: false })
    .limit(3);
  console.log('\nMain Bar POS Outlet Shifts (Final):', vOutletShifts);
}

execute().catch(console.error);
