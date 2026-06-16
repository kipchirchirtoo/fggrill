import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

export class PayrollService {
  static async getActivePolicies(branchId?: number) {
    let query = supabase.from('payroll_policies').select('*').eq('is_active', true);
    if (branchId) {
      query = query.or(`branch_id.is.null,branch_id.eq.${branchId}`);
    } else {
      query = query.is('branch_id', null);
    }
    const { data, error } = await query;
    if (error) { logger.error('Error fetching payroll policies:', error); return []; }
    return data || [];
  }

  static applyPolicyRule(policy: any, gross: number): number {
    let amount = 0;
    switch (policy.formula_type) {
      case 'percentage': amount = gross * parseFloat(policy.rate || '0'); break;
      case 'flat':       amount = parseFloat(policy.rate || '0'); break;
      case 'range':      amount = parseFloat(policy.rate || '0'); break;
      default: return 0;
    }
    if (policy.min_limit && amount < parseFloat(policy.min_limit)) amount = parseFloat(policy.min_limit);
    if (policy.max_limit && amount > parseFloat(policy.max_limit)) amount = parseFloat(policy.max_limit);
    return Math.round(amount * 100) / 100;
  }

  /**
   * Batch-fetch all payroll data for a list of staff in one pass.
   * Returns maps keyed by staff_profile.id for O(1) lookup per staff.
   */
  static async fetchBatchData(staffIds: string[], month: number, year: number) {
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate   = new Date(year, month, 0, 23, 59, 59, 999).toISOString().split('T')[0];

    const [
      advancesRes,
      loansRes,
      billsRes,
      logbookRes,
      posBillsRes,
      leaveRes,
      latenessRes,
      hrAdjRes,
    ] = await Promise.all([
      // 1. Advances
      supabase.from('staff_advances')
        .select('id, staff_id, amount, reason, accountant_id, auditor_id')
        .in('staff_id', staffIds)
        .in('status', ['auditor_confirmed', 'approved'])
        .eq('month_to_deduct', month)
        .eq('year_to_deduct', year),

      // 2. Loans
      supabase.from('staff_loans')
        .select('id, staff_id, installment_amount, remaining_balance, reason, auditor_id')
        .in('staff_id', staffIds)
        .in('status', ['active', 'auditor_confirmed'])
        .gt('remaining_balance', 0),

      // 3. Credit bills
      supabase.from('staff_credit_bills')
        .select('id, staff_id, amount, paid_amount, balance, description, status, accountant_id, auditor_id')
        .in('staff_id', staffIds)
        .is('paid_via_payroll_run_id', null)
        .in('status', ['pending', 'partial', 'accountant_confirmed', 'auditor_confirmed', 'approved', 'reconciled', 'audited'])
        .lte('bill_date', endDate),

      // 4. Logbook payments (staff paid cash — offsets credit bills)
      supabase.from('cashier_logbook_lines')
        .select('id, staff_id, amount, reference, cashier_logbooks!inner(status, log_date)')
        .in('staff_id', staffIds)
        .eq('section', 'paid_bill')
        .eq('cashier_logbooks.status', 'approved')
        .gte('cashier_logbooks.log_date', startDate)
        .lte('cashier_logbooks.log_date', endDate),

      // 5. POS unpaid bills
      supabase.from('unpaid_bills')
        .select('id, waiter_id, customer_id, balance_amount, customer_name, bill_number, accountant_id, auditor_id')
        .in('waiter_id', staffIds)
        .eq('status', 'unpaid')
        .or('accountant_id.not.is.null,auditor_id.not.is.null')
        .gte('bill_date', startDate)
        .lte('bill_date', endDate),

      // 6. Unpaid leave (absenteeism)
      supabase.from('staff_leave')
        .select('staff_id, start_date, end_date')
        .in('staff_id', staffIds)
        .eq('leave_type', 'unpaid')
        .eq('status', 'approved')
        .gte('start_date', startDate)
        .lte('end_date', endDate),

      // 7. Lateness records
      supabase.from('staff_attendance')
        .select('staff_id, clock_in_lateness_minutes')
        .in('staff_id', staffIds)
        .eq('is_late', true)
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate),

      // 8. HR manual adjustments — include pending + approved + applied
      supabase.from('staff_payroll_adjustments')
        .select('id, staff_id, type, category, amount, description, created_by')
        .in('staff_id', staffIds)
        .eq('month', String(month))
        .eq('year', year)
        .in('status', ['pending', 'approved', 'applied']),
    ]);

