import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

/**
 * Migrate pending orders older than 8 hours to unpaid bills
 * Also record void bills to audit table
 * Runs every hour via cron
 */
export const migratePendingBills = async (branchId?: number) => {
    try {
        logger.info(`Starting pending bills migration job${branchId ? ` for branch ${branchId}` : ''}...`);

        // ── AUTO-MIGRATION DISABLED ───────────────────────────────────────────
        // Pending orders (restaurant, bar, POS, Captain POS) are intentionally
        // NOT auto-migrated to unpaid_bills. Cashiers and accountants handle
        // clearances manually. Remove the early-return below to re-enable.
        logger.info('Auto-migration of pending orders to unpaid bills is disabled — skipping.');
        await recordVoidBills();
        logger.info('Pending bills migration job completed (void-audit only).');
        return;
        // ─────────────────────────────────────────────────────────────────────

        /* eslint-disable no-unreachable */
        // Map of raw table names → valid bill_type values that satisfy the unpaid_bills
        // check constraint. If the constraint changes, update this map.
        const BILL_TYPE_MAP: Record<string, string> = {
            restaurant_orders: 'restaurant_order',
            bar_orders: 'bar_order',
            pos_transactions: 'pos_transaction',
            pos_shift_orders: 'pos_order',
        };

        // Define tables and their mapping for migration
        const migrationTargets = [
            {
                table: 'restaurant_orders',
                idField: 'id',
                waiterField: 'created_by',
                amountField: 'total_amount',
                numberField: 'order_number',
                locationFields: ['table_number', 'room_number'],
                statusValue: 'pending',
                typeLabel: 'Restaurant Order'
            },
            {
                table: 'bar_orders',
                idField: 'id',
                waiterField: 'created_by',
                amountField: 'total',
                numberField: 'order_number',
                locationFields: ['seat_number', 'room_number'],
                statusValue: 'pending',
                typeLabel: 'Bar Order'
            },
            {
                table: 'pos_transactions',
                idField: 'id',
                waiterField: 'cashier_id',
                amountField: 'total_amount',
                numberField: 'transaction_number',
                locationFields: [],
                statusValue: 'pending',
                typeLabel: 'POS Transaction'
            },
            {
                table: 'pos_shift_orders',
                idField: 'id',
                waiterField: 'waiter_id',
                amountField: 'balance_amount',
                numberField: 'order_number',
                locationFields: ['customer_name'],
                statusValue: 'open',
                typeLabel: 'Captain POS Order'
            }
        ];
        /* eslint-enable no-unreachable */

        // If branchId is provided, we might want to skip the 8-hour check for immediate migration
        // But usually we should still check if they are pending.
        const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();

        for (const target of migrationTargets) {
            try {
                logger.info(`Checking ${target.table} for pending migrations...`);

                // pos_transactions.cashier_id has no FK to users in the schema cache,
                // so skip the users join for that table (staff profile resolved below anyway).
                const selectClause = target.table === 'pos_transactions'
                    ? '*'
                    : `*, waiter:users!${target.waiterField}(id, first_name, last_name)`;
                let query = (supabase
                    .from(target.table)
                    .select(selectClause) as any)
                    .eq('status', target.statusValue)
                    .eq('migrated_to_credit_bill', false)
                    .not(target.waiterField, 'is', null);

                // If no branchId provided, apply the 8-hour rule
                if (!branchId) {
                    query = query.lt('created_at', eightHoursAgo);
                } else {
                    query = query.eq('branch_id', branchId);
                }

                const { data: pendingItems, error: fetchError } = await query;

                if (fetchError) {
                    // Skip if table doesn't have these columns yet or other errors
                    if (fetchError.message?.includes('column') || fetchError.code === '42703') {
                        logger.warn(`Table ${target.table} missing migration columns, skipping.`);
                        continue;
                    }
                    logger.error(`Error fetching pending ${target.table}:`, fetchError);
                    continue;
                }

                if (!pendingItems || pendingItems.length === 0) {
                    logger.info(`No pending ${target.table} to migrate`);
                    continue;
                }

                logger.info(`Found ${pendingItems.length} pending ${target.table} to migrate`);

                for (const item of pendingItems as any[]) {
                    try {
                        const itemWaiter = Array.isArray(item.waiter) ? item.waiter[0] : item.waiter;
                        const waiterUserId = item[target.waiterField];
                        type StaffRow = { id: string; first_name: string; last_name: string };
                        const { data: _rawProfile, error: staffError } = await supabase
                            .from('staff_profiles')
                            .select('id, first_name, last_name')
                            .or(`user_id.eq.${waiterUserId},id.eq.${waiterUserId}`)
                            .maybeSingle();
                        const staffProfile = _rawProfile as StaffRow | null;

                        if (staffError) {
                            logger.error(`Error resolving staff profile for ${target.table} ${item[target.idField]}:`, staffError);
                            continue;
                        }
                        if (!staffProfile || !staffProfile!.id) {
                            logger.warn(`No staff profile found for waiter/user ${waiterUserId}; skipping ${target.table} ${item[target.idField]}`);
                            continue;
                        }
                        const sp = staffProfile!;

                        const location = target.locationFields
                            .map(field => item[field] ? `${field.replace('_', ' ')} ${item[field]}` : null)
                            .filter(Boolean)
                            .join(', ') || 'Unknown';

                        const amount = parseFloat(item[target.amountField] || '0');
                        const number = item[target.numberField] || item[target.idField];

                        const { data: migratedBillNumberData } = await supabase.rpc('generate_bill_number');
                        const migratedBillNumber = migratedBillNumberData
                            ? String(migratedBillNumberData).toUpperCase().replace(/[^A-Z0-9]/g, '')
                            : `MIG${Date.now()}`;

                        const { error: unpaidBillError } = await supabase
                            .from('unpaid_bills')
                            .insert({
                                bill_number: migratedBillNumber,
                                bill_type: BILL_TYPE_MAP[target.table] ?? target.table,
                                source_id: item[target.idField],
                                customer_name: `${sp.first_name || itemWaiter?.first_name || ''} ${sp.last_name || itemWaiter?.last_name || ''}`.trim() || 'Waiter',
                                waiter_id: sp.id,
                                branch_id: item.branch_id,
                                total_amount: amount,
                                amount_paid: 0,
                                balance_amount: amount,
                                balance_due: amount,
                                bill_date: new Date().toISOString(),
                                remarks: `Auto-migrated uncleared ${target.typeLabel} ${number} (${location}) - Payroll deduction`,
                                status: 'unpaid'
                            });

                        if (unpaidBillError) {
                            logger.error(`Error creating unpaid bill for ${target.table} ${number}:`, unpaidBillError);
                            continue;
                        }

                        // Update item to mark as migrated
                        const { error: updateError } = await supabase
                            .from(target.table)
                            .update({
                                migrated_to_credit_bill: true,
                                migrated_at: new Date().toISOString()
                            })
                            .eq(target.idField, item[target.idField]);

                        if (updateError) {
                            logger.error(`Error updating ${target.table} ${number}:`, updateError);
                            continue;
                        }

                        // Send notification
                        if (itemWaiter?.id) {
                            await supabase.from('notifications').insert({
                                user_id: itemWaiter.id,
                                module: 'credit_bills',
                                type: 'pending_bill_migrated',
                                title: 'Order Migrated to Unpaid Bills',
                                message: `${target.typeLabel} ${number} (${location}) has been migrated to unpaid bills - KES ${amount?.toLocaleString()}`,
                                link: '/dashboard/staff/credit-bills',
                                is_read: false
                            });
                        }

                        logger.info(`Successfully migrated ${target.table} ${number} to unpaid bill`);
                    } catch (err) {
                        logger.error(`Error processing ${target.table} item:`, err);
                    }
                }
            } catch (targetErr) {
                logger.error(`Error processing migration target ${target.table}:`, targetErr);
            }
        }

        // 2. Record void bills to audit (Existing logic)
        await recordVoidBills();

        logger.info('Pending bills migration job completed');
    } catch (error) {
        logger.error('Error in pending bills migration job:', error);
    }
};

