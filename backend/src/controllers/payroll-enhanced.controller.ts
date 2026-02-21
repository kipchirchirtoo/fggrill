import { Request, Response } from 'express';
import { supabase } from '../config/database';

// Get deduction rates
export const getDeductionRates = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('payroll_deduction_rates')
      .select('*')
      .eq('is_active', true)
      .order('deduction_type', { ascending: true });

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Error fetching deduction rates:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch deduction rates'
    });
  }
};

// Update deduction rate
export const updateDeductionRate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rateData = req.body;

    const { data, error } = await supabase
      .from('payroll_deduction_rates')
      .update(rateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data,
      message: 'Deduction rate updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating deduction rate:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update deduction rate'
    });
  }
};

// Calculate payroll with all deductions
export const calculatePayroll = async (req: Request, res: Response) => {
  try {
    const {
      staff_id,
      basic_salary,
      allowances = 0,
      overtime_pay = 0,
      uniform_deduction = 0,
      contributions_deduction = 0,
      absent_days = 0,
      working_days = 26,
      tax_deduction = 0
    } = req.body;

    // Get active deduction rates
    const { data: rates, error: ratesError } = await supabase
      .from('payroll_deduction_rates')
      .select('*')
      .eq('is_active', true);

    if (ratesError) throw ratesError;

    // Calculate gross salary
    const grossSalary = parseFloat(basic_salary) + parseFloat(allowances) + parseFloat(overtime_pay);

    // Calculate SHA deduction (2.75% of gross salary)
    const shaRate = rates?.find(r => r.deduction_type === 'SHA');
    const shaDeduction = shaRate 
      ? (grossSalary * parseFloat(shaRate.rate_value)) / 100 
      : 0;

    // Calculate NSSF deduction (6% of gross salary, capped if max_amount exists)
    const nssfRate = rates?.find(r => r.deduction_type === 'NSSF');
    let nssfDeduction = nssfRate 
      ? (grossSalary * parseFloat(nssfRate.rate_value)) / 100 
      : 0;
    
    if (nssfRate?.max_amount && nssfDeduction > parseFloat(nssfRate.max_amount)) {
      nssfDeduction = parseFloat(nssfRate.max_amount);
    }

    // Calculate absent days deduction
    const dailyRate = parseFloat(basic_salary) / working_days;
    const absentDaysDeduction = dailyRate * parseInt(absent_days);

    // Calculate total deductions
    const totalDeductions = 
      shaDeduction +
      nssfDeduction +
      parseFloat(uniform_deduction) +
      parseFloat(contributions_deduction) +
      absentDaysDeduction +
      parseFloat(tax_deduction);

    // Calculate net salary
    const netSalary = grossSalary - totalDeductions;

    const calculation = {
      staff_id,
      basic_salary: parseFloat(basic_salary),
      allowances: parseFloat(allowances),
      overtime_pay: parseFloat(overtime_pay),
      gross_salary: grossSalary,
      sha_deduction: shaDeduction,
      nssf_deduction: nssfDeduction,
      uniform_deduction: parseFloat(uniform_deduction),
      contributions_deduction: parseFloat(contributions_deduction),
      absent_days: parseInt(absent_days),
      absent_days_deduction: absentDaysDeduction,
      tax_deduction: parseFloat(tax_deduction),
      total_deductions: totalDeductions,
      net_salary: netSalary,
      working_days: parseInt(working_days)
    };

    res.status(200).json({
      success: true,
      data: calculation
    });
  } catch (error: any) {
    console.error('Error calculating payroll:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to calculate payroll'
    });
  }
};

// Process payroll with enhanced deductions
export const processEnhancedPayroll = async (req: Request, res: Response) => {
  try {
    const payrollData = req.body;

    // If calculation fields are not provided, calculate them
    if (!payrollData.gross_salary || !payrollData.net_salary) {
      const calculation = await calculatePayrollInternal(payrollData);
      Object.assign(payrollData, calculation);
    }

    const { data, error } = await supabase
      .from('payroll')
      .insert([payrollData])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data,
      message: 'Payroll processed successfully'
    });
  } catch (error: any) {
    console.error('Error processing payroll:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process payroll'
    });
  }
};

// Update payroll record
export const updateEnhancedPayroll = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const payrollData = req.body;

    // Recalculate if needed
    if (payrollData.basic_salary || payrollData.allowances || payrollData.absent_days) {
      const calculation = await calculatePayrollInternal(payrollData);
      Object.assign(payrollData, calculation);
    }

    const { data, error } = await supabase
      .from('payroll')
      .update(payrollData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data,
      message: 'Payroll updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating payroll:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update payroll'
    });
  }
};

