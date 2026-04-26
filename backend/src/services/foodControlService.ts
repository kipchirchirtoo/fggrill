/**
 * Food Control Service
 * 
 * Core service for calculating theoretical vs actual usage,
 * variance analysis, and portion output conversion
 */

import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import {
  TheoreticalUsage,
  FoodVarianceReport,
  PortionOutput,
  FoodVariance,
  VarianceReason
} from '../types/foodControl';

// =====================================================
// THEORETICAL USAGE CALCULATIONS
// =====================================================

/**
 * Calculate theoretical ingredient usage from POS sales in a shift
 */
export async function calculatePOSTheoreticalUsage(
  shiftId: number,
  branchId: number
): Promise<Map<string, TheoreticalUsage>> {
  try {
    // Get all POS transactions for this shift
    const { data: transactions, error: txError } = await supabase
      .from('pos_transactions')
      .select(`
        id,
        items:pos_transaction_items(
          product_id,
          qty,
          product:restaurant_menu_items(
            id,
            name,
            recipes(
              id,
              ingredients:recipe_items(
                item_sku,
                item_name,
                quantity_per_portion,
                unit_of_measure,
                unit_cost
              )
            )
          )
        )
      `)
      .eq('branch_id', branchId)
      .eq('shift_id', shiftId)
      .eq('status', 'PAID');

    if (txError) throw txError;

    const usageMap = new Map<string, TheoreticalUsage>();

    // Process each transaction
    for (const tx of transactions || []) {
      for (const item of tx.items || []) {
        const product = Array.isArray(item.product) ? item.product[0] : item.product;
        const recipe = Array.isArray(product?.recipes) ? product.recipes[0] : product?.recipes;
        if (!recipe) continue;

        const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
        if (ingredients.length === 0) continue;

        // Calculate ingredient usage for this sale
        for (const ingredient of ingredients) {
          const key = ingredient.item_sku;
          const qty = Number(ingredient.quantity_per_portion) * Number(item.qty);

          if (usageMap.has(key)) {
            const existing = usageMap.get(key)!;
            existing.theoreticalQty += qty;
          } else {
            usageMap.set(key, {
              itemSku: ingredient.item_sku,
              ingredientName: ingredient.item_name,
              unit: ingredient.unit_of_measure,
              theoreticalQty: qty,
              actualQty: 0,
              variance: 0,
              varianceCost: 0,
              costPerUnit: ingredient.unit_cost || 0,
              status: 'ok'
            });
          }
        }
      }
    }

    return usageMap;
  } catch (error) {
    logger.error('Error calculating POS theoretical usage:', error);
    throw error;
  }
}

/**
 * Calculate theoretical ingredient usage for a buffet
 */
export async function calculateBuffetTheoreticalUsage(
  buffetId: string,
  branchId: number
): Promise<Map<string, TheoreticalUsage>> {
  try {
    // Get buffet with menu items and recipes
    const { data: buffet, error: buffetError } = await supabase
      .from('buffets')
      .select(`
        id,
        actual_guests,
        expected_guests,
        menu_items:buffet_menu_items(
          portion_per_guest,
          recipe:recipes(
            id,
            ingredients:recipe_items(
              item_sku,
              item_name,
              quantity_per_portion,
              unit_of_measure,
              unit_cost
            )
          )
        )
      `)
      .eq('id', buffetId)
      .eq('branch_id', branchId)
      .single();

    if (buffetError) throw buffetError;

    const usageMap = new Map<string, TheoreticalUsage>();
    const guests = buffet.actual_guests || buffet.expected_guests;

    // Process each menu item
    for (const menuItem of buffet.menu_items || []) {
      const recipe = Array.isArray(menuItem.recipe) ? menuItem.recipe[0] : menuItem.recipe;
      if (!recipe) continue;

      const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
      if (ingredients.length === 0) continue;

      // Calculate ingredient usage for this buffet item
      for (const ingredient of ingredients) {
        const key = ingredient.item_sku;
        const qty = Number(ingredient.quantity_per_portion) * Number(menuItem.portion_per_guest) * guests;

        if (usageMap.has(key)) {
          const existing = usageMap.get(key)!;
          existing.theoreticalQty += qty;
        } else {
          usageMap.set(key, {
            itemSku: ingredient.item_sku,
            ingredientName: ingredient.item_name,
            unit: ingredient.unit_of_measure,
            theoreticalQty: qty,
            actualQty: 0,
            variance: 0,
            varianceCost: 0,
            costPerUnit: ingredient.unit_cost || 0,
            status: 'ok'
          });
        }
      }
    }

    return usageMap;
  } catch (error) {
    logger.error('Error calculating buffet theoretical usage:', error);
    throw error;
  }
}

