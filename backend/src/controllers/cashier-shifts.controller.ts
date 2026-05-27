import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { applyBranchFilter, isGlobalRole } from '../utils/branchIsolation';

// ==========================================
// SHIFT LOGBOOK
// ==========================================

// @desc    Get shift logs
// @route   GET /api/cashier/shifts
// @access  Private
export const getShiftLogs = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id, cashier_id, status, from_date, to_date } = req.query;
        const userId = req.user?.id;
        const userRole = req.user?.role;

        let query = supabase
            .from('cashier_shift_logs')
            .select('*')
            .order('shift_start', { ascending: false });

        // Apply branch isolation automatically
        query = applyBranchFilter(query, req);
        
        // Cashiers can only see their own shifts unless they're admin/accountant/auditor
        const managerRoles = [
            'super_admin',
            'general_manager', 
            'branch_manager',
            'accountant',
            'branch_accountant',
            'auditor',
            'it_manager'
        ];
        
        const isManager = managerRoles.includes((userRole || '').toString().toLowerCase()) || isGlobalRole(userRole?.toString());
        
        // Priority: if a manager provides a cashier_id, filter by it.
        // Otherwise, if not a manager, FORCE filter by their own userId.
        if (!isManager) {
            query = query.eq('cashier_id', userId);
        } else if (cashier_id) {
            query = query.eq('cashier_id', cashier_id);
        }

        // Filter by status
        if (status) {
            query = query.eq('status', status);
        }

        // Filter by date range
        if (from_date) {
            query = query.gte('shift_start', from_date);
        }
        if (to_date) {
            query = query.lte('shift_start', to_date);
        }

        const { data, error } = await query;

        if (error) throw error;

        const shifts = data || [];

        // Batch-fetch user names for shifts missing cashier_name
        const missingNameIds = [...new Set(
            shifts.filter((s: any) => !s.cashier_name && s.cashier_id).map((s: any) => s.cashier_id)
        )];
        const userNameMap: Record<string, string> = {};
        if (missingNameIds.length > 0) {
            const { data: users } = await supabase
                .from('users')
                .select('id, first_name, last_name')
                .in('id', missingNameIds);
            (users || []).forEach((u: any) => {
                userNameMap[u.id] = `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'N/A';
            });
        }

        // Enrich each shift: compute live sales from source revenue tables
        const enriched = await Promise.all(shifts.map(async (shift: any) => {
            const cashierName = shift.cashier_name || userNameMap[shift.cashier_id] || 'N/A';

            // For closed/reconciled shifts that already have totals stored, use them as-is
            if (shift.status !== 'open' && shift.total_sales > 0) {
                return { ...shift, cashier_name: cashierName };
            }

            if (!shift.shift_start || !shift.branch_id) {
                return { ...shift, cashier_name: cashierName };
            }

            const shiftEnd = shift.shift_end || new Date().toISOString();
            const branchId = shift.branch_id;

            try {
                // First try the RPC (works when cashier_shift_transactions are linked)
                const { data: summary } = await supabase
                    .rpc('calculate_shift_summary', { p_shift_id: shift.id });

                if (summary && summary.total_sales > 0) {
                    const expectedClosingFloat = Number(shift.opening_float || 0) + Number(summary.total_cash || 0);
                    const closingFloat = Number(shift.closing_float || 0);
                    return {
                        ...shift,
                        cashier_name: cashierName,
                        total_sales: summary.total_sales,
                        total_cash_sales: summary.total_cash || 0,
                        total_mpesa_sales: summary.total_mpesa || 0,
                        total_card_sales: summary.total_card || 0,
                        transaction_count: summary.transaction_count || 0,
                        expected_closing_float: expectedClosingFloat,
                        variance: closingFloat > 0 ? closingFloat - expectedClosingFloat : shift.variance,
                    };
                }

                // Fallback: aggregate from source revenue tables
                // CRITICAL: Must filter by branch_id AND cashier_id to prevent cross-shift/cross-branch leakage
                const [
                    { data: restOrders },
                    { data: barOrders },
                ] = await Promise.all([
                    supabase.from('restaurant_orders')
                        .select('total_amount, payment_method')
                        .eq('branch_id', branchId)
                        .eq('created_by', shift.cashier_id)
                        .gte('created_at', shift.shift_start)
                        .lte('created_at', shiftEnd),
                    supabase.from('bar_orders')
                        .select('total_amount, payment_method')
                        .eq('branch_id', branchId)
                        .eq('created_by', shift.cashier_id)
                        .gte('created_at', shift.shift_start)
                        .lte('created_at', shiftEnd),
                ]);

                const allOrders = [
                    ...(restOrders || []),
                    ...(barOrders || []),
                ];
                const totalCash  = allOrders.filter((o: any) => (o.payment_method || '').toLowerCase() === 'cash').reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);
                const totalMpesa = allOrders.filter((o: any) => (o.payment_method || '').toLowerCase().includes('mpesa') || (o.payment_method || '').toLowerCase().includes('m-pesa')).reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);
                const totalCard  = allOrders.filter((o: any) => (o.payment_method || '').toLowerCase() === 'card').reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);
                const restBarTotal = allOrders.reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);
                const totalSales = restBarTotal;
                const txCount = allOrders.length;

                if (totalSales > 0) {
                    const expectedClosingFloat = Number(shift.opening_float || 0) + totalCash;
                    const closingFloat = Number(shift.closing_float || 0);
                    return {
                        ...shift,
                        cashier_name: cashierName,
                        total_sales: totalSales,
                        total_cash_sales: totalCash,
                        total_mpesa_sales: totalMpesa,
                        total_card_sales: totalCard,
                        transaction_count: txCount,
                        expected_closing_float: expectedClosingFloat,
                        variance: closingFloat > 0 ? closingFloat - expectedClosingFloat : shift.variance,
                    };
                }
            } catch (err) {
                logger.warn(`Sales enrichment failed for shift ${shift.id}:`, err);
            }

            return { ...shift, cashier_name: cashierName };
        }));

        res.status(200).json({
            success: true,
            data: enriched
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single shift log with transactions
// @route   GET /api/cashier/shifts/:id
// @access  Private
export const getShiftLog = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        let query = supabase.from("cashier_shift_logs").select("*").eq("id", id);
        query = applyBranchFilter(query, req);
        const { data: shift, error: shiftError } = await query.single();

        if (shiftError) throw shiftError;
        if (!shift) throw new AppError('Shift not found', 404);

        // Verify ownership - cashiers can only view their own shifts
        const userId = req.user?.id;
        const userRole = (req.user?.role || '').toString().toLowerCase();
        const managerRoles = [
            'super_admin',
            'general_manager',
            'branch_manager',
            'accountant',
            'branch_accountant',
            'auditor'
        ];
        const isManager = managerRoles.includes(userRole) || isGlobalRole(userRole);
        
        if (!isManager && shift.cashier_id !== userId) {
            throw new AppError('You can only view your own shifts', 403);
        }

        // Get transactions
        const { data: transactions, error: txError } = await supabase
            .from('cashier_shift_transactions')
            .select('*')
            .eq('shift_id', id)
            .order('transaction_time', { ascending: false });

        if (txError) throw txError;

        // Enrich cashier name — fallback to users table if not stored on shift
        let cashierName = shift.cashier_name;
        if (!cashierName && shift.cashier_id) {
            const { data: user } = await supabase
                .from('users')
                .select('first_name, last_name')
                .eq('id', shift.cashier_id)
                .single();
            cashierName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'N/A';
        }
        cashierName = cashierName || 'N/A';

        // If totals are zero, recompute from payments table
        let enrichedShift = { ...shift, cashier_name: cashierName, transactions: transactions || [] };

        if (shift.cashier_id && shift.shift_start) {
            const shiftEnd = shift.shift_end || new Date().toISOString();
            const branchId = shift.branch_id;
            let rpcOk = false;

            // Step 1: try RPC
            try {
                const { data: summary } = await supabase
                    .rpc('calculate_shift_summary', { p_shift_id: shift.id });

                if (summary && summary.total_sales > 0) {
                    rpcOk = true;
                    const expectedClosingFloat = Number(shift.opening_float || 0) + Number(summary.total_cash || 0);
                    const closingFloat = Number(shift.closing_float || 0);
                    enrichedShift = {
                        ...enrichedShift,
                        total_sales: summary.total_sales,
                        total_cash_sales: summary.total_cash || 0,
                        total_mpesa_sales: summary.total_mpesa || 0,
                        total_card_sales: summary.total_card || 0,
                        transaction_count: summary.transaction_count || 0,
                        expected_closing_float: expectedClosingFloat,
                        variance: closingFloat > 0 ? closingFloat - expectedClosingFloat : shift.variance,
                    };
                }
            } catch (rpcErr) {
                logger.warn(`calculate_shift_summary failed for shift ${shift.id}:`, rpcErr);
            }

            // Step 2: fallback — aggregate from source revenue tables by time window only
            if (!rpcOk) {
                try {
                    // Fallback: aggregate from source revenue tables
                    const [
                        { data: restOrders },
                        { data: barOrders },
                    ] = await Promise.all([
                        supabase.from('restaurant_orders')
                            .select('total_amount, payment_method')
                            .eq('branch_id', branchId)
                            .eq('created_by', shift.cashier_id)
                            .gte('created_at', shift.shift_start)
                            .lte('created_at', shiftEnd),
                        supabase.from('bar_orders')
                            .select('total_amount, payment_method')
                            .eq('branch_id', branchId)
                            .eq('created_by', shift.cashier_id)
                            .gte('created_at', shift.shift_start)
                            .lte('created_at', shiftEnd),
                    ]);

                    const allOrders = [...(restOrders || []), ...(barOrders || [])];
                    const totalCash  = allOrders.filter((o: any) => (o.payment_method || '').toLowerCase() === 'cash').reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);
                    const totalMpesa = allOrders.filter((o: any) => (o.payment_method || '').toLowerCase().includes('mpesa') || (o.payment_method || '').toLowerCase().includes('m-pesa')).reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);
                    const totalCard  = allOrders.filter((o: any) => (o.payment_method || '').toLowerCase() === 'card').reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);
                    const totalSales = allOrders.reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);

                    if (totalSales > 0) {
                        const expectedClosingFloat = Number(shift.opening_float || 0) + totalCash;
                        const closingFloat = Number(shift.closing_float || 0);
                        enrichedShift = {
                            ...enrichedShift,
                            total_sales: totalSales,
                            total_cash_sales: totalCash,
                            total_mpesa_sales: totalMpesa,
                            total_card_sales: totalCard,
                            transaction_count: allOrders.length,
                            expected_closing_float: expectedClosingFloat,
                            variance: closingFloat > 0 ? closingFloat - expectedClosingFloat : shift.variance,
                        };
                    }
                } catch (fallbackErr) {
                    logger.warn(`Source-table fallback failed for shift ${shift.id}:`, fallbackErr);
                }
            }
        }

        // Autopopulate staff credit bills that were cleared through the cashier
        // during this open shift, so the close-shift logbook submits the same
        // staff_profiles IDs to payroll staff_credit_bills.
        try {
            const shiftEnd = shift.shift_end || new Date().toISOString();
            const { data: cashierCreditTxs, error: cashierCreditTxError } = await supabase
                .from('cashier_transactions')
                .select('id, amount, transaction_number, payment_reference, credit_bill_id, customer_name, created_at')
                .eq('branch_id', shift.branch_id)
                .eq('cashier_id', shift.cashier_id)
                .or('payment_method.eq.credit_bill,payment_method.eq.CREDIT_BILL,payment_method.eq.credit_bill_manual,payment_method.eq.CREDIT_BILL_MANUAL')
                .gte('created_at', shift.shift_start)
                .lte('created_at', shiftEnd);

            if (cashierCreditTxError) throw cashierCreditTxError;

            const creditBillIds = Array.from(new Set((cashierCreditTxs || [])
                .map((tx: any) => tx.credit_bill_id)
                .filter(Boolean)));

            let creditBillMap = new Map<string, any>();
            if (creditBillIds.length > 0) {
                const { data: creditBills, error: creditBillsError } = await supabase
                    .from('credit_bills')
                    .select('id, credit_number, staff_id, staff_name, employee_id, department, total_amount')
                    .in('id', creditBillIds);

                if (creditBillsError) throw creditBillsError;
                creditBillMap = new Map((creditBills || []).map((bill: any) => [bill.id, bill]));
            }

            const existingCreditDetails = Array.isArray(enrichedShift.credit_bills_details)
                ? enrichedShift.credit_bills_details
                : [];
            const mergedCreditDetails = [...existingCreditDetails];
            const seenCreditDetails = new Set(existingCreditDetails.map((bill: any) =>
                `${bill.staff_id || ''}|${Number(bill.amount || 0)}|${bill.reference || bill.credit_number || ''}`
            ));

            for (const tx of cashierCreditTxs || []) {
                const bill = tx.credit_bill_id ? creditBillMap.get(tx.credit_bill_id) : null;
                const staffId = bill?.staff_id;
                const amount = Number(bill?.total_amount || tx.amount || 0);
                if (!staffId || amount <= 0) continue;

                const reference = bill?.credit_number || tx.payment_reference || tx.transaction_number;
                const key = `${staffId}|${amount}|${reference || ''}`;
                if (seenCreditDetails.has(key)) continue;
                seenCreditDetails.add(key);

                mergedCreditDetails.push({
                    staff_id: staffId,
                    name: bill?.staff_name || tx.customer_name || 'Staff',
                    employee_id: bill?.employee_id,
                    department: bill?.department,
                    amount,
                    reference,
                    credit_bill_id: tx.credit_bill_id,
                    source: 'cashier_credit_bill_payment'
                });
            }

            if (mergedCreditDetails.length !== existingCreditDetails.length) {
                const totalCreditBills = mergedCreditDetails
                    .reduce((sum: number, bill: any) => sum + Number(bill.amount || 0), 0);
                enrichedShift = {
                    ...enrichedShift,
                    credit_bills_details: mergedCreditDetails,
                    credit_bills_count: mergedCreditDetails.length,
                    credit_bills_taken: totalCreditBills
                };
            }
        } catch (creditErr) {
            logger.warn(`Cashier credit bill enrichment failed for shift ${shift.id}:`, creditErr);
        }

        res.status(200).json({
            success: true,
            data: enrichedShift
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Start a new shift
// @route   POST /api/cashier/shifts/start
// @access  Private (Cashier)
export const startShift = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { opening_float, notes } = req.body;
        const userId = req.user?.id;
        const userName = `${req.user?.first_name || ''} ${req.user?.last_name || ''}`.trim();
        const branchId = req.user?.branch_id;

        if (!branchId) {
            throw new AppError('Branch ID is required', 400);
        }

        // Check if cashier has an open shift
        const { data: openShift } = await supabase
            .from('cashier_shift_logs')
            .select('id')
            .eq('cashier_id', userId)
            .eq('status', 'open')
            .single();

        if (openShift) {
            throw new AppError('You already have an open shift. Please close it first.', 400);
        }

        // Generate shift number
        const { data: shiftNumber, error: numberError } = await supabase
            .rpc('generate_shift_number');

        if (numberError) throw numberError;

        // Create shift
        const { data: newShift, error: shiftError } = await supabase
            .from('cashier_shift_logs')
            .insert({
                shift_number: shiftNumber,
                branch_id: branchId,
                cashier_id: userId,
                cashier_name: userName,
                shift_start: new Date().toISOString(),
                opening_float: opening_float || 0,
                notes
            })
            .select()
            .single();

        if (shiftError) throw shiftError;

        res.status(201).json({
            success: true,
            data: newShift
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Close shift
// @route   PUT /api/cashier/shifts/:id/close
// @access  Private (Cashier)
export const closeShift = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const {
            closing_float,
            notes,
            // Revenue by source
            swimming_pool_revenue,
            pool_token_revenue,
            conference_revenue,
            room_booking_revenue,
            restaurant_revenue,
            bar_revenue,
            other_revenue,
            // Credit & bills
            credit_bills_taken,
            credit_bills_count,
            credit_bills_details,
            unpaid_bills_value,
            unpaid_bills_count,
            paid_bills_value,
            paid_bills_count,
            paid_bills_details,
            // Cash management
            cash_at_hand,
            cash_deposited,
            bank_deposit_ref,
            // N/A flags
            pool_na,
            conference_na,
            rooms_na
        } = req.body;
        const userId = req.user?.id;

        // Get shift
        const { data: shift, error: shiftError } = await supabase
            .from('cashier_shift_logs')
            .select('*')
            .eq('id', id)
            .single();

        if (shiftError) throw shiftError;
        if (!shift) throw new AppError('Shift not found', 404);

        // Verify ownership - allow cashier to close own shift, or managers/accountants/auditors to close any shift
        const userRole = (req.user?.role || '').toString().toLowerCase();
        const canCloseAnyShift = [
            'super_admin',
            'general_manager',
            'branch_manager',
            'accountant',
            'branch_accountant',
            'auditor'
        ].includes(userRole) || isGlobalRole(userRole);
        
        if (shift.cashier_id !== userId && !canCloseAnyShift) {
            throw new AppError('You can only close your own shifts. Please contact a manager if you need to close this shift.', 403);
        }
        
        // Also ensure shift belongs to user's branch if they are not global
        if (!isGlobalRole(userRole) && shift.branch_id !== req.user?.branch_id) {
            throw new AppError('You can only manage shifts within your own branch', 403);
        }

        if (shift.status !== 'open') {
            throw new AppError('Shift is already closed', 400);
        }

        // ==========================================
        // VALIDATION: Check for unpaid bills
        // ==========================================
        const shiftEndTimestamp = new Date().toISOString();
        
        const [
            { data: unpaidRestOrders },
            { data: unpaidBarOrders }
        ] = await Promise.all([
            supabase.from('restaurant_orders')
                .select('id, order_number')
                .eq('branch_id', shift.branch_id)
                .gte('created_at', shift.shift_start)
                .lte('created_at', shiftEndTimestamp)
                .eq('payment_status', 'pending'),
            supabase.from('bar_orders')
                .select('id, order_number')
                .eq('branch_id', shift.branch_id)
                .gte('created_at', shift.shift_start)
                .lte('created_at', shiftEndTimestamp)
                .eq('payment_status', 'pending')
        ]);

        const totalUnpaid = (unpaidRestOrders?.length || 0) + (unpaidBarOrders?.length || 0);

        if (totalUnpaid > 0) {
            throw new AppError(`Cannot close shift. There are ${totalUnpaid} unsettled bills for this shift period. Please clear all bills or record them as credit bills before closing.`, 400);
        }
        // ==========================================

        // Calculate summary from transactions
        const { data: summary } = await supabase
            .rpc('calculate_shift_summary', { p_shift_id: id });

        const cash_sales = summary?.total_cash || 0;
        const mpesa_sales = summary?.total_mpesa || 0;
        const card_sales = summary?.total_card || 0;
        const total_sales_rpc = summary?.total_sales || 0;
        const credit_paid_cash = paid_bills_value || 0;

        // Strict accounting formula: Expected = Opening Float + Cash Sales + Cash Received for Credit Payments
        // NOTE: Only cash-affecting items count toward expected closing float
        const expectedClosingFloat = (shift.opening_float || 0) + cash_sales + credit_paid_cash;
        const variance = (closing_float || 0) - expectedClosingFloat;

        // Compute unpaid_bills server-side (credit issued minus credit paid)
        const creditTaken = (credit_bills_details || []).reduce((s: number, b: any) => s + (parseFloat(b.amount) || 0), 0);
        const creditPaid  = (paid_bills_details  || []).reduce((s: number, b: any) => s + (parseFloat(b.amount) || 0), 0);
        const computedUnpaidBills = Math.max(0, creditTaken - creditPaid);

        // Reconciliation warning: payment method sum should equal total_sales
        const methodSum = cash_sales + mpesa_sales + card_sales + (other_revenue || 0);
        if (total_sales_rpc > 0 && Math.abs(methodSum - total_sales_rpc) > 0.01) {
            logger.warn(`Shift ${id} reconciliation warning: method sum ${methodSum} ≠ total_sales ${total_sales_rpc}`);
        }

        // Update shift with all revenue breakdown
        const { data: updatedShift, error: updateError } = await supabase
            .from('cashier_shift_logs')
            .update({
                shift_end: new Date().toISOString(),
                closing_float,
                expected_closing_float: expectedClosingFloat,
                variance,
                // Payment method totals
                total_cash_sales: cash_sales,
                total_mpesa_sales: summary?.total_mpesa || 0,
                total_card_sales: summary?.total_card || 0,
                total_sales: summary?.total_sales || 0,
                transaction_count: summary?.transaction_count || 0,
                // Revenue by source
                swimming_pool_revenue: swimming_pool_revenue || 0,
                pool_token_revenue: pool_token_revenue || 0,
                conference_revenue: conference_revenue || 0,
                room_booking_revenue: room_booking_revenue || 0,
                restaurant_revenue: restaurant_revenue || 0,
                bar_revenue: bar_revenue || 0,
                other_revenue: other_revenue || 0,
                // Credit & bills
                credit_bills_taken: credit_bills_taken || 0,
                credit_bills_count: credit_bills_count || 0,
                credit_bills_details: credit_bills_details || [],
                unpaid_bills_value: unpaid_bills_value || 0,
                unpaid_bills_count: unpaid_bills_count || 0,
                paid_bills_value: paid_bills_value || 0,
                paid_bills_count: paid_bills_count || 0,
                paid_bills_details: paid_bills_details || [],
                // Cash management
                cash_at_hand: cash_at_hand || 0,
                cash_deposited: cash_deposited || 0,
                bank_deposit_ref,
                // N/A flags
                pool_na: pool_na || false,
                conference_na: conference_na || false,
                rooms_na: rooms_na || false,
                // Status
                status: 'closed',
                notes: notes || shift.notes,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;

        // SYNC WITH BRANCH ACCOUNTANT: Create staff_credit_bills records
        try {
            // 1. Process Credit Bills (Unpaid)
            if (credit_bills_details && Array.isArray(credit_bills_details)) {
                const creditBillsToInsert = credit_bills_details
                    .filter((bill: any) => bill.staff_id)
                    .map((bill: any) => ({
                        staff_id: bill.staff_id,
                        amount: bill.amount,
                        description: `Shift Credit - Shift #${shift.shift_number} - ${bill.name}`,
                        bill_date: new Date().toISOString().split('T')[0],
                        status: 'pending',
                        branch_id: shift.branch_id,
                        shift_id: shift.id
                    }));

                if (creditBillsToInsert.length > 0) {
                    const { error: creditError } = await supabase
                        .from('staff_credit_bills')
                        .insert(creditBillsToInsert);

                    if (creditError) {
                        logger.error(`Failed to sync credit bills for shift ${id}`, creditError);
                    }
                }
            }

            // 2. Process Paid Bills (Settle existing credits)
            if (paid_bills_details && Array.isArray(paid_bills_details)) {
                for (const bill of paid_bills_details) {
                    if (!bill.staff_id) continue;

                    let amountPaid = parseFloat(bill.amount);
                    if (isNaN(amountPaid) || amountPaid <= 0) continue;

                    // A. Record the payment itself for audit trail
                    const { error } = await supabase.from('staff_credit_bills').insert({
                        staff_id: bill.staff_id,
                        amount: amountPaid,
                        description: `Shift Payment - Shift #${shift.shift_number} - ${bill.name}`,
                        bill_date: new Date().toISOString().split('T')[0],
                        status: 'paid_cash',
                        branch_id: shift.branch_id,
                        paid_in_shift_id: shift.id
                    });

                    if (error) {

                      console.error('Database error:', error);

                      throw error;

                    }

                    // B. SETTLE FIFO: Find pending credits ordered by oldest first
                    const { data: credits, error: fetchError } = await supabase
                        .from('staff_credit_bills')
                        .select('id, amount')
                        .eq('staff_id', bill.staff_id)
                        .eq('status', 'pending')
                        .order('created_at', { ascending: true });

                    if (fetchError) {
                        logger.error(`Error fetching credits for settlement: ${bill.staff_id}`, fetchError);
                        continue;
                    }

                    if (credits && credits.length > 0) {
                        let remainingPayment = amountPaid;
                        for (const credit of credits) {
                            if (remainingPayment <= 0) break;

                            const creditAmount = parseFloat(credit.amount);
                            if (remainingPayment >= creditAmount) {
                                // Fully settle this credit bill
                                await supabase
                                    .from('staff_credit_bills')
                                    .update({ status: 'paid_cash' })
                                    .eq('id', credit.id);
                                remainingPayment -= creditAmount;
                            }
                            // Partial settlement: leave as pending (no partial balance column in schema)
                        }
                    }
                }
            }
        } catch (syncError) {
            // Log but don't fail the request since shift is already closed
            logger.error(`Error in shift sync logic for ${id}`, syncError);
        }

        res.status(200).json({
            success: true,
            data: updatedShift
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Reconcile shift (Branch Accountant)
// @route   PUT /api/cashier/shifts/:id/reconcile
// @access  Private (Accountant)
export const reconcileShift = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { reconciliation_notes } = req.body;
        const userId = req.user?.id;

        let query = supabase
            .from('cashier_shift_logs')
            .update({
                status: 'reconciled',
                reconciled_by: userId,
                reconciled_at: new Date().toISOString(),
                reconciliation_notes,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);
            
        // Enforce branch isolation
        if (!isGlobalRole(req.user?.role)) {
            query = query.eq('branch_id', req.user?.branch_id);
        }
        
        const { data, error } = await query.select().single();

        if (error) throw error;

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Verify shift (Auditor)
// @route   PUT /api/cashier/shifts/:id/verify
// @access  Private (Auditor)
export const verifyShift = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { verification_notes } = req.body;
        const userId = req.user?.id;

        let query = supabase
            .from('cashier_shift_logs')
            .update({
                status: 'verified',
                verified_by: userId,
                verified_at: new Date().toISOString(),
                verification_notes,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);
            
        // Enforce branch isolation
        if (!isGlobalRole(req.user?.role)) {
            query = query.eq('branch_id', req.user?.branch_id);
        }
        
        const { data, error } = await query.select().single();

        if (error) throw error;

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Add transaction to shift
// @route   POST /api/cashier/shifts/:id/transactions
// @access  Private
export const addShiftTransaction = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { transaction_id, transaction_ref, payment_method, amount } = req.body;
        const userId = req.user?.id;
        const userRole = (req.user?.role || '').toString().toLowerCase();

        // 1. Fetch shift to verify ownership
        const { data: shift, error: shiftError } = await supabase
            .from('cashier_shift_logs')
            .select('*')
            .eq('id', id)
            .single();

        if (shiftError || !shift) {
            throw new AppError('Shift not found', 404);
        }

        // 2. Ownership & Branch check
        const isManager = [
            'super_admin',
            'general_manager',
            'branch_manager',
            'accountant',
            'branch_accountant',
            'auditor'
        ].includes(userRole) || isGlobalRole(userRole);

        if (shift.cashier_id !== userId && !isManager) {
            throw new AppError('You can only add transactions to your own shifts', 403);
        }

        if (!isGlobalRole(userRole) && shift.branch_id !== req.user?.branch_id) {
            throw new AppError('Unauthorized branch access', 403);
        }

        if (shift.status !== 'open') {
            throw new AppError('Cannot add transactions to a closed shift', 400);
        }

        const { data, error } = await supabase
            .from('cashier_shift_transactions')
            .insert({
                shift_id: id,
                transaction_id,
                transaction_ref,
                payment_method,
                amount,
                transaction_time: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
};
