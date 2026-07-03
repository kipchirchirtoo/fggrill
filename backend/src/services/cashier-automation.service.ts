import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import notificationService from './notification.service';

type ShiftAutomationOptions = {
  actorId?: string | null;
  closingCashCounted?: number | null;
  cashVarianceReason?: string | null;
};

type AutomationRun = {
  id: string | null;
};

const numberValue = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizePaymentMethod = (value: unknown): 'cash' | 'mpesa' | 'card' | 'credit_bill' | 'other' => {
  const method = String(value || 'cash').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (method === 'cash') return 'cash';
  if (['mpesa', 'm_pesa', 'mpesa_manual', 'm_pesa_manual', 'mobile_money'].includes(method)) return 'mpesa';
  if (['card', 'card_manual', 'swipe', 'bank_card', 'pos_card'].includes(method)) return 'card';
  if (['credit_bill', 'credit_bill_manual', 'bill', 'staff_credit', 'staff_credit_bill'].includes(method)) return 'credit_bill';
  return 'other';
};

const todayIsoDate = (): string => new Date().toISOString().slice(0, 10);

const shortRef = (value: unknown): string => String(value || '').replace(/-/g, '').slice(0, 10).toUpperCase();

const isMissingRelation = (error: any): boolean =>
  ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(String(error?.code || ''));

const loadShift = async (shiftId: string): Promise<Record<string, any>> => {
  const { data, error } = await supabase
    .from('pos_outlet_shifts')
    .select('*, outlet:pos_outlets(*)')
    .eq('id', shiftId)
    .single();

  if (error || !data) {
    throw new Error(`POS shift not found for automation: ${error?.message || shiftId}`);
  }

  return data as Record<string, any>;
};

const startAutomationRun = async (
  shift: Record<string, any>,
  actorId?: string | null
): Promise<AutomationRun> => {
  const { data, error } = await supabase
    .from('automation_runs')
    .insert({
      run_type: 'cashier_shift_close',
      source_table: 'pos_outlet_shifts',
      source_id: shift.id,
      branch_id: shift.branch_id,
      started_by: actorId || null,
      status: 'running'
    })
    .select('id')
    .single();

  if (error) {
    if (!isMissingRelation(error)) {
      logger.warn('Unable to create cashier shift automation run', error);
    }
    return { id: null };
  }

  return { id: String(data.id) };
};

const finishAutomationRun = async (
  run: AutomationRun,
  status: 'completed' | 'completed_with_warnings' | 'failed',
  summary: Record<string, any>,
  errorMessage?: string
) => {
  if (!run.id) return;

  const { error } = await supabase
    .from('automation_runs')
    .update({
      status,
      summary,
      error_message: errorMessage || null,
      completed_at: new Date().toISOString()
    })
    .eq('id', run.id);

  if (error && !isMissingRelation(error)) {
    logger.warn('Unable to finish cashier shift automation run', error);
  }
};

export const ensureShiftAutomationOpened = async (
  shiftId: string,
  actorId?: string | null
): Promise<void> => {
  try {
    const shift = await loadShift(shiftId);
    const run = await startAutomationRun(shift, actorId);
    await finishAutomationRun(run, 'completed', {
      phase: 'shift_opened',
      shift_id: shiftId,
      opened_at: new Date().toISOString()
    });
  } catch (error) {
    logger.warn('Unable to record POS shift open automation marker', error);
  }
};

const resolveStaffForOrder = async (order: Record<string, any>): Promise<Record<string, any> | null> => {
  const candidateIds = [
    order.waiter_id,
    order.created_by
  ].filter(Boolean).map((id) => String(id));

  for (const id of candidateIds) {
    const byId = await supabase
      .from('staff_profiles')
      .select('id, first_name, last_name, id_number, branch_id, user_id')
      .eq('id', id)
      .maybeSingle();
    if (byId.error && !isMissingRelation(byId.error)) throw byId.error;
    if (byId.data) return byId.data as Record<string, any>;

    const byUser = await supabase
      .from('staff_profiles')
      .select('id, first_name, last_name, id_number, branch_id, user_id')
      .eq('user_id', id)
      .maybeSingle();
    if (byUser.error && !isMissingRelation(byUser.error)) throw byUser.error;
    if (byUser.data) return byUser.data as Record<string, any>;
  }

  const waiterName = String(order.waiter_name || '').trim();
  if (waiterName) {
    const [firstName, ...lastParts] = waiterName.split(/\s+/);
    let query = supabase
      .from('staff_profiles')
      .select('id, first_name, last_name, id_number, branch_id, user_id')
      .ilike('first_name', firstName);

    const lastName = lastParts.join(' ');
    if (lastName) query = query.ilike('last_name', lastName);

    const { data, error } = await query.limit(1).maybeSingle();
    if (error && !isMissingRelation(error)) throw error;
    if (data) return data as Record<string, any>;
  }

  return null;
};

