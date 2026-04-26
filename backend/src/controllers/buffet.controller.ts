/**
 * Buffet Controller
 * 
 * Handles buffet event management, menu items, and variance calculation
 */

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { computeVariance } from '../services/foodControlService';
import { CreateBuffetInput, CloseBuffetInput } from '../types/foodControl';

/**
 * @desc    Get all buffets
 * @route   GET /api/v1/buffet
 * @access  Private (Manager, Accountant, Auditor)
 */
export const getBuffets = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = (req as any).user?.branch_id;
    const { status, startDate, endDate } = req.query;

    let query = supabase
      .from('buffets')
      .select(`
        *,
        menu_items:buffet_menu_items(
          id,
          menu_item_name,
          portion_per_guest
        )
      `)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single buffet
 * @route   GET /api/v1/buffet/:id
 * @access  Private
 */
export const getBuffet = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = (req as any).user?.branch_id;

    const { data, error } = await supabase
      .from('buffets')
      .select(`
        *,
        menu_items:buffet_menu_items(
          id,
          menu_item_id,
          menu_item_name,
          portion_per_guest,
          recipe:recipes(
            id,
            menu_item_name,
            standard_cost,
            ingredients:recipe_items(
              item_sku,
              item_name,
              quantity_per_portion,
              unit_of_measure,
              unit_cost
            )
          )
        ),
        opened_by_user:users!buffets_opened_by_fkey(first_name, last_name),
        closed_by_user:users!buffets_closed_by_fkey(first_name, last_name)
      `)
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new AppError('Buffet not found', 404);
      }
      throw error;
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create buffet
 * @route   POST /api/v1/buffet
 * @access  Private (Manager)
 */
