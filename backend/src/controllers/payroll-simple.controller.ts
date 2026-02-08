import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import axios from 'axios';
import { PYTHON_SERVICE_URL } from '../config/pythonService';
import { logger } from '../utils/logger';

/**
 * Generate Payroll for a specific month/year
 */
export const generatePayroll = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { month, year, staff_id } = req.body;
        const processedBy = req.user?.id;

        if (!month || !year) {
            throw new AppError('Month and Year are required', 400);
        }

        // 1. Fetch Staff Profiles (Active only)
        let staffQuery = supabase
            .from('staff_profiles')
            .select('id, basic_salary')
            .eq('status', 'active');

        if (staff_id) {
            staffQuery = staffQuery.eq('id', staff_id);
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

                // A. Helper to get start/end dates for the month
                // month is likely a number 1-12 or string. 
                const monthIndex = Number(month) - 1; // 0-11
                const startDate = new Date(year, monthIndex, 1).toISOString().split('T')[0];
                const endDate = new Date(year, monthIndex + 1, 0).toISOString().split('T')[0];

                // B. Calculate Credit Bills (Pending bills up to end of this month)
                const { data: bills } = await supabase
                    .from('staff_credit_bills')
                    .select('id, amount')
                    .eq('staff_id', staff.id)
                    .eq('is_paid', false) // Schema uses is_paid boolean
                    .lte('date', endDate); // Schema uses date

                const totalCreditBills = bills?.reduce((sum, b) => sum + Number(b.amount), 0) || 0;
                const billIds = bills?.map(b => b.id) || [];

                // C. Calculate Advances (Approved advances that are NOT 'deducted')
                // We assume any approved advance that hasn't been deducted should be deducted now
                const { data: advances } = await supabase
                    .from('staff_advances')
                    .select('id, amount')
                    .eq('staff_id', staff.id)
                    .eq('status', 'approved') // Only approved
                    .lte('request_date', endDate);

                const totalAdvances = advances?.reduce((sum, a) => sum + Number(a.amount), 0) || 0;
                const advanceIds = advances?.map(a => a.id) || [];

                // D. Calculate Loans (Active loans)
                const { data: loans } = await supabase
                    .from('staff_loans')
                    .select('id, monthly_installment, remaining_balance, start_date')
                    .eq('staff_id', staff.id)
                    .eq('status', 'active')
                    .lte('start_date', endDate); // Added this line to match the pattern of other queries.

                let totalLoanDeductions = 0;
                const loanUpdates = [];

                if (loans) {
                    for (const loan of loans) {
                        const installment = Math.min(Number(loan.monthly_installment), Number(loan.remaining_balance));
                        if (installment > 0) {
                            totalLoanDeductions += installment;
                            loanUpdates.push({
                                id: loan.id,
                                deduction: installment,
                                new_balance: Number(loan.remaining_balance) - installment
                            });
                        }
                    }
                }

                // E. Statutory Deductions (Simplified for now - strictly 0 unless logic added)
                // In future, calculate NSSF/NHIF/PAYE based on basicSalary limits
                const nssf = 0; // Placeholder
                const nhif = 0; // Placeholder
                const paye = 0; // Placeholder
                const housingLevy = 0; // Placeholder 

                // F. Calculate Net Pay
                const totalDeductions = totalCreditBills + totalAdvances + totalLoanDeductions + nssf + nhif + paye + housingLevy;
                const netPay = basicSalary - totalDeductions;

                // G. Create/Update Payroll Record
                const { data: payroll, error: payrollError } = await supabase
                    .from('staff_payroll')
                    .upsert({
                        staff_id: staff.id,
                        month: String(month),
                        year: Number(year),
                        basic_salary: basicSalary,
                        total_credit_bills: totalCreditBills,
                        total_advances: totalAdvances,
                        loan_deduction: totalLoanDeductions,
                        nssf,
                        nhif,
                        paye,
                        housing_levy: housingLevy,
                        total_deductions: totalDeductions,
                        net_pay: netPay,
                        status: 'draft', // Draft until confirmed/paid
                        generated_at: new Date().toISOString()
                    }, { onConflict: 'staff_id, month, year' })
                    .select()
                    .single();

                if (payrollError) throw payrollError;

                // H. Update Related Records (Mark as deducted)
                // We link them to this payroll ID. 
                // Note: If we re-run, we might re-deduct if we don't check `deducted_in_payroll_id`.
                // For 'is_paid', we set to true.

                if (payroll) {
                    // Update Bills
                    if (billIds.length > 0) {
                        await supabase
                            .from('staff_credit_bills')
                            .update({ is_paid: true, payroll_id: payroll.id })
                            .in('id', billIds);
                    }

                    // Update Advances
                    if (advanceIds.length > 0) {
                        await supabase
                            .from('staff_advances')
                            .update({ status: 'deducted', payroll_id: payroll.id })
                            .in('id', advanceIds);
                    }

                    // Update Loans (Record payment)
                    for (const update of loanUpdates) {
                        // Insert loan payment record
                        await supabase.from('staff_loan_payments').insert({
                            loan_id: update.id,
                            amount: update.deduction,
                            payment_date: new Date().toISOString(),
                            payroll_id: payroll.id
                        });

                        // Update loan balance
                        const newStatus = update.new_balance <= 0 ? 'completed' : 'active';
                        await supabase
                            .from('staff_loans')
                            .update({
                                remaining_balance: update.new_balance,
                                status: newStatus
                            })
                            .eq('id', update.id);
                    }
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
        const { month, year, staff_id } = req.query;

        let query = supabase
            .from('staff_payroll')
            .select(`
                *,
                staff:staff_profiles(
                    *,
                    user:users!user_id(*)
                )
            `)
            .order('generated_at', { ascending: false });

        if (month) query = query.eq('month', String(month));
        if (year) query = query.eq('year', Number(year));
        if (staff_id) query = query.eq('staff_id', staff_id);

        const { data, error } = await query;
        if (error) throw error;

        // Transform data for frontend if needed (e.g. flatten staff details)
        const transformed = data.map(item => ({
            ...item,
            staff_name: item.staff?.user ? `${item.staff.user.first_name || ''} ${item.staff.user.last_name || ''}`.trim() : '',
            staff_role: item.staff?.role,
            staff_department: item.staff?.department,
            staff: item.staff ? {
                ...item.staff,
                first_name: item.staff.user?.first_name || '',
                last_name: item.staff.user?.last_name || '',
                phone_number: item.staff.user?.phone_number || '',
                email: item.staff.user?.email || ''
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
        const { month, year } = req.query;

        let query = supabase
            .from('staff_payroll')
            .select('*');

        if (month) query = query.eq('month', String(month));
        if (year) query = query.eq('year', Number(year));

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
 * Trigger Batch Email for Payslips
 */
export const emailPayslips = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { month, year } = req.body;

        // Fetch payroll records with staff details
        const { data: records, error } = await supabase
            .from('staff_payroll')
            .select(`
                *,
                staff:staff_profiles(
                    *,
                    user:users!user_id(*)
                )
            `)
            .eq('month', String(month))
            .eq('year', Number(year));

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
                name: r.staff?.user ? `${r.staff.user.first_name || ''} ${r.staff.user.last_name || ''}`.trim() : ''
            },
            period: `${month} ${year}`
        }));

        // Call Python Service
        const pythonUrl = `${PYTHON_SERVICE_URL}/api/payroll/email-batch`;
        logger.debug(`Calling Python service (Email): ${pythonUrl}`);

        const pythonRes = await axios.post(pythonUrl, {
            payroll_records: formattedRecords,
            period: `${month} ${year}`
        });

        res.status(200).json({
            success: true,
            data: pythonRes.data
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
        const { month, year } = req.body; // or query params

        // Fetch records
        const { data: records, error } = await supabase
            .from('staff_payroll')
            .select(`
                *,
                staff:staff_profiles(
                    *,
                    user:users!user_id(*)
                )
            `)
            .eq('month', String(month))
            .eq('year', Number(year));

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
                name: r.staff?.user ? `${r.staff.user.first_name || ''} ${r.staff.user.last_name || ''}`.trim() : ''
            },
            period: `${month} ${year}`
        }));

        // Call Python Service explicitly for ZIP
        const pythonUrl = `${PYTHON_SERVICE_URL}/api/payroll/generate-batch-zip`;
        logger.debug(`Calling Python service (ZIP): ${pythonUrl}`);

        // Since we want to stream the ZIP back to client, we respond with the stream
        const response = await axios.post(pythonUrl, {
            payroll_records: formattedRecords,
            period: `${month}_${year}`
        }, { responseType: 'stream' });

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename=Payslips_${month}_${year}.zip`);

        response.data.pipe(res);

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
