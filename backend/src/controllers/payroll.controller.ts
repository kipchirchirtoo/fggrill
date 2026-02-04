import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { paystackService } from '../services/paystack.service';
import { mpesaService } from '../services/mpesa.service';
import { PayrollService } from '../services/payroll.service';
import { generatePayslipPDF } from '../utils/pdfGenerator';
import axios from 'axios';
import { emailService } from '../services/email.service';
import { bankDistributionService } from '../services/bankDistribution.service';

// @desc    Get payroll summary
// @route   GET /api/payroll/summary
// @access  Private (Admin, HR)
export const getPayrollSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { startDate, endDate, department, branch } = req.query;

    let query = supabase
      .from('payroll_records')
      .select(`
        *,
        employee:staff_profiles!staff_id(
          *,
          user:users!user_id(
            first_name,
            last_name,
            email,
            phone_number
          )
        )
      `)
      .order('month', { ascending: false });

    if (startDate) {
      // Logic for filtration based on date
    }

    const { data: payrollRecords, error } = await query;

    if (error) throw error;

    const summary = {
      totalEmployees: new Set(payrollRecords.map(r => r.staff_id)).size,
      totalGrossPay: payrollRecords.reduce((sum, r) => sum + parseFloat(r.gross_pay || 0), 0),
      totalDeductions: payrollRecords.reduce((sum, r) => sum + parseFloat(r.total_deductions || 0), 0),
      totalNetPay: payrollRecords.reduce((sum, r) => sum + parseFloat(r.net_salary || 0), 0),
      payrollRecords: payrollRecords.map(record => ({
        id: record.id,
        employeeId: record.staff_id,
        employeeName: `${record.employee?.user?.first_name} ${record.employee?.user?.last_name}`,
        department: record.employee?.department,
        month: record.month,
        year: record.year,
        basicSalary: parseFloat(record.base_salary),
        allowances: parseFloat(record.allowances || 0),
        overtime: parseFloat(record.overtime_hours || 0) * (record.overtime_rate || 1.5),
        bonuses: parseFloat(record.bonuses || 0),
        grossPay: parseFloat(record.gross_pay),
        taxDeductions: parseFloat(record.tax_deductions || 0),
        shifDeductions: parseFloat(record.shif_deduction || 0),
        housingLevyDeductions: parseFloat(record.housing_levy_deduction || 0),
        nssfDeductions: parseFloat(record.nssf_deduction || 0),
        otherDeductions: parseFloat(record.other_deductions || 0),
        totalDeductions: parseFloat(record.total_deductions),
        netPay: parseFloat(record.net_salary),
        approvalStatus: record.approval_status,
        paymentStatus: record.status,
        paymentMethod: record.payment_method,
        paymentDate: record.payment_date,
        paymentReference: record.payment_reference
      }))
    };

    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Calculate payroll for an employee