const staffDisplayName = (staff: Record<string, any> | null, fallback: string): string => {
  if (!staff) return fallback;
  const name = `${staff.first_name || ''} ${staff.last_name || ''}`.trim();
  return name || fallback;
};

const migrateUnpaidWaiterBills = async (
  shift: Record<string, any>,
  actorId?: string | null
): Promise<{ migrated: number; skipped: number; total: number; warnings: string[] }> => {
  const { data: orders, error } = await supabase
    .from('pos_shift_orders')
    .select('*')
    .eq('shift_id', shift.id)
    .in('payment_status', ['unpaid', 'partial']);

  if (error) throw error;

  let migrated = 0;
  let skipped = 0;
  let total = 0;
  const warnings: string[] = [];

  for (const order of (orders || []) as Array<Record<string, any>>) {
    const paid = numberValue(order.amount_paid);
    const balance = numberValue(order.balance_amount) || Math.max(0, numberValue(order.total_amount) - paid);
    if (balance <= 0) continue;

    const staff = await resolveStaffForOrder(order);
    if (!staff) {
      skipped += 1;
      warnings.push(`No staff profile matched waiter for order ${order.order_number || order.id}`);
      continue;
    }

    const { data: existing, error: existingError } = await supabase
      .from('staff_credit_bills')
      .select('id')
      .eq('source_pos_shift_id', shift.id)
      .eq('source_pos_order_id', order.id)
      .maybeSingle();
    if (existingError && !isMissingRelation(existingError)) throw existingError;

    let creditBillId = existing?.id ? String(existing.id) : '';
    if (!creditBillId) {
      const { data: creditBill, error: creditError } = await supabase
        .from('staff_credit_bills')
        .insert({
          staff_id: staff.id,
          amount: balance,
          description: `Automated waiter unpaid bill migration for ${order.order_number || order.id}`,
          bill_date: todayIsoDate(),
          status: 'pending',
          credit_number: `POS-CB-${shortRef(order.id)}`,
          branch_id: shift.branch_id,
          created_by: actorId || shift.cashier_id,
          source_pos_shift_id: shift.id,
          source_pos_order_id: order.id
        })
        .select('id')
        .single();

      if (creditError || !creditBill) throw creditError || new Error('Staff credit bill creation failed');
      creditBillId = String(creditBill.id);
    }

    const { data: payment } = await supabase
      .from('pos_shift_payments')
      .select('id')
      .eq('shift_id', shift.id)
      .eq('order_id', order.id)
      .eq('payment_method', 'credit_bill')
      .maybeSingle();

    if (!payment) {
      const { data: insertedPayment, error: paymentError } = await supabase
        .from('pos_shift_payments')
        .insert({
          shift_id: shift.id,
          outlet_id: shift.outlet_id,
          order_id: order.id,
          payment_method: 'credit_bill',
          amount: balance,
          reference: `AUTO-CB-${shortRef(creditBillId)}`,
          staff_credit_bill_id: creditBillId,
          received_by: actorId || shift.cashier_id
        })
        .select('id')
        .single();
      if (paymentError) throw paymentError;

      await supabase
        .from('staff_credit_bills')
        .update({ source_pos_payment_id: insertedPayment?.id || null, updated_at: new Date().toISOString() })
        .eq('id', creditBillId);
    }

    const { error: orderUpdateError } = await supabase
      .from('pos_shift_orders')
      .update({
        status: 'credit_bill',
        payment_status: 'credit_bill',
        amount_paid: numberValue(order.total_amount),
        balance_amount: 0,
        staff_credit_bill_id: creditBillId,
        migrated_to_credit_bill: true,
        migrated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);
    if (orderUpdateError) throw orderUpdateError;

    migrated += 1;
    total += balance;
  }

  return { migrated, skipped, total, warnings };
};

const postAutomatedStockMovements = async (
  shift: Record<string, any>,
  actorId?: string | null
): Promise<{ adjusted: number; quantity: number; warnings: string[] }> => {
  const { data: counts, error } = await supabase
    .from('pos_shift_stock_counts')
    .select('*')
    .eq('shift_id', shift.id);
  if (error) throw error;

  let adjusted = 0;
  let quantity = 0;
  const warnings: string[] = [];

  // branch_stock is keyed by the central catalog sku (inventory_items.sku,
  // e.g. FG-190) while POS outlet items carry M-<uuid> skus — resolve the
  // branch sku through pos_outlet_items → bar_drinks → inventory_items so
  // sold quantities actually land on the branch_stock rows. Falls back to
  // the raw count sku for non-bar items.
  const outletItemIds = ((counts || []) as Array<Record<string, any>>)
    .map((c) => String(c.outlet_item_id || ''))
    .filter(Boolean);
  const branchSkuByOutletItemId = new Map<string, string>();
  if (outletItemIds.length) {
    const { data: outletItems } = await supabase
      .from('pos_outlet_items')
      .select('id, source_table, source_item_id')
      .in('id', outletItemIds);
    const barSourced = (outletItems || []).filter(
      (oi: any) => oi.source_table === 'bar_drinks' && oi.source_item_id
    );
    if (barSourced.length) {
      const { data: drinks } = await supabase
        .from('bar_drinks')
        .select('id, inventory_item_id')
        .in('id', barSourced.map((oi: any) => oi.source_item_id));
      const invIdByDrinkId = new Map<string, string>();
      for (const d of (drinks || []) as Array<Record<string, any>>) {
        if (d.inventory_item_id) invIdByDrinkId.set(String(d.id), String(d.inventory_item_id));
      }
      const invIds = Array.from(new Set(Array.from(invIdByDrinkId.values())));
      if (invIds.length) {
        const { data: invItems } = await supabase
          .from('inventory_items')
          .select('id, sku')
          .in('id', invIds);
        const skuByInvId = new Map((invItems || []).map((i: any) => [String(i.id), i.sku]));
        for (const oi of barSourced) {
          const invId = invIdByDrinkId.get(String(oi.source_item_id));
          const branchSku = invId ? skuByInvId.get(String(invId)) : null;
          if (branchSku) branchSkuByOutletItemId.set(String(oi.id), String(branchSku));
        }
      }
    }
  }

  for (const count of (counts || []) as Array<Record<string, any>>) {
    const sku = branchSkuByOutletItemId.get(String(count.outlet_item_id || ''))
      || String(count.sku || '').trim();
    const sold = Math.max(0, Math.round(numberValue(count.sold_quantity)));
    const systemClosing = numberValue(count.opening_stock) + numberValue(count.additions) - numberValue(count.sold_quantity);

    await supabase
      .from('pos_shift_stock_counts')
      .update({
        system_closing_stock: systemClosing,
        physical_count: systemClosing,
        variance: 0,
        variance_reason: 'Automated by Lina from POS sales',
        updated_at: new Date().toISOString()
      })
      .eq('id', count.id);

    await supabase
      .from('pos_outlet_items')
      .update({ current_stock: systemClosing, updated_at: new Date().toISOString() })
      .eq('id', count.outlet_item_id);

    if (!sku || sold <= 0 || count.track_stock === false) continue;

    const { data: existingMovement } = await supabase
      .from('branch_stock_movements')
      .select('id')
      .eq('branch_id', shift.branch_id)
      .eq('item_sku', sku)
      .eq('reference_id', shift.id)
      .eq('movement_type', 'SALE')
      .limit(1)
      .maybeSingle();
    if (existingMovement) continue;

    const { data: stockRow, error: stockError } = await supabase
      .from('branch_stock')
      .select('id, quantity')
      .eq('branch_id', shift.branch_id)
      .eq('item_sku', sku)
      .maybeSingle();
    if (stockError && !isMissingRelation(stockError)) throw stockError;

    const previousStock = numberValue(stockRow?.quantity);
    const newStock = Math.max(0, previousStock - sold);

    if (stockRow?.id) {
      const { error: branchUpdateError } = await supabase
        .from('branch_stock')
        .update({
          quantity: newStock,
          current_stock: newStock,
          last_stock_out: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', stockRow.id);
      if (branchUpdateError) throw branchUpdateError;
    } else {
      warnings.push(`Branch stock row missing for sold SKU ${sku}; movement logged with zero opening stock.`);
    }

    const { error: movementError } = await supabase
      .from('branch_stock_movements')
      .insert({
        branch_id: shift.branch_id,
        item_sku: sku,
        movement_type: 'SALE',
        quantity: sold,
        previous_stock: previousStock,
        new_stock: newStock,
        reference_type: 'SALE',
        reference_id: shift.id,
        reference_number: `POS-${shortRef(shift.id)}`,
        notes: `Automated stock adjustment from POS shift ${shift.id}`,
        performed_by: actorId || shift.cashier_id
      });
    if (movementError) throw movementError;

    adjusted += 1;
    quantity += sold;
  }

  return { adjusted, quantity, warnings };
};

const logbookTypeForShift = (shift: Record<string, any>): string => {
  const type = String(shift.outlet?.outlet_type || shift.outlet_type || 'cashier');
  return ['restaurant', 'main_bar', 'executive_bar', 'non_consumables', 'cashier', 'kyogong_reception', 'kyogong_spa', 'kyogong_executive_bar', 'kyogong_sports_bar'].includes(type)
    ? type
    : 'unified_pos';
};

const createGeneratedLogbook = async (
  shift: Record<string, any>,
  run: AutomationRun,
  automationSummary: Record<string, any>,
  options: ShiftAutomationOptions
): Promise<Record<string, any>> => {
  const { data: orders, error: orderError } = await supabase
    .from('pos_shift_orders')
    .select('*')
    .eq('shift_id', shift.id);
  if (orderError) throw orderError;

  const { data: payments, error: paymentError } = await supabase
    .from('pos_shift_payments')
    .select('*')
    .eq('shift_id', shift.id);
  if (paymentError) throw paymentError;

  const totalMpesa = (payments || [])
    .filter((payment: any) => normalizePaymentMethod(payment.payment_method) === 'mpesa')
    .reduce((sum: number, payment: any) => sum + numberValue(payment.amount), 0);
  const totalSwipe = (payments || [])
    .filter((payment: any) => normalizePaymentMethod(payment.payment_method) === 'card')
    .reduce((sum: number, payment: any) => sum + numberValue(payment.amount), 0);
  const totalCash = (payments || [])
    .filter((payment: any) => normalizePaymentMethod(payment.payment_method) === 'cash')
    .reduce((sum: number, payment: any) => sum + numberValue(payment.amount), 0);
  const totalCredit = (payments || [])
    .filter((payment: any) => normalizePaymentMethod(payment.payment_method) === 'credit_bill')
    .reduce((sum: number, payment: any) => sum + numberValue(payment.amount), 0);

  const logDate = String(shift.opened_at || new Date().toISOString()).slice(0, 10);
  const type = logbookTypeForShift(shift);
  const closingFloat = Number.isFinite(options.closingCashCounted as number)
    ? numberValue(options.closingCashCounted)
    : numberValue(automationSummary.expected_cash);

  const logbookPayload = {
    branch_id: shift.branch_id,
    cashier_id: shift.cashier_id,
    type,
    log_date: logDate,
    opening_float: numberValue(shift.opening_float),
    closing_float: closingFloat,
    sales_breakdown: {
      total_cash: totalCash,
      total_mpesa: totalMpesa,
      total_card: totalSwipe,
      total_credit_bill: totalCredit,
      total_sales: (orders || []).reduce((sum: number, order: any) => sum + numberValue(order.total_amount), 0),
      order_count: (orders || []).length,
      outlet: shift.outlet?.name || type,
      automation: automationSummary
    },
    total_mpesa: totalMpesa,
    total_swipe: totalSwipe,
    notes: [
      'Generated automatically by Lina at POS shift close.',
      options.cashVarianceReason ? `Cash note: ${options.cashVarianceReason}` : ''
    ].filter(Boolean).join(' '),
    status: 'pending_accountant_review',
    source: 'lina_shift_automation',
    outlet_shift_id: shift.id,
    automation_run_id: run.id,
    submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data: existing } = await supabase
    .from('cashier_logbooks')
    .select('id')
    .eq('outlet_shift_id', shift.id)
    .maybeSingle();

  const logbookResult = existing?.id
    ? await supabase
        .from('cashier_logbooks')
        .update(logbookPayload)
        .eq('id', existing.id)
        .select('*')
        .single()
    : await supabase
        .from('cashier_logbooks')
        .insert(logbookPayload)
        .select('*')
        .single();

  if (logbookResult.error || !logbookResult.data) {
    throw logbookResult.error || new Error('Cashier logbook generation failed');
  }

  const logbook = logbookResult.data as Record<string, any>;
  await supabase
    .from('cashier_logbook_lines')
    .delete()
    .eq('logbook_id', logbook.id)
    .eq('source_table', 'pos_shift_payments');

  const staffByOrderId = new Map<string, Record<string, any> | null>();
  for (const order of (orders || []) as Array<Record<string, any>>) {
    staffByOrderId.set(String(order.id), await resolveStaffForOrder(order));
  }

  const paymentLines = ((payments || []) as Array<Record<string, any>>).map((payment) => {
    const order = ((orders || []) as Array<Record<string, any>>).find((item) => String(item.id) === String(payment.order_id));
    const staff = order ? staffByOrderId.get(String(order.id)) || null : null;
    const normalizedPaymentMethod = normalizePaymentMethod(payment.payment_method);
    const isCredit = normalizedPaymentMethod === 'credit_bill';
    return {
      logbook_id: logbook.id,
      section: isCredit ? 'credit_bill' : 'paid_bill',
      customer_name: isCredit
        ? staffDisplayName(staff, order?.waiter_name || order?.customer_name || 'Staff credit bill')
        : String(order?.customer_name || order?.order_number || 'POS payment'),
      amount: numberValue(payment.amount),
      reference: String(payment.reference || order?.order_number || payment.id),
      staff_id: isCredit ? staff?.id || null : null,
      source_table: 'pos_shift_payments',
      source_id: payment.id,
      payment_method: normalizedPaymentMethod === 'other' ? payment.payment_method : normalizedPaymentMethod,
      outlet_shift_id: shift.id,
      automation_run_id: run.id
    };
  });

  if (paymentLines.length) {
    const { error: lineError } = await supabase
      .from('cashier_logbook_lines')
      .insert(paymentLines);
    if (lineError) throw lineError;
  }

  await notificationService.notifyRole(
    'branch_accountant',
    'Cashier logbook ready for review',
    `Lina generated the ${shift.outlet?.name || 'POS'} shift logbook for ${logDate}.`,
    {
      type: 'info',
      category: 'cashier_logbook',
      priority: 'high',
      branchId: shift.branch_id,
      metadata: {
        logbook_id: logbook.id,
        shift_id: shift.id,
        source: 'lina_shift_automation'
      }
    }
  );

  return logbook;
};

export const runShiftCloseAutomation = async (
  shiftId: string,
  options: ShiftAutomationOptions = {}
): Promise<Record<string, any>> => {
  const shift = await loadShift(shiftId);
  const run = await startAutomationRun(shift, options.actorId);

  try {
    const creditMigration = await migrateUnpaidWaiterBills(shift, options.actorId);
    const stockAutomation = await postAutomatedStockMovements(shift, options.actorId);
    const summary = {
      credit_bill_migration: creditMigration,
      stock_automation: stockAutomation,
      warnings: [...creditMigration.warnings, ...stockAutomation.warnings],
      generated_at: new Date().toISOString()
    };
    const logbook = await createGeneratedLogbook(shift, run, summary, options);
    const finalSummary = { ...summary, logbook_id: logbook.id };

    await finishAutomationRun(
      run,
      finalSummary.warnings.length ? 'completed_with_warnings' : 'completed',
      finalSummary
    );

    return finalSummary;
  } catch (error: any) {
    await finishAutomationRun(run, 'failed', {}, error?.message || String(error));
    throw error;
  }
};
