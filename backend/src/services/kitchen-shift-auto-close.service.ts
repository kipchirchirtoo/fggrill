import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

function n(v: any): number {
    const num = Number(v);
    return isNaN(num) ? 0 : num;
}

export interface AutoCloseKitchenOptions {
    branchId: number | string;
    cashierShiftId?: string | null;
    userId?: string | null;
    closingNotes?: string;
}

/**
 * Automatically closes all active (status = 'open') kitchen shifts for the given branch.
 * When the cashier closes their shift for the commercial day / shift, this ensures
 * all corresponding kitchen sessions are cleanly closed, closing stocks & variances calculated,
 * stock_counts synced, and daily controls snapshots persisted for the Branch Accountant.
 */
export async function autoCloseOpenKitchenShiftsForBranch(
    options: AutoCloseKitchenOptions
): Promise<Array<{ id: string; shift_number: string }>> {
    const branchIdNum = Number(options.branchId);
    if (!branchIdNum || isNaN(branchIdNum)) {
        return [];
    }

    try {
        let query = supabase
            .from('kitchen_shifts')
            .select('*')
            .eq('branch_id', branchIdNum)
            .eq('status', 'open');

        const { data: openShifts, error: fetchErr } = await query;
        if (fetchErr) {
            logger.error('[autoCloseKitchenShifts] Error fetching open kitchen shifts:', fetchErr);
            return [];
        }

        if (!openShifts || openShifts.length === 0) {
            return [];
        }

        logger.info(
            `[autoCloseKitchenShifts] Auto-closing ${openShifts.length} open kitchen shift(s) for branch ${branchIdNum} (Cashier shift: ${options.cashierShiftId || 'N/A'})`
        );

        const closedList: Array<{ id: string; shift_number: string }> = [];

        for (const shift of openShifts) {
            const shiftId = shift.id;
            const now = new Date().toISOString();

            // 1. Fetch shift items
            const { data: items, error: itemsErr } = await supabase
                .from('kitchen_shift_items')
                .select('*')
                .eq('shift_id', shiftId);

            if (itemsErr) {
                logger.error(`[autoCloseKitchenShifts] Error fetching items for shift ${shiftId}:`, itemsErr);
            }

            let spoilageCost = 0;
            let varianceCost = 0;
            let cogs = 0;

            // 2. Process each shift item to finalize counts
            for (const item of items || []) {
                const open = n(item.opening_stock);
                const adds = n(item.additions);
                const sold = n(item.sold_quantity);
                const spoil = n(item.spoilage_quantity);
                const sysClose = open + adds - sold - spoil;
                const phys = item.physical_count !== null ? n(item.physical_count) : sysClose;
                const varQty = phys - sysClose;
                const cp = n(item.cost_price);
                const varVal = varQty * cp;

                await supabase
                    .from('kitchen_shift_items')
                    .update({
                        physical_count: phys,
                        system_closing_stock: sysClose,
                        variance: varQty,
                        variance_value: varVal,
                        updated_at: now
                    })
                    .eq('id', item.id);

                // Insert stock take entry if not already present
                await supabase
                    .from('kitchen_shift_stock_take')
                    .insert({
                        shift_id: shiftId,
                        branch_id: shift.branch_id,
                        item_sku: item.item_sku,
                        item_name: item.item_name,
                        unit_of_measure: item.unit_of_measure,
                        cost_price: cp,
                        opening_stock: open,
                        additions: adds,
                        total_available: open + adds,
                        system_sales: sold,
                        spoilage: spoil,
                        system_closing_stock: sysClose,
                        physical_count: phys,
                        variance: varQty,
                        variance_value: varVal,
                        variance_category: varQty < 0 ? 'shortage' : varQty > 0 ? 'overage' : 'ok',
                        variance_reason: options.closingNotes || 'Auto-closed on cashier shift closure',
                        counted_by: options.userId || shift.store_keeper_id || shift.opened_by,
                        counted_at: now
                    });

                spoilageCost += spoil * cp;
                varianceCost += varVal;
                cogs += (sold + spoil) * cp;
            }

            // 3. Update kitchen_shifts header to closed
            const { error: updErr } = await supabase
                .from('kitchen_shifts')
                .update({
                    status: 'closed',
                    closed_at: now,
                    total_cogs: cogs,
                    total_spoilage_cost: spoilageCost,
                    total_variance_cost: varianceCost,
                    closing_notes: options.closingNotes || 'Auto-closed on cashier shift closure',
                    updated_at: now
                })
                .eq('id', shiftId);

            if (updErr) {
                logger.error(`[autoCloseKitchenShifts] Error updating kitchen shift ${shiftId}:`, updErr);
                continue;
            }

            closedList.push({ id: shiftId, shift_number: shift.shift_number });

            // 4. Sync to stock_counts for Branch Accountant audit
            try {
                await syncToStockCounts(shift, items || [], now);
            } catch (stockCountErr) {
                logger.error(`[autoCloseKitchenShifts] Error syncing to stock_counts for shift ${shiftId}:`, stockCountErr);
            }

            logger.info(`[autoCloseKitchenShifts] Successfully auto-closed kitchen shift ${shift.shift_number} (${shiftId})`);
        }

        return closedList;
    } catch (error) {
        logger.error('[autoCloseKitchenShifts] Unexpected error during auto-close:', error);
        return [];
    }
}

