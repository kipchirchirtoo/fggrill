/**
 * GPS Tracking Controller
 * Handles real-time location updates for dispatches
 */

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

/**
 * Update dispatch location (GPS tracking)
 * POST /api/dispatch/dispatches/:id/location
 */
export const updateDispatchLocation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { latitude, longitude, accuracy, timestamp } = req.body;
    const userId = req.user?.id;

    if (!latitude || !longitude) {
      throw new AppError('Latitude and longitude are required', 400);
    }

    // Validate coordinates
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new AppError('Invalid coordinates', 400);
    }

    // Check if dispatch exists
    const { data: dispatch, error: dispatchError } = await supabase
      .from('store_dispatches')
      .select('id, status, driver_id')
      .eq('id', id)
      .single();

    if (dispatchError || !dispatch) {
      throw new AppError('Dispatch not found', 404);
    }

    // Verify user is the assigned driver
    if (dispatch.driver_id && dispatch.driver_id !== userId) {
      throw new AppError('Unauthorized: You are not the assigned driver', 403);
    }

    // Insert location tracking record
    const { data: locationData, error: locationError } = await supabase
      .from('dispatch_tracking')
      .insert({
        dispatch_id: id,
        latitude,
        longitude,
        accuracy: accuracy || null,
        recorded_at: timestamp || new Date().toISOString(),
        recorded_by: userId,
      })
      .select()
      .single();

    if (locationError) {
      logger.error('Error saving location:', locationError);
      throw new AppError('Failed to save location', 500);
    }

    // Update dispatch with latest location
    await supabase
      .from('store_dispatches')
      .update({
        last_location_lat: latitude,
        last_location_lng: longitude,
        last_location_at: timestamp || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    res.status(200).json({
      success: true,
      message: 'Location updated successfully',
      data: locationData,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get dispatch location history
 * GET /api/dispatch/dispatches/:id/location
 */
export const getDispatchLocation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;

    // Get location tracking history
    const { data: locations, error } = await supabase
      .from('dispatch_tracking')
      .select('*')
      .eq('dispatch_id', id)
      .order('recorded_at', { ascending: false })
      .limit(Number(limit));

    if (error) {
      logger.error('Error fetching locations:', error);
      throw new AppError('Failed to fetch locations', 500);
    }

    // Get dispatch current location
    const { data: dispatch } = await supabase
      .from('store_dispatches')
      .select('last_location_lat, last_location_lng, last_location_at')
      .eq('id', id)
      .single();

    res.status(200).json({
      success: true,
      data: {
        current: dispatch ? {
          latitude: dispatch.last_location_lat,
          longitude: dispatch.last_location_lng,
          timestamp: dispatch.last_location_at,
        } : null,
        history: locations || [],
        count: locations?.length || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all active dispatches with locations (for central store map view)
 * GET /api/dispatch/tracking/active
 */
export const getActiveDispatchesWithLocation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data: dispatches, error } = await supabase
      .from('store_dispatches')
      .select(`
        id,
        dispatch_number,
        status,
        to_branch_id,
        driver_id,
        last_location_lat,
        last_location_lng,
        last_location_at,
        created_at,
        branches!to_branch_id(id, name, code),
        drivers(id, name, phone)
      `)
      .in('status', ['DISPATCHED', 'IN_TRANSIT'])
      .not('last_location_lat', 'is', null)
      .not('last_location_lng', 'is', null)
      .order('last_location_at', { ascending: false });

    if (error) {
      logger.error('Error fetching active dispatches:', error);
      throw new AppError('Failed to fetch active dispatches', 500);
    }

    res.status(200).json({
      success: true,
      count: dispatches?.length || 0,
      data: dispatches || [],
    });
  } catch (error) {
    next(error);
  }
};
