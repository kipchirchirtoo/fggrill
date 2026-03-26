import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { PayrollService } from '../services/payroll.service';
import { generatePayslipPDF, generatePayrollSummaryPDF } from '../utils/pdfGenerator';
import { generateBrandedPayrollSummaryV2 } from '../services/native-pdf-reports.service';

// HELPER: Ensure a draft run exists
async function getOrCreateDraftRun(month: number, year: number, reqUser: any) {
  const { data: existingRun } = await supabase
    .from('payroll_runs')
    .select('*')
    .eq('month', month)
    .eq('year', year)
    .maybeSingle();

  if (existingRun) return existingRun;

  const { data: newRun, error } = await supabase
    .from('payroll_runs')
    .insert([{ month, year, created_by: reqUser?.id }])
    .select()
    .single();

  // Handle race condition: another request may have inserted concurrently
  if (error) {
    if (error.code === '23505') {
      // Duplicate key — fetch the row that was just inserted by the other request
      const { data: racedRun, error: fetchError } = await supabase
        .from('payroll_runs')
        .select('*')
        .eq('month', month)
        .eq('year', year)
        .single();
      if (fetchError) throw fetchError;
      return racedRun;
    }
    throw error;
  }
  return newRun;
}

// @desc    Get Draft Payroll (Dynamic recalculation)
// @route   GET /api/payroll/draft
// @access  Private (Admin, HR)
export const getDraftPayroll = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const month = parseInt(req.query.month as string);
    const year = parseInt(req.query.year as string);
    const branch_id = req.query.branch_id ? parseInt(req.query.branch_id as string) : null;

    if (!month || !year) {
      res.status(400).json({ success: false, message: 'Month and year are required' });
      return;
    }

    // 1. Get or Create the Run
    const run = await getOrCreateDraftRun(month, year, req.user);

    // If approved or downloaded, just return the static locked records
    if (run.status !== 'draft') {
      let query = supabase
        .from('payroll_records')
        .select(`*, employee:users!staff_id(id, first_name, last_name, email)`)
        .eq('payroll_run_id', run.id);
        
      if (branch_id) query = query.eq('branch_id', branch_id);
      
      const { data: staticRecords, error } = await query;
      if (error) throw error;
      
      res.status(200).json({ success: true, data: { run, records: staticRecords } });
      return;
    }

    // 2. Fetch Active Staff with valid user accounts (staff_id in payroll_records FK references users)
    let staffQuery = supabase
      .from('staff_profiles')
      .select('*, user:users!user_id(id, first_name, last_name)')
      .eq('status', 'active')
      .not('user_id', 'is', null);
    if (branch_id) staffQuery = staffQuery.eq('branch_id', branch_id);
    const { data: rawStaffList } = await staffQuery;
    // Filter out any whose user join came back null (user row deleted but profile remains)
    const staffList = (rawStaffList || []).filter(s => s.user !== null);
    logger.info(`Payroll draft: ${staffList.length} eligible staff (${(rawStaffList || []).length} total active, filtered ${(rawStaffList || []).length - staffList.length} with no user)`);

    // 3. Fetch Existing Draft Records to preserve manual JSON entries
    const { data: existingRecords } = await supabase
      .from('payroll_records')
      .select('*')
      .eq('payroll_run_id', run.id);

    const existingMap = new Map(existingRecords?.map(r => [r.staff_id, r]) || []);

    // 4. Dynamically Recalculate
    const recordsToUpsert = [];

    for (const staff of staffList) {
      const existing = existingMap.get(staff.user_id) || { additions: [], deductions: [] };
      
      const calculatedInfo = await PayrollService.generateDynamicCalculation(
        staff,
        month,
        year,
        existing.additions,
        existing.deductions
      );

      (staff as any).calculatedInfo = calculatedInfo;

      recordsToUpsert.push({
        payroll_run_id: run.id,
        staff_id: staff.user_id,
        branch_id: staff.branch_id,
        employee_name: `${staff.user.first_name} ${staff.user.last_name}`,
        employee_code: staff.employee_id || staff.id_number || staff.id || 'N/A',
        national_id: staff.national_id || staff.id_number || 'N/A',
        basic_salary: calculatedInfo.basic_salary,
        shif: (calculatedInfo.deductions || []).filter((d: any) => (d.category || '').toLowerCase() === 'shif').reduce((s: number, d: any) => s + (parseFloat(d.amount) || 0), 0),
        nssf: (calculatedInfo.deductions || []).filter((d: any) => (d.category || '').toLowerCase() === 'nssf').reduce((s: number, d: any) => s + (parseFloat(d.amount) || 0), 0),
        additions: calculatedInfo.additions,
        deductions: calculatedInfo.deductions,
        total_additions: calculatedInfo.total_additions,
        total_deductions: calculatedInfo.total_deductions,
        gross_pay: calculatedInfo.gross_pay,
        net_pay: calculatedInfo.net_pay
      });
    }

    // 5. Bulk Upsert Draft Records
    if (recordsToUpsert.length > 0) {
      const { data: upsertedRecords, error: upsertError } = await supabase
        .from('payroll_records')
        .upsert(recordsToUpsert, { onConflict: 'payroll_run_id, staff_id' })
        .select();
      
      if (upsertError) throw upsertError;
      logger.info(`Upserted ${recordsToUpsert.length} payroll records for run ${run.id}`);

      // 5.1. Save Traceable Items (staff_payroll_items)
      const payrollItems: any[] = [];
      for (const rec of upsertedRecords || []) {
        const sourceData = recordsToUpsert.find(r => r.staff_id === rec.staff_id);
        if (sourceData) {
          // Flatten additions and deductions into items table
          [...sourceData.additions, ...sourceData.deductions].forEach(item => {
            payrollItems.push({
              payroll_id: rec.id, // Reference to the record we just saved
              category: item.category || item.type,
              amount: item.amount,
              source_table: item.source_table || null,
              source_id: item.source_id || null,
              policy_id: item.policy_id || null,
              reference: item.reference,
              approval_status: item.audit_ref ? 'audited' : 'system_calculated'
            });
          });
        }
      }

      if (payrollItems.length > 0) {
        // Delete old items for these records first to avoid duplicates on recalculation
        const recordIds = (upsertedRecords || []).map(r => r.id);
        await supabase.from('staff_payroll_items').delete().in('payroll_id', recordIds);
        
        const { error: itemsError } = await supabase.from('staff_payroll_items').insert(payrollItems);
        if (itemsError) logger.error(`Error saving payroll items: ${itemsError.message}`);
      }
    } else {
      logger.warn(`No staff to upsert for payroll run ${run.id} (month=${month}, year=${year})`);
    }

    // 6. Return Draft Response
    let finalQuery = supabase
      .from('payroll_records')
      .select(`
        *, 
        items:staff_payroll_items(*),
        employee:users!staff_id(id, first_name, last_name, email)
      `)
      .eq('payroll_run_id', run.id);

    if (branch_id) finalQuery = finalQuery.eq('branch_id', branch_id);

    const { data: finalDraftRecords, error: fetchError } = await finalQuery;

    if (fetchError) logger.error(`Error fetching final draft records: ${fetchError.message}`);
    logger.info(`Final draft records count: ${finalDraftRecords?.length ?? 0} for run ${run.id}`);

    // Update Run Totals for the Draft
    const totals = finalDraftRecords?.reduce((acc, r) => ({
      basic: acc.basic + parseFloat(r.basic_salary),
      gross: acc.gross + parseFloat(r.gross_pay),
      deductions: acc.deductions + parseFloat(r.total_deductions),
      net: acc.net + parseFloat(r.net_pay)
    }), { basic: 0, gross: 0, deductions: 0, net: 0 }) || { basic: 0, gross: 0, deductions: 0, net: 0 };

    await supabase.from('payroll_runs').update({
      total_basic_salary: totals.basic,
      total_gross_pay: totals.gross,
      total_deductions: totals.deductions,
      total_net_pay: totals.net,
    }).eq('id', run.id);

    const updatedRun = { ...run, ...totals };

    res.status(200).json({ success: true, data: { run: updatedRun, records: finalDraftRecords } });

  } catch (error) {
    next(error);
  }
};

