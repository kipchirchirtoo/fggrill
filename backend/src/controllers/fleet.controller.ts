import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';

// =====================================================
// VEHICLES
// =====================================================

// @desc    Get all vehicles
// @route   GET /api/fleet/vehicles
// @access  Private
export const getVehicles = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, vehicle_type } = req.query;

    let query = supabase
      .from('vehicles')
      .select('*')
      .order('vehicle_number', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    if (vehicle_type) {
      query = query.eq('vehicle_type', vehicle_type);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.status(200).json({
      success: true,
      count: data?.length || 0,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single vehicle
// @route   GET /api/fleet/vehicles/:id
// @access  Private
export const getVehicle = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .select(`
        *,
        assignments:vehicle_assignments(
          *,
          driver:users(id, first_name, last_name),
          transfer:stock_transfers(id, transfer_number)
        )
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) {
      res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create vehicle
// @route   POST /api/fleet/vehicles
// @access  Private (Admin, Manager)
export const createVehicle = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { vehicle_number, vehicle_type, capacity, current_mileage, last_service_date } = req.body;

    const vehicle = {
      vehicle_number,
      vehicle_type,
      capacity,
      current_mileage,
      last_service_date,
      status: 'available',
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('vehicles')
      .insert([vehicle])
      .select()
      .single();

    if (error) throw error;

    logger.info(`Vehicle created: ${vehicle_number} by user ${req.user.id}`);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// =====================================================
// VEHICLE ASSIGNMENTS
// =====================================================

// @desc    Assign vehicle
// @route   POST /api/fleet/assignments
// @access  Private (Manager)
export const assignVehicle = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { vehicle_id, driver_id, transfer_id, start_time, start_mileage } = req.body;

    const assignment = {
      vehicle_id,
      driver_id,
      transfer_id,
      start_time: start_time || new Date().toISOString(),
      start_mileage,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('vehicle_assignments')
      .insert([assignment])
      .select()
      .single();

    if (error) throw error;

    // Update vehicle status
    await supabase
      .from('vehicles')
      .update({ status: 'in_use' })
      .eq('id', vehicle_id);

    logger.info(`Vehicle ${vehicle_id} assigned to driver ${driver_id}`);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};
