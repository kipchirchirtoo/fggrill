import { Request } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { recordAuditTrail } from '../utils/audit';
import { PayrollService } from './payroll.service';

type AdjustmentRecord = {
  id?: string;
  staff_id?: string;
  type?: string;
  category?: string;
  amount?: number | string;
  description?: string | null;
  month?: string | number;
  year?: number;
  status?: string;
  created_by?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
};

type SyncParams = {
  previousAdjustment?: AdjustmentRecord | null;
  currentAdjustment?: AdjustmentRecord | null;
  actorId?: string;
  req?: Request;
  trigger: string;
};

type SyncContext = {
  staffId: string;
  month: number;
  year: number;
};

const PAYROLL_ACTIVE_ADJUSTMENT_STATUSES = new Set(['approved', 'applied']);

const normalizeStatus = (value?: string | null) => (value || '').toLowerCase();

const toSyncContext = (adjustment?: AdjustmentRecord | null): SyncContext | null => {
  if (!adjustment?.staff_id || adjustment.month === undefined || adjustment.year === undefined || adjustment.year === null) {
    return null;
  }

  const month = Number(adjustment.month);
  const year = Number(adjustment.year);

  if (!month || !year) {
    return null;
  }

  return {
    staffId: adjustment.staff_id,
    month,
    year,
  };
};

export const syncAdjustmentToPayroll = async (
  adjustmentId: string,
  actorId?: string,
  req?: Request,
  previousAdjustment?: AdjustmentRecord | null,
) => {
  const { data: currentAdjustment, error } = await supabase
    .from('staff_payroll_adjustments')
    .select('*')
    .eq('id', adjustmentId)
    .single();

  if (error) {
    throw error;
  }

  await PayrollAdjustmentSyncService.syncAdjustmentChange({
    previousAdjustment,
    currentAdjustment,
    actorId,
    req,
    trigger: 'controller_sync',
  });
};

export class PayrollAdjustmentSyncService {
  static async syncAdjustmentChange(params: SyncParams) {
    const contexts = new Map<string, SyncContext>();

    for (const adjustment of [params.previousAdjustment, params.currentAdjustment]) {
      const context = toSyncContext(adjustment);
      if (!context) {
        continue;
      }

      contexts.set(`${context.staffId}:${context.month}:${context.year}`, context);
    }

    for (const context of contexts.values()) {
      await this.syncDraftRecord({
        ...params,
        ...context,
      });
    }
  }

