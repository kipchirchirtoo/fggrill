/**
 * Shift P&L Service
 * 
 * Service for generating and managing shift-level Profit & Loss statements
 */

import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { ShiftPnL, ShiftFinancialStatus } from '../types/foodControl';
import notificationService from './notification.service';

// =====================================================
// SHIFT P&L GENERATION
// =====================================================

/**
 * Generate or refresh shift-level P&L
 */
export async function generateShiftPnL(
  shiftId: number,
  branchId: number
): Promise<ShiftPnL> {
  try {
    logger.info(`Generating shift P&L for shift ${shiftId}, branch ${branchId}`);

    // ===== REVENUE CALCULATION =====
    
    // 1. POS Revenue
    const { data: posTransactions } = await supabase
      .from('pos_transactions')
      .select('total_amount')
      .eq('shift_id', shiftId)
      .eq('branch_id', branchId)
      .eq('status', 'PAID');

    const posRevenue = posTransactions?.reduce((sum, tx) => sum + Number(tx.total_amount), 0) || 0;

    // 2. Buffet Revenue
    const { data: buffets } = await supabase
      .from('buffets')
      .select('actual_guests, expected_guests, price_per_person')
      .eq('shift_id', shiftId)
      .eq('branch_id', branchId)
      .eq('status', 'closed');

    const buffetRevenue = buffets?.reduce((sum, buffet) => {
      const guests = buffet.actual_guests || buffet.expected_guests;
      return sum + (guests * Number(buffet.price_per_person));
    }, 0) || 0;

    // 3. Catering Revenue
    const { data: cateringEvents } = await supabase
      .from('catering_events')
      .select('id, agreed_price')
      .eq('shift_id', shiftId)
      .eq('branch_id', branchId)
      .eq('status', 'completed');

    const cateringRevenue = cateringEvents?.reduce((sum, event) => sum + Number(event.agreed_price), 0) || 0;

    // ===== COGS CALCULATION =====

    // 4. POS Theoretical COGS (from recipes)
    const { data: posVariances } = await supabase
      .from('food_control_variance')
      .select('theoretical_usage, variance_cost, item_sku')
      .eq('shift_id', shiftId)
      .eq('branch_id', branchId)
      .eq('reference_type', 'POS');

    let posTheoreticalCogs = 0;
    for (const variance of posVariances || []) {
      // Get cost per unit
      const { data: item } = await supabase
        .from('inventory_items')
        .select('cost_per_unit')
        .eq('sku', variance.item_sku)
        .single();

      const cost = variance.theoretical_usage * (item?.cost_per_unit || 0);
      posTheoreticalCogs += cost;
    }

    // 5. POS Actual COGS (from stock issues)
    const { data: posIssues } = await supabase
      .from('stock_issues')
      .select('item_sku, quantity_issued')
      .eq('shift_id', shiftId)
      .eq('branch_id', branchId)
      .eq('reference_type', 'POS');

    let posActualCogs = 0;
    for (const issue of posIssues || []) {
      const { data: item } = await supabase
        .from('inventory_items')
        .select('cost_per_unit')
        .eq('sku', issue.item_sku)
        .single();

      const cost = issue.quantity_issued * (item?.cost_per_unit || 0);
      posActualCogs += cost;
    }

    // 6. Buffet Theoretical COGS
    const { data: buffetVariances } = await supabase
      .from('food_control_variance')
      .select('theoretical_usage, item_sku')
      .eq('shift_id', shiftId)
      .eq('branch_id', branchId)
      .eq('reference_type', 'BUFFET');

    let buffetTheoreticalCogs = 0;
    for (const variance of buffetVariances || []) {
      const { data: item } = await supabase
        .from('inventory_items')
        .select('cost_per_unit')
        .eq('sku', variance.item_sku)
        .single();

      const cost = variance.theoretical_usage * (item?.cost_per_unit || 0);
      buffetTheoreticalCogs += cost;
    }

    // 7. Buffet Actual COGS
    const { data: buffetIssues } = await supabase
      .from('stock_issues')
      .select('item_sku, quantity_issued')
      .eq('shift_id', shiftId)
      .eq('branch_id', branchId)
      .eq('reference_type', 'BUFFET');

    let buffetActualCogs = 0;
    for (const issue of buffetIssues || []) {
      const { data: item } = await supabase
        .from('inventory_items')
        .select('cost_per_unit')
        .eq('sku', issue.item_sku)
        .single();

      const cost = issue.quantity_issued * (item?.cost_per_unit || 0);
      buffetActualCogs += cost;
    }

    // 8. Catering COGS (from stock allocations)
    const { data: cateringAllocations } = await supabase
      .from('catering_stock_allocations')
      .select('total_cost')
      .eq('branch_id', branchId)
      .in('event_id', cateringEvents?.map(e => e.id) || []);

    const cateringCogs = cateringAllocations?.reduce((sum, alloc) => sum + Number(alloc.total_cost || 0), 0) || 0;

    // ===== CALCULATE KPIs =====

    const totalRevenue = posRevenue + buffetRevenue + cateringRevenue;
    const foodRevenue = totalRevenue; // Assuming all revenue is food-related
    const actualCogs = posActualCogs + buffetActualCogs + cateringCogs;
    const foodCostPercentage = foodRevenue > 0 ? (actualCogs / foodRevenue * 100) : 0;

    // ===== UPSERT SHIFT FINANCIALS =====

    const { data: shiftFinancial, error } = await supabase
      .from('shift_financials')
      .upsert({
        shift_id: shiftId,
        branch_id: branchId,
        pos_revenue: posRevenue,
        buffet_revenue: buffetRevenue,
        catering_revenue: cateringRevenue,
        pos_theoretical_cogs: posTheoreticalCogs,
        pos_actual_cogs: posActualCogs,
        buffet_theoretical_cogs: buffetTheoreticalCogs,
        buffet_actual_cogs: buffetActualCogs,
        catering_cogs: cateringCogs,
        food_cost_percentage: foodCostPercentage,
        food_revenue: foodRevenue,
        status: 'draft'
      }, {
        onConflict: 'shift_id'
      })
      .select()
      .single();

    if (error) throw error;

    logger.info(`Shift P&L generated successfully for shift ${shiftId}`);

    return shiftFinancial;
  } catch (error) {
    logger.error('Error generating shift P&L:', error);
    throw error;
  }
}

