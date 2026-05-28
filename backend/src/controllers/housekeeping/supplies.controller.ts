import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';

const toPositiveInt = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
};

const resolveStaffProfileId = async (req: Request, explicitStaffId?: unknown): Promise<string | null> => {
  if (explicitStaffId) return String(explicitStaffId);

  const userId = req.user?.id;
  if (!userId) return null;

  let query = supabase
    .from('staff_profiles')
    .select('id')
    .eq('user_id', userId);

  const branchId = req.user?.branch_id ?? req.user?.branchId;
  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    logger.warn('Unable to resolve housekeeping supply requester staff profile', {
      userId,
      branchId,
      error
    });
    return null;
  }

  return data?.id || null;
};

export const getSuppliesInventory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { search, status } = req.query;

    let query = supabase
      .from('housekeeping_supplies')
      .select(`
        *,
        category:housekeeping_supply_categories(id, name, description)
      `)
      .order('name', { ascending: true });

    if (status) {
      query = query.eq('status', String(status));
    }

    if (search) {
      query = query.ilike('name', `%${String(search).trim()}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({
      success: true,
      count: data?.length || 0,
      data: data || []
    });
  } catch (error) {
    next(error);
  }
};

export const requestSupplies = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const supplyId = req.body.supply_id ?? req.body.supplyId;
    const quantity = toPositiveInt(req.body.quantity);
    const requestedBy = await resolveStaffProfileId(
      req,
      req.body.requested_by ?? req.body.requestedBy ?? req.body.staff_id ?? req.body.staffId
    );

    if (!supplyId || !quantity) {
      res.status(400).json({
        success: false,
        message: 'Supply id and a positive quantity are required'
      });
      return;
    }

    if (!requestedBy) {
      res.status(400).json({
        success: false,
        message: 'A staff profile is required to request supplies'
      });
      return;
    }

    const { data, error } = await supabase
      .from('housekeeping_supply_requests')
      .insert({
        supply_id: supplyId,
        requested_by: requestedBy,
        quantity,
        urgency: req.body.urgency || req.body.priority || 'normal',
        notes: req.body.notes || null,
        status: 'pending'
      })
      .select(`
        *,
        supply:housekeeping_supplies(id, name, unit, current_stock, minimum_stock),
        requester:staff_profiles!requested_by(id, first_name, last_name, employee_id)
      `)
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Supply request submitted successfully',
      data
    });
  } catch (error) {
    next(error);
  }
};
