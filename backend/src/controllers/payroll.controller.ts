import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { paystackService } from '../services/paystack.service';
import { mpesaService } from '../services/mpesa.service';

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
        employee:staff_profiles!employee_id(
          *,
          user:users!user_id(
            first_name,
            last_name,
            email,
            phone_number
          )
        )
      `)
      .order('pay_period_start', { ascending: false });

    if (startDate) {
      query = query.gte('pay_period_start', startDate);
    }
    if (endDate) {
      query = query.lte('pay_period_end', endDate);
    }

    const { data: payrollRecords, error } = await query;

    if (error) throw error;

    const summary = {
      totalEmployees: new Set(payrollRecords.map(r => r.employee_id)).size,
      totalGrossPay: payrollRecords.reduce((sum, r) => sum + parseFloat(r.gross_pay || 0), 0),
      totalDeductions: payrollRecords.reduce((sum, r) => sum + parseFloat(r.total_deductions || 0), 0),
      totalNetPay: payrollRecords.reduce((sum, r) => sum + parseFloat(r.net_pay || 0), 0),
      payrollRecords: payrollRecords.map(record => ({
        id: record.id,
        employeeId: record.employee_id,
        employeeName: `${record.employee?.user?.first_name} ${record.employee?.user?.last_name}`,
        position: record.employee?.position,
        department: record.employee?.department,
        payPeriodStart: record.pay_period_start,
        payPeriodEnd: record.pay_period_end,
        basicSalary: parseFloat(record.basic_salary),
        allowances: parseFloat(record.allowances || 0),
        overtime: parseFloat(record.overtime || 0),
        bonuses: parseFloat(record.bonuses || 0),
        grossPay: parseFloat(record.gross_pay),
        taxDeductions: parseFloat(record.tax_deductions || 0),
        nhifDeductions: parseFloat(record.nhif_deductions || 0),
        nssfDeductions: parseFloat(record.nssf_deductions || 0),
        otherDeductions: parseFloat(record.other_deductions || 0),
        totalDeductions: parseFloat(record.total_deductions),
        netPay: parseFloat(record.net_pay),
        paymentStatus: record.payment_status,
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
      advances = 0
    } = req.body;

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
        .eq('is_approved', true);

      if (attendance && attendance.length > 0) {
        const baseRate = Number(attendance[0].staff?.hourly_base_rate || 0);
        finalOvertime = attendance.reduce((sum, rec) => {
          const weekdayVal = Number(rec.hours_ot_weekday || 0) * baseRate * 1.5;
          const restVal = Number(rec.hours_ot_rest || 0) * baseRate * 2.0;
          const holidayVal = Number(rec.hours_ot_holiday || 0) * baseRate * 2.0;
          return sum + weekdayVal + restVal + holidayVal;
        }, 0);
      }
    }

    // Calculate gross pay
    const grossPay = parseFloat(basicSalary) + parseFloat(allowances) + finalOvertime + parseFloat(bonuses);

    // Calculate tax (simplified PAYE calculation for Kenya)
    const taxDeductions = calculatePAYE(grossPay);

    // Calculate NHIF (Kenya health insurance)
    const nhifDeductions = calculateNHIF(grossPay);

    // Calculate NSSF (Kenya pension)
    const nssfDeductions = calculateNSSF(grossPay);

    // Other deductions
    const otherDeductions = parseFloat(loans) + parseFloat(advances);

    // Total deductions
    const totalDeductions = taxDeductions + nhifDeductions + nssfDeductions + otherDeductions;

    // Net pay
    const netPay = grossPay - totalDeductions;

    const payrollData = {
      employee_id: employeeId,
      pay_period_start: payPeriodStart,
      pay_period_end: payPeriodEnd,
      basic_salary: basicSalary,
      allowances,
      overtime,
      bonuses,
      gross_pay: grossPay,
      tax_deductions: taxDeductions,
      nhif_deductions: nhifDeductions,
      nssf_deductions: nssfDeductions,
      other_deductions: otherDeductions,
      total_deductions: totalDeductions,
      net_pay: netPay,
      payment_status: 'pending',
      created_at: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      data: payrollData
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Process payroll payment (single employee)
// @route   POST /api/payroll/pay
// @access  Private (Admin, HR)
export const processPayrollPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      payrollRecordId,
      paymentMethod, // 'paystack', 'mpesa', 'bank_transfer'
      employeePhone,
      employeeEmail,
      bankDetails
    } = req.body;

    // Get payroll record
    const { data: payrollRecord, error: fetchError } = await supabase
      .from('payroll_records')
      .select('*, employee:staff_profiles!employee_id(*, user:users!user_id(*))')
      .eq('id', payrollRecordId)
      .single();

    if (fetchError || !payrollRecord) {
      res.status(404).json({
        success: false,
        message: 'Payroll record not found'
      });
      return;
    }

    let paymentResult;
    let paymentReference;

    try {
      if (paymentMethod === 'mpesa') {
        // Process via M-Pesa
        const phone = employeePhone || payrollRecord.employee.user.phone_number;
        paymentResult = await mpesaService.b2cPayment(
          phone,
          parseFloat(payrollRecord.net_pay),
          `Salary payment for ${payrollRecord.pay_period_start} to ${payrollRecord.pay_period_end}`,
          'Salary'
        );
        paymentReference = paymentResult.ConversationID;

      } else if (paymentMethod === 'paystack') {
        // Create transfer recipient
        const recipientData = {
          type: 'nuban' as const,
          name: `${payrollRecord.employee.user.first_name} ${payrollRecord.employee.user.last_name}`,
          account_number: bankDetails.accountNumber,
          bank_code: bankDetails.bankCode,
          currency: 'KES'
        };

        const recipient = await paystackService.createTransferRecipient(recipientData);

        // Initiate transfer
        paymentResult = await paystackService.initiateTransfer(
          parseFloat(payrollRecord.net_pay),
          recipient.data.recipient_code,
          `Salary payment for ${payrollRecord.pay_period_start} to ${payrollRecord.pay_period_end}`
        );
        paymentReference = paymentResult.data.transfer_code;

      } else {
        res.status(400).json({
          success: false,
          message: 'Invalid payment method'
        });
        return;
      }

      // Update payroll record
      const { error: updateError } = await supabase
        .from('payroll_records')
        .update({
          payment_status: 'processing',
          payment_method: paymentMethod,
          payment_reference: paymentReference,
          payment_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', payrollRecordId);

      if (updateError) throw updateError;

      logger.info(`Payroll payment initiated: ${payrollRecordId}, Method: ${paymentMethod}, Reference: ${paymentReference}`);

      res.status(200).json({
        success: true,
        message: 'Payment initiated successfully',
        data: {
          payrollRecordId,
          paymentReference,
          paymentMethod,
          amount: payrollRecord.net_pay,
          status: 'processing'
        }
      });

    } catch (paymentError: any) {
      logger.error('Payment processing error:', paymentError);

      // Update status to failed
      await supabase
        .from('payroll_records')
        .update({
          payment_status: 'failed',
          payment_error: paymentError.message,
          updated_at: new Date().toISOString()
        })
        .eq('id', payrollRecordId);

      res.status(500).json({
        success: false,
        message: 'Payment processing failed',
        error: paymentError.message
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Process bulk payroll payments
// @route   POST /api/payroll/bulk-pay
// @access  Private (Admin, HR)
export const processBulkPayroll = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { payrollRecordIds, paymentMethod } = req.body;

    if (!Array.isArray(payrollRecordIds) || payrollRecordIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Invalid payroll record IDs'
      });
      return;
    }

    // Fetch all payroll records
    const { data: payrollRecords, error: fetchError } = await supabase
      .from('payroll_records')
      .select('*, employee:staff_profiles!employee_id(*, user:users!user_id(*))')
      .in('id', payrollRecordIds);

    if (fetchError || !payrollRecords) {
      res.status(404).json({
        success: false,
        message: 'Payroll records not found'
      });
      return;
    }

    const results = {
      successful: [] as any[],
      failed: [] as any[]
    };

    if (paymentMethod === 'mpesa') {
      // Process bulk M-Pesa payments
      const payments = payrollRecords.map(record => ({
        phoneNumber: record.employee.user.phone_number,
        amount: parseFloat(record.net_pay),
        remarks: `Salary payment`,
        occasion: `${record.pay_period_start} to ${record.pay_period_end}`
      }));

      const paymentResults = await mpesaService.bulkB2CPayments(payments);

      // Update records
      for (let i = 0; i < payrollRecords.length; i++) {
        const record = payrollRecords[i];
        const result = paymentResults[i];

        if ('error' in result) {
          results.failed.push({
            recordId: record.id,
            employeeId: record.employee_id,
            error: result.error
          });

          await supabase
            .from('payroll_records')
            .update({
              payment_status: 'failed',
              payment_error: result.error,
              updated_at: new Date().toISOString()
            })
            .eq('id', record.id);
        } else {
          results.successful.push({
            recordId: record.id,
            employeeId: record.employee_id,
            reference: result.ConversationID
          });

          await supabase
            .from('payroll_records')
            .update({
              payment_status: 'processing',
              payment_method: 'mpesa',
              payment_reference: result.ConversationID,
              payment_date: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', record.id);
        }
      }
    } else if (paymentMethod === 'paystack') {
      // Process bulk Paystack transfers (requires pre-created recipients)
      // This is a simplified version - in production, you'd need to create/fetch recipients
      for (const record of payrollRecords) {
        try {
          // Assume recipient codes are stored in employee profiles
          const recipientCode = record.employee.paystack_recipient_code;

          if (!recipientCode) {
            results.failed.push({
              recordId: record.id,
              employeeId: record.employee_id,
              error: 'No Paystack recipient code found'
            });
            continue;
          }

          const result = await paystackService.initiateTransfer(
            parseFloat(record.net_pay),
            recipientCode,
            `Salary payment`
          );

          results.successful.push({
            recordId: record.id,
            employeeId: record.employee_id,
            reference: result.data.transfer_code
          });

          await supabase
            .from('payroll_records')
            .update({
              payment_status: 'processing',
              payment_method: 'paystack',
              payment_reference: result.data.transfer_code,
              payment_date: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', record.id);

        } catch (error: any) {
          results.failed.push({
            recordId: record.id,
            employeeId: record.employee_id,
            error: error.message
          });

          await supabase
            .from('payroll_records')
            .update({
              payment_status: 'failed',
              payment_error: error.message,
              updated_at: new Date().toISOString()
            })
            .eq('id', record.id);
        }
      }
    }

    logger.info(`Bulk payroll processed: ${results.successful.length} successful, ${results.failed.length} failed`);

    res.status(200).json({
      success: true,
      message: 'Bulk payroll processing completed',
      data: results
    });

  } catch (error) {
    next(error);
  }
};

// Helper functions for tax calculations (Kenya-specific)
function calculatePAYE(grossPay: number): number {
  // Simplified PAYE calculation for Kenya
  // Actual calculation is more complex with tax bands
  let tax = 0;

  if (grossPay <= 24000) {
    tax = grossPay * 0.10;
  } else if (grossPay <= 32333) {
    tax = 2400 + (grossPay - 24000) * 0.25;
  } else if (grossPay <= 500000) {
    tax = 4483.25 + (grossPay - 32333) * 0.30;
  } else if (grossPay <= 800000) {
    tax = 144783.35 + (grossPay - 500000) * 0.325;
  } else {
    tax = 242283.35 + (grossPay - 800000) * 0.35;
  }

  return Math.round(tax);
}

function calculateNHIF(grossPay: number): number {
  // NHIF rates (2024)
  if (grossPay < 6000) return 150;
  if (grossPay < 8000) return 300;
  if (grossPay < 12000) return 400;
  if (grossPay < 15000) return 500;
  if (grossPay < 20000) return 600;
  if (grossPay < 25000) return 750;
  if (grossPay < 30000) return 850;
  if (grossPay < 35000) return 900;
  if (grossPay < 40000) return 950;
  if (grossPay < 45000) return 1000;
  if (grossPay < 50000) return 1100;
  if (grossPay < 60000) return 1200;
  if (grossPay < 70000) return 1300;
  if (grossPay < 80000) return 1400;
  if (grossPay < 90000) return 1500;
  if (grossPay < 100000) return 1600;
  return 1700;
}

function calculateNSSF(grossPay: number): number {
  // NSSF contribution (2024) - 6% of pensionable pay
  const pensionablePay = Math.min(grossPay, 18000); // Capped at 18,000
  return Math.round(pensionablePay * 0.06);
}

// @desc    Get payment banks (for Paystack)
// @route   GET /api/payroll/banks
// @access  Private
export const getBanks = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const banks = await paystackService.getBanks('kenya');

    res.status(200).json({
      success: true,
      data: banks.data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify bank account
// @route   POST /api/payroll/verify-bank
// @access  Private
export const verifyBankAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountNumber, bankCode } = req.body;

    const verification = await paystackService.verifyBankAccount(accountNumber, bankCode);

    res.status(200).json({
      success: true,
      data: verification.data
    });
  } catch (error) {
    next(error);
  }
};
