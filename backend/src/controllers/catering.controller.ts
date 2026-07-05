/**
 * Catering Controller
 * 
 * Handles catering event management, stock allocation, and P&L calculation
 */

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

type CreateCateringEventInput = {
  clientName: string;
  clientPhone?: string | null;
  clientEmail?: string | null;
  eventName?: string | null;
  eventDate: string;
  eventTime?: string | null;
  location: string;
  expectedGuests: number;
  agreedPrice: number;
  depositPaid?: number | null;
  leadChef?: string | null;
  cateringManager?: string | null;
  notes?: string | null;
  menuItems?: Array<{
    menuItemId?: string | null;
    menuItemName: string;
    quantityExpected: number;
    recipeId?: number | null;
  }>;
};

type AllocateStockInput = {
  allocations: Array<{
    itemSku: string;
    itemName: string;
    quantityAllocated: number;
    unitCost?: number | null;
  }>;
};

type RecordActualInput = {
  actualGuests: number;
  notes?: string | null;
  returns?: Array<{
    allocationId: string;
    quantityReturned: number;
  }>;
};

/**
 * @desc    Get all catering events
 * @route   GET /api/v1/catering/events
 * @access  Private (Manager, Accountant, Auditor)
 */
export const getCateringEvents = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = (req as any).user?.branch_id;
    const { status, startDate, endDate } = req.query;

    let query = supabase
      .from('catering_events')
      .select(`
        *,
        menu_items:catering_menu_items(
          id,
          menu_item_name,
          quantity_expected,
          quantity_actual
        ),
        lead_chef_user:users!catering_events_lead_chef_fkey(first_name, last_name),
        manager_user:users!catering_events_catering_manager_fkey(first_name, last_name)
      `)
      .eq('branch_id', branchId)
      .order('event_date', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (startDate) {
      query = query.gte('event_date', startDate);
    }

    if (endDate) {
      query = query.lte('event_date', endDate);
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
 * @desc    Get single catering event
 * @route   GET /api/v1/catering/events/:id
 * @access  Private
 */
export const getCateringEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = (req as any).user?.branch_id;

    const { data, error } = await supabase
      .from('catering_events')
      .select(`
        *,
        menu_items:catering_menu_items(
          id,
          menu_item_id,
          menu_item_name,
          quantity_expected,
          quantity_actual,
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
        stock_allocations:catering_stock_allocations(
          id,
          item_sku,
          item_name,
          quantity_allocated,
          quantity_returned,
          quantity_used,
          unit_cost,
          total_cost,
          allocated_at,
          allocated_by_user:users!catering_stock_allocations_allocated_by_fkey(first_name, last_name)
        ),
        lead_chef_user:users!catering_events_lead_chef_fkey(first_name, last_name),
        manager_user:users!catering_events_catering_manager_fkey(first_name, last_name),
        created_by_user:users!catering_events_created_by_fkey(first_name, last_name)
      `)
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new AppError('Catering event not found', 404);
      }
      throw error;
    }

    // Calculate P&L
    const totalCost = data.stock_allocations?.reduce((sum: number, alloc: any) => 
      sum + Number(alloc.total_cost || 0), 0) || 0;
    const profit = Number(data.agreed_price) - totalCost;
    const profitMargin = data.agreed_price > 0 ? (profit / data.agreed_price * 100) : 0;

    res.json({
      success: true,
      data: {
        ...data,
        pnl: {
          revenue: data.agreed_price,
          cost: totalCost,
          profit,
          profitMargin
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create catering event
 * @route   POST /api/v1/catering/events
 * @access  Private (Manager)
 */
export const createCateringEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = (req as any).user?.branch_id;
    const userId = (req as any).user?.id;
    const input: CreateCateringEventInput = req.body;

    // Validate required fields
    if (!input.clientName || !input.eventDate || !input.location || !input.expectedGuests || !input.agreedPrice) {
      throw new AppError('Missing required fields', 400);
    }

    // Create catering event
    const { data: event, error: eventError } = await supabase
      .from('catering_events')
      .insert({
        client_name: input.clientName,
        client_phone: input.clientPhone,
        client_email: input.clientEmail,
        event_name: input.eventName,
        event_date: input.eventDate,
        event_time: input.eventTime,
        location: input.location,
        expected_guests: input.expectedGuests,
        agreed_price: input.agreedPrice,
        deposit_paid: input.depositPaid || 0,
        lead_chef: input.leadChef,
        catering_manager: input.cateringManager,
        notes: input.notes,
        status: 'pending',
        branch_id: branchId,
        created_by: userId
      })
      .select()
      .single();

    if (eventError) throw eventError;

    // Add menu items if provided
    if (input.menuItems && input.menuItems.length > 0) {
      const menuItemsData = input.menuItems.map(item => ({
        event_id: event.id,
        menu_item_id: item.menuItemId,
        menu_item_name: item.menuItemName,
        quantity_expected: item.quantityExpected,
        recipe_id: item.recipeId
      }));

      const { error: menuError } = await supabase
        .from('catering_menu_items')
        .insert(menuItemsData);

      if (menuError) throw menuError;
    }

    logger.info(`Catering event created: ${event.id} by user ${userId}`);

    res.status(201).json({
      success: true,
      data: event,
      message: 'Catering event created successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update catering event
 * @route   PUT /api/v1/catering/events/:id
 * @access  Private (Manager)
 */
export const updateCateringEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = (req as any).user?.branch_id;
    const updateData = req.body;

    // Don't allow updating completed events
    const { data: existing } = await supabase
      .from('catering_events')
      .select('status')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();

    if (existing?.status === 'completed' || existing?.status === 'invoiced') {
      throw new AppError('Cannot update completed or invoiced event', 400);
    }

    const { data, error } = await supabase
      .from('catering_events')
      .update(updateData)
      .eq('id', id)
      .eq('branch_id', branchId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data,
      message: 'Catering event updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Allocate stock to catering event
 * @route   POST /api/v1/catering/events/:id/allocate-stock
 * @access  Private (Storekeeper, Manager)
 */
export const allocateStock = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = (req as any).user?.branch_id;
    const userId = (req as any).user?.id;
    const input: AllocateStockInput = req.body;

    if (!input.allocations || !Array.isArray(input.allocations) || input.allocations.length === 0) {
      throw new AppError('Allocations array is required', 400);
    }

    // Verify event exists
    const { data: event } = await supabase
      .from('catering_events')
      .select('status')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();

    if (!event) {
      throw new AppError('Catering event not found', 404);
    }

    // Insert allocations
    const allocationsData = input.allocations.map(alloc => ({
      event_id: id,
      item_sku: alloc.itemSku,
      item_name: alloc.itemName,
      quantity_allocated: alloc.quantityAllocated,
      unit_cost: alloc.unitCost,
      allocated_by: userId,
      branch_id: branchId
    }));

    const { data, error } = await supabase
      .from('catering_stock_allocations')
      .insert(allocationsData)
      .select();

    if (error) throw error;

    // Update event status to confirmed if still pending
    if (event.status === 'pending') {
      await supabase
        .from('catering_events')
        .update({ status: 'confirmed' })
        .eq('id', id);
    }

    logger.info(`Stock allocated to catering event ${id} by user ${userId}`);

    res.json({
      success: true,
      data,
      message: 'Stock allocated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Record actual guests and returns
 * @route   POST /api/v1/catering/events/:id/record-actual
 * @access  Private (Manager, Chef)
 */
export const recordActual = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = (req as any).user?.branch_id;
    const input: RecordActualInput = req.body;

    if (!input.actualGuests && input.actualGuests !== 0) {
      throw new AppError('Actual guest count is required', 400);
    }

    // Update event
    const { data: event, error: eventError } = await supabase
      .from('catering_events')
      .update({
        actual_guests: input.actualGuests,
        notes: input.notes,
        status: 'in_progress'
      })
      .eq('id', id)
      .eq('branch_id', branchId)
      .select()
      .single();

    if (eventError) throw eventError;

    // Update returns if provided
    if (input.returns && input.returns.length > 0) {
      for (const returnItem of input.returns) {
        await supabase
          .from('catering_stock_allocations')
          .update({
            quantity_returned: returnItem.quantityReturned
          })
          .eq('id', returnItem.allocationId)
          .eq('event_id', id);
      }
    }

    logger.info(`Actual data recorded for catering event ${id}`);

    res.json({
      success: true,
      data: event,
      message: 'Actual data recorded successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Complete catering event
 * @route   POST /api/v1/catering/events/:id/complete
 * @access  Private (Manager)
 */
export const completeEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = (req as any).user?.branch_id;

    // Update event status
    const { data: event, error: updateError } = await supabase
      .from('catering_events')
      .update({
        status: 'completed'
      })
      .eq('id', id)
      .eq('branch_id', branchId)
      .select()
      .single();

    if (updateError) throw updateError;

    logger.info(`Catering event completed: ${id}`);

    res.json({
      success: true,
      data: event,
      message: 'Catering event completed successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cancel catering event
 * @route   POST /api/v1/catering/events/:id/cancel
 * @access  Private (Manager)
 */
export const cancelEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = (req as any).user?.branch_id;
    const { reason } = req.body;

    const { data, error } = await supabase
      .from('catering_events')
      .update({
        status: 'cancelled',
        notes: reason
      })
      .eq('id', id)
      .eq('branch_id', branchId)
      .select()
      .single();

    if (error) throw error;

    logger.info(`Catering event cancelled: ${id}, reason: ${reason}`);

    res.json({
      success: true,
      data,
      message: 'Catering event cancelled successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add menu items to catering event
 * @route   POST /api/v1/catering/events/:id/menu-items
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

    // Verify event exists and is not completed
    const { data: event } = await supabase
      .from('catering_events')
      .select('status')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();

    if (!event) {
      throw new AppError('Catering event not found', 404);
    }

    if (event.status === 'completed' || event.status === 'invoiced') {
      throw new AppError('Cannot add items to completed or invoiced event', 400);
    }

    // Insert menu items
    const menuItemsData = menuItems.map((item: any) => ({
      event_id: id,
      menu_item_id: item.menuItemId,
      menu_item_name: item.menuItemName,
      quantity_expected: item.quantityExpected,
      recipe_id: item.recipeId
    }));

    const { data, error } = await supabase
      .from('catering_menu_items')
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