// =====================================================
// WORKFLOW MANAGEMENT
// =====================================================

/**
 * Submit shift P&L for accountant review
 */
export async function submitForAccountantReview(
  shiftId: number,
  submittedBy: string
): Promise<ShiftPnL> {
  try {
    const { data, error } = await supabase
      .from('shift_financials')
      .update({
        status: 'pending_accountant'
      })
      .eq('shift_id', shiftId)
      .select()
      .single();

    if (error) throw error;

    // Send notification to branch accountant
    const { data: shift } = await supabase
      .from('staff_shifts')
      .select('branch_id')
      .eq('id', shiftId)
      .single();

    if (shift) {
      // Get branch accountant
      const { data: accountants } = await supabase
        .from('users')
        .select('id')
        .eq('branch_id', shift.branch_id)
        .eq('role', 'branch_accountant');

      for (const accountant of accountants || []) {
        await notificationService.createNotification({
          user_id: accountant.id,
          type: 'info',
          category: 'shift_pnl',
          title: 'Shift P&L Ready for Review',
          message: `Shift ${shiftId} P&L is ready for your review`,
          priority: 'high',
          action_url: `/dashboard/branch-accounting/shift-review/${shiftId}`
        });
      }
    }

    logger.info(`Shift P&L ${shiftId} submitted for accountant review`);

    return data;
  } catch (error) {
    logger.error('Error submitting shift P&L for review:', error);
    throw error;
  }
}

/**
 * Accountant approve/review shift P&L
 */