/**
 * Calculate theoretical ingredient usage for a catering event
 */
export async function calculateCateringTheoreticalUsage(
  eventId: string,
  branchId: number
): Promise<Map<string, TheoreticalUsage>> {
  try {
    // Get catering event with menu items and recipes
    const { data: event, error: eventError } = await supabase
      .from('catering_events')
      .select(`
        id,
        actual_guests,
        expected_guests,
        menu_items:catering_menu_items(
          quantity_expected,
          quantity_actual,
          recipe:recipes(
            id,
            ingredients:recipe_items(
              item_sku,
              item_name,
              quantity_per_portion,
              unit_of_measure,
              unit_cost
            )
          )
        )
      `)
      .eq('id', eventId)
      .eq('branch_id', branchId)
      .single();

    if (eventError) throw eventError;

    const usageMap = new Map<string, TheoreticalUsage>();

    // Process each menu item
    for (const menuItem of event.menu_items || []) {
      const recipe = Array.isArray(menuItem.recipe) ? menuItem.recipe[0] : menuItem.recipe;
      if (!recipe) continue;

      const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
      if (ingredients.length === 0) continue;

      const quantity = Number(menuItem.quantity_actual || menuItem.quantity_expected);

      // Calculate ingredient usage for this catering item
      for (const ingredient of ingredients) {
        const key = ingredient.item_sku;
        const qty = Number(ingredient.quantity_per_portion) * quantity;

        if (usageMap.has(key)) {
          const existing = usageMap.get(key)!;
          existing.theoreticalQty += qty;
        } else {
          usageMap.set(key, {
            itemSku: ingredient.item_sku,
            ingredientName: ingredient.item_name,
            unit: ingredient.unit_of_measure,
            theoreticalQty: qty,
            actualQty: 0,
            variance: 0,
            varianceCost: 0,
            costPerUnit: ingredient.unit_cost || 0,
            status: 'ok'
          });
        }
      }
    }

    return usageMap;
  } catch (error) {
    logger.error('Error calculating catering theoretical usage:', error);
    throw error;
  }
}

// =====================================================
// ACTUAL USAGE RETRIEVAL
// =====================================================

/**
 * Get actual ingredient usage from stock issues for a shift
 */
export async function getActualUsageByShift(
  shiftId: number,
  referenceType: string,
  referenceId?: string,
  branchId?: number
): Promise<Map<string, number>> {
  try {
    let query = supabase
      .from('stock_issues')
      .select('item_sku, quantity_issued')
      .eq('shift_id', shiftId)
      .eq('reference_type', referenceType);

    if (referenceId) {
      query = query.eq('reference_id', referenceId);
    }

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data: issues, error } = await query;

    if (error) throw error;

    const usageMap = new Map<string, number>();

    for (const issue of issues || []) {
      const key = issue.item_sku;
      if (usageMap.has(key)) {
        usageMap.set(key, usageMap.get(key)! + issue.quantity_issued);
      } else {
        usageMap.set(key, issue.quantity_issued);
      }
    }

    return usageMap;
  } catch (error) {
    logger.error('Error getting actual usage by shift:', error);
    throw error;
  }
}

// =====================================================
// VARIANCE CALCULATION ENGINE
// =====================================================

/**
 * Compute variance between theoretical and actual usage
 */
