import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
export const getUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        branch:branches!users_branch_id_fkey(id, name, code)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Transform the data to include branch_name for frontend compatibility
    const transformedData = data?.map(user => {
      let profile_photo_url = null;
      if (user.profile_photo) {
        const { data: { publicUrl } } = supabase.storage
          .from('profile-photos')
          .getPublicUrl(user.profile_photo);
        profile_photo_url = publicUrl;
      }

      return {
        ...user,
        branch_name: user.branch?.name || null,
        branch_code: user.branch?.code || null,
        profile_photo_url
      };
    });

    res.status(200).json({
      success: true,
      data: transformedData
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private/Admin
export const getUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) {
      res.status(404).json({
        success: false,
        message: 'User not found'
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

// @desc    Create user
// @route   POST /api/users
// @access  Private/Admin
// @desc    Create user
// @route   POST /api/users
// @access  Private/Admin
export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // console.log('[DEBUG] createUser request body:', JSON.stringify(req.body, null, 2));
    const {
      email, password, role, status,
      firstName, first_name,
      lastName, last_name,
      branchId, branch_id,
      phoneNumber, phone_number,
      pos_pin,
      employeeId, employee_id,
      department, shift, startDate, start_date,
      emergencyContact, emergency_contact,
      address
    } = req.body;

    const fName = (firstName || first_name || '').trim();
    const lName = (lastName || last_name || '').trim();
    const bId = branchId || branch_id;
    const pNumber = phoneNumber || phone_number;
    const empId = employeeId || employee_id;
    const sDate = startDate || start_date;
    const eContact = emergencyContact || emergency_contact;

    // Validate required fields
    if (!fName || !lName || !role) {
      // console.log('[DEBUG] Missing required fields:', { fName, lName, role });
      res.status(400).json({ success: false, message: 'Please provide firstName, lastName, and role' });
      return;
    }

    // Step 1: Create auth user via Supabase Admin API
    const userEmail = email || `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@pos.local`;
    const userPassword = password || (Math.random().toString(36).substr(2, 12) + 'Aa1!');

    // console.log('[DEBUG] Creating auth user:', { userEmail, role });
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: userEmail,
      password: userPassword,
      email_confirm: true,
      user_metadata: { first_name: fName, last_name: lName }
    });

    if (authError || !authData?.user) {
      console.error('[DEBUG] auth.admin.createUser error:', authError);
      logger.error('Supabase auth.admin.createUser error:', authError);
      res.status(500).json({
        success: false,
        message: authError?.message || 'Failed to create auth user',
        details: authError
      });
      return;
    }

    const userId = authData.user.id;
    // console.log('[DEBUG] Auth user created with ID:', userId);

    // Hash password for local database fallback
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(userPassword, salt);

    // Step 2: Upsert public.users profile
    const profileData: Record<string, any> = {
      id: userId,
      email: userEmail,
      first_name: fName,
      last_name: lName,
      role,
      branch_id: bId || null,
      phone_number: pNumber || null,
      employee_id: empId || null,
      department: department || null,
      shift: shift || null,
      start_date: sDate || null,
      emergency_contact: eContact ? JSON.stringify(eContact) : null,
      address: address || null,
      status: status || 'active',
      pos_pin: pos_pin || null,
      password_hash: passwordHash,
      updated_at: new Date().toISOString()
    };

    // console.log('[DEBUG] Upserting profile for ID:', userId);
    const { data: profile, error: upsertError } = await supabase
      .from('users')
      .upsert(profileData, { onConflict: 'id' })
      .select()
      .single();

    if (upsertError) {
      console.error('[DEBUG] upsertError:', upsertError);
      // Cleanup orphaned auth user
      await supabase.auth.admin.deleteUser(userId);
      logger.error('Error upserting public.users profile:', upsertError);
      res.status(500).json({
        success: false,
        message: 'Failed to create user profile',
        details: upsertError.message,
        error: upsertError
      });
      return;
    }

    // console.log('[DEBUG] User created successfully');
    res.status(201).json({ success: true, data: profile, message: 'User created successfully' });
    logger.info(`User created by admin: ${userEmail} (${role})`);

  } catch (error: any) {
    console.error('[DEBUG] Fatal error in createUser:', error);
    logger.error('Error creating user:', error);
    res.status(500).json({ success: false, message: 'Failed to create user', details: error.message, stack: error.stack });
  }
};



// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { password, ...fields } = req.body;

    // Explicitly map fields to snake_case for Supabase
    const userFields: Record<string, any> = {
      first_name: fields.first_name || fields.firstName,
      last_name: fields.last_name || fields.lastName,
      email: fields.email,
      role: fields.role,
      status: fields.status,
      branch_id: fields.branch_id || fields.branchId,
      phone_number: fields.phone_number || fields.phoneNumber,
      employee_id: fields.employee_id || fields.employeeId,
      department: fields.department,
      position: fields.position,
      shift: fields.shift,
      start_date: fields.start_date || fields.startDate,
      emergency_contact: fields.emergency_contact || fields.emergencyContact,
      address: fields.address,
      pos_pin: fields.pos_pin,
      updated_at: new Date().toISOString()
    };

    // Remove undefined fields
    Object.keys(userFields).forEach(key => {
      if (userFields[key] === undefined) delete userFields[key];
    });

    // Update user profile in public.users table
    const { data, error } = await supabase
      .from('users')
      .update(userFields)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Update password in local database fallback and Supabase Auth if provided
    if (password) {
      // 1. Update hash in users table
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      await supabase
        .from('users')
        .update({ password_hash: passwordHash })
        .eq('id', req.params.id);

      // 2. Update in Supabase Auth
      const { error: authError } = await supabase.auth.admin.updateUserById(
        req.params.id,
        { password }
      );

      if (authError) {
        console.error('Password update error:', authError);
        // Don't fail the entire request if password update fails
      }
    }

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if user exists
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('id', id)
      .single();

    if (fetchError || !user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Don't allow deleting yourself
    if (req.user?.id === id) {
      res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
      return;
    }

    // 1. Delete from Supabase Auth (admin)
    // Note: Due to our ON DELETE CASCADE migration, deleting from auth.users
    // will automatically delete from public.users and other dependent tables.
    const { error: authError } = await supabase.auth.admin.deleteUser(id);

    if (authError) {
      // Fallback: Try to delete from public.users directly if auth delete fails
      // (e.g. if the user only exists in public.users)
      console.error('Auth deletion failed, trying direct profile deletion:', authError.message);

      const { error: profileError } = await supabase
        .from('users')
        .delete()
        .eq('id', id);

      if (profileError) throw profileError;
    }

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });

    logger.info(`User deleted: ${user.email} (${user.role}) by admin ${req.user?.id}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Get user stats
// @route   GET /api/users/stats
// @access  Private/Admin
export const getUserStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { count: totalUsers, error: countError } = await supabase
      .from('users')
      .select('*', { count: 'exact' })
      .limit(0);

    if (countError) throw countError;

    const { data: activeUsers, error: activeError } = await supabase
      .from('users')
      .select('*')
      .eq('status', 'active');

    if (activeError) throw activeError;

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        activeUsers: activeUsers?.length || 0
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user profile
// @route   GET /api/users/profile/:id
// @access  Private
export const getUserProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) {
      res.status(404).json({
        success: false,
        message: 'User not found'
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

// @desc    Update user profile
// @route   PUT /api/users/profile/:id
// @access  Private
export const updateUserProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({
        ...req.body,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user password
// @route   PUT /api/users/password/:id
// @access  Private
export const updateUserPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error } = await supabase.auth.admin.updateUserById(
      req.params.id,
      { password: req.body.password }
    );

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Test user creation without Supabase Auth
// @route   POST /api/users/test
// @access  Private/Admin
export const testCreateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, firstName, lastName, role, branchId, phoneNumber } = req.body;

    // Generate a UUID for the user
    const userId = uuidv4();

    // Try to create a minimal auth.users entry using raw SQL
    try {
      const { data: authResult, error: authSqlError } = await supabase
        .from('auth.users')
        .insert([{
          id: userId,
          email: email,
          email_confirmed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          raw_user_meta_data: { first_name: firstName, last_name: lastName }
        }])
        .select()
        .single();

      if (authSqlError) {
        logger.warn('Could not create auth.users entry:', authSqlError.message);
      } else {
        logger.info('Created auth.users entry successfully');
      }
    } catch (authError) {
      logger.warn('Auth table insertion failed, proceeding with profile only');
    }

    // Create user profile
    const userProfile = {
      id: userId,
      email,
      first_name: firstName,
      last_name: lastName,
      role,
      branch_id: branchId || null,
      phone_number: phoneNumber
    };

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .insert([userProfile])
      .select()
      .single();

    if (profileError) throw profileError;

    res.status(201).json({
      success: true,
      data: profile,
      message: 'User created successfully (development mode)',
      note: 'This user may not be able to log in without proper Supabase Auth configuration'
    });

    logger.info(`Dev user created: ${email} (${role})`);
  } catch (error) {
    next(error);
  }
};

// @desc    Upload profile photo
// @route   POST /api/users/:id/photo
// @access  Private
export const uploadProfilePhoto = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const file = req.file as Express.Multer.File;

    if (!file) {
      res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
      return;
    }

    const { data, error } = await supabase.storage
      .from('profile-photos')
      .upload(
        `users/${req.params.id}/${Date.now()}-${file.originalname}`,
        file.buffer,
        {
          contentType: file.mimetype
        }
      );

    if (error) throw error;

    // Update user profile with photo URL
    const { data: user, error: updateError } = await supabase
      .from('users')
      .update({ profile_photo: data.path })
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateError) throw updateError;

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};
