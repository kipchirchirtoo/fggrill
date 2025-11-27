import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

// @desc    Get all guests
// @route   GET /api/guests
// @access  Private
export const getGuests = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const startIndex = (page - 1) * limit;

    let query = supabase
      .from('guest_stay_history')
      .select('*', { count: 'exact' })
      .order('last_stay', { ascending: false })
      .range(startIndex, startIndex + limit - 1);

    // Add filters
    if (req.query.vip) {
      query = query.eq('vip_status', req.query.vip === 'true');
    }
    if (req.query.search) {
      const search = req.query.search as string;
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: guests, error, count } = await query;

    if (error) {
      throw error;
    }

    res.status(200).json({
      success: true,
      count: guests.length,
      total: count || 0,
      page,
      pages: Math.ceil((count || 0) / limit),
      data: guests
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single guest
// @route   GET /api/guests/:id
// @access  Private
export const getGuest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data: guest, error } = await supabase
      .from('guest_profiles')
      .select(`
        *,
        user:users!user_id(
          id,
          email,
          first_name,
          last_name,
          phone_number
        ),
        preferences:guest_preferences(*)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) {
      throw error;
    }

    if (!guest) {
      res.status(404).json({
        success: false,
        message: 'Guest not found'
      });
      return;
    }

    // Get guest's bookings
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('*')
      .eq('guest_id', guest.user_id)
      .order('check_in_date', { ascending: false });

    if (bookingsError) {
      throw bookingsError;
    }

    res.status(200).json({
      success: true,
      data: {
        ...guest,
        bookings
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create guest
// @route   POST /api/guests
// @access  Private
export const createGuest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      idType,
      idNumber,
      nationality,
      address,
      company,
      vipStatus,
      notes
    } = req.body;

    // Create user first
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName
      }
    });

    if (authError || !authData.user) {
      throw authError || new Error('Failed to create user');
    }

    // Update user profile
    const { error: userError } = await supabase
      .from('users')
      .update({
        first_name: firstName,
        last_name: lastName,
        phone_number: phone,
        role: 'guest'
      })
      .eq('id', authData.user.id);

    if (userError) {
      // Rollback auth user creation
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw userError;
    }

    // Create guest profile
    const { data: guest, error: guestError } = await supabase
      .from('guest_profiles')
      .insert([
        {
          user_id: authData.user.id,
          id_type: idType,
          id_number: idNumber,
          nationality,
          address,
          company,
          vip_status: vipStatus,
          notes
        }
      ])
      .select()
      .single();

    if (guestError) {
      // Rollback user creation
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw guestError;
    }

    res.status(201).json({
      success: true,
      data: guest
    });

    logger.info(`New guest created: ${email}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Update guest
// @route   PUT /api/guests/:id
// @access  Private
export const updateGuest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      idType,
      idNumber,
      nationality,
      address,
      company,
      vipStatus,
      notes
    } = req.body;

    // Get guest profile
    const { data: guest, error: getError } = await supabase
      .from('guest_profiles')
      .select('user_id')
      .eq('id', req.params.id)
      .single();

    if (getError || !guest) {
      res.status(404).json({
        success: false,
        message: 'Guest not found'
      });
      return;
    }

    // Update user profile
    const { error: userError } = await supabase
      .from('users')
      .update({
        first_name: firstName,
        last_name: lastName,
        phone_number: phone
      })
      .eq('id', guest.user_id);

    if (userError) {
      throw userError;
    }

    // Update email if changed
    if (email) {
      const { error: emailError } = await supabase.auth.admin.updateUserById(
        guest.user_id,
        { email }
      );

      if (emailError) {
        throw emailError;
      }
    }

    // Update guest profile
    const { data: updatedGuest, error: updateError } = await supabase
      .from('guest_profiles')
      .update({
        id_type: idType,
        id_number: idNumber,
        nationality,
        address,
        company,
        vip_status: vipStatus,
        notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    res.status(200).json({
      success: true,
      data: updatedGuest
    });

    logger.info(`Guest updated: ${email || updatedGuest.id}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete guest
// @route   DELETE /api/guests/:id
// @access  Private (Admin only)
export const deleteGuest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get guest profile
    const { data: guest, error: getError } = await supabase
      .from('guest_profiles')
      .select('user_id')
      .eq('id', req.params.id)
      .single();

    if (getError || !guest) {
      res.status(404).json({
        success: false,
        message: 'Guest not found'
      });
      return;
    }

    // Check if guest has any active bookings
    const { data: activeBookings, error: bookingError } = await supabase
      .from('bookings')
      .select('id')
      .eq('guest_id', guest.user_id)
      .in('status', ['pending', 'confirmed', 'checked_in'])
      .limit(1);

    if (bookingError) {
      throw bookingError;
    }

    if (activeBookings && activeBookings.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Cannot delete guest with active bookings'
      });
      return;
    }

    // Delete guest profile and user
    const { error: deleteError } = await supabase.auth.admin.deleteUser(
      guest.user_id
    );

    if (deleteError) {
      throw deleteError;
    }

    res.status(200).json({
      success: true,
      data: {}
    });

    logger.info(`Guest deleted: ${req.params.id}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Update guest preferences
// @route   PUT /api/guests/:id/preferences
// @access  Private
export const updateGuestPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { preferences } = req.body;

    // Check if guest exists
    const { data: guest, error: getError } = await supabase
      .from('guest_profiles')
      .select('id')
      .eq('id', req.params.id)
      .single();

    if (getError || !guest) {
      res.status(404).json({
        success: false,
        message: 'Guest not found'
      });
      return;
    }

    // Delete existing preferences
    await supabase
      .from('guest_preferences')
      .delete()
      .eq('guest_id', req.params.id);

    // Insert new preferences
    const { data: updatedPreferences, error: updateError } = await supabase
      .from('guest_preferences')
      .insert(
        Object.entries(preferences).map(([key, value]) => ({
          guest_id: req.params.id,
          preference_key: key,
          preference_value: value
        }))
      )
      .select();

    if (updateError) {
      throw updateError;
    }

    res.status(200).json({
      success: true,
      data: updatedPreferences
    });

    logger.info(`Guest preferences updated: ${req.params.id}`);
  } catch (error) {
    next(error);
  }
};
