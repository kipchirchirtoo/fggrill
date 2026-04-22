/**
 * OTP Controller for Dispatch Verification
 * Handles 6-digit OTP generation and verification for dispatch deliveries
 */

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

/**
 * Generate OTP for a dispatch
 * POST /api/dispatch/dispatches/:id/generate-otp
 */
export const generateOTP = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { expiry_hours = 24 } = req.body;

    // Check if dispatch exists
    const { data: dispatch, error: dispatchError } = await supabase
      .from('store_dispatches')
      .select('id, status')
      .eq('id', id)
      .single();

    if (dispatchError || !dispatch) {
      throw new AppError('Dispatch not found', 404);
    }

    // Generate OTP using database function
    const { data: otpData, error: otpError } = await supabase
      .rpc('generate_dispatch_otp', {
        p_dispatch_id: id,
        p_expiry_hours: expiry_hours
      });

    if (otpError) {
      logger.error('Error generating OTP:', otpError);
      throw new AppError('Failed to generate OTP', 500);
    }

    // The function returns a single row with otp_id, otp_code, expires_at
    const otp = Array.isArray(otpData) ? otpData[0] : otpData;

    res.status(200).json({
      success: true,
      data: {
        otp_id: otp.otp_id,
        otp_code: otp.otp_code,
        expires_at: otp.expires_at,
        dispatch_id: id
      },
      message: 'OTP generated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify OTP for a dispatch
 * POST /api/dispatch/dispatches/:id/verify-otp
 */
export const verifyOTP = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { otp_code } = req.body;
    const userId = req.user?.id;

    if (!otp_code) {
      throw new AppError('OTP code is required', 400);
    }

    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otp_code)) {
      throw new AppError('Invalid OTP format. Must be 6 digits', 400);
    }

    if (!userId) {
      throw new AppError('User ID is required', 401);
    }

    // Verify OTP using database function
    const { data: verificationResult, error: verifyError } = await supabase
      .rpc('verify_dispatch_otp', {
        p_dispatch_id: id,
        p_otp_code: otp_code,
        p_user_id: userId
      });

    if (verifyError) {
      logger.error('Error verifying OTP:', verifyError);
      throw new AppError('Failed to verify OTP', 500);
    }

    // The function returns a single row with success, message, otp_id
    const result = Array.isArray(verificationResult) ? verificationResult[0] : verificationResult;

    if (!result.success) {
      res.status(400).json({
        success: false,
        message: result.message
      });
      return;
    }

    // Fetch updated dispatch
    const { data: dispatch } = await supabase
      .from('store_dispatches')
      .select('*')
      .eq('id', id)
      .single();

    res.status(200).json({
      success: true,
      message: result.message,
      data: dispatch
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get OTP for a dispatch (for display purposes)
 * GET /api/dispatch/dispatches/:id/otp
 */
export const getOTP = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    // Get active OTP for dispatch
    const { data: otp, error: otpError } = await supabase
      .from('dispatch_otps')
      .select('*')
      .eq('dispatch_id', id)
      .eq('is_used', false)
      .is('verified_at', null)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (otpError || !otp) {
      throw new AppError('No active OTP found for this dispatch', 404);
    }

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(otp.expires_at);
    const isExpired = expiresAt < now;

    res.status(200).json({
      success: true,
      data: {
        otp_id: otp.id,
        otp_code: otp.otp_code,
        generated_at: otp.generated_at,
        expires_at: otp.expires_at,
        is_expired: isExpired,
        attempts: otp.attempts,
        max_attempts: otp.max_attempts,
        remaining_attempts: otp.max_attempts - otp.attempts
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cleanup expired OTPs (admin/cron job)
 * POST /api/dispatch/otps/cleanup
 */
export const cleanupExpiredOTPs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data: count, error } = await supabase
      .rpc('cleanup_expired_otps');

    if (error) {
      logger.error('Error cleaning up expired OTPs:', error);
      throw new AppError('Failed to cleanup expired OTPs', 500);
    }

    res.status(200).json({
      success: true,
      message: `Cleaned up ${count} expired OTPs`,
      data: { cleaned_count: count }
    });
  } catch (error) {
    next(error);
  }
};