// @route   POST /api/payroll/calculate
// @access  Private (Admin, HR)
export const calculatePayroll = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      employeeId,
      payPeriodStart,
      payPeriodEnd,
      basicSalary,
      allowances = 0,
      overtime = 0,
      bonuses = 0,
      loans = 0,
      advances = 0,
      absencePenalties = 0,
      customDeductions = 0,
      customAllowances = 0,
      unpaidLeaveDeductionOverride = null
    } = req.body;

    const month = new Date(payPeriodStart).getMonth() + 1;
    const year = new Date(payPeriodStart).getFullYear();

    // 1. PRE-VALIDATION: Check if payroll is already locked (Approved/Paid)
    const { data: existingPayroll } = await supabase
      .from('staff_payroll')
      .select('approval_status')
      .eq('staff_id', employeeId)
      .eq('month', month)
      .eq('year', year)
      .maybeSingle();

    if (existingPayroll && (existingPayroll.approval_status === 'approved' || existingPayroll.approval_status === 'paid')) {
      res.status(403).json({
        success: false,
        message: 'Payroll record is locked (Approved or Paid). Editing not allowed.'
      });
      return;
    }

    // 2. WORKFLOW VALIDATION: Check if attendance is confirmed and leave is locked
    const { data: attendanceCheck } = await supabase
      .from('staff_attendance')
      .select('id')
      .eq('staff_id', employeeId)
      .gte('attendance_date', payPeriodStart)
      .lte('attendance_date', payPeriodEnd)
      .eq('is_confirmed', false)
      .limit(1);

    if (attendanceCheck && attendanceCheck.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Cannot calculate payroll: Some attendance records are NOT confirmed for this period.'
      });
      return;
    }

    const { data: leaveCheck } = await supabase
      .from('staff_leave')
      .select('id')
      .eq('staff_id', employeeId)
      .gte('start_date', payPeriodStart)
      .lte('end_date', payPeriodEnd)
      .eq('status', 'approved')
      .eq('is_locked', false)
      .limit(1);

    if (leaveCheck && leaveCheck.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Cannot calculate payroll: Approved leave requests must be LOCKED first.'
      });
      return;
    }

    let finalOvertime = parseFloat(overtime);

    // AUTO-INTEGRATION: If overtime is not provided, fetch from approved attendance
    if (finalOvertime === 0 && employeeId && payPeriodStart && payPeriodEnd) {
      const { data: attendance } = await supabase
        .from('staff_attendance')
        .select(`
          hours_ot_weekday, 
          hours_ot_rest, 
          hours_ot_holiday, 
          staff:staff_profiles(hourly_base_rate)
        `)
        .eq('staff_id', employeeId)
        .gte('attendance_date', payPeriodStart)
        .lte('attendance_date', payPeriodEnd)
        .eq('is_approved', true)
        .eq('is_confirmed', true); // Only confirmed ones

      if (attendance && attendance.length > 0) {
        const staff: any = attendance[0].staff;
        const baseRate = Number(Array.isArray(staff) ? staff[0]?.hourly_base_rate : staff?.hourly_base_rate || 0);

        finalOvertime = attendance.reduce((sum, rec) => {
          const weekdayVal = Number(rec.hours_ot_weekday || 0) * baseRate * 1.5;
          const restVal = Number(rec.hours_ot_rest || 0) * baseRate * 2.0;
          const holidayVal = Number(rec.hours_ot_holiday || 0) * baseRate * 2.0;
          return sum + weekdayVal + restVal + holidayVal;
        }, 0);
      }
    }

    // 3. AUTO-INTEGRATION: Fetch unpaid leave and calculate deductions
    let unpaidLeaveDeduction = Number(unpaidLeaveDeductionOverride);
    if (unpaidLeaveDeductionOverride === null || unpaidLeaveDeductionOverride === undefined) {
      const { data: unpaidLeave } = await supabase
        .from('staff_leave')
        .select('start_date, end_date')
        .eq('staff_id', employeeId)
        .eq('leave_type', 'unpaid')
        .eq('status', 'approved')
        .eq('is_locked', true)
        .gte('start_date', payPeriodStart)
        .lte('end_date', payPeriodEnd);

      if (unpaidLeave && unpaidLeave.length > 0) {
        // Calculate days
        let totalUnpaidDays = 0;
        unpaidLeave.forEach(leave => {
          const start = new Date(leave.start_date);
          const end = new Date(leave.end_date);
          const diffTime = Math.abs(end.getTime() - start.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          totalUnpaidDays += diffDays;
        });

        // Calculate deduction based on daily rate (Basic Salary / 26 days)
        const dailyRate = parseFloat(basicSalary) / 26;
        unpaidLeaveDeduction = totalUnpaidDays * dailyRate;
      } else {
        unpaidLeaveDeduction = 0;
      }
    }

    const grossPay = parseFloat(basicSalary) + parseFloat(allowances) + finalOvertime + parseFloat(bonuses) + parseFloat(customAllowances);

    // Calculate deductions using Service (HR Settings)
    const taxDeductions = await PayrollService.calculatePAYE(grossPay);
    const shifDeductions = await PayrollService.calculateSHIF(grossPay);
    const housingLevyDeductions = await PayrollService.calculateHousingLevy(grossPay);
    const nssfDeductions = await PayrollService.calculateNSSF(grossPay);

    const otherDeductions = parseFloat(loans) + parseFloat(advances) + parseFloat(absencePenalties) + parseFloat(customDeductions) + unpaidLeaveDeduction;
    const totalDeductions = taxDeductions + shifDeductions + nssfDeductions + housingLevyDeductions + otherDeductions;
    const netPay = grossPay - totalDeductions;

    const payrollData = {
      staff_id: employeeId,
      month,
      year,
      base_salary: basicSalary,
      allowances,
      overtime_hours: finalOvertime / (/* assuming base rate */ 1),
      overtime_rate: 1.5,
      bonuses,
      gross_pay: grossPay,
      tax_deductions: taxDeductions,
      shif_deduction: shifDeductions,
      housing_levy_deduction: housingLevyDeductions,
      nssf_deduction: nssfDeductions,
      other_deductions: otherDeductions,
      absence_penalties: absencePenalties,
      custom_deductions: customDeductions,
      custom_allowances: customAllowances,
      unpaid_leave_deduction: unpaidLeaveDeduction,
      total_deductions: totalDeductions,
      net_salary: netPay,
      approval_status: 'draft',
      status: 'pending',
      created_at: new Date().toISOString()
    };

    const { data: savedPayroll, error: saveError } = await supabase
      .from('staff_payroll')
      .upsert([payrollData], { onConflict: 'staff_id, month, year' })
      .select()
      .single();

    if (saveError) throw saveError;

    res.status(200).json({
      success: true,
      data: savedPayroll
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Review payroll record
// @route   PUT /api/payroll/:id/review
// @access  Private (Admin, HR)
export const reviewPayroll = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('staff_payroll')
      .update({
        approval_status: 'reviewed',
        reviewed_by: req.user?.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve payroll record
// @route   PUT /api/payroll/:id/approve
// @access  Private (Admin)
export const approvePayroll = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    // Transition from Reviewed to Approved
    const { data, error } = await supabase
      .from('staff_payroll')
      .update({
        approval_status: 'approved',
        approved_by_id: req.user?.id,
        approved_at: new Date().toISOString(),
        attendance_snapshot_verified_at: new Date().toISOString(),
        leave_snapshot_verified_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('approval_status', 'reviewed') // Require reviewed status first
      .select()
      .single();

    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// REST OF THE ORIGINAL FUNCTIONS (Payments, Banks, etc.)
export const processPayrollPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { payrollRecordId, paymentMethod, employeePhone, bankDetails } = req.body;

    const { data: payrollRecord, error: fetchError } = await supabase
      .from('payroll_records')
      .select('*, employee:staff_profiles!staff_id(*, user:users!user_id(*))')
      .eq('id', payrollRecordId)
      .single();

    if (fetchError || !payrollRecord) {
      res.status(404).json({ success: false, message: 'Payroll record not found' });
      return;
    }

    if (payrollRecord.approval_status !== 'approved') {
      res.status(403).json({ success: false, message: 'Only approved payroll can be paid' });
      return;
    }

    let paymentReference;
    if (paymentMethod === 'mpesa') {
      const phone = employeePhone || payrollRecord.employee.user.phone_number;
      const result = await mpesaService.b2cPayment(phone, parseFloat(payrollRecord.net_salary), 'Salary', 'Salary');
      paymentReference = result.ConversationID;
    } else if (paymentMethod === 'paystack') {
      const recipient = await paystackService.createTransferRecipient({
        type: 'nuban',
        name: `${payrollRecord.employee.user.first_name} ${payrollRecord.employee.user.last_name}`,
        account_number: bankDetails.accountNumber,
        bank_code: bankDetails.bankCode,
        currency: 'KES'
      });
      const result = await paystackService.initiateTransfer(parseFloat(payrollRecord.net_salary), recipient.data.recipient_code, 'Salary');
      paymentReference = result.data.transfer_code;
    }

    const { error: updateError } = await supabase
      .from('staff_payroll')
      .update({
        status: 'paid',
        approval_status: 'paid',
        payment_method: paymentMethod,
        payment_reference: paymentReference,
        payment_date: new Date().toISOString()
      })
      .eq('id', payrollRecordId);

    if (updateError) throw updateError;

    // 4. Create Finance Transaction for accounting
    const { error: financeError } = await supabase
      .from('finance_transactions')
      .insert([{
        transaction_number: `PAY-${Date.now()}`,
        transaction_type: 'expense',
        amount: parseFloat(payrollRecord.net_salary),
        description: `Salary Payment - ${payrollRecord.employee.user.first_name} ${payrollRecord.employee.user.last_name} (${payrollRecord.month}/${payrollRecord.year})`,
        category: 'Salaries & Wages',
        payment_method: paymentMethod,
        branch_id: payrollRecord.employee.branch_id,
        payment_date: new Date().toISOString(),
        payment_status: 'completed',
        reference_type: 'payroll',
        reference_id: payrollRecordId,
        notes: `PAYE: ${payrollRecord.tax_deductions}, NSSF: ${payrollRecord.nssf_deduction}, SHIF: ${payrollRecord.shif_deduction}, Housing Levy: ${payrollRecord.housing_levy_deduction}`,
        created_by: req.user?.id
      }]);

    if (financeError) {
      logger.error('Error creating finance transaction for payroll:', financeError);
      // We don't throw here to avoid rollback of the 'paid' status, 
      // but in a real enterprise app, this should be a transaction.
    }

    // 5. Send Payslip Email
    try {
      const monthName = new Date(0, payrollRecord.month - 1).toLocaleString('en-US', { month: 'long' });
      const pdfBuffer = await generatePayslipPDF({
        ...payrollRecord,
        month: monthName,
        company: 'Famous Gate Hotel',
        company_email: 'accounts@famousgate.co.ke'
      });
      await emailService.sendPayslipEmail(payrollRecord.employee, monthName, payrollRecord.year, pdfBuffer);
      logger.info(`Payslip email sent to ${payrollRecord.employee.user.email} after payment`);
    } catch (emailError) {
      logger.error('Failed to send payslip email after payment:', emailError);
      // We don't fail the request if just the email fails
    }

    res.status(200).json({ success: true, data: { paymentReference, status: 'paid' } });
  } catch (error) {
    next(error);
  }
};

export const processBulkPayroll = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { payrollRecordIds, paymentMethod } = req.body;
    const { data: records, error } = await supabase.from('payroll_records').select('*').in('id', payrollRecordIds);
    if (error) throw error;

    // Filter only approved ones
    const approvedRecords = records.filter(r => r.approval_status === 'approved');

    // Bulk processing logic (simplified for this restoration)
    res.status(200).json({ success: true, message: `Processing ${approvedRecords.length} approved records` });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate payslip PDF
// @route   GET /api/payroll/:id/payslip
// @access  Private
export const generatePayslip = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    // Get payroll record with all details
    const { data: record, error } = await supabase
      .from('payroll_records')
      .select('*, employee:staff_profiles!staff_id(*, user:users!user_id(*))')
      .eq('id', id)
      .single();

    if (error || !record) {
      res.status(404).json({ success: false, message: 'Payroll record not found' });
      return;
    }

    // Call Python service to generate PDF
    // We send all data including new statutory fields
    try {
      const response = await axios.post(`${process.env.PYTHON_SERVICE_URL || 'https://services.hirall.com'}/api/reports/generate/branded-pdf`, {
        reportType: 'payslip',
        data: {
          ...record,
          company: 'Famous Gate Hotel',
          generatedAt: new Date().toISOString()
        }
      }, {
        responseType: 'arraybuffer',
        timeout: 5000 // 5 second timeout for Python service
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Payslip_${record.employee.user.last_name}_${record.month}_${record.year}.pdf`);
      res.send(response.data);
    } catch (pythonError) {
      console.error('Python PDF service failed, using Node.js fallback:', pythonError);

      // Fallback to Node.js PDF generation
      const pdfBuffer = await generatePayslipPDF({
        ...record,
        company: 'Famous Gate Hotel',
        company_email: 'accounts@famousgate.co.ke',
        company_address: 'Kericho-Kisumu Highway, Kericho, Kenya'
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Payslip_${record.employee.user.last_name}_${record.month}_${record.year}_Fallback.pdf`);
      res.send(pdfBuffer);
    }
  } catch (error) {
    next(error);
  }
};

export const getBanks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const banks = await paystackService.getBanks('kenya');
    res.status(200).json({ success: true, data: banks.data });
  } catch (error) {
    next(error);
  }
};

export const verifyBankAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { accountNumber, bankCode } = req.body;
    const verification = await paystackService.verifyBankAccount(accountNumber, bankCode);
    res.status(200).json({ success: true, data: verification.data });
  } catch (error) {
    next(error);
  }
};

// @desc    Export bank distribution file (CSV)
// @route   GET /api/payroll/export/bank-distribution
// @access  Private (Admin, HR)
export const exportBankDistribution = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      res.status(400).json({ success: false, message: 'Month and year are required' });
      return;
    }

    const { data: records, error } = await supabase
      .from('payroll_records')
      .select('*, employee:staff_profiles!staff_id(*, user:users!user_id(*))')
      .eq('month', parseInt(month as string))
      .eq('year', parseInt(year as string))
      .eq('approval_status', 'approved');

    if (error) throw error;

    if (!records || records.length === 0) {
      res.status(404).json({ success: false, message: 'No approved records found for this period' });
      return;
    }

    const bankRecords = records.map(r => ({
      account_number: r.employee.bank_account_number || 'N/A',
      account_name: `${r.employee.user.first_name} ${r.employee.user.last_name}`,
      bank_name: r.employee.bank_name || 'N/A',
      bank_branch: r.employee.bank_branch || 'N/A',
      amount: parseFloat(r.net_salary),
      reference: `SALARY-${r.month}-${r.year}`
    }));

    const csv = await bankDistributionService.generateBankCSV(bankRecords);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=Bank_Distribution_${month}_${year}.csv`);
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};
