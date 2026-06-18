import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import axios from 'axios';
import { PYTHON_SERVICE_URL } from '../config/pythonService';
import { logger } from '../utils/logger';
import { emailService } from '../services/email.service';
import archiver from 'archiver';
import { generatePayslipPDF } from '../utils/pdfGenerator';
import { applyBranchFilter } from '../utils/branchIsolation';

/**
 * Core payroll engine for a single staff member.
 * Fetches ALL dynamic deductions fresh, computes totals, upserts the record,
 * then marks every source record as deducted.
 *
 * Deduction rules:
 *  - NSSF / SHIF / Housing Levy / PAYE → ONLY from staff_payroll_adjustments (never auto-calculated)
 *  - Credit Bills  → ALL status='pending' or 'partial', deducted by remaining balance
 *  - Unpaid Bills  → ALL status='unpaid' or 'partial' where waiter_id = staffId, deducted by remaining balance
 *  - Advances      → status='approved' AND month_to_deduct/year_to_deduct match
 *  - Loans         → status='active', remaining_balance > 0, deduction period started
 */
async function processStaffPayroll(
    staffId: string,
    basicSalary: number,
    month: number,
    year: number,
    existingPayrollId: string | null
): Promise<any> {

    // ── Step 1: If re-generating, reset previously-linked deductions ──────────
    if (existingPayrollId) {
        await Promise.all([
            supabase.from('staff_advances')
                .update({ status: 'approved', deducted_in_payroll_id: null })
                .eq('deducted_in_payroll_id', existingPayrollId),
            supabase.from('staff_credit_bills')
                .update({ status: 'pending', deducted_in_payroll_id: null })
                .eq('deducted_in_payroll_id', existingPayrollId),
            supabase.from('unpaid_bills')
                .update({ status: 'unpaid' })
                .eq('status', 'deducted')
                .like('remarks', `%payroll ${month}/${year}%`),
            supabase.from('staff_payroll_adjustments')
                .update({ status: 'approved', payroll_id: null })
                .eq('payroll_id', existingPayrollId),
        ]);
    }

    // ── Step 2: Fetch adjustments (statutory + misc) ──────────────────────────
    const { data: adjustments } = await supabase
        .from('staff_payroll_adjustments')
        .select('id, type, category, amount')
        .eq('staff_id', staffId)
        .eq('month', String(month))
        .eq('year', year)
        .eq('status', 'approved');

    let nssf = 0, shif = 0, housingLevy = 0, paye = 0;
    let totalAllowances = 0, totalBonuses = 0;
    let uniformDeductions = 0, absenceDeductions = 0, otherAdjustmentDeductions = 0;
    const adjustmentIds: string[] = [];

    for (const adj of adjustments || []) {
        const amt = Number(adj.amount || 0);
        adjustmentIds.push(adj.id);
        if (adj.type === 'deduction') {
            switch (adj.category) {
                case 'nssf':         nssf += amt; break;
                case 'shif':         shif += amt; break;
                case 'housing_levy': housingLevy += amt; break;
                case 'paye':         paye += amt; break;
                case 'uniform':      uniformDeductions += amt; break;
                case 'absent_day':   absenceDeductions += amt; break;
                default:             otherAdjustmentDeductions += amt; break;
            }
        } else if (adj.type === 'addition') {
            if (adj.category === 'allowance') totalAllowances += amt;
            else totalBonuses += amt;
        }
    }

    // ── Step 3: Fetch ALL dynamic deductions ─────────────────────────────────

    // 3a. Credit bills — ALL pending or partially paid, deducted by remaining balance
    const { data: creditBillRows, error: cbErr } = await supabase
        .from('staff_credit_bills')
        .select('id, amount, paid_amount, balance, status, description')
        .eq('staff_id', staffId)
        .in('status', ['pending', 'partial']);
    if (cbErr) throw cbErr;

    // 3b. Unpaid bills — ALL unpaid or partially paid for this waiter
    const { data: unpaidBillRows, error: ubErr } = await supabase
        .from('unpaid_bills')
        .select('id, total_amount, balance_amount')
        .eq('waiter_id', staffId)
        .in('status', ['unpaid', 'partial']);
    if (ubErr) throw ubErr;

    // 3c. Approved advances matching this payroll month/year
    const { data: advanceRows, error: advErr } = await supabase
        .from('staff_advances')
        .select('id, amount')
        .eq('staff_id', staffId)
        .eq('status', 'approved')
        .eq('month_to_deduct', month)
        .eq('year_to_deduct', year);
    if (advErr) throw advErr;

    // 3d. Active loans whose deduction period has started (DB-level filter)
    const { data: loanRows, error: loanErr } = await supabase
        .from('staff_loans')
        .select('id, installment_amount, remaining_balance, start_deduction_month, start_deduction_year')
        .eq('staff_id', staffId)
        .eq('status', 'active')
        .gt('remaining_balance', 0)
        .or(
            `start_deduction_year.lt.${year},` +
            `and(start_deduction_year.eq.${year},start_deduction_month.lte.${month})`
        );
    if (loanErr) throw loanErr;

    // ── Step 4: Aggregate ─────────────────────────────────────────────────────
    let totalCreditBills = 0;
    const creditBillIds: string[] = [];
    for (const b of creditBillRows || []) {
        if (String(b.description || '').startsWith('Unsettled ')) {
            continue;
        }
        const amount = Number(b.amount || 0);
        const paidAmount = Number(b.paid_amount || 0);
        const remainingBalance = b.balance === null || b.balance === undefined
            ? Math.max(0, amount - paidAmount)
            : Number(b.balance || 0);
        totalCreditBills += Math.max(0, remainingBalance);
        creditBillIds.push(b.id);
    }

    let totalUnpaidBills = 0;
    const unpaidBillIds: string[] = [];
    for (const b of unpaidBillRows || []) {
        totalUnpaidBills += Number(b.balance_amount || b.total_amount || 0);
        unpaidBillIds.push(b.id);
    }

    let totalAdvances = 0;
    const advanceIds: string[] = [];
    for (const a of advanceRows || []) {
        totalAdvances += Number(a.amount || 0);
        advanceIds.push(a.id);
    }

    let totalLoanDeductions = 0;
    const loanDeductionMap: { id: string; deducted: number; newBalance: number }[] = [];
    for (const loan of loanRows || []) {
        const installment = Number(loan.installment_amount || 0);
        const remaining = Number(loan.remaining_balance || 0);
        const deducted = Math.min(installment, remaining);
        totalLoanDeductions += deducted;
        loanDeductionMap.push({ id: loan.id, deducted, newBalance: remaining - deducted });
    }

    // ── Step 5: Compute totals ────────────────────────────────────────────────
    const grossSalary = basicSalary + totalAllowances + totalBonuses;
    const statutoryDeductions = nssf + shif + housingLevy + paye;
    const financialDeductions = totalCreditBills + totalUnpaidBills + totalAdvances + totalLoanDeductions;
    const miscDeductions = uniformDeductions + absenceDeductions + otherAdjustmentDeductions;
    const totalDeductions = statutoryDeductions + financialDeductions + miscDeductions;
    const netPay = grossSalary - totalDeductions;

    // ── Step 6: Upsert payroll record ─────────────────────────────────────────
    const payrollPayload = {
        staff_id: staffId,
        month: String(month),
        year,
        basic_salary: basicSalary,
        allowances: totalAllowances,
        bonuses: totalBonuses,
        nssf,
        nssf_deduction: nssf,
        shif_deduction: shif,
        housing_levy: housingLevy,
        housing_levy_deduction: housingLevy,
        paye,
        nhif: 0,
        total_advances: totalAdvances,
        loan_deduction: totalLoanDeductions,
        total_credit_bills: totalCreditBills,
        total_deductions: totalDeductions,
        net_pay: netPay,
        status: 'draft',
        generated_at: new Date().toISOString(),
    };

    const { data: existingPayroll } = await supabase
        .from('staff_payroll')
        .select('id')
        .eq('staff_id', staffId)
        .eq('month', String(month))
        .eq('year', year)
        .maybeSingle();

    let payroll: any;
    if (existingPayroll?.id) {
        const { data: updated, error: updateError } = await supabase
            .from('staff_payroll')
            .update(payrollPayload)
            .eq('id', existingPayroll.id)
            .select()
            .single();
        if (updateError) throw updateError;
        payroll = updated;
    } else {
        const { data: inserted, error: insertError } = await supabase
            .from('staff_payroll')
            .insert(payrollPayload)
            .select()
            .single();
        if (insertError) throw insertError;
        payroll = inserted;
    }

    // ── Step 7: Mark all source records as deducted ───────────────────────────
    const markPromises: PromiseLike<any>[] = [];

    if (adjustmentIds.length > 0) {
        markPromises.push(
            supabase.from('staff_payroll_adjustments')
                .update({ status: 'applied', payroll_id: payroll.id })
                .in('id', adjustmentIds).then()
        );
    }
    if (advanceIds.length > 0) {
        markPromises.push(
            supabase.from('staff_advances')
                .update({ status: 'deducted', deducted_in_payroll_id: payroll.id })
                .in('id', advanceIds).then()
        );
    }
    if (creditBillIds.length > 0) {
        markPromises.push(
            supabase.from('staff_credit_bills')
                .update({ status: 'deducted', deducted_in_payroll_id: payroll.id })
                .in('id', creditBillIds).then()
        );
    }
    if (unpaidBillIds.length > 0) {
        markPromises.push(
            supabase.from('unpaid_bills')
                .update({ status: 'deducted', remarks: `Deducted from payroll ${month}/${year}` })
                .in('id', unpaidBillIds).then()
        );
    }
    for (const { id, newBalance } of loanDeductionMap) {
        markPromises.push(
            supabase.from('staff_loans')
                .update({
                    remaining_balance: newBalance,
                    ...(newBalance <= 0 ? { status: 'paid' } : {}),
                })
                .eq('id', id).then()
        );
    }

    await Promise.all(markPromises);
    return payroll;
}