// @desc    Approve & Lock Payroll
// @route   POST /api/payroll/approve
// @access  Private (Admin)
export const approvePayroll = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { runId } = req.body;

    // 1. Ensure run exists and is in draft
    const { data: run, error: runError } = await supabase
      .from('payroll_runs')
      .select('*')
      .eq('id', runId)
      .single();

    if (runError || !run) {
      res.status(404).json({ success: false, message: 'Payroll run not found' });
      return;
    }

    if (run.status !== 'draft') {
      res.status(400).json({ success: false, message: 'Payroll run is already approved/locked' });
      return;
    }

    // 2. Lock the run
    const { error: updateError } = await supabase
      .from('payroll_runs')
      .update({
        status: 'approved',
        approved_by: req.user?.id,
        approved_at: new Date().toISOString()
      })
      .eq('id', runId);

    if (updateError) throw updateError;

    // 3. Update related items to mark them as paid/deducted (ONLY if net_pay > 0)
    // Fetch all records with their net_pay to check eligibility for reset
    const { data: recordsData } = await supabase
      .from('payroll_records')
      .select('id, staff_id, net_pay')
      .eq('payroll_run_id', runId);
    
    const records = recordsData || [];
    const validRecordIds = records.filter(r => parseFloat(r.net_pay || 0) > 0).map(r => r.id);

    if (validRecordIds.length > 0) {
      const { data: items } = await supabase
        .from('staff_payroll_items')
        .select('category, source_table, source_id, amount, staff_id')
        .in('payroll_id', validRecordIds);
      
      if (items) {
        for (const item of items) {
          if (!item.source_table || !item.source_id) continue;

          // Update the source record status based on table type
          if (item.source_table === 'staff_credit_bills') {
            await supabase.from('staff_credit_bills').update({ status: 'deducted', paid_via_payroll_run_id: runId }).eq('id', item.source_id);
          } else if (item.source_table === 'staff_payroll_adjustments') {
            await supabase.from('staff_payroll_adjustments').update({ status: 'applied', payroll_id: runId }).eq('id', item.source_id);
          } else if (item.source_table === 'staff_advances') {
            await supabase.from('staff_advances').update({ status: 'deducted', deducted_in_payroll_id: runId }).eq('id', item.source_id);
          } else if (item.source_table === 'unpaid_bills') {
             await supabase.from('unpaid_bills').update({ status: 'deducted' }).eq('id', item.source_id);
          } else if (item.source_table === 'staff_loans') {
            const { data: loan } = await supabase.from('staff_loans').select('remaining_balance').eq('id', item.source_id).single();
            if (loan) {
               const newBalance = Math.max(0, parseFloat(loan.remaining_balance) - parseFloat(item.amount));
               await supabase.from('staff_loans').update({ 
                 remaining_balance: newBalance,
                 status: newBalance <= 0 ? 'paid' : 'active'
               }).eq('id', item.source_id);
            }
          }
        }
      }
    }

    res.status(200).json({ success: true, message: 'Payroll approved and locked successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Add manual adjustment (Addition/Deduction)
// @route   POST /api/payroll/adjustments
// @access  Private (Admin, HR)
export const addAdjustment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let { recordId, staff_id, month, year, type, source, amount, reference, isAddition } = req.body;

    // 1. If recordId is missing but we have staff info, find it
    if (!recordId && staff_id && month && year) {
        const { data: run } = await supabase
          .from('payroll_runs')
          .select('id')
          .eq('month', parseInt(month as string))
          .eq('year', parseInt(year as string))
          .single();
        
        if (run) {
          const { data: rec } = await supabase
            .from('payroll_records')
            .select('id')
            .eq('payroll_run_id', run.id)
            .eq('staff_id', staff_id)
            .single();
          if (rec) recordId = rec.id;
        }
    }

    if (!recordId) {
      res.status(404).json({ success: false, message: 'Payroll record not found for this period. Please load the draft first.' });
      return;
    }

    const { data: record, error: fetchError } = await supabase
      .from('payroll_records')
      .select('*, payroll_runs!inner(status)')
      .eq('id', recordId)
      .single();

    if (fetchError || !record) {
      res.status(404).json({ success: false, message: 'Record not found' });
      return;
    }

    // Prevent edit if locked
    if ((record.payroll_runs as any).status !== 'draft') {
      res.status(400).json({ success: false, message: 'Cannot edit locked payroll' });
      return;
    }

    const adjustment = {
      type,
      source: source || 'manual',
      amount: parseFloat(amount),
      reference: reference || '',
      timestamp: new Date().toISOString()
    };

    let updateData: any = {};
    if (isAddition) {
      const additions = [...(record.additions as any[]), adjustment];
      updateData.additions = additions;
    } else {
      const deductions = [...(record.deductions as any[]), adjustment];
      updateData.deductions = deductions;
    }

    // Update the record JSON. Totals will be recalculated on the next GET /draft fetch!
    const { error: updateError } = await supabase
      .from('payroll_records')
      .update(updateData)
      .eq('id', recordId);

    if (updateError) throw updateError;

    res.status(200).json({ success: true, message: 'Adjustment saved. Refresh to recalculate.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get manual adjustments for a specific staff member and period
// @route   GET /api/payroll/adjustments
// @access  Private (Admin, HR, Auditor)
export const getAdjustments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { staff_id, month, year } = req.query;

    if (!staff_id || !month || !year) {
      res.status(400).json({ success: false, message: 'Missing staff_id, month, or year' });
      return;
    }

    // 1. Find the payroll run for this period
    const { data: run } = await supabase
      .from('payroll_runs')
      .select('id')
      .eq('month', parseInt(month as string))
      .eq('year', parseInt(year as string))
      .single();

    if (!run) {
      res.status(404).json({ success: false, message: 'Payroll run not found for this period' });
      return;
    }

    // 2. Find the record for this staff in this run
    const { data: record, error } = await supabase
      .from('payroll_records')
      .select('additions, deductions')
      .eq('payroll_run_id', run.id)
      .eq('staff_id', staff_id)
      .single();

    if (error || !record) {
      res.status(200).json({ success: true, data: { additions: [], deductions: [] } });
      return;
    }

    res.status(200).json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
};

// @desc    Get history list of payroll runs
// @route   GET /api/payroll/history
export const getPayrollHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('payroll_runs')
      .select('*, approver:users!approved_by(first_name, last_name)')
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate individual payslip PDF
// @route   GET /api/payroll/:id/payslip
export const generatePayslip = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const { data: record, error } = await supabase
      .from('payroll_records')
      .select(`
        *,
        run:payroll_runs!payroll_run_id(month, year, status),
        staff:staff_profiles!inner(
          id, id_number, national_id, phone, department, role, position,
          bank_name, account_number, kra_pin, employment_type,
          user:users!user_id(first_name, last_name, email)
        )
      `)
      .eq('id', id)
      .single();

    if (error || !record) {
      res.status(404).json({ success: false, message: 'Payroll record not found' });
      return;
    }

    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const monthName = MONTHS[(record.run?.month || 1) - 1];

    // Extract deduction amounts by type
    const deductions: any[] = record.deductions || [];
    const getAmt = (type: string) => deductions.filter(d => d.type === type).reduce((s: number, d: any) => s + parseFloat(d.amount || 0), 0);

    const pdfBuffer = await generatePayslipPDF({
      month: monthName,
      year: record.run?.year || new Date().getFullYear(),
      base_salary: parseFloat(record.basic_salary || 0),
      overtime_pay: 0,
      allowances: parseFloat(record.total_additions || 0),
      gross_pay: parseFloat(record.gross_pay || 0),
      nssf_deduction: getAmt('nssf'),
      shif_deduction: getAmt('shif'),
      total_deductions: parseFloat(record.total_deductions || 0),
      net_salary: parseFloat(record.net_pay || 0),
      employee: {
        national_id: record.staff?.national_id || record.national_id || 'N/A',
        kra_pin: record.staff?.kra_pin || 'N/A',
        employee_type: record.staff?.employment_type || record.staff?.role || 'Staff',
        department: record.staff?.department || 'General',
        bank_name: record.staff?.bank_name || 'N/A',
        bank_account_number: record.staff?.account_number || 'N/A',
        user: {
          first_name: record.staff?.user?.first_name || record.employee_name?.split(' ')[0] || '',
          last_name: record.staff?.user?.last_name || record.employee_name?.split(' ').slice(1).join(' ') || '',
        }
      },
      company: 'Famous Gates Hotels',
      company_email: 'info@famousgatehotels.com',
      company_address: 'Bomet, Kenya'
    });

    const filename = `Payslip_${record.employee_name?.replace(/\s+/g, '_')}_${monthName}_${record.run?.year}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

// @desc    Download all payslips as ZIP for a payroll run
// @route   GET /api/payroll/run/:runId/payslips-zip
export const downloadPayslipsZip = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { runId } = req.params;
    const { branch_id } = req.query;

    const { data: run, error: runError } = await supabase
      .from('payroll_runs')
      .select('*')
      .eq('id', runId)
      .single();

    if (runError || !run) {
      res.status(404).json({ success: false, message: 'Payroll run not found' });
      return;
    }

    let query = supabase
      .from('payroll_records')
      .select('*')
      .eq('payroll_run_id', runId);
    
    if (branch_id && branch_id !== '0') {
      query = query.eq('branch_id', branch_id);
    }

    const { data: records, error } = await query;

    if (error) throw error;
    if (!records || records.length === 0) {
      res.status(404).json({ success: false, message: 'No payroll records found for this run' });
      return;
    }

    // Fetch staff profile data separately (payroll_records.staff_id FK → users, not staff_profiles directly)
    const staffIds = records.map(r => r.staff_id).filter(Boolean);
    const { data: staffProfiles } = await supabase
      .from('staff_profiles')
      .select('id, national_id, phone, department, role, bank_name, account_number, kra_pin, employment_type, user_id')
      .in('user_id', staffIds);
    const staffMap = new Map((staffProfiles || []).map(s => [s.user_id, s]));

    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const monthName = MONTHS[(run.month || 1) - 1];

    const archiver = require('archiver');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="Payslips_${monthName}_${run.year}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err: any) => { if (!res.headersSent) res.status(500).json({ success: false, message: err.message }); });
    archive.pipe(res);

    for (const record of records) {
      try {
        const staff = staffMap.get(record.staff_id);
        const deductions: any[] = record.deductions || [];
        const getAmt = (cat: string) => deductions.filter((d: any) => d.category === cat).reduce((s: number, d: any) => s + parseFloat(d.amount || 0), 0);

        const pdfBuffer = await generatePayslipPDF({
          month: monthName,
          year: run.year,
          base_salary: parseFloat(record.basic_salary || 0),
          overtime_pay: 0,
          allowances: parseFloat(record.total_additions || 0),
          gross_pay: parseFloat(record.gross_pay || 0),
          nssf_deduction: getAmt('nssf'),
          shif_deduction: getAmt('shif'),
          total_deductions: parseFloat(record.total_deductions || 0),
          net_salary: parseFloat(record.net_pay || 0),
          employee: {
            national_id: staff?.national_id || record.national_id || 'N/A',
            kra_pin: staff?.kra_pin || 'N/A',
            employee_type: staff?.employment_type || staff?.role || 'Staff',
            department: staff?.department || 'General',
            bank_name: staff?.bank_name || 'N/A',
            bank_account_number: staff?.account_number || 'N/A',
            user: {
              first_name: record.employee_name?.split(' ')[0] || '',
              last_name: record.employee_name?.split(' ').slice(1).join(' ') || '',
            }
          },
          company: 'Famous Gates Hotels',
          company_email: 'info@famousgatehotels.com',
          company_address: 'Bomet, Kenya'
        });

        const filename = `Payslip_${record.employee_name?.replace(/\s+/g, '_')}_${monthName}_${run.year}.pdf`;
        archive.append(pdfBuffer, { name: filename });
      } catch (pdfErr) {
        logger.error(`Failed to generate PDF for ${record.employee_name}:`, pdfErr);
        archive.append(Buffer.from(`Error generating payslip for ${record.employee_name}: ${pdfErr}`), { name: `ERROR_${record.employee_name?.replace(/\s+/g, '_')}.txt` });
      }
    }

    await archive.finalize();
  } catch (error) {
    next(error);
  }
};

// @desc    Download payroll summary PDF
// @route   GET /api/payroll/run/:runId/summary-pdf
export const downloadSummaryPDF = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { runId } = req.params;
    const { branch_id } = req.query;

    const { data: run, error: runError } = await supabase
      .from('payroll_runs')
      .select('*')
      .eq('id', runId)
      .single();

    if (runError || !run) {
      res.status(404).json({ success: false, message: `Payroll run not found: ${runError?.message || 'unknown'}` });
      return;
    }

    // Optionally get branch name
    let branchName = 'All Branches';
    const effectiveBranchId = branch_id && branch_id !== '0' ? branch_id : run.branch_id;
    
    if (effectiveBranchId) {
      const { data: branch } = await supabase.from('branches').select('name').eq('id', effectiveBranchId).single();
      if (branch?.name) branchName = branch.name;
    }

    let query = supabase
      .from('payroll_records')
      .select('*')
      .eq('payroll_run_id', runId);
    
    if (branch_id && branch_id !== '0') {
      query = query.eq('branch_id', branch_id);
    }

    const { data: records, error } = await query;

    if (error) throw error;

    // Recalculate totals for the filtered branch if applicable
    let runDataForPDF = { ...run };
    if (branch_id && branch_id !== '0') {
      const totals = (records || []).reduce((acc, r) => ({
        basic: acc.basic + parseFloat(r.basic_salary || 0),
        gross: acc.gross + parseFloat(r.gross_pay || 0),
        deductions: acc.deductions + parseFloat(r.total_deductions || 0),
        net: acc.net + parseFloat(r.net_pay || 0)
      }), { basic: 0, gross: 0, deductions: 0, net: 0 });

      runDataForPDF = {
        ...run,
        total_basic_salary: totals.basic,
        total_gross_pay: totals.gross,
        total_deductions: totals.deductions,
        total_net_pay: totals.net
      };
    }
    
    // Call the branded A3 landscape generator
    await generateBrandedPayrollSummaryV2(
      res,
      runDataForPDF,
      records || [],
      branchName
    );
  } catch (error) {
    next(error);
  }
};
