import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';

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
export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      email, password, firstName, lastName, role, branchId, phoneNumber, pos_pin,
      employeeId, department, shift, startDate, emergencyContact, address, status
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !role) {
      res.status(400).json({
        success: false,
        message: 'Please provide firstName, lastName, and role'
      });
      return;
    }

    // Validate name lengths to match database constraints
    if (firstName.trim().length < 2 || firstName.trim().length > 50) {
      res.status(400).json({
        success: false,
        message: 'First name must be between 2 and 50 characters'
      });
      return;
    }

    if (lastName.trim().length < 2 || lastName.trim().length > 50) {
      res.status(400).json({
        success: false,
        message: 'Last name must be between 2 and 50 characters'
      });
      return;
    }

    // For POS users with PIN, email/password are optional
    // Generate dummy credentials if not provided
    const isPOSUser = !!pos_pin;
    const userEmail = email || `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@pos.local`;
    const userPassword = password || Math.random().toString(36).substr(2, 15);

    // Check if user already exists (only if email was provided)
    if (email) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
        return;
      }
    }

    // Use direct database insertion to create user in auth.users and public.users
    // This bypasses Supabase Auth API issues while maintaining data integrity
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    try {
      const userId = uuidv4();
      const hashedPassword = await bcrypt.hash(password, 12);

      // Start transaction
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        // 1. Create user in auth.users table
        await client.query(`
          INSERT INTO auth.users (
            id, instance_id, email, encrypted_password,
            email_confirmed_at, aud, role,
            raw_app_meta_data, raw_user_meta_data,
            created_at, updated_at
          )
          VALUES (
            $1, '00000000-0000-0000-0000-000000000000', $2, $3,
            NOW(), 'authenticated', 'authenticated',
            '{"provider": "email", "providers": ["email"]}',
            $4,
            NOW(), NOW()
          )
        `, [userId, email, hashedPassword, JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim()
        })]);

        // 2. Update the public.users entry created by trigger with correct data
        // The handle_new_user trigger creates a basic entry, we update it with full data
        await client.query(`
          UPDATE public.users SET
            first_name = $1,
            last_name = $2,
            role = $3,
            branch_id = $4,
            phone_number = $5,
            employee_id = $7,
            department = $8,
            shift = $9,
            start_date = $10,
            emergency_contact = $11,
            address = $12,
            status = $13,
            updated_at = NOW()
          WHERE id = $6
        `, [
          firstName.trim(),
          lastName.trim(),
          role,
          branchId || null,
          phoneNumber || null,
          userId,
          employeeId || null,
          department || null,
          shift || null,
          startDate || null,
          emergencyContact ? JSON.stringify(emergencyContact) : null,
          address || null,
          status || 'active'
        ]);

        await client.query('COMMIT');

        // Fetch the created user
        const { data: profile, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (fetchError) {
          throw fetchError;
        }

        res.status(201).json({
          success: true,
          data: profile,
          message: 'User created successfully'
        });

        logger.info(`User created by admin: ${email} (${role})`);

      } catch (txError) {
        await client.query('ROLLBACK');
        throw txError;
      } finally {
        client.release();
      }

    } finally {
      await pool.end();
    }

  } catch (error: any) {
    logger.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      details: error.message
    });
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
    const { password, ...userFields } = req.body;

    // Update user profile in public.users table
    const { data, error } = await supabase
      .from('users')
      .update({
        ...userFields,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Update password in Supabase Auth if provided
    if (password) {
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
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: {}
    });
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