  private static async syncDraftRecord(
    params: SyncParams & SyncContext,
  ) {
    const adjustmentId = params.currentAdjustment?.id || params.previousAdjustment?.id;
    const previousStatus = normalizeStatus(params.previousAdjustment?.status);
    const currentStatus = normalizeStatus(params.currentAdjustment?.status);
    const previousAffectsPayroll = PAYROLL_ACTIVE_ADJUSTMENT_STATUSES.has(previousStatus);
    const currentAffectsPayroll = PAYROLL_ACTIVE_ADJUSTMENT_STATUSES.has(currentStatus);

    try {
      const { data: run, error: runError } = await supabase
        .from('payroll_runs')
        .select('*')
        .eq('month', params.month)
        .eq('year', params.year)
        .maybeSingle();

      if (runError) {
        throw runError;
      }

      if (!run) {
        await this.logSyncEvent({
          actorId: params.actorId,
          req: params.req,
          adjustmentId,
          trigger: params.trigger,
          previousStatus,
          currentStatus,
          previousAffectsPayroll,
          currentAffectsPayroll,
          syncResult: 'deferred_no_run',
          staffId: params.staffId,
          month: params.month,
          year: params.year,
          adjustmentCreatorId: params.currentAdjustment?.created_by || params.previousAdjustment?.created_by || null,
        });
        return;
      }

      if (run.status !== 'draft') {
        await this.logSyncEvent({
          actorId: params.actorId,
          req: params.req,
          adjustmentId,
          trigger: params.trigger,
          previousStatus,
          currentStatus,
          previousAffectsPayroll,
          currentAffectsPayroll,
          syncResult: 'skipped_locked_run',
          staffId: params.staffId,
          month: params.month,
          year: params.year,
          payrollRunId: run.id,
          adjustmentCreatorId: params.currentAdjustment?.created_by || params.previousAdjustment?.created_by || null,
        });
        return;
      }

      const { data: staff, error: staffError } = await supabase
        .from('staff_profiles')
        .select('*')
        .eq('id', params.staffId)
        .single();

      if (staffError || !staff) {
        throw staffError || new Error(`Staff profile ${params.staffId} not found`);
      }

      const { data: existingRecord, error: existingError } = await supabase
        .from('payroll_records')
        .select('*')
        .eq('payroll_run_id', run.id)
        .eq('staff_id', params.staffId)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      const [batchData, policies] = await Promise.all([
        PayrollService.fetchBatchData([params.staffId], params.month, params.year),
        PayrollService.getActivePolicies(staff.branch_id || undefined),
      ]);

      const calculatedInfo = PayrollService.calculateFromBatch(
        staff,
        params.month,
        params.year,
        batchData,
        policies,
        existingRecord?.additions || [],
        existingRecord?.deductions || [],
      );

      const payload = {
        payroll_run_id: run.id,
        staff_id: staff.id,
        branch_id: staff.branch_id,
        employee_name: `${staff.first_name || ''} ${staff.last_name || ''}`.trim() || 'Unknown',
        employee_code: staff.employee_id || staff.id_number || staff.id || 'N/A',
        national_id: staff.national_id || staff.id_number || 'N/A',
        basic_salary: calculatedInfo.basic_salary,
        shif: calculatedInfo.deductions
          .filter((item: any) => item.category?.toLowerCase() === 'shif')
          .reduce((sum: number, item: any) => sum + (parseFloat(item.amount) || 0), 0),
        nssf: calculatedInfo.deductions
          .filter((item: any) => item.category?.toLowerCase() === 'nssf')
          .reduce((sum: number, item: any) => sum + (parseFloat(item.amount) || 0), 0),
        additions: calculatedInfo.additions,
        deductions: calculatedInfo.deductions,
        total_additions: calculatedInfo.total_additions,
        total_deductions: calculatedInfo.total_deductions,
        gross_pay: calculatedInfo.gross_pay,
        net_pay: calculatedInfo.net_pay,
      };

      const { data: savedRecord, error: upsertError } = await supabase
        .from('payroll_records')
        .upsert(payload, { onConflict: 'payroll_run_id, staff_id' })
        .select()
        .single();

      if (upsertError || !savedRecord) {
        throw upsertError || new Error('Failed to upsert payroll record');
      }

      const { error: deleteItemsError } = await supabase
        .from('staff_payroll_items')
        .delete()
        .eq('payroll_id', savedRecord.id);

      if (deleteItemsError) {
        throw deleteItemsError;
      }

      const payrollItems = [...calculatedInfo.additions, ...calculatedInfo.deductions].map((item: any) => ({
        payroll_id: savedRecord.id,
        category: item.category || item.type,
        amount: item.amount,
        source_table: item.source_table || null,
        source_id: item.source_id || null,
        policy_id: item.policy_id || null,
        reference: item.reference,
        approval_status: item.audit_ref ? 'audited' : 'system_calculated',
      }));

      if (payrollItems.length > 0) {
        const { error: itemsError } = await supabase
          .from('staff_payroll_items')
          .insert(payrollItems);

        if (itemsError) {
          throw itemsError;
        }
      }

      const { data: runRecords, error: recordsError } = await supabase
        .from('payroll_records')
        .select('basic_salary, gross_pay, total_deductions, net_pay')
        .eq('payroll_run_id', run.id);

      if (recordsError) {
        throw recordsError;
      }

      const totals = (runRecords || []).reduce((acc: any, record: any) => ({
        basic: acc.basic + parseFloat(record.basic_salary || 0),
        gross: acc.gross + parseFloat(record.gross_pay || 0),
        deductions: acc.deductions + parseFloat(record.total_deductions || 0),
        net: acc.net + parseFloat(record.net_pay || 0),
      }), { basic: 0, gross: 0, deductions: 0, net: 0 });

      const { error: updateRunError } = await supabase
        .from('payroll_runs')
        .update({
          total_basic_salary: totals.basic,
          total_gross_pay: totals.gross,
          total_deductions: totals.deductions,
          total_net_pay: totals.net,
        })
        .eq('id', run.id);

      if (updateRunError) {
        throw updateRunError;
      }

      await this.logSyncEvent({
        actorId: params.actorId,
        req: params.req,
        adjustmentId,
        trigger: params.trigger,
        previousStatus,
        currentStatus,
        previousAffectsPayroll,
        currentAffectsPayroll,
        syncResult: 'synced',
        staffId: params.staffId,
        month: params.month,
        year: params.year,
        payrollRunId: run.id,
        payrollRecordId: savedRecord.id,
        totalNetPay: calculatedInfo.net_pay,
        totalDeductions: calculatedInfo.total_deductions,
        adjustmentCreatorId: params.currentAdjustment?.created_by || params.previousAdjustment?.created_by || null,
      });
    } catch (error: any) {
      logger.error(`Payroll adjustment sync failed for staff ${params.staffId} (${params.month}/${params.year})`, error);

      await this.logSyncEvent({
        actorId: params.actorId,
        req: params.req,
        adjustmentId,
        trigger: params.trigger,
        previousStatus,
        currentStatus,
        previousAffectsPayroll,
        currentAffectsPayroll,
        syncResult: 'failed',
        syncError: error?.message || 'Unknown sync error',
        staffId: params.staffId,
        month: params.month,
        year: params.year,
        adjustmentCreatorId: params.currentAdjustment?.created_by || params.previousAdjustment?.created_by || null,
      });

      throw error;
    }
  }