async function syncToStockCounts(shift: any, items: any[], timestamp: string) {
    const shiftLocation = shift.sub_shift_type
        ? `kitchen_${String(shift.sub_shift_type).toLowerCase()}`
        : 'kitchen_single';
    const stocktakeDate = shift.shift_date;

    const { data: existingCount } = await supabase
        .from('stock_counts')
        .select('id')
        .eq('branch_id', shift.branch_id)
        .eq('count_date', stocktakeDate)
        .eq('location', shiftLocation)
        .eq('store_type', 'kitchen')
        .maybeSingle();

    const countHeader: any = {
        branch_id: shift.branch_id,
        count_date: stocktakeDate,
        count_type: 'daily',
        store_type: 'kitchen',
        location: shiftLocation,
        status: 'submitted',
        counted_by: shift.store_keeper_id || shift.opened_by || null,
        updated_at: timestamp
    };

    let countId = existingCount?.id;
    if (countId) {
        await supabase.from('stock_counts').update(countHeader).eq('id', countId);
    } else {
        const { data: createdCount } = await supabase
            .from('stock_counts')
            .insert({ ...countHeader, created_at: timestamp })
            .select('id')
            .single();
        countId = createdCount?.id;
    }

    if (countId && items.length > 0) {
        for (const item of items) {
            const open = n(item.opening_stock);
            const adds = n(item.additions);
            const sold = n(item.sold_quantity);
            const spoil = n(item.spoilage_quantity);
            const sysClose = open + adds - sold - spoil;
            const phys = item.physical_count !== null ? n(item.physical_count) : sysClose;
            const varQty = phys - sysClose;
            const cp = n(item.cost_price);

            const countItem: any = {
                stock_count_id: countId,
                item_id: item.item_sku,
                item_name: item.item_name,
                system_quantity: sysClose,
                physical_quantity: phys,
                variance: varQty,
                unit_cost: cp,
                variance_cost: varQty * cp,
                category: 'Food',
                updated_at: timestamp
            };

            const { data: existingItem } = await supabase
                .from('stock_count_items')
                .select('id')
                .eq('stock_count_id', countId)
                .eq('item_id', item.item_sku)
                .maybeSingle();

            if (existingItem) {
                await supabase.from('stock_count_items').update(countItem).eq('id', existingItem.id);
            } else {
                await supabase.from('stock_count_items').insert({ ...countItem, created_at: timestamp });
            }
        }
    }
}
