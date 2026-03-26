import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

export class PayrollService {
  /**
   * Fetches active payroll policies for a specific branch or global
   */
  static async getActivePolicies(branchId?: number) {
    let query = supabase
      .from('payroll_policies')
      .select('*')
      .eq('is_active', true);
    
    if (branchId) {
      query = query.or(`branch_id.is.null,branch_id.eq.${branchId}`);
    } else {
      query = query.is('branch_id', null);
    }

    const { data, error } = await query;
    if (error) {
      logger.error('Error fetching payroll policies:', error);
      return [];
    }
    return data;
  }

  /**
   * Calculates a deduction based on a policy and gross pay
   */
  static applyPolicyRule(policy: any, gross: number): number {
    let amount = 0;
    switch (policy.formula_type) {
      case 'percentage':
        amount = gross * parseFloat(policy.rate || '0');
        break;
      case 'flat':
        amount = parseFloat(policy.rate || '0');
        break;
      case 'range':
        // Simplified range logic - could be expanded if needed
        amount = parseFloat(policy.rate || '0');
        break;
      default:
        return 0;
    }

    if (policy.min_limit && amount < parseFloat(policy.min_limit)) amount = parseFloat(policy.min_limit);
    if (policy.max_limit && amount > parseFloat(policy.max_limit)) amount = parseFloat(policy.max_limit);

    return Math.round(amount * 100) / 100;
  }

  static async calculatePAYE(gross: number): Promise<number> {
    // 1. Fetch PAYE bands from hr_settings (source of truth for tax)
    const { data: payeSetting } = await supabase
      .from('hr_settings')
      .select('value')
      .eq('key', 'paye_bands')
      .single();

    const { data: reliefSetting } = await supabase
      .from('hr_settings')
      .select('value')
      .eq('key', 'personal_relief')
      .single();

    if (!payeSetting) {
      // Fallback to internal logic if settings missing
      if (gross <= 24000) return 0;
      let paye = 0;
      if (gross > 24000) {
        if (gross <= 32333) paye = (gross - 24000) * 0.25;
        else {
          paye = (32333 - 24000) * 0.25;
          paye += (gross - 32333) * 0.30;
        }
      }
      return Math.max(0, Math.round((paye - 2400) * 100) / 100);
    }

    // Dynamic PAYE calculation from DB bands
    const bands = (payeSetting.value as any[]).sort((a, b) => a.threshold - b.threshold);
    const relief = (reliefSetting?.value as any)?.amount || 2400;
    
    let tax = 0;
    let prevThreshold = 0;
    for (const band of bands) {
      if (gross > prevThreshold) {
        const taxableInRange = Math.min(gross, band.threshold) - prevThreshold;
        tax += taxableInRange * band.rate;
        prevThreshold = band.threshold;
      } else break;
    }

    return Math.max(0, Math.round((tax - relief) * 100) / 100);
  }

  /**
   * Calculates absenteeism based on attendance records and policies
   */
  static async calculateAbsenteeism(staffId: string, month: number, year: number, basicSalary: number, policy?: any): Promise<{ amount: number; days: number }> {
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

    // 1. Check for missing shifts (Days where they didn't clock in but were expected)
    // For now, we fallback to 'unpaid leave' as the primary source of absenteeism
    const { data: unpaidLeave } = await supabase
      .from('staff_leave')
      .select('start_date, end_date')
      .eq('staff_id', staffId)
      .eq('leave_type', 'unpaid')
      .eq('status', 'approved')
      .gte('start_date', startDate)
      .lte('end_date', endDate);

    let absentDays = 0;
    if (unpaidLeave) {
      unpaidLeave.forEach(leave => {
        const start = new Date(Math.max(new Date(leave.start_date).getTime(), new Date(startDate).getTime()));
        const end = new Date(Math.min(new Date(leave.end_date).getTime(), new Date(endDate).getTime()));
        const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        absentDays += diffDays;
      });
    }

    // 2. Add lateness penalties if policy exists
    let latenessDeduction = 0;
    if (policy?.formula_type === 'attendance_based') {
       const { data: lateRecords } = await supabase
         .from('staff_attendance')
         .select('clock_in_lateness_minutes')
         .eq('staff_id', staffId)
         .eq('is_late', true)
         .gte('attendance_date', startDate)
         .lte('attendance_date', endDate);
       
       if (lateRecords) {
         // Example: 100 KES per 30 mins late
         const totalLateMinutes = lateRecords.reduce((sum, r) => sum + (r.clock_in_lateness_minutes || 0), 0);
         latenessDeduction = Math.floor(totalLateMinutes / 30) * (policy.rate || 0);
       }
    }

    const dailyRate = basicSalary / 26; // Standard 26 working days
    const totalAmount = Math.round((absentDays * dailyRate + latenessDeduction) * 100) / 100;
    
    return { amount: totalAmount, days: absentDays };
  }

