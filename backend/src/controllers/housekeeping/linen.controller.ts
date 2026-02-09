// =====================================================
// HOUSEKEEPING LINEN MANAGEMENT CONTROLLER
// =====================================================

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';

/**
 * @desc    Get all linen types
 * @route   GET /api/housekeeping/linen/types
 * @access  Private
 */
export const getLinenTypes = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { category } = req.query;

    let query = supabase
      .from('hk_linen_types')
      .select('*')
      .eq('is_active', true)
      .order('category')
      .order('name');

    if (category) query = query.eq('category', category);

    const { data: types, error } = await query;
    if (error) throw error;

    res.status(200).json({ success: true, data: types });
  } catch (error) {
    logger.error('Error fetching linen types:', error);
    next(error);
  }
};

/**
 * @desc    Get linen inventory summary
 * @route   GET /api/housekeeping/linen/inventory
 * @access  Private
 */
export const getLinenInventory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { locationType, status } = req.query;
    const branchId = req.query.branchId as string || req.user?.branchId;

    let query = supabase
      .from('hk_linen_inventory')
      .select(`
        *,
        linen_type:hk_linen_types(id, name, category, size)
      `)
      .eq('branch_id', branchId);

    if (locationType) query = query.eq('location_type', locationType);
    if (status) query = query.eq('status', status);

    const { data: inventory, error } = await query;
    if (error) throw error;

    // Group by type and status
    const summary: Record<string, any> = {};
    (inventory || []).forEach(item => {
      const typeName = item.linen_type?.name || 'Unknown';
      if (!summary[typeName]) {
        summary[typeName] = {
          type: item.linen_type,
          clean_available: 0,
          in_use: 0,
          soiled_collected: 0,
          in_laundry: 0,
          damaged: 0,
          total: 0
        };
      }
      summary[typeName][item.status]++;
      summary[typeName].total++;
    });

    res.status(200).json({
      success: true,
      data: {
        items: inventory,
        summary: Object.values(summary)
      }
    });
  } catch (error) {
    logger.error('Error fetching linen inventory:', error);
    next(error);
  }
};

/**
 * @desc    Record linen transaction
 * @route   POST /api/housekeeping/linen/transactions
 * @access  Private
 */
export const recordTransaction = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      linenTypeId,
      transactionType,
      quantity,
      fromLocation,
      toLocation,
      taskId,
      roomId,
      staffId,
      notes
    } = req.body;

    const { data: transaction, error } = await supabase
      .from('hk_linen_transactions')
      .insert([{
        linen_type_id: linenTypeId,
        transaction_type: transactionType,
        quantity,
        from_location: fromLocation,
        to_location: toLocation,
        task_id: taskId,
        room_id: roomId,
        staff_id: staffId,
        notes,
        created_by: req.user?.id
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, data: transaction });
    logger.info(`Linen transaction recorded: ${transactionType} x${quantity}`);
  } catch (error) {
    logger.error('Error recording linen transaction:', error);
    next(error);
  }
};

/**
 * @desc    Get linen transactions history
 * @route   GET /api/housekeeping/linen/transactions
 * @access  Private
 */
export const getTransactions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const { linenTypeId, transactionType, date } = req.query;

    let query = supabase
      .from('hk_linen_transactions')
      .select(`
        *,
        linen_type:hk_linen_types(name, category),
        staff:hk_staff_profiles(staff_code, user:users!user_id(first_name, last_name)),
        created_by_user:users!created_by(first_name, last_name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (linenTypeId) query = query.eq('linen_type_id', linenTypeId);
    if (transactionType) query = query.eq('transaction_type', transactionType);
    if (date) query = query.gte('created_at', `${date}T00:00:00`).lte('created_at', `${date}T23:59:59`);

    const { data: transactions, error, count } = await query;
    if (error) throw error;

    res.status(200).json({
      success: true,
      count: transactions?.length || 0,
      total: count || 0,
      page,
      pages: Math.ceil((count || 0) / limit),
      data: transactions
    });
  } catch (error) {
    logger.error('Error fetching linen transactions:', error);
    next(error);
  }
};

/**
 * @desc    Issue linen to staff/floor
 * @route   POST /api/housekeeping/linen/issue
 * @access  Private (Linen Room Staff)
 */
export const issueLinen = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { items, staffId, floorNumber } = req.body;
    // items: [{ linenTypeId, quantity }]

    const transactions = [];
    for (const item of items) {
      const { data: transaction } = await supabase
        .from('hk_linen_transactions')
        .insert([{
          linen_type_id: item.linenTypeId,
          transaction_type: 'issue',
          quantity: item.quantity,
          from_location: 'central_store',
          to_location: floorNumber ? `floor_${floorNumber}` : `staff_${staffId}`,
          staff_id: staffId,
          created_by: req.user?.id
        }])
        .select()
        .single();

      transactions.push(transaction);
    }

    res.status(201).json({ success: true, data: transactions });
  } catch (error) {
    logger.error('Error issuing linen:', error);
    next(error);
  }
};

/**
 * @desc    Return soiled linen
 * @route   POST /api/housekeeping/linen/return
 * @access  Private
 */
export const returnLinen = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { items, staffId, fromLocation } = req.body;
    // items: [{ linenTypeId, quantity, condition }]

    const transactions = [];
    for (const item of items) {
      const { data: transaction } = await supabase
        .from('hk_linen_transactions')
        .insert([{
          linen_type_id: item.linenTypeId,
          transaction_type: 'return',
          quantity: item.quantity,
          from_location: fromLocation,
          to_location: item.condition === 'damaged' ? 'damaged_bin' : 'soiled_collection',
          staff_id: staffId,
          notes: item.condition === 'damaged' ? 'Damaged linen' : null,
          created_by: req.user?.id
        }])
        .select()
        .single();

      transactions.push(transaction);
    }

    res.status(201).json({ success: true, data: transactions });
  } catch (error) {
    logger.error('Error returning linen:', error);
    next(error);
  }
};

/**
 * @desc    Get linen par levels status
 * @route   GET /api/housekeeping/linen/par-levels
 * @access  Private
 */
export const getParLevelStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = req.query.branchId as string || req.user?.branchId;

    // Get types with par levels
    const { data: types, error: typesError } = await supabase
      .from('hk_linen_types')
      .select('*')
      .eq('is_active', true);

    if (typesError) throw typesError;

    // Get current inventory counts
    const { data: inventory, error: invError } = await supabase
      .from('hk_linen_inventory')
      .select('linen_type_id, status')
      .eq('branch_id', branchId)
      .eq('status', 'clean_available');

    if (invError) throw invError;

    // Calculate par status for each type
    const parStatus = (types || []).map(type => {
      const currentCount = (inventory || []).filter(i => i.linen_type_id === type.id).length;
      const parLevel = type.par_level_central;
      const percentage = parLevel > 0 ? Math.round((currentCount / parLevel) * 100) : 100;

      return {
        id: type.id,
        name: type.name,
        category: type.category,
        size: type.size,
        current: currentCount,
        parLevel,
        percentage,
        status: percentage >= 100 ? 'adequate' : percentage >= 50 ? 'low' : 'critical'
      };
    });

    res.status(200).json({ success: true, data: parStatus });
  } catch (error) {
    logger.error('Error fetching par level status:', error);
    next(error);
  }
};