export async function computeVariance(
  shiftId: number,
  referenceType: 'POS' | 'BUFFET' | 'CATERING',
  referenceId: string | undefined,
  branchId: number
): Promise<FoodVarianceReport> {
  try {
    // Get branch config for thresholds
    const { data: config } = await supabase
      .from('branch_food_control_config')
      .select('*')
      .eq('branch_id', branchId)
      .single();

    const varianceThresholdKes = config?.variance_threshold_kes || 200;
    const varianceThresholdPercent = config?.variance_threshold_percent || 10;

    // Calculate theoretical usage based on reference type
    let theoreticalMap: Map<string, TheoreticalUsage>;

    if (referenceType === 'POS') {
      theoreticalMap = await calculatePOSTheoreticalUsage(shiftId, branchId);
    } else if (referenceType === 'BUFFET' && referenceId) {
      theoreticalMap = await calculateBuffetTheoreticalUsage(referenceId, branchId);
    } else if (referenceType === 'CATERING' && referenceId) {
      theoreticalMap = await calculateCateringTheoreticalUsage(referenceId, branchId);
    } else {
      throw new Error('Invalid reference type or missing reference ID');
    }

    // Get actual usage
    const actualMap = await getActualUsageByShift(shiftId, referenceType, referenceId, branchId);

    // Combine theoretical and actual to calculate variance
    const items: TheoreticalUsage[] = [];
    let totalVarianceCost = 0;
    const flaggedItems: TheoreticalUsage[] = [];

    // Process all items from theoretical usage
    for (const [sku, theoretical] of theoreticalMap.entries()) {
      const actualQty = actualMap.get(sku) || 0;
      const variance = actualQty - theoretical.theoreticalQty;
      const varianceCost = variance * theoretical.costPerUnit;
      const variancePercent = theoretical.theoreticalQty > 0 
        ? Math.abs(variance / theoretical.theoreticalQty * 100) 
        : 0;

      // Determine status
      let status: 'ok' | 'warning' | 'critical' = 'ok';
      let requiresExplanation = false;

      if (Math.abs(varianceCost) > varianceThresholdKes || variancePercent > varianceThresholdPercent) {
        status = 'critical';
        requiresExplanation = true;
      } else if (variance > 0) {
        status = 'warning';
      }

      const item: TheoreticalUsage = {
        ...theoretical,
        actualQty,
        variance,
        varianceCost,
        status
      };

      items.push(item);
      totalVarianceCost += varianceCost;

      if (status === 'critical') {
        flaggedItems.push(item);
      }

      // Upsert variance record to database
      await supabase
        .from('food_control_variance')
        .upsert({
          shift_id: shiftId,
          item_sku: sku,
          item_name: theoretical.ingredientName,
          reference_type: referenceType,
          reference_id: referenceId,
          theoretical_usage: theoretical.theoreticalQty,
          actual_usage: actualQty,
          variance_cost: varianceCost,
          requires_explanation: requiresExplanation,
          status: requiresExplanation ? 'pending' : 'approved',
          branch_id: branchId
        }, {
          onConflict: 'shift_id,item_sku,reference_type,reference_id'
        });
    }

    // Check for items in actual but not in theoretical (unexpected usage)
    for (const [sku, actualQty] of actualMap.entries()) {
      if (!theoreticalMap.has(sku)) {
        // Get item details
        const { data: item } = await supabase
          .from('inventory_items')
          .select('item_name, cost_per_unit')
          .eq('sku', sku)
          .single();

        const costPerUnit = item?.cost_per_unit || 0;
        const varianceCost = actualQty * costPerUnit;

        const unexpectedItem: TheoreticalUsage = {
          itemSku: sku,
          ingredientName: item?.item_name || sku,
          unit: '',
          theoreticalQty: 0,
          actualQty,
          variance: actualQty,
          varianceCost,
          costPerUnit,
          status: 'critical'
        };

        items.push(unexpectedItem);
        flaggedItems.push(unexpectedItem);
        totalVarianceCost += varianceCost;

        // Insert variance record
        await supabase
          .from('food_control_variance')
          .upsert({
            shift_id: shiftId,
            item_sku: sku,
            item_name: item?.item_name || sku,
            reference_type: referenceType,
            reference_id: referenceId,
            theoretical_usage: 0,
            actual_usage: actualQty,
            variance_cost: varianceCost,
            requires_explanation: true,
            status: 'pending',
            branch_id: branchId
          }, {
            onConflict: 'shift_id,item_sku,reference_type,reference_id'
          });
      }
    }

    return {
      shiftId,
      referenceType,
      referenceId,
      items,
      totalVarianceCost,
      flaggedItems,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error computing variance:', error);
    throw error;
  }
}

// =====================================================
// PORTION OUTPUT CONVERSION
// =====================================================

/**
 * Calculate portion output: issued stock → expected portions vs actual sold
 */
export async function getPortionOutputConversion(
  shiftId: number,
  branchId: number
): Promise<PortionOutput[]> {
  try {
    // Get all stock issues for this shift
    const { data: issues, error: issuesError } = await supabase
      .from('stock_issues')
      .select('item_sku, quantity_issued')
      .eq('shift_id', shiftId)
      .eq('branch_id', branchId)
      .eq('issued_to', 'kitchen');

    if (issuesError) throw issuesError;

    const outputs: PortionOutput[] = [];

    // Group issues by item
    const issueMap = new Map<string, number>();
    for (const issue of issues || []) {
      const key = issue.item_sku;
      if (issueMap.has(key)) {
        issueMap.set(key, issueMap.get(key)! + issue.quantity_issued);
      } else {
        issueMap.set(key, issue.quantity_issued);
      }
    }

    // For each issued item, calculate expected portions
    for (const [sku, issuedQty] of issueMap.entries()) {
      // Find recipes that use this ingredient
      const { data: recipeItems, error: recipeError } = await supabase
        .from('recipe_items')
        .select(`
          quantity_per_portion,
          unit_of_measure,
          recipe:recipes(
            id,
            menu_item_name,
            portions_per_recipe
          )
        `)
        .eq('item_sku', sku);

      if (recipeError) continue;

      if (!recipeItems || recipeItems.length === 0) continue;

      // Use the first recipe (most common case)
      const recipeItem = recipeItems[0];
      const qtyPerPortion = recipeItem.quantity_per_portion;
      const expectedPortions = qtyPerPortion > 0 ? issuedQty / qtyPerPortion : 0;

      // Get actual portions sold from POS
      const { data: sales, error: salesError } = await supabase
        .from('pos_transaction_items')
        .select(`
          qty,
          transaction:pos_transactions!inner(shift_id, status)
        `)
        .eq('transaction.shift_id', shiftId)
        .eq('transaction.status', 'PAID');

      if (salesError) continue;

      const actualSold = sales?.reduce((sum, sale) => sum + sale.qty, 0) || 0;
      const gap = expectedPortions - actualSold;

      // Get item details for cost
      const { data: item } = await supabase
        .from('inventory_items')
        .select('item_name, cost_per_unit')
        .eq('sku', sku)
        .single();

      const gapCost = gap * (item?.cost_per_unit || 0) * qtyPerPortion;

      outputs.push({
        ingredient: item?.item_name || sku,
        itemSku: sku,
        issuedQty,
        expectedPortions: Math.round(expectedPortions),
        actualSold,
        gap: Math.round(gap),
        gapCost,
        unit: recipeItem.unit_of_measure
      });
    }

    return outputs;
  } catch (error) {
    logger.error('Error calculating portion output:', error);
    throw error;
  }
}

// =====================================================
// VARIANCE EXPLANATION
// =====================================================

/**
 * Explain a variance item
 */
export async function explainVariance(
  varianceId: string,
  userId: string,
  reason: VarianceReason,
  description: string
): Promise<FoodVariance> {
  try {
    const { data, error } = await supabase
      .from('food_control_variance')
      .update({
        variance_reason: reason,
        reason_description: description,
        explained_by: userId,
        explained_at: new Date().toISOString(),
        status: 'explained'
      })
      .eq('id', varianceId)
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    logger.error('Error explaining variance:', error);
    throw error;
  }
}

/**
 * Flag a variance for audit
 */
export async function flagVariance(
  varianceId: string,
  userId: string,
  notes?: string
): Promise<FoodVariance> {
  try {
    const { data, error } = await supabase
      .from('food_control_variance')
      .update({
        status: 'flagged',
        flagged_by: userId,
        flagged_at: new Date().toISOString(),
        reason_description: notes
      })
      .eq('id', varianceId)
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    logger.error('Error flagging variance:', error);
    throw error;
  }
}

/**
 * Get unexplained variances for a branch
 */
export async function getUnexplainedVariances(
  branchId: number,
  shiftId?: number
): Promise<FoodVariance[]> {
  try {
    let query = supabase
      .from('food_control_variance')
      .select('*')
      .eq('branch_id', branchId)
      .eq('requires_explanation', true)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (shiftId) {
      query = query.eq('shift_id', shiftId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data || [];
  } catch (error) {
    logger.error('Error getting unexplained variances:', error);
    throw error;
  }
}