  static async generateDynamicCalculation(
    staff: any, 
    month: number, 
    year: number,
    existingAdditions: any[] = [],
    existingDeductions: any[] = []
  ) {
    const basicSalary = parseFloat(staff.basic_salary || staff.salary || '0');
    let dynamicDeductions: any[] = [];
    let dynamicAdditions: any[] = [];

    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

    // 0. Fetch Branch Policies
    const policies = await this.getActivePolicies(staff.branch_id);

    // 1. Approved & Audited Advances
    const { data: advances } = await supabase
      .from('staff_advances')
      .select('id, amount, reason, accountant_id, auditor_id')
      .eq('staff_id', staff.user_id || staff.id) // Support both profile and user ID mappings
      .in('status', ['auditor_confirmed', 'approved']) // Strictly requirement: Audited/Approved
      .eq('month_to_deduct', month)
      .eq('year_to_deduct', year);

    if (advances) {
      for (const adv of advances) {
        dynamicDeductions.push({
          category: 'advance',
          source: 'system',
          source_table: 'staff_advances',
          source_id: adv.id,
          amount: parseFloat(adv.amount || '0'),
          reference: adv.reason || 'Salary advance',
          audit_ref: adv.auditor_id ? `Audited by ${adv.auditor_id}` : 'Approved',
          timestamp: new Date().toISOString()
        });
      }
    }

    // 2. Active Audited Loans
    const { data: loans } = await supabase
      .from('staff_loans')
      .select('id, installment_amount, remaining_balance, reason, auditor_id')
      .eq('staff_id', staff.user_id || staff.id)
      .in('status', ['active', 'auditor_confirmed']) // Strictly requirement: Audited/Active
      .gt('remaining_balance', 0)
      .or(`start_deduction_year.lt.${year},and(start_deduction_year.eq.${year},start_deduction_month.lte.${month})`);

    if (loans) {
      for (const loan of loans) {
        const installment = parseFloat(loan.installment_amount || '0');
        const remaining = parseFloat(loan.remaining_balance || '0');
        const amount = Math.min(installment, remaining);
        if (amount > 0) {
          dynamicDeductions.push({
            category: 'loan',
            source: 'system',
            source_table: 'staff_loans',
            source_id: loan.id,
            amount,
            reference: loan.reason || 'Loan repayment',
            audit_ref: loan.auditor_id ? `Audited by ${loan.auditor_id}` : 'Active',
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    // 3. Unpaid Credit Bills (Audited & within exact month range)
    const { data: bills } = await supabase
      .from('staff_credit_bills')
      .select('id, amount, description, status, accountant_id, auditor_id, source_logbook_id, cashier_logbooks(status)')
      .eq('staff_id', staff.user_id || staff.id)
      .is('paid_via_payroll_run_id', null)
      .in('status', ['accountant_confirmed', 'auditor_confirmed', 'approved', 'reconciled', 'audited']) 
      .lte('bill_date', endDate.split('T')[0]);  // End of current month

    if (bills) {
      for (const bill of bills) {
        // If the bill came from a logbook, we verify if that logbook is reconciled (approved)
        const sourceLogbook = (bill as any).cashier_logbooks;
        if (bill.source_logbook_id && sourceLogbook && sourceLogbook.status !== 'approved') {
          continue; // Skip if not yet reconciled by accountant/auditor
        }

        dynamicDeductions.push({
          category: 'credit_bills',
          source: 'system',
          source_table: 'staff_credit_bills',
          source_id: bill.id,
          amount: parseFloat(bill.amount || '0'),
          reference: bill.description || 'Credit bill',
          audit_ref: bill.auditor_id ? `Audited by ${bill.auditor_id}` : (bill.accountant_id ? `Approved by ${bill.accountant_id}` : (bill.source_logbook_id ? 'Logbook Reconciled' : 'Confirmed')),
          timestamp: new Date().toISOString()
        });
      }
    }

    // 4. Staff Payments in Cashier Logbook (Paid Bills - reduces deductions)
    // These are amounts the staff paid in cash/mpesa to the cashier, reconciled by accountant
    const { data: logbookPayments } = await supabase
      .from('cashier_logbook_lines')
      .select(`
        id, amount, reference, section,
        cashier_logbooks!inner(id, status, log_date)
      `)
      .eq('staff_id', staff.user_id || staff.id)
      .eq('section', 'paid_bill')
      .eq('cashier_logbooks.status', 'approved') // Only reconciled payments
      .gte('cashier_logbooks.log_date', startDate.split('T')[0])
      .lte('cashier_logbooks.log_date', endDate.split('T')[0]);

    if (logbookPayments) {
      for (const payment of logbookPayments) {
        dynamicDeductions.push({
          category: 'credit_bills', // Use credit bills category to offset
          source: 'system',
          source_table: 'cashier_logbook_lines',
          source_id: payment.id,
          amount: -parseFloat(payment.amount || '0'), // NEGATIVE amount to reduce deductions
          reference: `Payment Recorded in Logbook: ${payment.reference || 'Staff Payment'}`,
          audit_ref: 'Reconciled by Accountant',
          timestamp: new Date().toISOString()
        });
      }
    }

    // 5. Unpaid Bills in POS (Waiter/Staff items tracked in unpaid_bills table)
    const { data: posBills } = await supabase
      .from('unpaid_bills')
      .select('id, balance_amount, customer_name, bill_number, waiter_id, customer_id, accountant_id, auditor_id')
      .or(`waiter_id.eq.${staff.user_id || staff.id},customer_id.eq.${staff.user_id || staff.id}`)
      .eq('status', 'unpaid')
      .or('accountant_id.not.is.null,auditor_id.not.is.null') // Requirement 3 & 4: Only finalized/audited POS bills
      .gte('bill_date', startDate.split('T')[0]) 
      .lte('bill_date', endDate.split('T')[0]);

    if (posBills) {
      for (const pos of posBills) {
        dynamicDeductions.push({
          category: 'credit_bills', // Categorized as credit bill for payroll display
          source: 'system',
          source_table: 'unpaid_bills',
          source_id: pos.id,
          amount: parseFloat(pos.balance_amount || '0'),
          reference: `POS Bill: ${pos.bill_number} - ${pos.customer_name}`,
          audit_ref: pos.auditor_id ? `POS Audited by ${pos.auditor_id}` : (pos.accountant_id ? `POS Approved by ${pos.accountant_id}` : 'POS Confirmed'),
          timestamp: new Date().toISOString()
        });
      }
    }

    // 5. Absenteeism penalty (based on policy and attendance)
    const absentPolicy = policies.find(p => p.category === 'absenteeism');
    const absentInfo = await this.calculateAbsenteeism(staff.user_id || staff.id, month, year, basicSalary, absentPolicy);
    if (absentInfo.amount > 0) {
      dynamicDeductions.push({
        category: 'absenteeism',
        source: 'system',
        amount: absentInfo.amount,
        reference: `${absentInfo.days} days absent`,
        policy_id: absentPolicy?.id,
        timestamp: new Date().toISOString()
      });
    }

    // 5. Aggregate manual adjustments (from HR Dashboard)
    const { data: hrAdjustments } = await supabase
      .from('staff_payroll_adjustments')
      .select('id, type, category, amount, description, created_by')
      .eq('staff_id', staff.user_id || staff.id)
      .eq('month', String(month))
      .eq('year', year)
      .in('status', ['pending', 'applied', 'Pending', 'Applied', 'APPLIED', 'PENDING']);

    if (hrAdjustments) {
      for (const adj of hrAdjustments) {
        const item = {
          category: (adj.category || 'other').toLowerCase(),
          source: 'manual',
          source_table: 'staff_payroll_adjustments',
          source_id: adj.id,
          amount: parseFloat(adj.amount || '0'),
          reference: adj.description || `HR ${adj.type}`,
          audit_ref: `Created by ${adj.created_by}`,
          timestamp: new Date().toISOString()
        };
        if (adj.type === 'addition') {
          dynamicAdditions.push(item);
        } else {
          dynamicDeductions.push(item);
        }
      }
    }

    // Preserve any purely static JSON additions/deductions (rare/fallback)
    const customAdditions = (existingAdditions || []).filter(a => a.source === 'manual' && !a.source_table);
    const customDeductions = (existingDeductions || []).filter(d => d.source === 'manual' && !d.source_table);

    const totalAdditions = [...dynamicAdditions, ...customAdditions].reduce((sum, item) => sum + parseFloat(item.amount), 0);
    const grossPay = basicSalary + totalAdditions;

    // 6. Policy-Driven Statutory Deductions (Requirement 2C: Enrolled only)
    const statutoryCategories = [
      { cat: 'shif', enabled: staff.shif_enabled },
      { cat: 'nssf', enabled: staff.nssf_enabled },
      { cat: 'uniform', enabled: staff.uniform_enabled }
    ];

    for (const stat of statutoryCategories) {

      if (!stat.enabled) continue; // "SET IF THE EMPLOYEE HAS ONE"

      const policy = policies.find(p => p.category === stat.cat);
      if (policy) {
        const amount = this.applyPolicyRule(policy, grossPay);
        if (amount > 0) {
          dynamicDeductions.push({
            category: stat.cat,
            source: 'policy',
            policy_id: policy.id,
            amount,
            reference: policy.name,
            audit_ref: `Formula: ${policy.formula_type} (${policy.rate})`,
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    // NOTE: PAYE Tax is NOT calculated here per business requirements.
    // Deductions are strictly: Credit Bills, Loans, Advances, Absenteeism, SHIF, NSSF, Uniform.

    const allDeductions = [...dynamicDeductions, ...customDeductions];
    const totalDeductions = allDeductions.reduce((sum, item) => sum + parseFloat(item.amount), 0);
    const netPay = Math.max(0, grossPay - totalDeductions);

    // Collect all traceable items
    const traceable_items = [...dynamicAdditions, ...dynamicDeductions]
      .filter(item => item.source_table || item.source === 'policy');

    return {
      basic_salary: basicSalary,
      additions: [...dynamicAdditions, ...customAdditions],
      deductions: allDeductions,
      total_additions: totalAdditions,
      total_deductions: totalDeductions,
      gross_pay: grossPay,
      net_pay: netPay,
      traceable_items
    };
  }
}
