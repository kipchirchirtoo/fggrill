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
 * Generate Payroll for a specific month/year
 */
export const generatePayroll = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { month, year, staff_id, branch_id } = req.body;
        const processedBy = req.user?.id;

        if (!month || !year) {
            throw new AppError('Month and Year are required', 400);
        }

        // 1. Fetch Staff Profiles (Active only)
        // 1. Fetch Staff Profiles (Active only)
        let staffQuery = supabase
            .from('staff_profiles')
            .select('id, basic_salary, nssf_enabled, shif_enabled, housing_fund_enabled, kra_pin')
            .eq('status', 'active');

        if (staff_id) {
            staffQuery = staffQuery.eq('id', staff_id);
        }

        if (branch_id) {
            staffQuery = staffQuery.eq('branch_id', branch_id);
        }

        const { data: staffList, error: staffError } = await staffQuery;
        if (staffError) throw staffError;
        if (!staffList || staffList.length === 0) {
            throw new AppError('No active staff found', 404);
        }

        const results = [];
        const errors = [];

        // 2. Process each staff member
        for (const staff of staffList) {
            try {
                const basicSalary = Number(staff.basic_salary) || 0;
                const nssfEnabled = staff.nssf_enabled !== false; // Default true
                const shifEnabled = staff.shif_enabled !== false; // Default true
                const housingEnabled = staff.housing_fund_enabled !== false; // Default true

                // A. Helper to get start/end dates for the month
                // month is likely a number 1-12 or string. 
                const monthIndex = Number(month) - 1; // 0-11
                const startDate = new Date(year, monthIndex, 1).toISOString().split('T')[0];
                const endDate = new Date(year, monthIndex + 1, 0).toISOString().split('T')[0];

                // B. Fetch Pending Adjustments (Deductions & Additions)
                const { data: adjustments } = await supabase
                    .from('staff_payroll_adjustments')
                    .select('id, type, category, amount')
                    .eq('staff_id', staff.id)
                    .eq('status', 'pending');

                // C. Fetch Direct Financials (Advances, Loans, Credit Bills) not yet linked to adjustments
                // This ensures we capture items directly filled by accountants/cashiers
                const [advancesRes, loansRes, creditBillsRes, unpaidBillsRes] = await Promise.all([
                    supabase.from('staff_advances').select('id, amount').eq('staff_id', staff.id).eq('status', 'approved').is('payroll_id', null),
                    supabase.from('staff_loans').select('id, monthly_installment').eq('staff_id', staff.id).eq('status', 'active'),
                    supabase.from('staff_credit_bills').select('id, amount, balance').eq('staff_id', staff.id).eq('is_paid', false).is('payroll_id', null),
                    supabase.from('unpaid_bills').select('id, total_amount, balance_amount').eq('waiter_id', staff.id).eq('status', 'unpaid')
                ]);

                let totalCreditBills = 0;
                let totalAdvances = 0;
                let totalLoanDeductions = 0;
                let totalUnpaidBills = 0;
                let uniformDeductions = 0;
                let absenceDeductions = 0;
                let otherUnifiedDeductions = 0;
                let totalAllowances = 0;
                let totalBonuses = 0;
                const adjustmentUpdates: string[] = [];
                const advanceUpdates: string[] = [];
                const creditBillUpdates: string[] = [];
                const unpaidBillUpdates: string[] = [];

                if (adjustments) {
                    for (const adj of adjustments) {
                        const amt = Number(adj.amount || 0);
                        if (adj.type === 'deduction') {
                            if (adj.category === 'credit_bill') totalCreditBills += amt;
                            else if (adj.category === 'advance') totalAdvances += amt;
                            else if (adj.category === 'loan_installment') totalLoanDeductions += amt;
                            else if (adj.category === 'uniform') uniformDeductions += amt;
                            else if (adj.category === 'absent_day') absenceDeductions += amt;
                            else otherUnifiedDeductions += amt;
                        } else if (adj.type === 'addition') {
                            if (adj.category === 'allowance') totalAllowances += amt;
                            else totalBonuses += amt;
                        }
                        adjustmentUpdates.push(adj.id);
                    }
                }

                // Process Direct Advances
                if (advancesRes.data) {
                    for (const adv of advancesRes.data) {
                        totalAdvances += Number(adv.amount || 0);
                        advanceUpdates.push(adv.id);
                    }
                }

                // Process Direct Loans (Recurring installments)
                if (loansRes.data) {
                    for (const loan of loansRes.data) {
                        totalLoanDeductions += Number(loan.monthly_installment || 0);
                    }
                }

                // Process Direct Credit Bills
                if (creditBillsRes.data) {
                    for (const bill of creditBillsRes.data) {
                        totalCreditBills += Number(bill.balance || bill.amount || 0);
                        creditBillUpdates.push(bill.id);
                    }
                }

                // Process Unpaid Bills (Waiters accountability)
                if (unpaidBillsRes.data) {
                    for (const bill of unpaidBillsRes.data) {
                        totalUnpaidBills += Number(bill.balance_amount || bill.total_amount || 0);
                        unpaidBillUpdates.push(bill.id);
                    }
                }


                // E. Kenyan Statutory Deductions (Manual entry by branch accountants)
                let nssf = 0;
                let shif = 0;
                const nhif = 0; // Deprecated
                let housingLevy = 0;
                let statutoryDeductionId = null;

                const { data: manualStatutory } = await supabase
                    .from('staff_monthly_statutory_deductions')
                    .select('*')
                    .eq('staff_id', staff.id)
                    .eq('month', month)
                    .eq('year', year)
                    .eq('status', 'pending')
                    .maybeSingle();

                if (manualStatutory) {
                    nssf = Number(manualStatutory.nssf_amount || 0);
                    shif = Number(manualStatutory.shif_amount || 0);
                    housingLevy = Number(manualStatutory.housing_fund_amount || 0);
                    statutoryDeductionId = manualStatutory.id;
                }

                // --- PAYE (Pay As You Earn - Income Tax) ---
                // Taxable income = gross salary - NSSF (NSSF is tax-deductible)
                // Calculate PAYE (Taxable Income = Gross - NSSF)
                const calculatePAYE = (taxablePay: number) => {
                    let tax = 0;
                    if (taxablePay <= 24000) {
                        tax = taxablePay * 0.1;
                    } else if (taxablePay <= 32333) {
                        tax = 2400 + (taxablePay - 24000) * 0.25;
                    } else if (taxablePay <= 500000) {
                        tax = 2400 + 2083.25 + (taxablePay - 32333) * 0.3;
                    } else if (taxablePay <= 800000) {
                        tax = 2400 + 2083.25 + 140300.1 + (taxablePay - 500000) * 0.325;
                    } else {
                        tax = 2400 + 2083.25 + 140300.1 + 97500 + (taxablePay - 800000) * 0.35;
                    }
                    return Math.max(0, tax - 2400); // Less personal relief
                };

                const grossSalary = basicSalary + totalAllowances + totalBonuses;
                const paye = calculatePAYE(grossSalary - nssf);

                // F. Calculate Net Pay
                const statutoryDeductions = nssf + shif + paye + housingLevy;
                const otherDeductions = totalCreditBills + totalAdvances + totalLoanDeductions + totalUnpaidBills + uniformDeductions + absenceDeductions + otherUnifiedDeductions;
                const totalDeductions = statutoryDeductions + otherDeductions;
                const netPay = (basicSalary + totalAllowances + totalBonuses) - totalDeductions;

                // G. Create/Update Payroll Record
                const { data: payroll, error: payrollError } = await supabase
                    .from('staff_payroll')
                    .upsert({
                        staff_id: staff.id,
                        month: String(month),
                        year: Number(year),
                        basic_salary: basicSalary,
                        allowances: totalAllowances,
                        bonuses: totalBonuses,
                        total_credit_bills: totalCreditBills,
                        total_advances: totalAdvances,
                        loan_deduction: totalLoanDeductions,
                        uncollected_bills_deduction: totalUnpaidBills,
                        uniform_deduction: uniformDeductions,
                        absence_deduction: absenceDeductions,
                        nssf,
                        nhif,
                        paye,
                        housing_levy: housingLevy,
                        nssf_deduction: nssf,
                        shif_deduction: shif,
                        housing_levy_deduction: housingLevy,
                        total_deductions: totalDeductions,
                        net_pay: netPay,
                        status: 'draft', // Draft until confirmed/paid
                        generated_at: new Date().toISOString()
                    }, { onConflict: 'staff_id, month, year' })
                    .select()
                    .single();

                if (payrollError) throw payrollError;

                // H. Update Related Records (Mark as applied)
                if (payroll) {
                    const updatePromises = [];
                    if (adjustmentUpdates.length > 0) {
                        updatePromises.push(
                            supabase
                                .from('staff_payroll_adjustments')
                                .update({ status: 'applied', payroll_id: payroll.id })
                                .in('id', adjustmentUpdates)
                        );
                    }
                    if (advanceUpdates.length > 0) {
                        updatePromises.push(
                            supabase
                                .from('staff_advances')
                                .update({ payroll_id: payroll.id })
                                .in('id', advanceUpdates)
                        );
                    }
                    if (creditBillUpdates.length > 0) {
                        updatePromises.push(
                            supabase
                                .from('staff_credit_bills')
                                .update({ is_paid: true, balance: 0, payroll_id: payroll.id })
                                .in('id', creditBillUpdates)
                        );
                    }
                    if (unpaidBillUpdates.length > 0) {
                        updatePromises.push(
                            supabase
                                .from('unpaid_bills')
                                .update({ status: 'deducted', remarks: `Deducted from payroll for ${month}/${year}` })
                                .in('id', unpaidBillUpdates)
                        );
                    }
                    if (statutoryDeductionId) {
                        updatePromises.push(
                            supabase
                                .from('staff_monthly_statutory_deductions')
                                .update({ status: 'applied', payroll_id: payroll.id })
                                .eq('id', statutoryDeductionId)
                        );
                    }
                    await Promise.all(updatePromises);
                }


                results.push(payroll);
            } catch (err: any) {
                errors.push({ staff_id: staff.id, error: err.message });
            }
        }

        res.status(errors.length > 0 && results.length === 0 ? 500 : 200).json({
            success: errors.length < staffList.length,
            data: {
                processed_count: results.length,
                error_count: errors.length,
                results,
                errors
            }
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
            .select(`
                *,
                staff:staff_profiles!inner(
                    *,
                    user:users!user_id(*),
                    branch:branches(id, name)
                )
            `)
            .order('generated_at', { ascending: false });

        if (month) query = query.eq('month', String(month));
        if (year) query = query.eq('year', Number(year));
        if (staff_id) query = query.eq('staff_id', staff_id);
        if (branch_id) query = query.eq('staff.branch_id', branch_id);

        const { data, error } = await query;
        if (error) throw error;

        // Transform data for frontend if needed (e.g. flatten staff details)
        const transformed = data.map(item => ({
            ...item,
            staff_name: item.staff?.user
                ? `${item.staff.user.first_name || ''} ${item.staff.user.last_name || ''}`.trim()
                : `${item.staff?.first_name || ''} ${item.staff?.last_name || ''}`.trim(),
            staff_role: item.staff?.role,
            staff_department: item.staff?.department,
            branch_name: item.staff?.branch?.name || 'Main Branch',
            staff: item.staff ? {
                ...item.staff,
                first_name: item.staff.user?.first_name || item.staff.first_name || '',
                last_name: item.staff.user?.last_name || item.staff.last_name || '',
                phone_number: item.staff.user?.phone_number || item.staff.phone || '',
                email: item.staff.user?.email || item.staff.email || ''
            } : null
        }));

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

        if (status === 'pending_accountant') {
            creditBillsQuery = creditBillsQuery.eq('is_paid', false);
        } else if (status === 'pending_auditor') {
            // Fallback since auditor columns are missing
            creditBillsQuery = creditBillsQuery.eq('is_paid', false);
        } else if (status === 'approved') {
            creditBillsQuery = creditBillsQuery.eq('is_paid', true);
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
        const { data, error } = await supabase
            .from(tableName)
            .update({
                auditor_confirmed_at: new Date().toISOString(),
                auditor_id: auditorId,
                status: type === 'loan' ? 'active' : 'approved'
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
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

        // Update the record with rejection
        const { data, error } = await supabase
            .from(tableName)
            .update({
                status: 'rejected',
                auditor_id: auditorId,
                // Store rejection reason in a notes/reason field if it exists
                ...(tableName === 'staff_credit_bills' ? { description: `REJECTED: ${reason}` } : {}),
                ...(tableName === 'staff_advances' ? { reason: `REJECTED: ${reason}` } : {}),
                ...(tableName === 'staff_loans' ? { reason: `REJECTED: ${reason}` } : {})
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
