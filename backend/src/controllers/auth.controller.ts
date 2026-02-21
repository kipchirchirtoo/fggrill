import { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
dotenv.config();
import { supabase } from '../config/supabase';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import db from '../db';

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

    // No demo accounts - use real authentication only

    // Try Supabase Auth first
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (!authError && authData?.user) {
      // Supabase Auth succeeded
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

    // Fallback: Direct database authentication
    logger.info(`Supabase Auth failed for ${email}, trying direct DB auth`);

    let storedHash: string | null = null;
    let userId: string | null = null;
    let userProfile: any = null;

    try {
      // Use direct PostgreSQL connection with timeout settings
      const { Pool } = require('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
        query_timeout: 10000,
        max: 1
      });

      // Get user profile and auth data in one query
      const result = await pool.query(
        `SELECT 
          u.id, u.email, u.first_name, u.last_name, u.role, u.branch_id,
          au.encrypted_password
        FROM public.users u
        LEFT JOIN auth.users au ON u.id = au.id
        WHERE u.email = $1`,
        [email]
      );

      await pool.end();

      if (result.rows[0]) {
        const row = result.rows[0];
        userId = row.id;
        storedHash = row.encrypted_password;
        userProfile = {
          id: row.id,
          email: row.email,
          first_name: row.first_name,
          last_name: row.last_name,
          role: row.role,
          branch_id: row.branch_id,
          status: row.status
        };
      }
    } catch (dbError) {
      logger.error('Direct DB auth error:', dbError);
    }

    if (!storedHash || !userId) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
      return;
    }

    // Verify password with bcrypt
    const passwordMatch = await bcrypt.compare(password, storedHash);

    if (!passwordMatch) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
      return;
    }

    if (!userProfile) {
      res.status(401).json({
        success: false,
        message: 'User profile not found'
      });
      return;
    }

    // Update last login using direct DB (avoid Supabase timeout)
    try {
      await db.query(
        'UPDATE public.users SET last_login = NOW() WHERE id = $1',
        [userId]
      );
    } catch (updateError) {
      logger.warn('Failed to update last login:', updateError);
    }

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'fallback-secret-key';

    logger.debug('Generating token for user login', {
      userId,
      email: userProfile.email,
      hasSecret: !!jwtSecret,
      secretLength: jwtSecret.length
    });

    const accessToken = jwt.sign(
      {
        sub: userId,
        email: userProfile.email,
        role: userProfile.role,
        aud: 'authenticated'
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    const refreshToken = jwt.sign(
      { sub: userId, type: 'refresh' },
      jwtSecret,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      success: true,
      data: {
        user: userProfile,
        session: {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          user: { id: userId, email: userProfile.email }
        }
      }
    });

    logger.info(`User logged in via direct DB auth: ${email}`);
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
    // User is already authenticated by protect middleware
    if (!req.user || !req.user.id) {
      res.status(401).json({
        success: false,
        message: 'Not authorized'
      });
      return;
    }

    // Get full user profile from database with staff profile data
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select(`
        *,
        staff_profile:staff_profiles(id_number)
      `)
      .eq('id', req.user.id)
      .single();

    if (profileError || !profile) {
      res.status(404).json({
        success: false,
        message: 'User profile not found'
      });
      return;
    }

    // Flatten staff_profile data
    const responseData = {
      ...profile,
      id_number: profile.staff_profile?.[0]?.id_number || profile.staff_profile?.id_number || null,
      staff_profile: undefined // Remove nested object
    };

    res.status(200).json({
      success: true,
      data: responseData
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

    const fieldsToUpdate: any = {
      first_name: req.body.firstName,
      last_name: req.body.lastName,
      email: req.body.email,
      phone_number: req.body.phoneNumber,
      address: req.body.address,
      updated_at: new Date().toISOString()
    };

    if (req.body.profilePhoto) {
      fieldsToUpdate.profile_photo = req.body.profilePhoto;
    }

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

// @desc    POS PIN Login
// @route   POST /api/auth/pos-login
// @access  Public
export const posLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { pin } = req.body;

    if (!pin) {
      res.status(400).json({
        success: false,
        message: 'Please provide a PIN'
      });
      return;
    }

    // Validate PIN format (RXXXX, BXXXX, or CXXXX — letter + 4 digits)
    const pinRegex = /^[RBC]\d{4}$/;
    if (!pinRegex.test(pin)) {
      res.status(400).json({
        success: false,
        message: 'Invalid PIN format. Waiters use RXXXX, Bar staff use BXXXX, Cashiers use CXXXX'
      });
      return;
    }

    // Find user by PIN
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('pos_pin', pin)
      .single();

    if (userError || !user) {
      res.status(401).json({
        success: false,
        message: 'Invalid PIN'
      });
      return;
    }

    logger.debug('POS Login Debug:', {
      pinPrefix: pin[0],
      userRole: user.role,
      userId: user.id
    });

    // Validate role against PIN prefix
    const prefix = pin[0];
    const restaurantRoles = [
      'restaurant', 'restaurant_manager', 'head_chef', 'sous_chef',
      'line_cook', 'prep_cook', 'waiter', 'waitress', 'head_waiter',
      'food_runner', 'busser', 'host_hostess', 'pos_kitchen',
      'kitchen', 'kitchen_helper', 'dishwasher', 'manager',
      'branch_manager', 'super_admin', 'cashier',
      'kyogong_spa_cashier', 'kyogong_executive_bar_cashier',
      'kyogong_sports_bar_cashier', 'kyogong_reception_cashier'
    ];

    const barRoles = [
      'barmaid', 'barman', 'bartender', 'barista', 'bar_manager',
      'manager', 'branch_manager', 'super_admin', 'cashier',
      'kyogong_spa_cashier', 'kyogong_executive_bar_cashier',
      'kyogong_sports_bar_cashier', 'kyogong_reception_cashier'
    ];

    const cashierRoles = [
      'cashier', 'accountant', 'manager', 'branch_manager', 'super_admin',
      'kyogong_spa_cashier', 'kyogong_executive_bar_cashier',
      'kyogong_sports_bar_cashier', 'kyogong_reception_cashier'
    ];

    logger.info(`POS Login Attempt - User: ${user.email}, Role: ${user.role}, Prefix: ${prefix}, PIN: ${pin}`);
    logger.info(`Allowed Cashier Roles: ${JSON.stringify(cashierRoles)}`);
    logger.info(`Is role allowed for C prefix? ${cashierRoles.includes(user.role)}`);

    if (prefix === 'R' && !restaurantRoles.includes(user.role)) {
      logger.warn(`POS Login Denied: Role ${user.role} not allowed for prefix R`);
      res.status(403).json({
        success: false,
        message: 'This PIN is for restaurant staff only'
      });
      return;
    }

    if (prefix === 'B' && !barRoles.includes(user.role)) {
      logger.warn(`POS Login Denied: Role ${user.role} not allowed for prefix B`);
      res.status(403).json({
        success: false,
        message: 'This PIN is for bar staff only'
      });
      return;
    }

    if (prefix === 'C' && !cashierRoles.includes(user.role)) {
      logger.warn(`POS Login Denied: Role ${user.role} not allowed for prefix C`);
      res.status(403).json({
        success: false,
        message: 'This PIN is for cashier/finance staff only [FIX-V1]'
      });
      return;
    }

    // Update last login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'fallback-secret-key';

    logger.debug('Generating token for POS login', {
      userId: user.id,
      email: user.email,
      hasSecret: !!jwtSecret,
      secretLength: jwtSecret.length
    });

    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        aud: 'authenticated',
        isPosLogin: true
      },
      jwtSecret,
      { expiresIn: '12h' }
    );

    const refreshToken = jwt.sign(
      { sub: user.id, type: 'refresh' },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // Auto Clock-in for Staff Attendance
    try {
      const { data: existingAttendance } = await supabase
        .from('staff_attendance')
        .select('id')
        .eq('user_id', user.id)
        .is('clock_out', null)
        .maybeSingle();

      if (!existingAttendance) {
        await supabase
          .from('staff_attendance')
          .insert([{
            user_id: user.id,
            branch_id: user.branch_id,
            clock_in: new Date().toISOString(),
            status: 'present',
            notes: 'Auto clock-in via POS login'
          }]);
        logger.info(`Auto clock-in for user ${user.id} during POS login`);
      }
    } catch (attendanceError) {
      logger.error('Failed to auto clock-in during POS login:', attendanceError);
    }

    res.status(200).json({
      success: true,
      data: {
        user,
        session: {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
          user: { id: user.id, email: user.email }
        }
      }
    });

    logger.info(`User ${user.email} logged in via POS PIN: ${pin}`);
  } catch (error) {
    next(error);
  }
};
