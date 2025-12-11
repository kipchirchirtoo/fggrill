import { Request, Response, NextFunction } from 'express';
import { channelManagerService } from '../services/channelManager.service';
import { AppError } from '../middleware/errorHandler';

/**
 * Get all configured channels
 */
export const getChannels = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const channels = channelManagerService.getChannels();
    res.json({
      success: true,
      data: channels,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get sync status for all channels
 */
export const getSyncStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const status = channelManagerService.getSyncStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Configure a channel
 */
export const configureChannel = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { channelId } = req.params;
    const config = req.body;

    const channel = await channelManagerService.configureChannel(channelId, config);
    
    if (!channel) {
      throw new AppError('Channel not found', 404);
    }

    res.json({
      success: true,
      message: 'Channel configured successfully',
      data: channel,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Enable/disable a channel
 */
export const toggleChannel = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { channelId } = req.params;
    const { enabled } = req.body;

    const channel = await channelManagerService.configureChannel(channelId, { enabled });
    
    if (!channel) {
      throw new AppError('Channel not found', 404);
    }

    res.json({
      success: true,
      message: `Channel ${enabled ? 'enabled' : 'disabled'} successfully`,
      data: channel,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Push availability to a specific channel
 */
export const pushAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { channelId } = req.params;
    const { availability } = req.body;

    if (!availability || !Array.isArray(availability)) {
      throw new AppError('Availability data is required', 400);
    }

    const result = await channelManagerService.pushAvailability(channelId, availability);
    
    res.json({
      success: result.success,
      message: result.success 
        ? `Pushed ${result.itemsProcessed} availability updates` 
        : 'Failed to push availability',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Push rates to a specific channel
 */
export const pushRates = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { channelId } = req.params;
    const { rates } = req.body;

    if (!rates || !Array.isArray(rates)) {
      throw new AppError('Rates data is required', 400);
    }

    const result = await channelManagerService.pushRates(channelId, rates);
    
    res.json({
      success: result.success,
      message: result.success 
        ? `Pushed ${result.itemsProcessed} rate updates` 
        : 'Failed to push rates',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Pull bookings from a specific channel
 */
export const pullBookings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { channelId } = req.params;

    const result = await channelManagerService.pullBookings(channelId);
    
    res.json({
      success: result.success,
      message: result.success 
        ? `Retrieved ${result.bookings.length} bookings` 
        : 'Failed to pull bookings',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Sync all enabled channels
 */
export const syncAllChannels = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const results = await channelManagerService.syncAllChannels();
    
    const successful = results.filter((r) => r.success).length;
    const failed = results.length - successful;

    res.json({
      success: failed === 0,
      message: `Synced ${successful} channels, ${failed} failed`,
      data: results,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Import a booking from channel
 */
export const importBooking = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const booking = req.body;

    if (!booking.channelBookingId || !booking.channelName) {
      throw new AppError('Channel booking ID and channel name are required', 400);
    }

    const result = await channelManagerService.importBooking(booking);
    
    res.json({
      success: result.success,
      message: result.success 
        ? 'Booking imported successfully' 
        : result.error,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
