import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import axios from 'axios';

// Python Service URL
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:5000';

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
                    .lte('start_date', endDate);

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

        res.status(200).json({
            success: true,
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
                staff:staff_profiles(id, first_name, last_name, role, department, bank_name, account_number, pin_number, nssf_number, nhif_number, phone_number, email)
            `)
            .order('created_at', { ascending: false });

        if (month) query = query.eq('month', month);
        if (year) query = query.eq('year', year);
        if (staff_id) query = query.eq('staff_id', staff_id);

        const { data, error } = await query;
        if (error) throw error;

        // Transform data for frontend if needed (e.g. flatten staff details)
        const transformed = data.map(item => ({
            ...item,
            staff_name: `${item.staff?.first_name || ''} ${item.staff?.last_name || ''}`.trim(),
            staff_role: item.staff?.role,
            staff_department: item.staff?.department
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
                staff:staff_profiles(id, first_name, last_name, role, department, bank_name, account_number, pin_number, nssf_number, nhif_number, phone_number, email)
            `)
            .eq('month', month)
            .eq('year', year);

        if (error) throw error;
        if (!records || records.length === 0) throw new AppError('No payroll records found to email', 404);

        // Format for Python Service
        const formattedRecords = records.map(r => ({
            ...r,
            staff: {
                ...r.staff,
                name: `${r.staff?.first_name || ''} ${r.staff?.last_name || ''}`.trim()
            },
            period: `${month} ${year}`
        }));

        // Call Python Service
        const pythonRes = await axios.post(`${PYTHON_SERVICE_URL}/api/payroll/email-batch`, {
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
                staff:staff_profiles(id, first_name, last_name, role, department, bank_name, account_number, pin_number, nssf_number, nhif_number, phone_number, email)
            `)
            .eq('month', month)
            .eq('year', year);

        if (error) throw error;
        if (!records || records.length === 0) throw new AppError('No payroll records found', 404);

        const formattedRecords = records.map(r => ({
            ...r,
            staff: {
                ...r.staff,
                name: `${r.staff?.first_name || ''} ${r.staff?.last_name || ''}`.trim()
            },
            period: `${month} ${year}`
        }));

        // Call Python Service explicitly for ZIP
        // Since we want to stream the ZIP back to client, we respond with the stream
        const response = await axios.post(`${PYTHON_SERVICE_URL}/api/payroll/generate-batch-zip`, {
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
