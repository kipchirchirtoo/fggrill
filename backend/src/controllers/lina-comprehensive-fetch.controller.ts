import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

/**
 * LINA AI COMPREHENSIVE DATA FETCHING CONTROLLER
 * 
 * This controller fetches ALL payment, cashier, and shift data from across
 * the entire database for a given branch and date. It queries EVERY relevant
 * table to provide complete visibility into daily operations.
 * 
 * @route   GET /api/finance/lina/comprehensive-fetch
 * @desc    Fetch all payments, cashiers, shifts, and transactions for a branch/date
 * @access  Branch Accountant, Auditor, Director, Super Admin
 */
export const getComprehensiveDailyData = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const role = String((req as any).user?.role || '');
        const userBranchId = (req as any).user?.branch_id;
        let branchId: any = req.query.branch_id;
        
        // Branch-level users can only see their own branch
        if (['branch_manager', 'branch_accountant', 'accountant'].includes(role)) {
            branchId = userBranchId;
        }
        
        if (!branchId || branchId === '0') {
            res.status(400).json({ 
                success: false, 
                error: 'Branch ID is required' 
            });
            return;
        }
        
        const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
        const startTs = `${date}T00:00:00`;
        const endTs = `${date}T23:59:59`;
        
        logger.info(`Lina AI: Fetching comprehensive data for branch ${branchId} on ${date}`);
        
        // ═══════════════════════════════════════════════════════════════════════
        // 1. CASHIER SHIFTS - All shift records with staff details
        // ═══════════════════════════════════════════════════════════════════════
        const { data: cashierShifts, error: shiftsError } = await supabase
            .from('cashier_shifts')
            .select(`
                *,
                staff:staff_id(id, full_name, employee_id, role, phone_number),
                approved_by_staff:approved_by(id, full_name, role)
            `)
            .eq('branch_id', branchId)
            .gte('shift_start', startTs)
            .lte('shift_start', endTs)
            .order('shift_start', { ascending: true });

        // ═══════════════════════════════════════════════════════════════════════
        // 2. CASHIER SHIFT LOGS - Reconciled daily figures with cashier info
        // ═══════════════════════════════════════════════════════════════════════
        const { data: shiftLogs, error: logsError } = await supabase
            .from('cashier_shift_logs')
            .select(`
                *,
                staff:staff_id(id, full_name, employee_id, role, phone_number, email),
                approver:approved_by(id, full_name, role)
            `)
            .eq('branch_id', branchId)
            .gte('shift_start', startTs)
            .lte('shift_start', endTs)
            .order('shift_start', { ascending: true });

        // ═══════════════════════════════════════════════════════════════════════
        // 3. ALL SHIFT TRANSACTIONS - Every single transaction with cashier info
        // ═══════════════════════════════════════════════════════════════════════
        const { data: allShiftTransactions, error: txnsError } = await supabase
            .from('shift_transactions')
            .select(`
                *,
                cashier:cashier_id(id, full_name, employee_id, phone_number),
                shift:shift_id(shift_number, shift_start, shift_end, status)
            `)
            .eq('branch_id', branchId)
            .gte('created_at', startTs)
            .lte('created_at', endTs)
            .order('created_at', { ascending: true });

        // ═══════════════════════════════════════════════════════════════════════
        // 4. CASHIER LOGBOOKS - Daily cashier records with all line items
        // ═══════════════════════════════════════════════════════════════════════
        const { data: cashierLogbooks, error: logbooksError } = await supabase
            .from('cashier_logbooks')
            .select(`
                *,
                cashier:cashier_id(id, full_name, employee_id, phone_number),
                lines:cashier_logbook_lines(*)
            `)
            .eq('branch_id', branchId)
            .gte('logbook_date', date)
            .lte('logbook_date', date);

        // ═══════════════════════════════════════════════════════════════════════
        // 5. POS OUTLET SHIFTS - POS-specific shift data
        // ═══════════════════════════════════════════════════════════════════════
        const { data: posOutletShifts, error: posShiftsError } = await supabase
            .from('pos_outlet_shifts')
            .select(`
                *,
                outlet:outlet_id(outlet_name, outlet_type),
                staff:staff_id(full_name, employee_id)
            `)
            .eq('outlet_id', await supabase.from('pos_outlets').select('id').eq('branch_id', branchId).then(r => r.data?.map(o => o.id) || []))
            .gte('opened_at', startTs)
            .lte('opened_at', endTs);

        // ═══════════════════════════════════════════════════════════════════════
        // 6. POS SHIFT PAYMENTS - Payment method breakdown per POS shift
        // ═══════════════════════════════════════════════════════════════════════
        const { data: posShiftPayments, error: posPaymentsError } = await supabase
            .from('pos_shift_payments')
            .select(`
                *,
                shift:shift_id(
                    shift_number,
                    outlet:outlet_id(outlet_name, outlet_type),
                    staff:staff_id(full_name, employee_id)
                )
            `)
            .gte('recorded_at', startTs)
            .lte('recorded_at', endTs);

        // ═══════════════════════════════════════════════════════════════════════
        // 7. ALL PAYMENT RECORDS - From main payments table
        // ═══════════════════════════════════════════════════════════════════════
        const { data: allPayments, error: paymentsError } = await supabase
            .from('payments')
            .select('*')
            .eq('branch_id', branchId)
            .gte('created_at', startTs)
            .lte('created_at', endTs)
            .order('created_at', { ascending: true });

        // ═══════════════════════════════════════════════════════════════════════
        // 8. BANKING TRANSACTIONS - All banking activity with approvals
        // ═══════════════════════════════════════════════════════════════════════
        const { data: bankingTransactions, error: bankingError } = await supabase
            .from('banking_transactions')
            .select(`
                *,
                recorder:recorded_by(id, full_name, employee_id),
                approver:approved_by(id, full_name, role)
            `)
            .eq('branch_id', branchId)
            .gte('transaction_date', startTs)
            .lte('transaction_date', endTs)
            .order('transaction_date', { ascending: true });

        // ═══════════════════════════════════════════════════════════════════════
        // 9. RESTAURANT BILL PAYMENTS - All restaurant payment records
        // ═══════════════════════════════════════════════════════════════════════
        const { data: restaurantPayments, error: restPayError } = await supabase
            .from('restaurant_bill_payments')
            .select(`
                *,
                bill:bill_id(bill_number, table_number, total_amount, status),
                cashier:cashier_id(full_name, employee_id, phone_number)
            `)
            .gte('created_at', startTs)
            .lte('created_at', endTs);

        // ═══════════════════════════════════════════════════════════════════════
        // 10. BOOKING PAYMENTS - All room booking payment records
        // ═══════════════════════════════════════════════════════════════════════
        const { data: bookingPayments, error: bookPayError } = await supabase
            .from('booking_payments')
            .select(`
                *,
                booking:booking_id(booking_number, guest_name, total_amount, status)
            `)
            .gte('created_at', startTs)
            .lte('created_at', endTs);

        // ═══════════════════════════════════════════════════════════════════════
        // 11. STAFF CREDIT BILL PAYMENTS - Credit bill payment history
        // ═══════════════════════════════════════════════════════════════════════
        const { data: creditBillPayments, error: creditPayError } = await supabase
            .from('staff_credit_bill_payments')
            .select(`
                *,
                credit_bill:credit_bill_id(
                    bill_number, 
                    staff_id,
                    staff:staff_id(full_name, employee_id),
                    total_amount,
                    status
                ),
                recorded_by_user:recorded_by(full_name, employee_id)
            `)
            .gte('payment_date', startTs)
            .lte('payment_date', endTs);

        // ═══════════════════════════════════════════════════════════════════════
        // 12. CASHIER TRANSACTIONS - Legacy cashier transaction records
        // ═══════════════════════════════════════════════════════════════════════
        const { data: cashierTransactions, error: cashierTxnError } = await supabase
            .from('cashier_transactions')
            .select('*')
            .eq('branch_id', branchId)
            .gte('created_at', startTs)
            .lte('created_at', endTs);

        // ═══════════════════════════════════════════════════════════════════════
        // 13. STAFF SHIFTS - Staff shift assignments for the day
        // ═══════════════════════════════════════════════════════════════════════
        const { data: staffShifts, error: staffShiftsError } = await supabase
            .from('staff_shifts')
            .select(`
                *,
                staff:staff_id(full_name, employee_id, role, phone_number),
                shift_type:shift_type_id(name, description)
            `)
            .eq('branch_id', branchId)
            .gte('shift_date', date)
            .lte('shift_date', date);

        // ═══════════════════════════════════════════════════════════════════════
        // 14. POS SHIFT ORDERS - All POS orders for the day
        // ═══════════════════════════════════════════════════════════════════════
        const { data: posShiftOrders, error: posOrdersError } = await supabase
            .from('pos_shift_orders')
            .select(`
                *,
                shift:shift_id(
                    shift_number,
                    outlet:outlet_id(outlet_name, outlet_type),
                    staff:staff_id(full_name, employee_id)
                )
            `)
            .gte('created_at', startTs)
            .lte('created_at', endTs);

        // ═══════════════════════════════════════════════════════════════════════
        // 15. FINANCE PAYMENTS - Finance module payment records
        // ═══════════════════════════════════════════════════════════════════════
        const { data: financePayments, error: financePayError } = await supabase
            .from('finance_payments')
            .select('*')
            .eq('branch_id', branchId)
            .gte('payment_date', date)
            .lte('payment_date', date);

        // ═══════════════════════════════════════════════════════════════════════
        // 16. BRANCH PAYMENT RECEIPTS - Payment receipt records
        // ═══════════════════════════════════════════════════════════════════════
        const { data: paymentReceipts, error: receiptsError } = await supabase
            .from('branch_payment_receipts')
            .select('*')
            .eq('branch_id', branchId)
            .gte('created_at', startTs)
            .lte('created_at', endTs);

        // Log any errors but continue processing
        if (shiftsError) logger.warn('Error fetching cashier shifts:', shiftsError);
        if (logsError) logger.warn('Error fetching shift logs:', logsError);
        if (txnsError) logger.warn('Error fetching transactions:', txnsError);
        if (logbooksError) logger.warn('Error fetching logbooks:', logbooksError);
        if (posShiftsError) logger.warn('Error fetching POS shifts:', posShiftsError);
        if (posPaymentsError) logger.warn('Error fetching POS payments:', posPaymentsError);
        if (paymentsError) logger.warn('Error fetching payments:', paymentsError);
        if (bankingError) logger.warn('Error fetching banking:', bankingError);

        // ═══════════════════════════════════════════════════════════════════════
        // COMPUTE SUMMARY TOTALS
        // ═══════════════════════════════════════════════════════════════════════
        const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
        
        // Total all payment methods from various sources
        let totalCash = 0, totalMpesa = 0, totalCard = 0, totalCredit = 0;
        let totalRevenue = 0, totalBanked = 0, totalVariance = 0;
        
        // Sum from shift logs
        (shiftLogs || []).forEach((log: any) => {
            totalCash += n(log.total_cash_sales);
            totalMpesa += n(log.total_mpesa_sales);
            totalCard += n(log.total_card_sales);
            totalCredit += n(log.credit_bills_taken);
            totalRevenue += n(log.restaurant_revenue) + n(log.bar_revenue) + 
                           n(log.room_booking_revenue) + n(log.conference_revenue);
            totalBanked += n(log.cash_deposited);
            totalVariance += n(log.variance);
        });
        
        // Sum from all payments
        (allPayments || []).forEach((payment: any) => {
            const pm = String(payment.payment_method || '').toLowerCase();
            const amt = n(payment.amount);
            if (pm.includes('mpesa')) totalMpesa += amt;
            else if (pm.includes('card') || pm.includes('swipe')) totalCard += amt;
            else if (pm.includes('credit')) totalCredit += amt;
            else totalCash += amt;
        });
        
        // Sum from banking transactions
        (bankingTransactions || []).forEach((bank: any) => {
            if (!String(bank.transaction_type || '').toLowerCase().includes('withdraw')) {
                totalBanked += n(bank.amount);
            }
        });
        
        // ═══════════════════════════════════════════════════════════════════════
        // FORMAT & RETURN COMPREHENSIVE RESPONSE
        // ═══════════════════════════════════════════════════════════════════════
        const response = {
            success: true,
            message: 'Lina AI: Comprehensive data fetch complete',
            metadata: {
                branch_id: branchId,
                date: date,
                generated_at: new Date().toISOString(),
                generated_by: 'lina_ai_comprehensive_engine',
                data_sources: 16,
                total_records: [
                    cashierShifts,
                    shiftLogs,
                    allShiftTransactions,
                    cashierLogbooks,
                    posOutletShifts,
                    posShiftPayments,
                    allPayments,
                    bankingTransactions,
                    restaurantPayments,
                    bookingPayments,
                    creditBillPayments,
                    cashierTransactions,
                    staffShifts,
                    posShiftOrders,
                    financePayments,
                    paymentReceipts
                ].reduce((sum, arr) => sum + (arr?.length || 0), 0)
            },
            summary: {
                total_cash: Math.round(totalCash * 100) / 100,
                total_mpesa: Math.round(totalMpesa * 100) / 100,
                total_card: Math.round(totalCard * 100) / 100,
                total_credit: Math.round(totalCredit * 100) / 100,
                total_revenue: Math.round(totalRevenue * 100) / 100,
                total_banked: Math.round(totalBanked * 100) / 100,
                total_variance: Math.round(totalVariance * 100) / 100,
                expected_cash: Math.round((totalCash - totalBanked) * 100) / 100
            },
            data: {
                // 1. CASHIER SHIFTS - Complete shift records with staff info
                cashier_shifts: (cashierShifts || []).map((shift: any) => ({
                    shift_id: shift.id,
                    shift_number: shift.shift_number,
                    shift_start: shift.shift_start,
                    shift_end: shift.shift_end,
                    status: shift.status,
                    staff_name: shift.staff?.full_name,
                    staff_employee_id: shift.staff?.employee_id,
                    staff_role: shift.staff?.role,
                    staff_phone: shift.staff?.phone_number,
                    opening_float: shift.opening_float,
                    closing_float: shift.closing_float,
                    expected_float: shift.expected_float,
                    variance: shift.variance,
                    total_sales: shift.total_sales,
                    cash_sales: shift.cash_sales,
                    mpesa_sales: shift.mpesa_sales,
                    card_sales: shift.card_sales,
                    approved_by: shift.approved_by_staff?.full_name,
                    approved_by_role: shift.approved_by_staff?.role,
                    approved_at: shift.approved_at,
                    notes: shift.notes
                })),
                
                // 2. SHIFT LOGS - Reconciled figures per cashier
                shift_logs: (shiftLogs || []).map((log: any) => ({
                    log_id: log.id,
                    shift_start: log.shift_start,
                    shift_end: log.shift_end,
                    cashier_name: log.staff?.full_name,
                    cashier_employee_id: log.staff?.employee_id,
                    cashier_phone: log.staff?.phone_number,
                    cashier_email: log.staff?.email,
                    restaurant_revenue: log.restaurant_revenue,
                    bar_revenue: log.bar_revenue,
                    room_booking_revenue: log.room_booking_revenue,
                    conference_revenue: log.conference_revenue,
                    swimming_pool_revenue: log.swimming_pool_revenue,
                    pool_token_revenue: log.pool_token_revenue,
                    total_cash_sales: log.total_cash_sales,
                    total_mpesa_sales: log.total_mpesa_sales,
                    total_card_sales: log.total_card_sales,
                    credit_bills_taken: log.credit_bills_taken,
                    paid_bills_value: log.paid_bills_value,
                    cash_deposited: log.cash_deposited,
                    variance: log.variance,
                    approved_by: log.approver?.full_name,
                    approved_by_role: log.approver?.role,
                    notes: log.notes
                })),
                
                // 3. ALL TRANSACTIONS - Every individual transaction
                all_transactions: (allShiftTransactions || []).map((txn: any) => ({
                    transaction_id: txn.id,
                    transaction_number: txn.transaction_number,
                    service_category: txn.service_category,
                    total_amount: txn.total_amount,
                    payment_method: txn.payment_method,
                    cashier_name: txn.cashier?.full_name,
                    cashier_employee_id: txn.cashier?.employee_id,
                    cashier_phone: txn.cashier?.phone_number,
                    shift_number: txn.shift?.shift_number,
                    shift_start: txn.shift?.shift_start,
                    shift_status: txn.shift?.status,
                    created_at: txn.created_at,
                    is_voided: txn.is_voided,
                    void_reason: txn.void_reason,
                    notes: txn.notes
                })),
                
                // 4. CASHIER LOGBOOKS - Daily logbook records
                cashier_logbooks: (cashierLogbooks || []).map((logbook: any) => ({
                    logbook_id: logbook.id,
                    logbook_date: logbook.logbook_date,
                    cashier_name: logbook.cashier?.full_name,
                    cashier_employee_id: logbook.cashier?.employee_id,
                    cashier_phone: logbook.cashier?.phone_number,
                    opening_float: logbook.opening_float,
                    closing_float: logbook.closing_float,
                    total_credit_bills: logbook.total_credit_bills,
                    total_paid_bills: logbook.total_paid_bills,
                    total_unpaid_bills: logbook.total_unpaid_bills,
                    cash_deposited: logbook.cash_deposited,
                    status: logbook.status,
                    lines: logbook.lines || [],
                    notes: logbook.notes
                })),
                
                // 5. POS OUTLET SHIFTS
                pos_outlet_shifts: (posOutletShifts || []).map((shift: any) => ({
                    shift_id: shift.id,
                    outlet_name: shift.outlet?.outlet_name,
                    outlet_type: shift.outlet?.outlet_type,
                    staff_name: shift.staff?.full_name,
                    staff_employee_id: shift.staff?.employee_id,
                    opened_at: shift.opened_at,
                    closed_at: shift.closed_at,
                    status: shift.status,
                    opening_cash: shift.opening_cash,
                    closing_cash: shift.closing_cash,
                    total_sales: shift.total_sales
                })),
                
                // 6. POS SHIFT PAYMENTS - Payment breakdown
                pos_shift_payments: (posShiftPayments || []).map((payment: any) => ({
                    payment_id: payment.id,
                    shift_number: payment.shift?.shift_number,
                    outlet_name: payment.shift?.outlet?.outlet_name,
                    staff_name: payment.shift?.staff?.full_name,
                    payment_method: payment.payment_method,
                    amount: payment.amount,
                    reference: payment.reference,
                    recorded_at: payment.recorded_at
                })),
                
                // 7. ALL PAYMENTS - Main payments table
                all_payments: (allPayments || []).map((payment: any) => ({
                    payment_id: payment.id,
                    reference: payment.reference,
                    amount: payment.amount,
                    payment_method: payment.payment_method,
                    status: payment.status,
                    description: payment.description,
                    created_at: payment.created_at
                })),
                
                // 8. BANKING TRANSACTIONS - All banking activity
                banking_transactions: (bankingTransactions || []).map((bank: any) => ({
                    transaction_id: bank.id,
                    transaction_type: bank.transaction_type,
                    amount: bank.amount,
                    account_number: bank.account_number,
                    reference_number: bank.reference_number,
                    slip_number: bank.slip_number,
                    recorded_by_name: bank.recorder?.full_name,
                    recorded_by_employee_id: bank.recorder?.employee_id,
                    approved_by_name: bank.approver?.full_name,
                    approved_by_role: bank.approver?.role,
                    transaction_date: bank.transaction_date,
                    bank_name: bank.bank_name,
                    notes: bank.notes
                })),
                
                // 9. RESTAURANT BILL PAYMENTS
                restaurant_payments: (restaurantPayments || []).map((payment: any) => ({
                    payment_id: payment.id,
                    bill_number: payment.bill?.bill_number,
                    table_number: payment.bill?.table_number,
                    bill_total: payment.bill?.total_amount,
                    bill_status: payment.bill?.status,
                    amount_paid: payment.amount_paid,
                    payment_method: payment.payment_method,
                    payment_reference: payment.payment_reference,
                    cashier_name: payment.cashier?.full_name,
                    cashier_employee_id: payment.cashier?.employee_id,
                    cashier_phone: payment.cashier?.phone_number,
                    created_at: payment.created_at
                })),
                
                // 10. BOOKING PAYMENTS
                booking_payments: (bookingPayments || []).map((payment: any) => ({
                    payment_id: payment.id,
                    booking_number: payment.booking?.booking_number,
                    guest_name: payment.booking?.guest_name,
                    booking_total: payment.booking?.total_amount,
                    booking_status: payment.booking?.status,
                    amount_paid: payment.amount_paid,
                    payment_method: payment.payment_method,
                    payment_reference: payment.payment_reference,
                    created_at: payment.created_at
                })),
                
                // 11. CREDIT BILL PAYMENTS
                credit_bill_payments: (creditBillPayments || []).map((payment: any) => ({
                    payment_id: payment.id,
                    bill_number: payment.credit_bill?.bill_number,
                    staff_name: payment.credit_bill?.staff?.full_name,
                    staff_employee_id: payment.credit_bill?.staff?.employee_id,
                    bill_total: payment.credit_bill?.total_amount,
                    bill_status: payment.credit_bill?.status,
                    amount_paid: payment.amount_paid,
                    payment_method: payment.payment_method,
                    payment_reference: payment.payment_reference,
                    recorded_by: payment.recorded_by_user?.full_name,
                    recorded_by_employee_id: payment.recorded_by_user?.employee_id,
                    payment_date: payment.payment_date,
                    notes: payment.notes
                })),
                
                // 12. CASHIER TRANSACTIONS (Legacy)
                cashier_transactions: (cashierTransactions || []).map((txn: any) => ({
                    transaction_id: txn.id,
                    transaction_type: txn.transaction_type,
                    amount: txn.amount,
                    payment_method: txn.payment_method,
                    reference: txn.reference,
                    created_at: txn.created_at,
                    notes: txn.notes
                })),
                
                // 13. STAFF SHIFTS - Staff assignments
                staff_shifts: (staffShifts || []).map((shift: any) => ({
                    shift_id: shift.id,
                    staff_name: shift.staff?.full_name,
                    staff_employee_id: shift.staff?.employee_id,
                    staff_role: shift.staff?.role,
                    staff_phone: shift.staff?.phone_number,
                    shift_type: shift.shift_type?.name,
                    shift_date: shift.shift_date,
                    start_time: shift.start_time,
                    end_time: shift.end_time,
                    status: shift.status
                })),
                
                // 14. POS SHIFT ORDERS
                pos_shift_orders: (posShiftOrders || []).map((order: any) => ({
                    order_id: order.id,
                    order_number: order.order_number,
                    shift_number: order.shift?.shift_number,
                    outlet_name: order.shift?.outlet?.outlet_name,
                    outlet_type: order.shift?.outlet?.outlet_type,
                    staff_name: order.shift?.staff?.full_name,
                    total_amount: order.total_amount,
                    payment_method: order.payment_method,
                    payment_status: order.payment_status,
                    status: order.status,
                    created_at: order.created_at
                })),
                
                // 15. FINANCE PAYMENTS
                finance_payments: (financePayments || []).map((payment: any) => ({
                    payment_id: payment.id,
                    payment_number: payment.payment_number,
                    amount: payment.amount,
                    payment_method: payment.payment_method,
                    payment_date: payment.payment_date,
                    description: payment.description,
                    status: payment.status
                })),
                
                // 16. PAYMENT RECEIPTS
                payment_receipts: (paymentReceipts || []).map((receipt: any) => ({
                    receipt_id: receipt.id,
                    payment_id: receipt.payment_id,
                    receipt_number: receipt.receipt_number,
                    receipt_type: receipt.receipt_type,
                    amount: receipt.amount,
                    issued_to: receipt.issued_to,
                    created_at: receipt.created_at
                }))
            }
        };
        
        logger.info(`Lina AI: Successfully fetched ${response.metadata.total_records} total records`);
        res.status(200).json(response);
        
    } catch (error: any) {
        logger.error('Lina AI comprehensive fetch failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch comprehensive daily data',
            message: error.message
        });
    }
};