export async function accountantApprove(
  shiftId: number,
  accountantId: string,
  notes?: string
): Promise<ShiftPnL> {
  try {
    const { data, error } = await supabase
      .from('shift_financials')
      .update({
        status: 'accountant_reviewed',
        reviewed_by: accountantId,
        reviewed_at: new Date().toISOString(),
        accountant_notes: notes
      })
      .eq('shift_id', shiftId)
      .select()
      .single();

    if (error) throw error;

    // Send notification to auditor
    const { data: shift } = await supabase
      .from('staff_shifts')
      .select('branch_id')
      .eq('id', shiftId)
      .single();

    if (shift) {
      // Get auditors
      const { data: auditors } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'auditor');

      for (const auditor of auditors || []) {
        await notificationService.createNotification({
          user_id: auditor.id,
          type: 'info',
          category: 'shift_pnl',
          title: 'Shift P&L Ready for Audit',
          message: `Shift ${shiftId} P&L has been reviewed by accountant and is ready for audit`,
          priority: 'medium',
          action_url: `/dashboard/auditor/shift-verification/${shiftId}`
        });
      }
    }

    logger.info(`Shift P&L ${shiftId} approved by accountant ${accountantId}`);

    return data;
  } catch (error) {
    logger.error('Error approving shift P&L:', error);
    throw error;
  }
}

/**
 * Auditor approve or flag shift P&L
 */
export async function auditorAction(
  shiftId: number,
  auditorId: string,
  action: 'approve' | 'flag',
  notes?: string
): Promise<ShiftPnL> {
  try {
    const status: ShiftFinancialStatus = action === 'approve' ? 'auditor_approved' : 'flagged';

    const { data, error } = await supabase
      .from('shift_financials')
      .update({
        status,
        approved_by: auditorId,
        approved_at: new Date().toISOString(),
        auditor_notes: notes
      })
      .eq('shift_id', shiftId)
      .select()
      .single();

    if (error) throw error;

    // If flagged, notify manager and admin
    if (action === 'flag') {
      const { data: shift } = await supabase
        .from('staff_shifts')
        .select('branch_id')
        .eq('id', shiftId)
        .single();

      if (shift) {
        // Get branch manager
        const { data: managers } = await supabase
          .from('users')
          .select('id')
          .eq('branch_id', shift.branch_id)
          .eq('role', 'branch_manager');

        for (const manager of managers || []) {
          await notificationService.createNotification({
            user_id: manager.id,
            type: 'error',
            category: 'shift_pnl',
            title: 'Shift P&L Flagged by Auditor',
            message: `Shift ${shiftId} P&L has been flagged by auditor. Immediate attention required.`,
            priority: 'urgent',
            action_url: `/dashboard/branch-manager/shift-review/${shiftId}`
          });
        }

        // Get admins
        const { data: admins } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'super_admin');

        for (const admin of admins || []) {
          await notificationService.createNotification({
            user_id: admin.id,
            type: 'error',
            category: 'shift_pnl',
            title: 'Shift P&L Flagged',
            message: `Shift ${shiftId} at branch ${shift.branch_id} has been flagged by auditor`,
            priority: 'high',
            action_url: `/dashboard/admin/shift-review/${shiftId}`
          });
        }
      }
    }

    logger.info(`Shift P&L ${shiftId} ${action}ed by auditor ${auditorId}`);

    return data;
  } catch (error) {
    logger.error('Error auditor action on shift P&L:', error);
    throw error;
  }
}

// =====================================================
// QUERY FUNCTIONS
// =====================================================

/**
 * Get shift P&L by shift ID
 */