/**
 * Generate Payroll for a specific month/year.
 * Enforces: no current/future month processing.
 */
export const generatePayroll = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { month, year, staff_id, branch_id } = req.body;

        if (!month || !year) {
            throw new AppError('Month and Year are required', 400);
        }

        // ── Period lock: cannot process future months only ───────────────
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // 1-based
        if (
            Number(year) > currentYear ||
            (Number(year) === currentYear && Number(month) > currentMonth)
        ) {
            throw new AppError(
                `Cannot process payroll for a future period (${month}/${year}).`,
                400
            );
        }

        // ── Fetch active staff ────────────────────────────────────────────────
        let staffQuery = supabase
            .from('staff_profiles')
            .select('id, basic_salary, branch_id')
            .eq('employment_status', 'active');

        if (staff_id) staffQuery = staffQuery.eq('id', staff_id);
        if (branch_id) staffQuery = staffQuery.eq('branch_id', branch_id);

        const { data: staffList, error: staffError } = await staffQuery;
        if (staffError) throw staffError;
        if (!staffList || staffList.length === 0) {
            throw new AppError('No active staff found', 404);
        }

        // ── Pre-fetch existing payroll records for this period (for idempotency reset) ──
        const staffIds = staffList.map(s => s.id);
        const { data: existingPayrolls } = await supabase
            .from('staff_payroll')
            .select('id, staff_id')
            .in('staff_id', staffIds)
            .eq('month', String(month))
            .eq('year', Number(year));

        const existingPayrollMap = new Map(
            (existingPayrolls || []).map(p => [p.staff_id, p.id])
        );

        const results: any[] = [];
        const errors: any[] = [];

        for (const staff of staffList) {
            try {
                const payroll = await processStaffPayroll(
                    staff.id,
                    Number(staff.basic_salary) || 0,
                    Number(month),
                    Number(year),
                    existingPayrollMap.get(staff.id) || null
                );
                results.push(payroll);
            } catch (err: any) {
                logger.error(`Payroll generation failed for staff ${staff.id}:`, err);
                errors.push({ staff_id: staff.id, error: err.message });
            }
        }

        res.status(errors.length > 0 && results.length === 0 ? 500 : 200).json({
            success: errors.length < staffList.length,
            data: {
                processed_count: results.length,
                error_count: errors.length,
                results,
                errors,
            },
        });

    } catch (error) {
        next(error);
    }
};