export const createBuffet = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = (req as any).user?.branch_id;
    const userId = (req as any).user?.id;
    const input: CreateBuffetInput = req.body;

    // Validate required fields
    if (!input.name || !input.buffetType || !input.pricePerPerson || !input.expectedGuests) {
      throw new AppError('Missing required fields', 400);
    }

    // Create buffet
    const { data: buffet, error: buffetError } = await supabase
      .from('buffets')
      .insert({
        name: input.name,
        buffet_type: input.buffetType,
        price_per_person: input.pricePerPerson,
        expected_guests: input.expectedGuests,
        shift_id: input.shiftId,
        notes: input.notes,
        status: 'planned',
        branch_id: branchId,
        opened_by: userId
      })
      .select()
      .single();

    if (buffetError) throw buffetError;

    // Add menu items if provided
    if (input.menuItems && input.menuItems.length > 0) {
      const menuItemsData = input.menuItems.map(item => ({
        buffet_id: buffet.id,
        menu_item_id: item.menuItemId,
        menu_item_name: item.menuItemName,
        portion_per_guest: item.portionPerGuest,
        recipe_id: item.recipeId
      }));

      const { error: menuError } = await supabase
        .from('buffet_menu_items')
        .insert(menuItemsData);

      if (menuError) throw menuError;
    }

    logger.info(`Buffet created: ${buffet.id} by user ${userId}`);

    res.status(201).json({
      success: true,
      data: buffet,
      message: 'Buffet created successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update buffet
 * @route   PUT /api/v1/buffet/:id
 * @access  Private (Manager)
 */
export const updateBuffet = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = (req as any).user?.branch_id;
    const updateData = req.body;

    // Don't allow updating closed buffets
    const { data: existing } = await supabase
      .from('buffets')
      .select('status')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();

    if (existing?.status === 'closed') {
      throw new AppError('Cannot update closed buffet', 400);
    }

    const { data, error } = await supabase
      .from('buffets')
      .update(updateData)
      .eq('id', id)
      .eq('branch_id', branchId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data,
      message: 'Buffet updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Open buffet (set to active)
 * @route   POST /api/v1/buffet/:id/open
 * @access  Private (Manager, Chef)
 */
export const openBuffet = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = (req as any).user?.branch_id;
    const userId = (req as any).user?.id;

    const { data, error } = await supabase
      .from('buffets')
      .update({
        status: 'active',
        opened_by: userId,
        opened_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('branch_id', branchId)
      .select()
      .single();

    if (error) throw error;

    logger.info(`Buffet opened: ${id} by user ${userId}`);

    res.json({
      success: true,
      data,
      message: 'Buffet opened successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Close buffet and trigger variance calculation
 * @route   POST /api/v1/buffet/:id/close
 * @access  Private (Manager, Chef)
 */
export const closeBuffet = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = (req as any).user?.branch_id;
    const userId = (req as any).user?.id;
    const input: CloseBuffetInput = req.body;

    if (!input.actualGuests && input.actualGuests !== 0) {
      throw new AppError('Actual guest count is required', 400);
    }

    // Update buffet
    const { data: buffet, error: updateError } = await supabase
      .from('buffets')
      .update({
        status: 'closed',
        actual_guests: input.actualGuests,
        closed_by: userId,
        closed_at: new Date().toISOString(),
        notes: input.notes || null
      })
      .eq('id', id)
      .eq('branch_id', branchId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Trigger variance calculation if shift_id exists
    if (buffet.shift_id) {
      try {
        await computeVariance(buffet.shift_id, 'BUFFET', id, branchId);
        logger.info(`Variance calculated for buffet ${id}, shift ${buffet.shift_id}`);
      } catch (varianceError) {
        logger.error('Error calculating buffet variance:', varianceError);
        // Don't fail the close operation if variance calculation fails
      }
    }

    logger.info(`Buffet closed: ${id} by user ${userId}, actual guests: ${input.actualGuests}`);

    res.json({
      success: true,
      data: buffet,
      message: 'Buffet closed successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add menu items to buffet
 * @route   POST /api/v1/buffet/:id/menu-items
 * @access  Private (Manager)
 */
export const addMenuItems = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = (req as any).user?.branch_id;
    const { menuItems } = req.body;

    if (!menuItems || !Array.isArray(menuItems) || menuItems.length === 0) {
      throw new AppError('Menu items array is required', 400);
    }

    // Verify buffet exists and is not closed
    const { data: buffet } = await supabase
      .from('buffets')
      .select('status')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();

    if (!buffet) {
      throw new AppError('Buffet not found', 404);
    }

    if (buffet.status === 'closed') {
      throw new AppError('Cannot add items to closed buffet', 400);
    }

    // Insert menu items
    const menuItemsData = menuItems.map((item: any) => ({
      buffet_id: id,
      menu_item_id: item.menuItemId,
      menu_item_name: item.menuItemName,
      portion_per_guest: item.portionPerGuest || 1.0,
      recipe_id: item.recipeId
    }));

    const { data, error } = await supabase
      .from('buffet_menu_items')
      .insert(menuItemsData)
      .select();

    if (error) throw error;

    res.json({
      success: true,
      data,
      message: 'Menu items added successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Remove menu item from buffet
 * @route   DELETE /api/v1/buffet/:id/menu-items/:itemId
 * @access  Private (Manager)
 */
export const removeMenuItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id, itemId } = req.params;
    const branchId = (req as any).user?.branch_id;

    // Verify buffet exists and is not closed
    const { data: buffet } = await supabase
      .from('buffets')
      .select('status')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();

    if (!buffet) {
      throw new AppError('Buffet not found', 404);
    }

    if (buffet.status === 'closed') {
      throw new AppError('Cannot remove items from closed buffet', 400);
    }

    const { error } = await supabase
      .from('buffet_menu_items')
      .delete()
      .eq('id', itemId)
      .eq('buffet_id', id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Menu item removed successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cancel buffet
 * @route   POST /api/v1/buffet/:id/cancel
 * @access  Private (Manager)
 */
export const cancelBuffet = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = (req as any).user?.branch_id;
    const { reason } = req.body;

    const { data, error } = await supabase
      .from('buffets')
      .update({
        status: 'cancelled',
        notes: reason
      })
      .eq('id', id)
      .eq('branch_id', branchId)
      .select()
      .single();

    if (error) throw error;

    logger.info(`Buffet cancelled: ${id}, reason: ${reason}`);

    res.json({
      success: true,
      data,
      message: 'Buffet cancelled successfully'
    });
  } catch (error) {
    next(error);
  }
};