// Get payroll with all details
export const getEnhancedPayroll = async (req: Request, res: Response) => {
  try {
    const { month, year, staffId } = req.query;

    let query = supabase
      .from('payroll')
      .select(`
        *,
        staff:users!payroll_staff_id_fkey(id, first_name, last_name, employee_id, role)
      `)
      .order('created_at', { ascending: false });

    if (month) {
      query = query.eq('month', month);
    }

    if (year) {
      query = query.eq('year', year);
    }

    if (staffId) {
      query = query.eq('staff_id', staffId);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Error fetching payroll:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch payroll'
    });
  }
};

// Generate payslip
export const generatePayslip = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: payroll, error } = await supabase
      .from('payroll')
      .select(`
        *,
        staff:users!payroll_staff_id_fkey(
          id, 
          first_name, 
          last_name, 
          employee_id, 
          role,
          department,
          position
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll record not found'
      });
    }

    // Format payslip data
    const payslip = {
      payrollId: payroll.id,
      employeeId: payroll.staff?.employee_id,
      employeeName: `${payroll.staff?.first_name} ${payroll.staff?.last_name}`,
      department: payroll.staff?.department,
      position: payroll.staff?.position,
      month: payroll.month,
      year: payroll.year,
      paymentDate: payroll.payment_date,
      
      earnings: {
        basicSalary: payroll.basic_salary,
        allowances: payroll.allowances || 0,
        overtimePay: payroll.overtime_pay || 0,
        grossSalary: payroll.gross_salary
      },
      
      deductions: {
        sha: payroll.sha_deduction || 0,
        nssf: payroll.nssf_deduction || 0,
        uniform: payroll.uniform_deduction || 0,
        contributions: payroll.contributions_deduction || 0,
        absentDays: payroll.absent_days || 0,
        absentDaysDeduction: payroll.absent_days_deduction || 0,
        tax: payroll.tax_deduction || 0,
        totalDeductions: payroll.total_deductions
      },
      
      netSalary: payroll.net_salary,
      workingDays: payroll.working_days || 26,
      status: payroll.status
    };

    res.status(200).json({
      success: true,
      data: payslip
    });
  } catch (error: any) {
    console.error('Error generating payslip:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate payslip'
    });
  }
};

// Internal calculation helper
async function calculatePayrollInternal(data: any) {
  const {
    basic_salary = 0,
    allowances = 0,
    overtime_pay = 0,
    uniform_deduction = 0,
    contributions_deduction = 0,
    absent_days = 0,
    working_days = 26,
    tax_deduction = 0
  } = data;

  // Get active deduction rates
  const { data: rates } = await supabase
    .from('payroll_deduction_rates')
    .select('*')
    .eq('is_active', true);

  const grossSalary = parseFloat(basic_salary) + parseFloat(allowances) + parseFloat(overtime_pay);

  const shaRate = rates?.find(r => r.deduction_type === 'SHA');
  const shaDeduction = shaRate ? (grossSalary * parseFloat(shaRate.rate_value)) / 100 : 0;

  const nssfRate = rates?.find(r => r.deduction_type === 'NSSF');
  let nssfDeduction = nssfRate ? (grossSalary * parseFloat(nssfRate.rate_value)) / 100 : 0;
  if (nssfRate?.max_amount && nssfDeduction > parseFloat(nssfRate.max_amount)) {
    nssfDeduction = parseFloat(nssfRate.max_amount);
  }

  const dailyRate = parseFloat(basic_salary) / working_days;
  const absentDaysDeduction = dailyRate * parseInt(absent_days);

  const totalDeductions = 
    shaDeduction +
    nssfDeduction +
    parseFloat(uniform_deduction) +
    parseFloat(contributions_deduction) +
    absentDaysDeduction +
    parseFloat(tax_deduction);

  const netSalary = grossSalary - totalDeductions;

  return {
    gross_salary: grossSalary,
    sha_deduction: shaDeduction,
    nssf_deduction: nssfDeduction,
    absent_days_deduction: absentDaysDeduction,
    total_deductions: totalDeductions,
    net_salary: netSalary
  };
}

// Bulk process payroll for multiple staff
export const bulkProcessPayroll = async (req: Request, res: Response) => {
  try {
    const { payrollRecords } = req.body;

    if (!Array.isArray(payrollRecords) || payrollRecords.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Payroll records array is required'
      });
    }

    // Calculate each record
    const processedRecords = await Promise.all(
      payrollRecords.map(async (record) => {
        const calculation = await calculatePayrollInternal(record);
        return { ...record, ...calculation };
      })
    );

    const { data, error } = await supabase
      .from('payroll')
      .insert(processedRecords)
      .select();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data,
      message: `${data.length} payroll records processed successfully`
    });
  } catch (error: any) {
    console.error('Error bulk processing payroll:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to bulk process payroll'
    });
  }
};