export const getPayrollRecords = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { month, year, staff_id, branch_id } = req.query;

        let query = supabase
            .from('staff_payroll')
            .select('*')
            .order('generated_at', { ascending: false });

        query = applyBranchFilter(query, req, 'staff_profiles');

        if (month) query = query.eq('month', String(month));
        if (year) query = query.eq('year', Number(year));
        if (staff_id) query = query.eq('staff_id', staff_id);

        const { data, error } = await query;
        if (error) throw error;

        if (!data || data.length === 0) {
            return res.status(200).json({ success: true, data: [] });
        }

        // Fetch staff profiles separately to avoid schema cache FK issues
        const staffIds = [...new Set(data.map(r => r.staff_id))];
        const { data: staffProfiles } = await supabase
            .from('staff_profiles')
            .select('id, role, department, branch_id, first_name, last_name, user_id')
            .in('id', staffIds);

        // Fetch users for names
        const userIds = staffProfiles?.map(s => s.user_id).filter(Boolean) || [];
        const { data: users } = userIds.length > 0
            ? await supabase.from('users').select('id, first_name, last_name, email, phone_number').in('id', userIds)
            : { data: [] };

        // Fetch branches
        const branchIds = [...new Set((staffProfiles || []).map(s => s.branch_id).filter(Boolean))];
        const { data: branches } = branchIds.length > 0
            ? await supabase.from('branches').select('id, name').in('id', branchIds)
            : { data: [] };

        const staffMap = new Map((staffProfiles || []).map(s => [s.id, s]));
        const userMap = new Map((users || []).map(u => [u.id, u]));
        const branchMap = new Map((branches || []).map(b => [b.id, b]));

        // ============ FETCH CREDIT BILLS FOR EACH PAYROLL RECORD ============
        // Fetch all credit bills that were deducted in these payroll records
        const payrollIds = data.map(p => p.id).filter(Boolean);
        
        let creditBillsData: any[] = [];
        if (payrollIds.length > 0) {
            const { data: creditBills, error: cbError } = await supabase
                .from('staff_credit_bills')
                .select('id, staff_id, amount, paid_amount, balance, status, description, bill_date, bill_number, deducted_in_payroll_id, created_at, source_cashier_credit_bill_id, source_pos_order_id')
                .in('deducted_in_payroll_id', payrollIds);
            
            if (cbError) {
                logger.warn('Failed to fetch credit bills for payroll records:', cbError);
            } else {
                creditBillsData = creditBills || [];
            }
        }

        // Also fetch credit bills by staff_id and date range for the payroll period
        // This catches bills that might not have deducted_in_payroll_id set yet
        // INCLUDES PAID BILLS for complete history
        const uniqueMonthYearPairs = [...new Set(data.map(p => `${p.month}-${p.year}`))];
        for (const pair of uniqueMonthYearPairs) {
            const [pMonth, pYear] = pair.split('-');
            const startDate = new Date(Number(pYear), Number(pMonth) - 1, 1).toISOString();
            const endDate = new Date(Number(pYear), Number(pMonth), 0, 23, 59, 59).toISOString();

            const staffIdsForPeriod = data
                .filter(p => p.month === pMonth && p.year === Number(pYear))
                .map(p => p.staff_id);

            if (staffIdsForPeriod.length > 0) {
                const { data: periodCreditBills, error: pcbError } = await supabase
                    .from('staff_credit_bills')
                    .select('id, staff_id, amount, paid_amount, balance, status, description, bill_date, bill_number, deducted_in_payroll_id, created_at, source_cashier_credit_bill_id, source_pos_order_id')
                    .in('staff_id', staffIdsForPeriod)
                    .gte('created_at', startDate)
                    .lte('created_at', endDate);

                if (!pcbError && periodCreditBills) {
                    // Merge with existing credit bills (avoid duplicates)
                    const existingIds = new Set(creditBillsData.map(cb => cb.id));
                    const newBills = periodCreditBills.filter(cb => !existingIds.has(cb.id));
                    creditBillsData = [...creditBillsData, ...newBills];
                }
            }
        }

        // Group credit bills by staff_id and payroll_id
        const creditBillsByStaffAndPayroll = new Map<string, any[]>();
        for (const cb of creditBillsData) {
            const key = `${cb.staff_id}-${cb.deducted_in_payroll_id || 'unlinked'}`;
            if (!creditBillsByStaffAndPayroll.has(key)) {
                creditBillsByStaffAndPayroll.set(key, []);
            }
            creditBillsByStaffAndPayroll.get(key)!.push(cb);
        }
        // ============ END CREDIT BILLS FETCHING ============

        // Filter by branch if requested
        const transformed = data
            .map(item => {
                const sp = staffMap.get(item.staff_id);
                const user = sp ? userMap.get(sp.user_id) : null;
                const branch = sp ? branchMap.get(sp.branch_id) : null;
                const firstName = user?.first_name || sp?.first_name || '';
                const lastName = user?.last_name || sp?.last_name || '';
                
                // Get credit bills for this payroll record
                const linkedKey = `${item.staff_id}-${item.id}`;
                const unlinkedKey = `${item.staff_id}-unlinked`;
                const allCreditBills = [
                    ...(creditBillsByStaffAndPayroll.get(linkedKey) || []),
                    ...(creditBillsByStaffAndPayroll.get(unlinkedKey) || [])
                ];

                // Separate credit bills by status
                const pendingCreditBills = allCreditBills.filter(cb => 
                    ['pending', 'partial', 'approved'].includes(cb.status)
                );
                const paidCreditBills = allCreditBills.filter(cb => 
                    ['paid', 'paid_cash', 'deducted'].includes(cb.status)
                );

                return {
                    ...item,
                    staff_name: `${firstName} ${lastName}`.trim(),
                    staff_role: sp?.role,
                    staff_department: sp?.department,
                    branch_name: branch?.name || 'Main Branch',
                    staff: sp ? {
                        ...sp,
                        first_name: firstName,
                        last_name: lastName,
                        email: user?.email || '',
                        phone_number: user?.phone_number || ''
                    } : null,
                    // Include ALL credit bills (pending AND paid)
                    credit_bills: allCreditBills,
                    credit_bills_count: allCreditBills.length,
                    // Separate pending and paid for easier filtering
                    pending_credit_bills: pendingCreditBills,
                    pending_credit_bills_count: pendingCreditBills.length,
                    paid_credit_bills: paidCreditBills,
                    paid_credit_bills_count: paidCreditBills.length
                };
            })
            .filter(item => !branch_id || item.staff?.branch_id === Number(branch_id));

        res.status(200).json({
            success: true,
            data: transformed
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get payroll summary (aggregated stats)
 */
export const getPayrollSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { month, year, branch_id } = req.query;

        let query = supabase
            .from('staff_payroll')
            .select('*, staff:staff_profiles!inner(branch_id)');

        query = applyBranchFilter(query, req, 'staff');

        if (month) query = query.eq('month', String(month));
        if (year) query = query.eq('year', Number(year));
        if (branch_id) query = query.eq('staff.branch_id', branch_id);

        const { data: records, error } = await query;
        if (error) throw error;

        const summary = {
            totalEmployees: new Set(records?.map(r => r.staff_id)).size,
            totalGrossPay: records?.reduce((sum, r) => sum + (Number(r.basic_salary) || 0), 0), // Simplifying gross as basic for summary
            totalDeductions: records?.reduce((sum, r) => sum + (Number(r.total_deductions) || 0), 0),
            totalNetPay: records?.reduce((sum, r) => sum + (Number(r.net_pay) || 0), 0),
            records_count: records?.length || 0
        };

        res.status(200).json({
            success: true,
            data: summary
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get detailed credit bills for a specific staff member's payroll
 * Used by Branch Accountant, Auditor, and HR to see credit bill breakdown
 * INCLUDES PAID BILLS (status: 'paid', 'paid_cash', 'deducted')
 */
export const getPayrollCreditBills = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { payroll_id, staff_id, month, year, include_paid } = req.query;

        if (!payroll_id && !staff_id) {
            throw new AppError('Either payroll_id or staff_id is required', 400);
        }

        // By default, include paid bills (set to 'false' to exclude)
        const shouldIncludePaid = include_paid !== 'false';

        let creditBillsQuery = supabase
            .from('staff_credit_bills')
            .select(`
                id, 
                staff_id, 
                amount, 
                paid_amount, 
                balance, 
                status, 
                description, 
                bill_date, 
                bill_number,
                deducted_in_payroll_id,
                created_at,
                updated_at,
                source_cashier_credit_bill_id,
                source_pos_order_id,
                branch_id,
                deducted_at,
                paid_at
            `)
            .order('created_at', { ascending: false });

        // Filter by payroll_id if provided
        if (payroll_id) {
            creditBillsQuery = creditBillsQuery.eq('deducted_in_payroll_id', payroll_id);
        } else if (staff_id) {
            // Filter by staff_id and optionally month/year
            creditBillsQuery = creditBillsQuery.eq('staff_id', staff_id);
            
            if (month && year) {
                const startDate = new Date(Number(year), Number(month) - 1, 1).toISOString();
                const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59).toISOString();
                creditBillsQuery = creditBillsQuery
                    .gte('created_at', startDate)
                    .lte('created_at', endDate);
            }
        }

        // Apply branch filter for access control
        creditBillsQuery = applyBranchFilter(creditBillsQuery, req);

        const { data: creditBills, error } = await creditBillsQuery;
        if (error) throw error;

        // Fetch staff details for the credit bills
        if (creditBills && creditBills.length > 0) {
            const staffIds = [...new Set(creditBills.map(cb => cb.staff_id))];
            const { data: staffProfiles } = await supabase
                .from('staff_profiles')
                .select('id, first_name, last_name, employee_number, role, department, branch_id, user_id')
                .in('id', staffIds);

            const staffMap = new Map((staffProfiles || []).map(s => [s.id, s]));

            // Enrich credit bills with staff info and categorize by status
            const enrichedCreditBills = creditBills.map(cb => {
                const staff = staffMap.get(cb.staff_id);
                const isPaid = ['paid', 'paid_cash', 'deducted'].includes(cb.status);
                const remainingBalance = cb.balance || (Number(cb.amount || 0) - Number(cb.paid_amount || 0));
                
                return {
                    ...cb,
                    staff_name: staff ? `${staff.first_name || ''} ${staff.last_name || ''}`.trim() : 'Unknown',
                    staff_employee_number: staff?.employee_number,
                    staff_role: staff?.role,
                    staff_department: staff?.department,
                    remaining_balance: remainingBalance,
                    is_paid: isPaid,
                    is_pending: ['pending', 'partial', 'approved'].includes(cb.status),
                    payment_date: cb.paid_at || cb.deducted_at || null
                };
            });

            // Filter by payment status if needed
            const filteredBills = shouldIncludePaid 
                ? enrichedCreditBills 
                : enrichedCreditBills.filter(cb => !cb.is_paid);

            // Separate pending and paid bills for summary
            const pendingBills = filteredBills.filter(cb => cb.is_pending);
            const paidBills = filteredBills.filter(cb => cb.is_paid);

            res.status(200).json({
                success: true,
                data: filteredBills,
                summary: {
                    total_count: filteredBills.length,
                    total_amount: filteredBills.reduce((sum, cb) => sum + Number(cb.amount || 0), 0),
                    total_balance: filteredBills.reduce((sum, cb) => sum + (cb.remaining_balance || 0), 0),
                    pending_count: pendingBills.length,
                    pending_amount: pendingBills.reduce((sum, cb) => sum + Number(cb.amount || 0), 0),
                    pending_balance: pendingBills.reduce((sum, cb) => sum + (cb.remaining_balance || 0), 0),
                    paid_count: paidBills.length,
                    paid_amount: paidBills.reduce((sum, cb) => sum + Number(cb.amount || 0), 0)
                },
                filters: {
                    include_paid: shouldIncludePaid,
                    payroll_id: payroll_id || null,
                    staff_id: staff_id || null,
                    month: month || null,
                    year: year || null
                }
            });
        } else {
            res.status(200).json({
                success: true,
                data: [],
                summary: {
                    total_count: 0,
                    total_amount: 0,
                    total_balance: 0,
                    pending_count: 0,
                    pending_amount: 0,
                    pending_balance: 0,
                    paid_count: 0,
                    paid_amount: 0
                },
                filters: {
                    include_paid: shouldIncludePaid,
                    payroll_id: payroll_id || null,
                    staff_id: staff_id || null,
                    month: month || null,
                    year: year || null
                }
            });
        }
    } catch (error) {
        next(error);
    }
};

/**
 * Utility to call Python service with retries
 */
const callPythonWithRetry = async (url: string, data: any, config: any = {}, maxRetries = 3) => {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await axios.post(url, data, config);
        } catch (error: any) {
            lastError = error;
            if (error.response?.status === 429) {
                const delay = Math.pow(2, i) * 2000; // 2s, 4s, 8s
                logger.warn(`Python service rate limited (429). Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error;
        }
    }
    throw lastError;
};

/**
 * Trigger Batch Email for Payslips
 */
export const emailPayslips = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { month, year, branch_id } = req.body;

        // Fetch payroll records with staff details
        let query = supabase
            .from('staff_payroll')
            .select(`
                *,
                staff:staff_profiles!inner(
                    *,
                    user:users!user_id(*),
                    branch:branches(id, name)
                )
            `)
            .eq('month', String(month))
            .eq('year', Number(year));

        if (branch_id) {
            query = query.eq('staff.branch_id', branch_id);
        }

        const { data: records, error } = await query;

        if (error) throw error;
        if (!records || records.length === 0) throw new AppError('No payroll records found to email', 404);

        // Format for Python Service
        const formattedRecords = records.map(r => ({
            ...r,
            staff: {
                ...r.staff,
                first_name: r.staff?.user?.first_name || '',
                last_name: r.staff?.user?.last_name || '',
                email: r.staff?.user?.email || '',
                phone_number: r.staff?.user?.phone_number || '',
                name: r.staff?.user ? `${r.staff.user.first_name || ''} ${r.staff.user.last_name || ''}`.trim() : '',
                branch_name: r.staff?.branch?.name || 'Main Branch'
            },
            period: `${month} ${year}`
        }));

        // Send individual emails
        const results = { sent: 0, failed: 0, details: [] as any[] };
        const pythonUrl = `${PYTHON_SERVICE_URL}/api/payroll/generate-single-pdf`;

        for (const record of formattedRecords) {
            try {
                // 1. Get PDF from Python
                const pythonRes = await callPythonWithRetry(pythonUrl, record, {
                    responseType: 'arraybuffer'
                });

                if (pythonRes.status !== 200) {
                    throw new Error(`Python service failed: ${pythonRes.statusText}`);
                }

                // 2. Send Email via Node side
                const pdfBuffer = Buffer.from(pythonRes.data);
                await emailService.sendPayslipEmail(
                    record.staff,
                    month,
                    parseInt(year),
                    pdfBuffer
                );

                results.sent++;
                results.details.push({ name: record.staff.name, status: 'sent' });
            } catch (err: any) {
                logger.error(`Failed to email payslip for ${record.staff?.name}: ${err.message}`);
                results.failed++;
                results.details.push({ name: record.staff?.name, error: err.message });
            }
        }

        res.status(200).json({
            success: true,
            data: results
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Download Batch Payslips as ZIP
 */
export const downloadPayslipsZip = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { month, year, branch_id } = req.body; // or query params

        // Fetch records
        let query = supabase
            .from('staff_payroll')
            .select(`
                *,
                staff:staff_profiles!inner(
                    *,
                    user:users!user_id(*),
                    branch:branches(id, name)
                )
            `)
            .eq('month', String(month))
            .eq('year', Number(year));

        if (branch_id) {
            query = query.eq('staff.branch_id', branch_id);
        }

        const { data: records, error } = await query;

        if (error) throw error;
        if (!records || records.length === 0) throw new AppError('No payroll records found', 404);

        const formattedRecords = records.map(r => ({
            ...r,
            staff: {
                ...r.staff,
                first_name: r.staff?.user?.first_name || '',
                last_name: r.staff?.user?.last_name || '',
                email: r.staff?.user?.email || '',
                phone_number: r.staff?.user?.phone_number || '',
                name: r.staff?.user ? `${r.staff.user.first_name || ''} ${r.staff.user.last_name || ''}`.trim() : '',
                branch_name: r.staff?.branch?.name || 'Main Branch'
            },
            period: `${month} ${year}`
        }));

        try {
            // ... (Python service call) ...

            // Attempt 1: Call Python Service explicitly for ZIP
            const pythonUrl = `${PYTHON_SERVICE_URL}/api/payroll/generate-batch-zip`;
            logger.debug(`Calling Python service (ZIP): ${pythonUrl}`);

            // Since we want to stream the ZIP back to client, we respond with the stream
            const pythonRes = await callPythonWithRetry(pythonUrl, {
                payroll_records: formattedRecords,
                period: `${month} ${year}`
            }, { responseType: 'stream' });

            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename=Payslips_${month}_${year}.zip`);

            pythonRes.data.pipe(res);
        } catch (pythonError: any) {
            logger.error('Python ZIP service failed, falling back to Node.js archiver:', pythonError);

            // Attempt 2: Fallback to Node.js Archiver
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename=Payslips_${month}_${year}_Fallback.zip`);

            const archive = archiver('zip', {
                zlib: { level: 9 } // Sets the compression level.
            });

            archive.on('error', function (err: any) {
                logger.error('Archiver error:', err);
                if (!res.headersSent) {
                    res.status(500).send({ error: err.message });
                }
            });

            archive.pipe(res);

            for (const record of formattedRecords) {
                try {
                    // Generate PDF buffer
                    const monthName = new Date(0, parseInt(month) - 1).toLocaleString('en-US', { month: 'long' });
                    const pdfBuffer = await generatePayslipPDF({
                        ...record,
                        month: monthName,
                        company: 'Famous Gates Hotels',
                        company_email: 'famous-gates-hotelsbmt@gmail.com',
                        company_address: 'Bomet, Kenya'
                    });

                    const filename = `Payslip_${record.staff.last_name}_${month}_${year}.pdf`;
                    archive.append(pdfBuffer, { name: filename });
                } catch (pdfErr) {
                    logger.error(`Failed to generate PDF for ${record.staff.name} in ZIP fallback:`, pdfErr);
                    // Add a text file indicating the error for this specific record
                    archive.append(Buffer.from(`Error generating payslip: ${pdfErr}`), { name: `ERROR_${record.staff.last_name}.txt` });
                }
            }

            await archive.finalize();
        }

    } catch (error) {
        next(error);
    }
};

/**
 * Get all pending payroll items for auditor approval
 */
export const getPendingApprovals = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { status } = req.query;

        // Fetch payroll items without embedded joins. Supabase schema cache
        // relationships between payroll tables and staff_profiles are not
        // reliable in production, so staff names are enriched separately.
        let creditBillsQuery = supabase
            .from('staff_credit_bills')
            .select('*')
            .is('auditor_confirmed_at', null)
            .order('created_at', { ascending: false });

        creditBillsQuery = applyBranchFilter(creditBillsQuery, req);

        if (status === 'pending_accountant' || status === 'pending_auditor') {
            creditBillsQuery = creditBillsQuery.eq('status', 'pending');
        } else if (status === 'approved') {
            creditBillsQuery = creditBillsQuery.in('status', ['deducted', 'paid_cash']);
        } else {
            creditBillsQuery = creditBillsQuery.not('status', 'in', '("paid","paid_cash","deducted","cancelled")');
        }

        // Fetch advances
        let advancesQuery = supabase
            .from('staff_advances')
            .select('*')
            .is('auditor_confirmed_at', null)
            .order('created_at', { ascending: false });

        advancesQuery = applyBranchFilter(advancesQuery, req);

        if (status === 'pending_accountant') {
            advancesQuery = advancesQuery.eq('status', 'pending');
        } else if (status === 'pending_auditor') {
            advancesQuery = advancesQuery.eq('status', 'pending');
        } else if (status === 'approved') {
            advancesQuery = advancesQuery.eq('status', 'approved');
        } else {
            advancesQuery = advancesQuery.in('status', ['pending', 'accountant_confirmed', 'pending_approval']);
        }

        // Fetch loans
        let loansQuery = supabase
            .from('staff_loans')
            .select('*')
            .is('auditor_confirmed_at', null)
            .order('created_at', { ascending: false });

        loansQuery = applyBranchFilter(loansQuery, req);

        if (status === 'pending_accountant') {
            loansQuery = loansQuery.eq('status', 'pending_approval');
        } else if (status === 'pending_auditor') {
            loansQuery = loansQuery.eq('status', 'pending_approval');
        } else if (status === 'approved') {
            loansQuery = loansQuery.eq('status', 'active');
        } else {
            loansQuery = loansQuery.in('status', ['pending', 'pending_approval', 'accountant_confirmed']);
        }

        const [creditBillsRes, advancesRes, loansRes] = await Promise.all([
            creditBillsQuery,
            advancesQuery,
            loansQuery
        ]);

        if (creditBillsRes.error) throw creditBillsRes.error;
        if (advancesRes.error) throw advancesRes.error;
        if (loansRes.error) throw loansRes.error;

        const staffIds = [...new Set([
            ...(creditBillsRes.data || []).map((item: any) => item.staff_id),
            ...(advancesRes.data || []).map((item: any) => item.staff_id),
            ...(loansRes.data || []).map((item: any) => item.staff_id),
        ].filter(Boolean))];

        const { data: staffProfiles, error: staffError } = staffIds.length
            ? await supabase
                .from('staff_profiles')
                .select('id, first_name, last_name, user_id, role, position, employee_number, branch_id')
                .in('id', staffIds)
            : { data: [], error: null };

        if (staffError) throw staffError;

        const userIds = [...new Set((staffProfiles || []).map((staff: any) => staff.user_id).filter(Boolean))];
        const { data: users, error: usersError } = userIds.length
            ? await supabase
                .from('users')
                .select('id, first_name, last_name, email')
                .in('id', userIds)
            : { data: [], error: null };

        if (usersError) throw usersError;

        const staffMap = new Map((staffProfiles || []).map((staff: any) => [staff.id, staff]));
        const userMap = new Map((users || []).map((user: any) => [user.id, user]));

        const enrich = (item: any, type: 'credit_bill' | 'advance' | 'loan') => {
            const staff: any = staffMap.get(item.staff_id);
            const user: any = staff?.user_id ? userMap.get(staff.user_id) : null;
            const firstName = user?.first_name || staff?.first_name || '';
            const lastName = user?.last_name || staff?.last_name || '';
            const staffName = `${firstName} ${lastName}`.trim() || item.staff_name || 'Unknown Staff';
            return {
                ...item,
                type,
                staff_name: staffName,
                employee_name: staffName,
                amount: type === 'loan' ? Number(item.total_amount || item.amount || 0) : Number(item.amount || 0),
                created_at: item.created_at || item.bill_date || item.request_date || item.start_date,
                staff: staff ? {
                    ...staff,
                    first_name: firstName,
                    last_name: lastName,
                    email: user?.email,
                    role: staff.role || staff.position,
                } : null,
            };
        };

        res.status(200).json({
            success: true,
            data: {
                credit_bills: (creditBillsRes.data || []).map((bill: any) => enrich(bill, 'credit_bill')),
                advances: (advancesRes.data || []).map((advance: any) => enrich(advance, 'advance')),
                loans: (loansRes.data || []).map((loan: any) => enrich(loan, 'loan'))
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Approve all draft payroll records for a given month/year (optionally filtered by branch).
 * Sets status from 'draft' → 'approved'.
 */
export const approvePayrollBatch = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { month, year, branch_id } = req.body;
        if (!month || !year) throw new AppError('month and year are required', 400);

        // Fetch draft records for the period
        let query = supabase
            .from('staff_payroll')
            .select('id, staff_id')
            .eq('month', String(month))
            .eq('year', Number(year))
            .eq('status', 'draft');

        if (branch_id) {
            // Filter via staff_profiles join
            const { data: staffInBranch } = await supabase
                .from('staff_profiles')
                .select('id')
                .eq('branch_id', branch_id);
            const ids = (staffInBranch || []).map(s => s.id);
            if (ids.length === 0) throw new AppError('No staff found for this branch', 404);
            query = query.in('staff_id', ids);
        }

        const { data: drafts, error: fetchErr } = await query;
        if (fetchErr) throw fetchErr;
        if (!drafts || drafts.length === 0) throw new AppError('No draft payroll records found for this period', 404);

        const ids = drafts.map(d => d.id);
        const { error: updateErr } = await supabase
            .from('staff_payroll')
            .update({ status: 'approved' })
            .in('id', ids);

        if (updateErr) throw updateErr;

        res.status(200).json({
            success: true,
            data: { approved_count: ids.length },
            message: `${ids.length} payroll record(s) approved for ${month}/${year}`,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Approve a payroll item (credit bill, loan, or advance)
 */
export const approvePayrollItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { type, id } = req.params;
        const auditorId = req.user?.id;

        if (!auditorId) {
            throw new AppError('Unauthorized', 401);
        }

        let tableName: string;
        if (type === 'credit_bill') tableName = 'staff_credit_bills';
        else if (type === 'advance') tableName = 'staff_advances';
        else if (type === 'loan') tableName = 'staff_loans';
        else throw new AppError('Invalid type', 400);

        // Update the record with auditor confirmation
        let updatePayload: Record<string, any>;
        if (type === 'advance') {
            updatePayload = { status: 'approved', approved_by: auditorId, auditor_confirmed_at: new Date().toISOString(), auditor_id: auditorId };
        } else if (type === 'loan') {
            updatePayload = { status: 'active', approved_by: auditorId, auditor_confirmed_at: new Date().toISOString(), auditor_id: auditorId };
        } else {
            updatePayload = { auditor_confirmed_at: new Date().toISOString(), auditor_id: auditorId };
        }

        const { data, error } = await supabase
            .from(tableName)
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();
        if (!data) throw new AppError('Record not found', 404);

        res.status(200).json({
            success: true,
            message: `${type} approved successfully`,
            data
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Reject a payroll item (credit bill, loan, or advance)
 */
export const rejectPayrollItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { type, id } = req.params;
        const { reason } = req.body;
        const auditorId = req.user?.id;

        if (!auditorId) {
            throw new AppError('Unauthorized', 401);
        }

        if (!reason) {
            throw new AppError('Rejection reason is required', 400);
        }

        let tableName: string;
        if (type === 'credit_bill') tableName = 'staff_credit_bills';
        else if (type === 'advance') tableName = 'staff_advances';
        else if (type === 'loan') tableName = 'staff_loans';
        else throw new AppError('Invalid type', 400);

        // Update the record with rejection (cancelled is the valid status for all three tables)
        const { data, error } = await supabase
            .from(tableName)
            .update({
                status: 'cancelled',
                ...(tableName === 'staff_credit_bills' ? { description: `CANCELLED: ${reason}` } : {}),
                ...(tableName === 'staff_advances' ? { reason: `CANCELLED: ${reason}` } : {}),
                ...(tableName === 'staff_loans' ? { reason: `CANCELLED: ${reason}` } : {})
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        if (!data) throw new AppError('Record not found', 404);

        res.status(200).json({
            success: true,
            message: `${type} rejected successfully`,
            data
        });
    } catch (error) {
        next(error);
    }
};
