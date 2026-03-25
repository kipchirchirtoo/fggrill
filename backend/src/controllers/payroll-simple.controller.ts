import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import axios from 'axios';
import { PYTHON_SERVICE_URL } from '../config/pythonService';
import { logger } from '../utils/logger';
import { emailService } from '../services/email.service';
import archiver from 'archiver';
import { generatePayslipPDF } from '../utils/pdfGenerator';

/**
 * Core payroll engine for a single staff member.
 * Fetches ALL dynamic deductions fresh, computes totals, upserts the record,
 * then marks every source record as deducted.
 *
 * Deduction rules:
 *  - NSSF / SHIF / Housing Levy / PAYE → ONLY from staff_payroll_adjustments (never auto-calculated)
 *  - Credit Bills  → ALL status='pending'
 *  - Unpaid Bills  → ALL status='unpaid' where waiter_id = staffId
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
                .update({ status: 'pending', payroll_id: null })
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
        .eq('status', 'pending');

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

    // 3a. Credit bills — ALL pending
    const { data: creditBillRows, error: cbErr } = await supabase
        .from('staff_credit_bills')
        .select('id, amount')
        .eq('staff_id', staffId)
        .eq('status', 'pending');
    if (cbErr) throw cbErr;

    // 3b. Unpaid bills — ALL unpaid for this waiter
    const { data: unpaidBillRows, error: ubErr } = await supabase
        .from('unpaid_bills')
        .select('id, total_amount, balance_amount')
        .eq('waiter_id', staffId)
        .eq('status', 'unpaid');
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
        totalCreditBills += Number(b.amount || 0);
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
    const { data: payroll, error: payrollError } = await supabase
        .from('staff_payroll')
        .upsert({
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
        }, { onConflict: 'staff_id, month, year' })
        .select()
        .single();

    if (payrollError) throw payrollError;

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
            .eq('status', 'active');

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

        // Filter by branch if requested
        const transformed = data
            .map(item => {
                const sp = staffMap.get(item.staff_id);
                const user = sp ? userMap.get(sp.user_id) : null;
                const branch = sp ? branchMap.get(sp.branch_id) : null;
                const firstName = user?.first_name || sp?.first_name || '';
                const lastName = user?.last_name || sp?.last_name || '';
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
                    } : null
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

        // Fetch credit bills
        let creditBillsQuery = supabase
            .from('staff_credit_bills')
            .select(`
                *, 
                staff:staff_profiles(
                    id,
                    role,
                    user:users!user_id(id, first_name, last_name)
                )
            `)
            .order('created_at', { ascending: false });

        if (status === 'pending_accountant' || status === 'pending_auditor') {
            creditBillsQuery = creditBillsQuery.eq('status', 'pending');
        } else if (status === 'approved') {
            creditBillsQuery = creditBillsQuery.in('status', ['deducted', 'paid_cash']);
        }

        // Fetch advances
        let advancesQuery = supabase
            .from('staff_advances')
            .select(`
                *, 
                staff:staff_profiles(
                    id,
                    role,
                    user:users!user_id(id, first_name, last_name)
                )
            `)
            .order('created_at', { ascending: false });

        if (status === 'pending_accountant') {
            advancesQuery = advancesQuery.eq('status', 'pending');
        } else if (status === 'pending_auditor') {
            advancesQuery = advancesQuery.eq('status', 'pending');
        } else if (status === 'approved') {
            advancesQuery = advancesQuery.eq('status', 'approved');
        }

        // Fetch loans
        let loansQuery = supabase
            .from('staff_loans')
            .select(`
                *, 
                staff:staff_profiles(
                    id,
                    role,
                    user:users!user_id(id, first_name, last_name)
                )
            `)
            .order('created_at', { ascending: false });

        if (status === 'pending_accountant') {
            loansQuery = loansQuery.eq('status', 'pending_approval');
        } else if (status === 'pending_auditor') {
            loansQuery = loansQuery.eq('status', 'pending_approval');
        } else if (status === 'approved') {
            loansQuery = loansQuery.eq('status', 'active');
        }

        const [creditBillsRes, advancesRes, loansRes] = await Promise.all([
            creditBillsQuery,
            advancesQuery,
            loansQuery
        ]);

        if (creditBillsRes.error) throw creditBillsRes.error;
        if (advancesRes.error) throw advancesRes.error;
        if (loansRes.error) throw loansRes.error;

        res.status(200).json({
            success: true,
            data: {
                credit_bills: (creditBillsRes.data || []).map((bill: any) => ({
                    ...bill,
                    staff: bill.staff ? {
                        ...bill.staff,
                        first_name: bill.staff.user?.first_name || '',
                        last_name: bill.staff.user?.last_name || ''
                    } : null
                })),
                advances: (advancesRes.data || []).map((advance: any) => ({
                    ...advance,
                    staff: advance.staff ? {
                        ...advance.staff,
                        first_name: advance.staff.user?.first_name || '',
                        last_name: advance.staff.user?.last_name || ''
                    } : null
                })),
                loans: (loansRes.data || []).map((loan: any) => ({
                    ...loan,
                    staff: loan.staff ? {
                        ...loan.staff,
                        first_name: loan.staff.user?.first_name || '',
                        last_name: loan.staff.user?.last_name || ''
                    } : null
                }))
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
            updatePayload = { status: 'approved', approved_by: auditorId };
        } else if (type === 'loan') {
            updatePayload = { status: 'active', approved_by: auditorId };
        } else {
            // credit_bill: already 'pending', no status change needed — just confirm it's valid
            // We don't change status here; payroll generation will set it to 'deducted'
            updatePayload = {};
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
