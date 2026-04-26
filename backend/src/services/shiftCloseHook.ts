/**
 * Shift Close Hook Service
 * 
 * Automatically triggered when a shift is closed to:
 * 1. Compute variance for all revenue streams
 * 2. Generate shift P&L
 * 3. Check thresholds and send alerts
 * 4. Auto-submit to accountant if configured
 */

import { logger } from '../utils/logger';
import { supabase } from '../config/supabase';
import { computeVariance, getUnexplainedVariances } from './foodControlService';
import {
  generateShiftPnL,
  submitForAccountantReview,
  checkFoodCostAlert
} from './shiftPnLService';
import notificationService from './notification.service';

interface ShiftCloseResult {
  blocked: boolean;
  reason?: string;
  count?: number;
  pnl?: any;
}

/**
 * Main shift close hook - called when a shift is closed
 */
export async function onShiftClose(
  shiftId: number,
  branchId: number
): Promise<ShiftCloseResult> {
  try {
    logger.info(`[Shift Close Hook] Starting for shift ${shiftId}, branch ${branchId}`);

    // Step 1: Compute variance for POS
    try {
      await computeVariance(shiftId, 'POS', undefined, branchId);
      logger.info(`[Shift Close Hook] POS variance computed for shift ${shiftId}`);
    } catch (error) {
      logger.error('[Shift Close Hook] Error computing POS variance:', error);
      // Continue even if POS variance fails
    }

    // Step 2: Compute variance for all buffets in this shift
    const { data: buffets } = await supabase
      .from('buffets')
      .select('id')
      .eq('shift_id', shiftId)
      .eq('branch_id', branchId)
      .eq('status', 'closed');

    for (const buffet of buffets || []) {
      try {
        await computeVariance(shiftId, 'BUFFET', buffet.id, branchId);
        logger.info(`[Shift Close Hook] Buffet variance computed for buffet ${buffet.id}`);
      } catch (error) {
        logger.error(`[Shift Close Hook] Error computing buffet variance for ${buffet.id}:`, error);
        // Continue even if buffet variance fails
      }
    }

    // Step 3: Compute variance for all catering events in this shift
    const { data: cateringEvents } = await supabase
      .from('catering_events')
      .select('id')
      .eq('shift_id', shiftId)
      .eq('branch_id', branchId)
      .eq('status', 'completed');

    for (const event of cateringEvents || []) {
      try {
        await computeVariance(shiftId, 'CATERING', event.id, branchId);
        logger.info(`[Shift Close Hook] Catering variance computed for event ${event.id}`);
      } catch (error) {
        logger.error(`[Shift Close Hook] Error computing catering variance for ${event.id}:`, error);
        // Continue even if catering variance fails
      }
    }

    // Step 4: Generate shift P&L
    let pnl;
    try {
      pnl = await generateShiftPnL(shiftId, branchId);
      logger.info(`[Shift Close Hook] Shift P&L generated for shift ${shiftId}`);
    } catch (error) {
      logger.error('[Shift Close Hook] Error generating shift P&L:', error);
      // This is critical, but we'll continue to check variances
    }

    // Step 5: Check food cost percentage threshold
    try {
      const alertSent = await checkFoodCostAlert(shiftId, branchId);
      if (alertSent) {
        logger.info(`[Shift Close Hook] Food cost alert sent for shift ${shiftId}`);
      }
    } catch (error) {
      logger.error('[Shift Close Hook] Error checking food cost alert:', error);
    }

    // Step 6: Check for unexplained critical variances
    const unexplained = await getUnexplainedVariances(branchId, shiftId);
    const criticalUnexplained = unexplained.filter(v => 
      v.requiresExplanation && v.status === 'pending'
    );

    if (criticalUnexplained.length > 0) {
      logger.warn(`[Shift Close Hook] ${criticalUnexplained.length} unexplained critical variances found`);

      // Get branch config to check if we should block
      const { data: config } = await supabase
        .from('branch_food_control_config')
        .select('*')
        .eq('branch_id', branchId)
        .single();

      // For now, we'll send notifications but not block the shift close
      // This can be configured per branch in the future

      // Notify manager and chef
      const { data: managers } = await supabase
        .from('users')
        .select('id')
        .eq('branch_id', branchId)
        .eq('role', 'branch_manager');

      for (const manager of managers || []) {
        await notificationService.createNotification({
          user_id: manager.id,
          type: 'warning',
          category: 'food_control',
          title: 'Unexplained Variances Detected',
          message: `Shift ${shiftId} has ${criticalUnexplained.length} unexplained critical variances requiring attention`,
          priority: 'high',
          action_url: `/dashboard/branch-manager/food-control/variance/${shiftId}`
        });
      }

      // Get chef on duty
      const { data: shift } = await supabase
        .from('staff_shifts')
        .select('staff_id')
        .eq('id', shiftId)
        .single();

      if (shift?.staff_id) {
        await notificationService.createNotification({
          user_id: shift.staff_id,
          type: 'warning',
          category: 'food_control',
          title: 'Variance Explanation Required',
          message: `Your shift has ${criticalUnexplained.length} unexplained variances. Please provide explanations.`,
          priority: 'high',
          action_url: `/dashboard/kitchen-operations/variance/${shiftId}`
        });
      }
    }

    // Step 7: Auto-submit to accountant if configured
    const { data: config } = await supabase
      .from('branch_food_control_config')
      .select('auto_submit_to_accountant_on_close')
      .eq('branch_id', branchId)
      .single();

    if (config?.auto_submit_to_accountant_on_close && pnl) {
      try {
        await submitForAccountantReview(shiftId, 'system');
        logger.info(`[Shift Close Hook] Shift P&L auto-submitted to accountant for shift ${shiftId}`);
      } catch (error) {
        logger.error('[Shift Close Hook] Error auto-submitting to accountant:', error);
      }
    }

    logger.info(`[Shift Close Hook] Completed successfully for shift ${shiftId}`);

    return {
      blocked: false,
      pnl
    };

  } catch (error) {
    logger.error('[Shift Close Hook] Fatal error:', error);
    // Don't block shift close even if hook fails
    return {
      blocked: false,
      reason: 'hook_error'
    };
  }
}

/**
 * Check if shift can be closed (pre-close validation)
 */
export async function canCloseShift(
  shiftId: number,
  branchId: number
): Promise<{ canClose: boolean; reason?: string }> {
  try {
    // Check if there are any open buffets
    const { data: openBuffets } = await supabase
      .from('buffets')
      .select('id, name')
      .eq('shift_id', shiftId)
      .eq('branch_id', branchId)
      .in('status', ['planned', 'active']);

    if (openBuffets && openBuffets.length > 0) {
      return {
        canClose: false,
        reason: `Cannot close shift: ${openBuffets.length} buffet(s) still open (${openBuffets.map(b => b.name).join(', ')})`
      };
    }

    // Check if there are any in-progress catering events
    const { data: activeEvents } = await supabase
      .from('catering_events')
      .select('id, event_name')
      .eq('shift_id', shiftId)
      .eq('branch_id', branchId)
      .eq('status', 'in_progress');

    if (activeEvents && activeEvents.length > 0) {
      return {
        canClose: false,
        reason: `Cannot close shift: ${activeEvents.length} catering event(s) still in progress`
      };
    }

    return { canClose: true };

  } catch (error) {
    logger.error('Error checking if shift can close:', error);
    // Allow close even if check fails
    return { canClose: true };
  }
}