export async function getShiftPnL(shiftId: number): Promise<ShiftPnL | null> {
  try {
    const { data, error } = await supabase
      .from('shift_financials')
      .select('*')
      .eq('shift_id', shiftId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data;
  } catch (error) {
    logger.error('Error getting shift P&L:', error);
    throw error;
  }
}

/**
 * Get shift P&Ls for a branch with filters
 */
export async function getShiftPnLs(
  branchId: number,
  filters?: {
    status?: ShiftFinancialStatus;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ data: ShiftPnL[]; total: number }> {
  try {
    let query = supabase
      .from('shift_financials')
      .select('*', { count: 'exact' })
      .eq('branch_id', branchId)
      .order('generated_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.startDate) {
      query = query.gte('generated_at', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('generated_at', filters.endDate);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      data: data || [],
      total: count || 0
    };
  } catch (error) {
    logger.error('Error getting shift P&Ls:', error);
    throw error;
  }
}

/**
 * Get multi-shift summary for a branch
 */
export async function getMultiShiftSummary(
  branchId: number,
  startDate: string,
  endDate: string
): Promise<{
  totalRevenue: number;
  totalCogs: number;
  totalProfit: number;
  averageFoodCostPercentage: number;
  shiftCount: number;
}> {
  try {
    const { data: shifts, error } = await supabase
      .from('shift_financials')
      .select('*')
      .eq('branch_id', branchId)
      .gte('generated_at', startDate)
      .lte('generated_at', endDate);

    if (error) throw error;

    const totalRevenue = shifts?.reduce((sum, s) => sum + Number(s.total_revenue), 0) || 0;
    const totalCogs = shifts?.reduce((sum, s) => sum + Number(s.actual_cogs), 0) || 0;
    const totalProfit = shifts?.reduce((sum, s) => sum + Number(s.gross_profit_actual), 0) || 0;
    const avgFoodCost = shifts?.reduce((sum, s) => sum + Number(s.food_cost_percentage || 0), 0) / (shifts?.length || 1) || 0;

    return {
      totalRevenue,
      totalCogs,
      totalProfit,
      averageFoodCostPercentage: avgFoodCost,
      shiftCount: shifts?.length || 0
    };
  } catch (error) {
    logger.error('Error getting multi-shift summary:', error);
    throw error;
  }
}

/**
 * Get food cost trend over time
 */
export async function getFoodCostTrend(
  branchId: number,
  startDate: string,
  endDate: string
): Promise<{
  date: string;
  foodCostPercentage: number;
  revenue: number;
  cogs: number;
}[]> {
  try {
    const { data: shifts, error } = await supabase
      .from('shift_financials')
      .select('generated_at, food_cost_percentage, total_revenue, actual_cogs')
      .eq('branch_id', branchId)
      .gte('generated_at', startDate)
      .lte('generated_at', endDate)
      .order('generated_at', { ascending: true });

    if (error) throw error;

    return shifts?.map(s => ({
      date: s.generated_at.split('T')[0],
      foodCostPercentage: Number(s.food_cost_percentage || 0),
      revenue: Number(s.total_revenue),
      cogs: Number(s.actual_cogs)
    })) || [];
  } catch (error) {
    logger.error('Error getting food cost trend:', error);
    throw error;
  }
}

// =====================================================
// ALERT CHECKS
// =====================================================

/**
 * Check if food cost percentage exceeds threshold
 */
export async function checkFoodCostAlert(
  shiftId: number,
  branchId: number
): Promise<boolean> {
  try {
    // Get branch config
    const { data: config } = await supabase
      .from('branch_food_control_config')
      .select('food_cost_alert_threshold')
      .eq('branch_id', branchId)
      .single();

    const threshold = config?.food_cost_alert_threshold || 35;

    // Get shift P&L
    const pnl = await getShiftPnL(shiftId);

    if (!pnl) return false;

    if (Number(pnl.foodCostPercentage || 0) > threshold) {
      // Send alert to accountant
      const { data: accountants } = await supabase
        .from('users')
        .select('id')
        .eq('branch_id', branchId)
        .eq('role', 'branch_accountant');
 
      for (const accountant of accountants || []) {
        await notificationService.createNotification({
          user_id: accountant.id,
          type: 'error',
          category: 'food_control',
          title: 'High Food Cost Alert',
          message: `Shift ${shiftId} food cost is ${pnl.foodCostPercentage?.toFixed(1)}% (threshold: ${threshold}%)`,
          priority: 'urgent',
          action_url: `/dashboard/branch-accounting/shift-review/${shiftId}`
        });
      }

      return true;
    }

    return false;
  } catch (error) {
    logger.error('Error checking food cost alert:', error);
    return false;
  }
}