    // Group everything by staff_id
    const group = (rows: any[] | null) => {
      const map = new Map<string, any[]>();
      for (const row of rows || []) {
        const arr = map.get(row.staff_id) || [];
        arr.push(row);
        map.set(row.staff_id, arr);
      }
      return map;
    };

    return {
      advances:        group(advancesRes.data),
      loans:           group(loansRes.data),
      bills:           group(billsRes.data),
      logbookPayments: group(logbookRes.data as any),
      posBills:        new Map<string, any[]>(), // handled separately below (waiter_id)
      posBillsRaw:     posBillsRes.data || [],
      leave:           group(leaveRes.data),
      lateness:        group(latenessRes.data),
      hrAdjustments:   group(hrAdjRes.data),
      startDate,
      endDate,
    };
  }

  /**
   * Calculate payroll for a single staff member using pre-fetched batch data.
   * Zero DB calls — pure in-memory computation.
   */
  static calculateFromBatch(
    staff: any,
    month: number,
    year: number,
    batchData: Awaited<ReturnType<typeof PayrollService.fetchBatchData>>,
    policies: any[],
    existingAdditions: any[] = [],
    existingDeductions: any[] = []
  ) {
    const basicSalary = parseFloat(staff.basic_salary || staff.salary || '0');
    const dynamicDeductions: any[] = [];
    const dynamicAdditions: any[] = [];
    const ts = new Date().toISOString();
    const { startDate, endDate } = batchData;

    // 1. Advances
    for (const adv of batchData.advances.get(staff.id) || []) {
      dynamicDeductions.push({
        category: 'advance', source: 'system',
        source_table: 'staff_advances', source_id: adv.id,
        amount: parseFloat(adv.amount || '0'),
        reference: adv.reason || 'Salary advance',
        audit_ref: adv.auditor_id ? `Audited by ${adv.auditor_id}` : 'Approved',
        timestamp: ts,
      });
    }

    // 2. Loans
    for (const loan of batchData.loans.get(staff.id) || []) {
      const installment = parseFloat(loan.installment_amount || '0');
      const remaining   = parseFloat(loan.remaining_balance  || '0');
      const amount = Math.min(installment, remaining);
      if (amount > 0) {
        dynamicDeductions.push({
          category: 'loan', source: 'system',
          source_table: 'staff_loans', source_id: loan.id,
          amount,
          reference: loan.reason || 'Loan repayment',
          audit_ref: loan.auditor_id ? `Audited by ${loan.auditor_id}` : 'Active',
          timestamp: ts,
        });
      }
    }

    // 3. Credit bills (Differentiate between staff credits and migrated unpaid bills)
    for (const bill of batchData.bills.get(staff.id) || []) {
      const isUnpaidBill = (bill.description || '').toLowerCase().includes('unsettled') || 
                           (bill.description || '').toLowerCase().includes('pending order');
      const billAmount = parseFloat(bill.amount || '0');
      const paidAmount = parseFloat(bill.paid_amount || '0');
      const storedBalance = bill.balance === null || bill.balance === undefined
        ? NaN
        : parseFloat(bill.balance || '0');
      const outstandingAmount = Number.isFinite(storedBalance)
        ? Math.max(0, storedBalance)
        : Math.max(0, billAmount - paidAmount);
      if (outstandingAmount <= 0) continue;
      
      dynamicDeductions.push({
        category: isUnpaidBill ? 'unpaid_bills' : 'credit_bills',
        source: 'system',
        source_table: 'staff_credit_bills', source_id: bill.id,
        amount: outstandingAmount,
        reference: bill.description || 'Credit bill',
        audit_ref: bill.auditor_id ? `Audited by ${bill.auditor_id}` : (bill.accountant_id ? `Approved by ${bill.accountant_id}` : 'Pending'),
        timestamp: ts,
      });
    }

    // 4. Cashier paid-credit entries are branch-accountant evidence only.
    // They are applied through the branch accountant partial/full payment flow,
    // so payroll reads the remaining staff_credit_bills balance above.

    // 5. POS unpaid bills (explicitly tagged as unpaid_bills)
    for (const pos of batchData.posBillsRaw) {
      if (pos.waiter_id === staff.id || pos.customer_id === staff.id) {
        dynamicDeductions.push({
          category: 'unpaid_bills', source: 'system',
          source_table: 'unpaid_bills', source_id: pos.id,
          amount: parseFloat(pos.balance_amount || '0'),
          reference: `POS Bill: ${pos.bill_number} - ${pos.customer_name}`,
          audit_ref: pos.auditor_id ? `POS Audited by ${pos.auditor_id}` : (pos.accountant_id ? `POS Approved by ${pos.accountant_id}` : 'POS Confirmed'),
          timestamp: ts,
        });
      }
    }

    // 6. Absenteeism
    const absentPolicy = policies.find(p => p.category === 'absenteeism');
    let absentDays = 0;
    const periodStart = new Date(startDate).getTime();
    const periodEnd   = new Date(endDate).getTime();
    for (const leave of batchData.leave.get(staff.id) || []) {
      const s = Math.max(new Date(leave.start_date).getTime(), periodStart);
      const e = Math.min(new Date(leave.end_date).getTime(),   periodEnd);
      if (e >= s) absentDays += Math.ceil((e - s) / 86400000) + 1;
    }
    let latenessDeduction = 0;
    if (absentPolicy?.formula_type === 'attendance_based') {
      const totalLateMinutes = (batchData.lateness.get(staff.id) || [])
        .reduce((sum: number, r: any) => sum + (r.clock_in_lateness_minutes || 0), 0);
      latenessDeduction = Math.floor(totalLateMinutes / 30) * (absentPolicy.rate || 0);
    }
    const dailyRate = basicSalary / 26;
    const absentAmount = Math.round((absentDays * dailyRate + latenessDeduction) * 100) / 100;
    if (absentAmount > 0) {
      dynamicDeductions.push({
        category: 'absenteeism', source: 'system',
        amount: absentAmount,
        reference: `${absentDays} days absent`,
        policy_id: absentPolicy?.id,
        timestamp: ts,
      });
    }

    // 7. HR manual adjustments
    for (const adj of batchData.hrAdjustments.get(staff.id) || []) {
      const adjType = (adj.type || 'deduction').toLowerCase();
      const item = {
        category: (adj.category || 'other').toLowerCase(),
        source: 'manual',
        source_table: 'staff_payroll_adjustments', source_id: adj.id,
        amount: parseFloat(adj.amount || '0'),
        reference: adj.description || `HR ${adjType}`,
        audit_ref: `Created by ${adj.created_by}`,
        timestamp: ts,
      };
      if (adjType === 'addition') dynamicAdditions.push(item);
      else dynamicDeductions.push(item);
    }

    // Preserve purely static manual entries
    const normalizeArr = (val: any): any[] => {
      if (Array.isArray(val)) return val;
      if (val && typeof val === 'object') return Object.values(val);
      return [];
    };
    const customAdditions = normalizeArr(existingAdditions).filter(a => a.source === 'manual' && !a.source_table);
    const customDeductions = normalizeArr(existingDeductions).filter(d => d.source === 'manual' && !d.source_table);

    const totalAdditions = [...dynamicAdditions, ...customAdditions].reduce((s, i) => s + parseFloat(i.amount), 0);
    const grossPay = basicSalary + totalAdditions;

    // 8. Statutory deductions (policy-driven, enrolled only)
    for (const stat of [
      { cat: 'shif',    enabled: staff.shif_enabled },
      { cat: 'nssf',    enabled: staff.nssf_enabled },
      { cat: 'uniform', enabled: staff.uniform_enabled },
    ]) {
      if (!stat.enabled) continue;
      const policy = policies.find(p => p.category === stat.cat);
      if (policy) {
        const amount = this.applyPolicyRule(policy, grossPay);
        if (amount > 0) {
          dynamicDeductions.push({
            category: stat.cat, source: 'policy',
            policy_id: policy.id, amount,
            reference: policy.name,
            audit_ref: `Formula: ${policy.formula_type} (${policy.rate})`,
            timestamp: ts,
          });
        }
      }
    }

    const allDeductions = [...dynamicDeductions, ...customDeductions];
    const totalDeductions = allDeductions.reduce((s, i) => s + parseFloat(i.amount), 0);
    const netPay = Math.max(0, grossPay - totalDeductions);

    return {
      basic_salary: basicSalary,
      additions: [...dynamicAdditions, ...customAdditions],
      deductions: allDeductions,
      total_additions: totalAdditions,
      total_deductions: totalDeductions,
      gross_pay: grossPay,
      net_pay: netPay,
    };
  }

  /** Legacy per-staff method — kept for compatibility but now delegates to batch helpers */
  static async generateDynamicCalculation(
    staff: any,
    month: number,
    year: number,
    existingAdditions: any[] = [],
    existingDeductions: any[] = []
  ) {
    const policies  = await this.getActivePolicies(staff.branch_id);
    const batchData = await this.fetchBatchData([staff.id], month, year);
    return this.calculateFromBatch(staff, month, year, batchData, policies, existingAdditions, existingDeductions);
  }
}
