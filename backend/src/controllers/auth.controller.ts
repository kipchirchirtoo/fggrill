import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';
import { UserRole } from '../models/User';

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { firstName, lastName, email, password, role } = req.body;

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('email')
      .eq('email', email)
      .single();

    if (existingUser) {
      res.status(400).json({
        success: false,
        message: 'User already exists'
      });
      return;
    }

    // Create user in Supabase auth
    const { data: authUser, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      throw authError;
    }

    if (!authUser.user) {
      throw new Error('Failed to create user');
    }

    // Create user profile
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .insert([
        {
          id: authUser.user.id,
          email,
          first_name: firstName,
          last_name: lastName,
          role,
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (profileError) {
      // Rollback auth user creation
      await supabase.auth.admin.deleteUser(authUser.user.id);
      throw profileError;
    }

    // Send response with session
    res.status(201).json({
      success: true,
      data: {
        user: profile,
        session: authUser.session
      }
    });

    logger.info(`New user registered: ${email}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
      return;
    }

    // Demo accounts support in development mode
    if (process.env.NODE_ENV === 'development') {
      // Check if this is a demo account
      const demoAccounts = [
        'admin@dev.com',
        'admin@famousgate.com',
        'central-ops@famousgate.com',
        'branch-ops@famousgate.com',
        'facilities@famousgate.com',
        'central.manager@famousgate.com',
        'warehouse@famousgate.com',
        'logistics@famousgate.com',
        'gm@famousgate.com',
        'manager.bomet@famousgate.com',
        'central@famousgate.com',
        'reception@famousgate.com',
        'restaurant@famousgate.com',
        'accountant@famousgate.com'
      ];
      
      if (demoAccounts.includes(email)) {
        logger.info(`Demo account login: ${email}`);
        
        // Create mock user and session
        const user = {
          id: 'demo-' + Math.random().toString(36).substring(2, 15),
          email,
          first_name: email.split('@')[0].split('.')[0],
          last_name: email.split('@')[0].split('.').length > 1 ? 
            email.split('@')[0].split('.')[1] : 'User',
          role: email.includes('central-ops') ? 'central_operations_manager' :
                 email.includes('branch-ops') ? 'branch_operations_manager' :
                 email.includes('admin') ? 'super_admin' : 'employee',
          branch_id: email.includes('central') || email.includes('admin') ? null : 1,
          is_central: email.includes('central') || email.includes('admin'),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const session = {
          access_token: 'demo-token-' + Date.now(),
          refresh_token: 'demo-refresh-' + Date.now(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
          user: { id: user.id, email: user.email }
        };
        
        res.status(200).json({
          success: true,
          data: {
            user,
            session
          }
        });
        return;
      }
    }

    // Sign in with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
      return;
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      throw profileError;
    }

    // Update last login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', authData.user.id);

    // Send response
    res.status(200).json({
      success: true,
      data: {
        user: profile,
        session: authData.session
      }
    });

    logger.info(`User logged in: ${email}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Refresh token
// @route   POST /api/auth/refresh-token
// @access  Public
export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        message: 'Please provide refresh token'
      });
      return;
    }

    // Refresh session with Supabase
    const { data: { session }, error: refreshError } = await supabase.auth.refreshSession({
      refresh_token: refreshToken
    });

    if (refreshError || !session) {
      res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
      return;
    }

    // Send response
    res.status(200).json({
      success: true,
      data: {
        session
      }
    });

    logger.info(`Token refreshed for user: ${session.user.email}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });

    logger.info('User logged out successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      res.status(401).json({
        success: false,
        message: 'Not authorized'
      });
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profileError) {
      throw profileError;
    }

    res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user details
// @route   PUT /api/auth/updatedetails
// @access  Private
export const updateDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      res.status(401).json({
        success: false,
        message: 'Not authorized'
      });
      return;
    }

    const fieldsToUpdate = {
      first_name: req.body.firstName,
      last_name: req.body.lastName,
      email: req.body.email,
      phone_number: req.body.phoneNumber,
      address: req.body.address,
      updated_at: new Date().toISOString()
    };

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(fieldsToUpdate)
      .eq('id', session.user.id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // If email is being updated, update auth email as well
    if (req.body.email && req.body.email !== session.user.email) {
      const { error: emailUpdateError } = await supabase.auth.admin.updateUserById(
        session.user.id,
        { email: req.body.email }
      );

      if (emailUpdateError) {
        throw emailUpdateError;
      }
    }

    res.status(200).json({
      success: true,
      data: updatedUser
    });

    logger.info(`User updated details: ${updatedUser.email}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
export const updatePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      res.status(401).json({
        success: false,
        message: 'Not authorized'
      });
      return;
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: req.body.newPassword
    });

    if (updateError) {
      throw updateError;
    }

    // Update password changed timestamp
    await supabase
      .from('users')
      .update({ password_changed_at: new Date().toISOString() })
      .eq('id', session.user.id);

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });

    logger.info(`User updated password: ${session.user.email}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgotpassword
// @access  Public
export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/reset-password`
    });

    if (error) {
      throw error;
    }

    res.status(200).json({
      success: true,
      message: 'Password reset email sent'
    });

    logger.info(`Password reset requested for: ${email}`);
  } catch (error) {
    next(error);
  }
};