  private static async logSyncEvent(params: {
    actorId?: string;
    req?: Request;
    adjustmentId?: string;
    trigger: string;
    previousStatus: string;
    currentStatus: string;
    previousAffectsPayroll: boolean;
    currentAffectsPayroll: boolean;
    syncResult: string;
    syncError?: string;
    staffId: string;
    month: number;
    year: number;
    payrollRunId?: string;
    payrollRecordId?: string;
    totalNetPay?: number;
    totalDeductions?: number;
    adjustmentCreatorId?: string | null;
  }) {
    if (!params.actorId) {
      return;
    }

    await recordAuditTrail({
      userId: params.actorId,
      action: 'adjustment_synced',
      entityType: 'staff_payroll_adjustments',
      entityId: params.adjustmentId,
      oldValues: {
        trigger: params.trigger,
        previous_status: params.previousStatus,
        previous_affects_payroll: params.previousAffectsPayroll,
      },
      newValues: {
        current_status: params.currentStatus,
        current_affects_payroll: params.currentAffectsPayroll,
        sync_result: params.syncResult,
        sync_error: params.syncError,
        adjustment_id: params.adjustmentId,
        employee_id: params.staffId,
        period: `${params.month}/${params.year}`,
        actor_id: params.actorId,
        timestamp: new Date().toISOString(),
        payroll_period: `${params.month}/${params.year}`,
        staff_id: params.staffId,
        payroll_run_id: params.payrollRunId,
        payroll_record_id: params.payrollRecordId,
        total_net_pay: params.totalNetPay,
        total_deductions: params.totalDeductions,
        adjustment_created_by: params.adjustmentCreatorId,
        synced_by: params.actorId,
      },
      req: params.req,
    });
  }
}