/**
 * Record void restaurant orders to audit table
 */
async function recordVoidBills() {
    try {
        const { data: voidOrders, error: voidFetchError } = await supabase
            .from('restaurant_orders')
            .select(`
                id,
                order_number,
                created_by,
                table_number,
                room_number,
                total_amount,
                cancelled_at,
                cancellation_reason,
                waiter:users!created_by(first_name, last_name)
            `)
            .eq('status', 'cancelled')
            .not('cancelled_at', 'is', null);

        if (voidFetchError) {
            logger.error('Error fetching void orders:', voidFetchError);
            return;
        }

        if (voidOrders && voidOrders.length > 0) {
            const { data: existingAudits } = await supabase
                .from('void_bills_audit')
                .select('order_id')
                .in('order_id', voidOrders.map(o => o.id));

            const existingOrderIds = new Set(existingAudits?.map(a => a.order_id) || []);
            const newVoidOrders = voidOrders.filter(o => !existingOrderIds.has(o.id));

            if (newVoidOrders.length > 0) {
                const auditRecords = newVoidOrders.map(order => {
                    const waiter = Array.isArray(order.waiter) ? order.waiter[0] : order.waiter;
                    return {
                        order_id: order.id,
                        order_number: order.order_number,
                        waiter_id: order.created_by,
                        waiter_name: waiter ? `${waiter.first_name} ${waiter.last_name}`.trim() : null,
                        table_number: order.table_number,
                        room_number: order.room_number,
                        total_amount: order.total_amount,
                        voided_at: order.cancelled_at,
                        voided_by: null,
                        void_reason: order.cancellation_reason,
                        reviewed_by_auditor: false
                    };
                });

                await supabase.from('void_bills_audit').insert(auditRecords);
            }
        }
    } catch (err) {
        logger.error('Error recording void bills:', err);
    }
}
