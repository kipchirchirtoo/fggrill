import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { PayrollService } from '../services/payroll.service';
import { generatePayslipPDF, generatePayrollSummaryPDF } from '../utils/pdfGenerator';
import { generateBrandedPayrollSummaryV2 } from '../services/native-pdf-reports.service';
import axios from 'axios';
import { PYTHON_SERVICE_URL } from '../config/pythonService';

// HELPER: Ensure a draft run exists
async function getOrCreateDraftRun(month: number, year: number, reqUser: any) {
  const periodFrom = new Date(year, month - 1, 1).toISOString().slice(0, 10);
  const periodTo   = new Date(year, month, 0).toISOString().slice(0, 10);
  const branchId   = reqUser?.branch_id || reqUser?.branchId || null;

  const { data: existingRun } = await supabase
    .from('payroll_runs')
    .select('*')
    .eq('pay_period_from', periodFrom)
    .eq('pay_period_to', periodTo)
    .eq('status', 'draft')
    .maybeSingle();

  if (existingRun) return existingRun;

  const runNumber = `RUN-${year}${String(month).padStart(2, '0')}-${Date.now()}`;
  const { data: newRun, error } = await supabase
    .from('payroll_runs')
    .insert([{
      pay_period_from: periodFrom,
      pay_period_to: periodTo,
      run_number: runNumber,
      branch_id: branchId,
      status: 'draft',
      prepared_by: reqUser?.id || null,
    }])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      const { data: racedRun, error: fetchError } = await supabase
        .from('payroll_runs')
        .select('*')
        .eq('pay_period_from', periodFrom)
        .eq('pay_period_to', periodTo)
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
        .select('*')
        .eq('run_id', run.id);

      if (branch_id) query = query.eq('branch_id', branch_id);

      const { data: staticRecords, error } = await query;
      if (error) throw error;

      // Enrich with staff profiles separately to avoid schema-cache FK issues
      const staffIds = [...new Set((staticRecords || []).map(r => r.staff_id).filter(Boolean))];
      let staffMap = new Map();
      if (staffIds.length > 0) {
        try {
          const { data: profiles } = await supabase.from('staff_profiles').select('id, first_name, last_name, employee_number, role').in('id', staffIds);
          staffMap = new Map((profiles || []).map(p => [p.id, p]));
        } catch (_) { /* ignore */ }
      }
      const enrichedRecords = (staticRecords || []).map(r => ({ ...r, employee: staffMap.get(r.staff_id) || null }));

      res.status(200).json({ success: true, data: { run, records: enrichedRecords } });
      return;
    }

    // 2. Fetch Active Staff (staff_profiles.id is the payroll identifier)
    let staffQuery = supabase
      .from('staff_profiles')
      .select('*')
      .eq('employment_status', 'active');
    if (branch_id) staffQuery = staffQuery.eq('branch_id', branch_id);
    const { data: rawStaffList } = await staffQuery;
    const staffList = rawStaffList || [];
    logger.info(`Payroll draft: ${staffList.length} eligible staff`);

    // 3. Fetch Existing Draft Records to preserve manual JSON entries
    const { data: existingRecords } = await supabase
      .from('payroll_records')
      .select('*')
      .eq('run_id', run.id);

    const existingMap = new Map(existingRecords?.map(r => [r.staff_id, r]) || []);

    // 4. Batch-fetch ALL payroll data in one pass, then calculate in memory
    const recordsToUpsert = [];

    if (staffList.length > 0) {
      const staffIds = staffList.map((s: any) => s.id);
      const [batchData, policies] = await Promise.all([
        PayrollService.fetchBatchData(staffIds, month, year),
        PayrollService.getActivePolicies(branch_id || undefined),
      ]);

      for (const staff of staffList) {
        const existing = existingMap.get(staff.id) || { additions: [], deductions: [] };
        const calculatedInfo = PayrollService.calculateFromBatch(
          staff, month, year, batchData, policies,
          existing.additions, existing.deductions
        );

        const periodStart = new Date(year, month - 1, 1).toISOString().slice(0, 10);
        const periodEnd   = new Date(year, month, 0).toISOString().slice(0, 10);
        recordsToUpsert.push({
          run_id: run.id,
          staff_id: staff.id,
          branch_id: staff.branch_id,
          pay_period_from: periodStart,
          pay_period_to: periodEnd,
          basic_salary: calculatedInfo.basic_salary,
          total_deductions: calculatedInfo.total_deductions,
          gross_pay: calculatedInfo.gross_pay,
          net_pay: calculatedInfo.net_pay,
          status: 'draft',
        });
      }
    }

    // 5. Bulk Save Draft Records: delete existing then insert fresh (no ON CONFLICT needed)
    if (recordsToUpsert.length > 0) {
      // Delete all existing draft records for this run first
      await supabase.from('payroll_records').delete().eq('run_id', run.id).eq('status', 'draft');

      const CHUNK = 50;
      const upsertedRecords: any[] = [];
      for (let i = 0; i < recordsToUpsert.length; i += CHUNK) {
        const chunk = recordsToUpsert.slice(i, i + CHUNK);
        const { data: chunkData, error: insertError } = await supabase
          .from('payroll_records')
          .insert(chunk)
          .select();
        if (insertError) throw insertError;
        upsertedRecords.push(...(chunkData || []));
      }
      logger.info(`Saved ${upsertedRecords.length} payroll records for run ${run.id}`);

      // 5.1. Save Traceable Items (staff_payroll_items)
      // staff_payroll_items is keyed to staff_payroll.id, not payroll_records.id — skip itemised insert
    } else {
      logger.warn(`No staff to upsert for payroll run ${run.id} (month=${month}, year=${year})`);
    }

    // 6. Return Draft Response
    let finalQuery = supabase
      .from('payroll_records')
      .select('*')
      .eq('run_id', run.id);

    if (branch_id) finalQuery = finalQuery.eq('branch_id', branch_id);

    const { data: finalDraftRecords, error: fetchError } = await finalQuery;

    // Enrich with staff profiles separately to avoid schema-cache FK issues
    const finalStaffIds = [...new Set((finalDraftRecords || []).map(r => r.staff_id).filter(Boolean))];
    let finalStaffMap = new Map();
    if (finalStaffIds.length > 0) {
      try {
        const { data: profiles } = await supabase.from('staff_profiles').select('id, first_name, last_name, employee_number, role, department, position').in('id', finalStaffIds);
        finalStaffMap = new Map((profiles || []).map(p => [p.id, p]));
      } catch (_) { /* ignore */ }
    }
    const enrichedFinalRecords = (finalDraftRecords || []).map(r => ({ ...r, employee: finalStaffMap.get(r.staff_id) || null }));

    if (fetchError) logger.error(`Error fetching final draft records: ${fetchError.message}`);
    logger.info(`Final draft records count: ${finalDraftRecords?.length ?? 0} for run ${run.id}`);

    // Update Run Totals for the Draft
    const totals = finalDraftRecords?.reduce((acc, r) => ({
      basic: acc.basic + parseFloat(r.basic_salary),
      gross: acc.gross + parseFloat(r.gross_pay),
      deductions: acc.deductions + parseFloat(r.total_deductions),
      net: acc.net + parseFloat(r.net_pay)
    }), { basic: 0, gross: 0, deductions: 0, net: 0 }) || { basic: 0, gross: 0, deductions: 0, net: 0 };

    const { error } = await supabase.from('payroll_runs').update({
      total_gross: totals.gross,
      total_deductions: totals.deductions,
      total_net: totals.net,
    }).eq('id', run.id);


    if (error) logger.warn('Failed to update run totals:', error.message);

    const updatedRun = { ...run, ...totals };

    res.status(200).json({ success: true, data: { run: updatedRun, records: enrichedFinalRecords } });

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
    let { runId, month, year, branch_id } = req.body;

    // Fallback: If runId is missing but we have month/year/branch, find the draft
    if (!runId && month && year) {
      const pfrom = new Date(parseInt(year), parseInt(month) - 1, 1).toISOString().slice(0, 10);
      const pto   = new Date(parseInt(year), parseInt(month), 0).toISOString().slice(0, 10);
      const { data: foundRun } = await supabase
        .from('payroll_runs')
        .select('id')
        .eq('pay_period_from', pfrom)
        .eq('pay_period_to', pto)
        .eq('status', 'draft')
        .maybeSingle();

      if (foundRun) runId = foundRun.id;
    }

    if (!runId) {
      res.status(400).json({ success: false, message: 'Missing payroll Run ID or period details' });
      return;
    }

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
      .eq('run_id', runId);
    
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
            const { error } = await supabase.from('staff_credit_bills').update({ status: 'paid' }).eq('id', item.source_id);
            if (error) {
              console.error('Database error:', error);
              throw error;
            }
          } else if (item.source_table === 'staff_payroll_adjustments') {
            const { error } = await supabase.from('staff_payroll_adjustments').update({ status: 'applied', payroll_id: runId }).eq('id', item.source_id);
            if (error) {
              console.error('Database error:', error);
              throw error;
            }
          } else if (item.source_table === 'staff_advances') {
            const { error } = await supabase.from('staff_advances').update({ status: 'deducted', deducted_in_payroll_id: runId }).eq('id', item.source_id);
            if (error) {
              console.error('Database error:', error);
              throw error;
            }
          } else if (item.source_table === 'unpaid_bills') {
             const { error } = await supabase.from('unpaid_bills').update({ status: 'deducted' }).eq('id', item.source_id);
             if (error) {
               console.error('Database error:', error);
               throw error;
             }
          } else if (item.source_table === 'staff_loans') {
            const { data: loan , error } = await supabase.from('staff_loans').select('remaining_balance').eq('id', item.source_id).single();
            if (error) {
              console.error('Database error:', error);
              throw error;
            }
            if (loan) {
               const newBalance = Math.max(0, parseFloat(loan.remaining_balance) - parseFloat(item.amount));
               const { error } = await supabase.from('staff_loans').update({ 
                 remaining_balance: newBalance,
                 status: newBalance <= 0 ? 'paid' : 'active'
               }).eq('id', item.source_id);

               if (error) {

                 console.error('Database error:', error);

                 throw error;

               }
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
        const pFromAdj2 = new Date(parseInt(year), parseInt(month) - 1, 1).toISOString().slice(0, 10);
        const pToAdj2   = new Date(parseInt(year), parseInt(month), 0).toISOString().slice(0, 10);
        const { data: run } = await supabase
          .from('payroll_runs')
          .select('id')
          .eq('pay_period_from', pFromAdj2)
          .eq('pay_period_to', pToAdj2)
          .single();
        
        if (run) {
          const { data: rec } = await supabase
            .from('payroll_records')
            .select('id')
            .eq('run_id', run.id)
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
    const pfromAdj = new Date(parseInt(year as string), parseInt(month as string) - 1, 1).toISOString().slice(0, 10);
    const ptoAdj   = new Date(parseInt(year as string), parseInt(month as string), 0).toISOString().slice(0, 10);
    const { data: run } = await supabase
      .from('payroll_runs')
      .select('id')
      .eq('pay_period_from', pfromAdj)
      .eq('pay_period_to', ptoAdj)
      .single();

    if (!run) {
      res.status(404).json({ success: false, message: 'Payroll run not found for this period' });
      return;
    }

    // 2. Find the record for this staff in this run
    const { data: record, error } = await supabase
      .from('payroll_records')
      .select('additions, deductions')
      .eq('run_id', run.id)
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
        run:payroll_runs!run_id(pay_period_from, pay_period_to, status)
      `)
      .eq('id', id)
      .single();

    // Fetch staff profile separately to avoid schema-cache FK issues
    if (record?.staff_id) {
      try {
        const { data: staff } = await supabase.from('staff_profiles').select('id, national_id, phone, department, role, position, bank_name, account_number, employee_number, first_name, last_name, email').eq('id', record.staff_id).single();
        if (staff) (record as any).staff = staff;
      } catch (_) { /* ignore */ }
    }

    if (error || !record) {
      res.status(404).json({ success: false, message: 'Payroll record not found' });
      return;
    }

    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const periodDate = record.run?.pay_period_from ? new Date(record.run.pay_period_from) : new Date();
    const periodMonth = periodDate.getMonth() + 1;
    const periodYear = periodDate.getFullYear();
    const monthName = MONTHS[periodMonth - 1];

    const pdfBuffer = await generatePayslipPDF({
      month: monthName,
      year: periodYear,
      base_salary: parseFloat(record.basic_salary || 0),
      overtime_pay: 0,
      allowances: 0,
      gross_pay: parseFloat(record.gross_pay || 0),
      nssf_deduction: 0,
      shif_deduction: 0,
      total_deductions: parseFloat(record.total_deductions || 0),
      net_salary: parseFloat(record.net_pay || 0),
      employee: {
        national_id: record.staff?.national_id || 'N/A',
        kra_pin: 'N/A',
        employee_type: record.staff?.role || 'Staff',
        department: record.staff?.department || 'General',
        bank_name: record.staff?.bank_name || 'N/A',
        bank_account_number: record.staff?.account_number || 'N/A',
        user: {
          first_name: record.staff?.first_name || '',
          last_name: record.staff?.last_name || '',
        }
      },
      company: 'Famous Gates Hotels',
      company_email: 'info@famousgatehotels.com',
      company_address: 'Bomet, Kenya'
    });

    const filename = `Payslip_${record.staff?.first_name || 'Staff'}_${monthName}_${periodYear}.pdf`;
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
      .eq('run_id', runId);
    
    if (branch_id && branch_id !== '0') {
      query = query.eq('branch_id', branch_id);
    }

    const { data: records, error } = await query;

    if (error) throw error;
    if (!records || records.length === 0) {
      res.status(404).json({ success: false, message: 'No payroll records found for this run' });
      return;
    }

    // Fetch staff profile data (payroll_records.staff_id now FK → staff_profiles.id)
    const staffIds = records.map(r => r.staff_id).filter(Boolean);
    const { data: staffProfiles } = await supabase
      .from('staff_profiles')
      .select('id, national_id, phone, department, role, bank_name, account_number, employee_number')
      .in('id', staffIds);
    const staffMap = new Map((staffProfiles || []).map(s => [s.id, s]));

    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const runPeriodDate = run.pay_period_from ? new Date(run.pay_period_from) : new Date();
    const runMonth = runPeriodDate.getMonth() + 1;
    const runYear = runPeriodDate.getFullYear();
    const monthName = MONTHS[runMonth - 1];

    const archiver = require('archiver');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="Payslips_${monthName}_${runYear}.zip"`);

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
          year: runYear,
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
            kra_pin: 'N/A',
            employee_type: staff?.role || 'Staff',
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

        const filename = `Payslip_${(record.employee_name || 'Staff')?.replace(/\s+/g, '_')}_${monthName}_${runYear}.pdf`;
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

    // Fetch approver name
    let approverName = '';
    if (run.approved_by) {
      const { data: approver } = await supabase
        .from('users')
        .select('first_name, last_name')
        .eq('id', run.approved_by)
        .single();
      if (approver) approverName = `${approver.first_name || ''} ${approver.last_name || ''}`.trim();
    }

    // Optionally get branch name
    let branchName = 'All Branches';
    const effectiveBranchId = branch_id && branch_id !== '0' ? branch_id : run.branch_id;
    if (effectiveBranchId) {
      const { data: branch , error } = await supabase.from('branches').select('name').eq('id', effectiveBranchId).single();
      if (error) {
        console.error('Database error:', error);
        throw error;
      }
      if (branch?.name) branchName = branch.name;
    }

    let query = supabase
      .from('payroll_records')
      .select('*')
      .eq('run_id', runId);
    if (branch_id && branch_id !== '0') {
      query = query.eq('branch_id', branch_id);
    }
    const { data: records, error } = await query;
    if (error) throw error;

    // Fetch staff roles and employee IDs for each record
    const staffUserIds = (records || []).map((r: any) => r.staff_id).filter(Boolean);
    let staffProfiles: any[] = [];
    if (staffUserIds.length > 0) {
      const { data } = await supabase
        .from('staff_profiles')
        .select('id, role, position, department, national_id, employee_number')
        .in('id', staffUserIds);
      staffProfiles = data || [];
    }
 
    // Enrich records with role and sort by employee ID
    const enrichedRecords = (records || []).map((r: any) => {
      const profile = staffProfiles.find((p: any) => p.id === r.staff_id);
      return {
        ...r,
        role: profile?.position || profile?.role || profile?.department || r.role || 'Staff',
        employee_id: profile?.employee_number || profile?.national_id || r.employee_id || r.id_number || '',
      };
    }).sort((a, b) => (a.employee_id || '').localeCompare(b.employee_id || '', undefined, { numeric: true, sensitivity: 'base' }));

    // Always recalculate totals from actual records (never trust stale run totals)
    const totals = enrichedRecords.reduce((acc: any, r: any) => ({
      basic: acc.basic + parseFloat(r.basic_salary || 0),
      gross: acc.gross + parseFloat(r.gross_pay || 0),
      additions: acc.additions + parseFloat(r.total_additions || 0),
      deductions: acc.deductions + parseFloat(r.total_deductions || 0),
      net: acc.net + parseFloat(r.net_pay || 0),
    }), { basic: 0, gross: 0, additions: 0, deductions: 0, net: 0 });

    const runDataForPDF = {
      ...run,
      total_basic_salary: totals.basic,
      total_gross_pay: totals.gross,
      total_additions: totals.additions,
      total_deductions: totals.deductions,
      total_net_pay: totals.net,
      approver_name: approverName,
    };

    // Build period label from run month/year
    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const periodLabel = run.month && run.year
      ? `${MONTHS[(run.month as number) - 1]} ${run.year}`
      : (run.period_label || '');

    // Map payroll_records to the branded Python template employee format
    const employees = enrichedRecords.map((r: any, idx: number) => {
      const ded: any[] = Array.isArray(r.deductions) ? r.deductions : [];
      const getAmt = (cat: string) => ded
        .filter((d: any) => (d.category || '').toLowerCase() === cat.toLowerCase())
        .reduce((s: number, d: any) => s + (parseFloat(d.amount) || 0), 0);

      const nssf        = getAmt('nssf');
      const shif        = getAmt('shif');
      const loans       = getAmt('loan');
      const advances    = getAmt('advance');
      const creditBills = getAmt('unpaid_bills') + getAmt('credit_bills');
      const totalDed    = parseFloat(r.total_deductions || 0);
      const calcParts   = nssf + shif + loans + advances + creditBills;
      // Assign remainder to PAYE so total deductions and net pay remain correct
      const paye        = Math.max(0, totalDed - calcParts);

      return {
        no:           idx + 1,
        emp_id:       r.employee_code || r.employee_id || '',
        name:         r.employee_name || '',
        phone:        '',
        role:         r.role || 'Staff',
        branch:       branchName,
        basic_salary: parseFloat(r.basic_salary || 0),
        nssf,
        shif,
        housing_levy: 0,
        paye,
        credit_bills: creditBills,
        advances,
        loans,
      };
    });

    const payload = {
      employees,
      period:          periodLabel,
      branch:          branchName,
      generated:       new Date().toLocaleString('en-KE'),
      status:          (run.status || 'DRAFT').toUpperCase(),
      company_name:    'FAMOUSGATE HOTELS',
      company_address: 'Bomet, Kenya',
      company_email:   'famousgateshotelsbmt@gmail.com',
      company_phone:   '0706 782 828',
    };

    try {
      const response = await axios.post(
        `${PYTHON_SERVICE_URL}/api/payroll/generate-pdf`,
        payload,
        { responseType: 'arraybuffer', timeout: 60000 },
      );
      const safeFilename = `Payroll_Summary_${branchName.replace(/\s+/g,'_')}_${periodLabel.replace(/\s+/g,'_')}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      res.send(Buffer.from(response.data));
    } catch (pythonErr: any) {
      logger.warn(`Python payroll PDF failed, falling back to native generator: ${pythonErr.message}`);
      await generateBrandedPayrollSummaryV2(res, runDataForPDF, enrichedRecords, branchName);
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Force-regenerate payroll draft (wipes existing draft records and recalculates)
// @route   POST /api/payroll/generate
// @access  Private (Admin, HR)
export const forceGeneratePayroll = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { month, year, branch_id } = req.body;

    if (!month || !year) {
      res.status(400).json({ success: false, message: 'month and year are required' });
      return;
    }

    const parsedMonth = parseInt(month);
    const parsedYear = parseInt(year);
    const parsedBranch = branch_id ? parseInt(branch_id) : null;

    // 1. Get or create the run
    const run = await getOrCreateDraftRun(parsedMonth, parsedYear, req.user);

    if (run.status !== 'draft') {
      res.status(400).json({ success: false, message: `Payroll for ${parsedMonth}/${parsedYear} is already ${run.status} and cannot be regenerated.` });
      return;
    }

    // 2. Delete existing draft records for this run (force recalculation)
    const deleteQuery = supabase.from('payroll_records').delete().eq('run_id', run.id);
    const { error: deleteError } = await deleteQuery;
    if (deleteError) {
      logger.error('Error deleting existing draft records:', deleteError);
      throw deleteError;
    }
    logger.info(`Cleared existing draft records for run ${run.id} (${parsedMonth}/${parsedYear})`);

    // 3. Fetch active staff
    let staffQuery = supabase
      .from('staff_profiles')
      .select('*')
      .eq('employment_status', 'active');
    if (parsedBranch) staffQuery = staffQuery.eq('branch_id', parsedBranch);

    const { data: rawStaffList, error: staffError } = await staffQuery;
    if (staffError) throw staffError;

    const staffList = rawStaffList || [];
    logger.info(`Force-generate: ${staffList.length} eligible staff`);

    if (staffList.length === 0) {
      res.status(404).json({ success: false, message: 'No active staff found for this branch/period.' });
      return;
    }

    // 4. Batch-fetch all data, then calculate in memory
    const recordsToUpsert = [];
    const errors: any[] = [];

    const staffIds = staffList.map((s: any) => s.id);
    const [batchData, policies] = await Promise.all([
      PayrollService.fetchBatchData(staffIds, parsedMonth, parsedYear),
      PayrollService.getActivePolicies(parsedBranch || undefined),
    ]);

    for (const staff of staffList) {
      try {
        const calculatedInfo = PayrollService.calculateFromBatch(
          staff, parsedMonth, parsedYear, batchData, policies, [], []
        );

        const periodStart2 = new Date(parsedYear, parsedMonth - 1, 1).toISOString().slice(0, 10);
        const periodEnd2   = new Date(parsedYear, parsedMonth, 0).toISOString().slice(0, 10);
        recordsToUpsert.push({
          run_id: run.id,
          staff_id: staff.id,
          branch_id: staff.branch_id,
          pay_period_from: periodStart2,
          pay_period_to: periodEnd2,
          basic_salary: calculatedInfo.basic_salary,
          total_deductions: calculatedInfo.total_deductions,
          gross_pay: calculatedInfo.gross_pay,
          net_pay: calculatedInfo.net_pay,
          status: 'draft',
        });
      } catch (err: any) {
        logger.error(`Payroll calc failed for staff ${staff.id}:`, err);
        errors.push({ staff_id: staff.id, name: `${staff.first_name || ''} ${staff.last_name || ''}`.trim(), error: err.message });
      }
    }

    if (recordsToUpsert.length === 0) {
      res.status(500).json({ success: false, message: 'Payroll calculation failed for all staff.', errors });
      return;
    }

    const { data: upserted, error: upsertError } = await supabase
      .from('payroll_records')
      .insert(recordsToUpsert)
      .select();

    if (upsertError) throw upsertError;

    // 5. Update run totals
    const totals = recordsToUpsert.reduce((acc, r) => ({
      basic: acc.basic + (r.basic_salary || 0),
      gross: acc.gross + (r.gross_pay || 0),
      deductions: acc.deductions + (r.total_deductions || 0),
      net: acc.net + (r.net_pay || 0),
    }), { basic: 0, gross: 0, deductions: 0, net: 0 });

    await supabase.from('payroll_runs').update({
      total_gross: totals.gross,
      total_deductions: totals.deductions,
      total_net: totals.net,
    }).eq('id', run.id);

    res.status(200).json({
      success: true,
      message: `Payroll generated for ${recordsToUpsert.length} staff${errors.length ? ` (${errors.length} failed)` : ''}.`,
      data: {
        run: { ...run, ...totals },
        records: upserted,
        errors,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const generateStatementPDFProxy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pythonResponse = await axios.post(
      `${PYTHON_SERVICE_URL}/api/payroll/generate-statement-pdf`,
      req.body,
      { responseType: 'arraybuffer' }
    );
    const pdfBuf = Buffer.from(pythonResponse.data);
    if (!pdfBuf || pdfBuf.length < 50) {
      throw new Error('Invalid PDF buffer returned from Python service');
    }
    const title = (req.body?.title || 'Statement').replace(/[^A-Za-z0-9]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="FG_${title}.pdf"`);
    res.send(pdfBuf);
  } catch (error) {
    logger.error('Failed to proxy statement PDF generation', error);
    next(error);
  }
};
