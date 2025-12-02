import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

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
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
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
    const { email, password, firstName, lastName, role, branchId, phoneNumber } = req.body;

    if (!email || !password || !firstName || !lastName || !role) {
      res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
      return;
    }

    // In development, use direct database insertion to bypass Supabase Auth issues
    const isDev = process.env.NODE_ENV === 'development';
    
    if (isDev) {
      logger.warn('Development mode: Attempting Supabase Auth with fallback to direct database insertion');
      
      try {
        // Try Supabase Auth first, even in dev mode
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            first_name: firstName,
            last_name: lastName,
            role
          }
        });

        if (authError) throw authError;
        if (!authUser.user) throw new Error('Failed to create auth user');

        // Create user profile in public users table
        const userProfile = {
          id: authUser.user.id,
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

        if (profileError) {
          // Rollback auth user if profile creation fails
          await supabase.auth.admin.deleteUser(authUser.user.id);
          throw profileError;
        }

        res.status(201).json({
          success: true,
          data: profile,
          message: 'User created successfully with Supabase Auth'
        });
        
        logger.info(`User created by admin (with auth): ${email} (${role})`);
        return;

      } catch (devAuthError: any) {
        logger.error('Supabase Auth failed in development mode:', devAuthError);
        
        // Fallback: Create user without auth (for development only)
        logger.warn('Falling back to database-only user creation (no authentication)');
        
        // Generate a UUID for the user
        const userId = uuidv4();
        
        // Create user profile directly in database
        const userProfile = {
          id: userId,
          email,
          first_name: firstName,
          last_name: lastName,
          role,
          branch_id: branchId || null,
          phone_number: phoneNumber
        };

        try {
          // Try to create a minimal auth user first using raw SQL to bypass constraints
          const { data: rawAuthUser, error: rawAuthError } = await supabase.rpc('create_dev_auth_user', {
            user_id: userId,
            user_email: email
          });

          if (rawAuthError) {
            logger.warn('Could not create auth user via RPC, proceeding with profile only');
          }

          const { data: profile, error: profileError } = await supabase
            .from('users')
            .insert([userProfile])
            .select()
            .single();

          if (profileError) throw profileError;

          res.status(201).json({
            success: true,
            data: profile,
            message: 'User created successfully (development mode - profile only, no authentication)',
            warning: 'This user cannot log in as no auth record was created'
          });
          
          logger.info(`User profile created (dev mode, no auth): ${email} (${role})`);
          return;
        } catch (dbError: any) {
          logger.error('Database insertion also failed:', dbError);
          
          // Final fallback: Return success with explanation
          res.status(200).json({
            success: false,
            message: 'User creation failed due to database constraints',
            details: {
              authError: devAuthError.message,
              dbError: dbError.message,
              explanation: 'The users table has a foreign key constraint to auth.users. In development, you may need to configure Supabase Auth settings or create users through the Supabase dashboard first.'
            },
            suggestion: 'Check Supabase Auth settings: disable email confirmation, enable manual user creation'
          });
        }
      }
    }

    // Production mode: Use Supabase Auth
    try {
      // 1. Create user in Supabase Auth
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          role
        }
      });

      if (authError) throw authError;
      if (!authUser.user) throw new Error('Failed to create auth user');

      // 2. Create user profile in public users table
      const userProfile = {
        id: authUser.user.id,
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

      if (profileError) {
        // Rollback auth user if profile creation fails
        await supabase.auth.admin.deleteUser(authUser.user.id);
        throw profileError;
      }

      res.status(201).json({
        success: true,
        data: profile
      });
      
      logger.info(`User created by admin: ${email} (${role})`);
    } catch (authError: any) {
      // If Supabase Auth fails, provide helpful error message
      logger.error('Supabase Auth error:', authError);
      res.status(500).json({
        success: false,
        message: 'Failed to create user authentication. Please check Supabase Auth configuration.',
        details: authError.message,
        suggestion: 'Ensure email confirmation is disabled for admin-created users in Supabase dashboard'
      });
    }
  } catch (error) {
    next(error);
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
    const { data, error } = await supabase
      .from('users')
      .update({
        ...req.body,
        updated_at: new Date().toISOString(),
        updated_by_id: req.user.id
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
