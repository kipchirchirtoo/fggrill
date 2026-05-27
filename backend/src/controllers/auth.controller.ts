import { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
dotenv.config();
import { supabase } from '../config/supabase';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import db from '../db';
import { logAuthAttempt, logSecurityEvent } from '../utils/audit';

const getJwtSecrets = (): string[] => {
  const candidateSecrets = [
    process.env.JWT_SECRET,
    process.env.SUPABASE_JWT_SECRET
  ].filter((secret, index, arr) => secret && arr.indexOf(secret) === index) as string[];

  if (!candidateSecrets.length) {
    candidateSecrets.push('fallback-secret-key');
  }

  return candidateSecrets;
};

// Roles that have universal access and skip the context selector
const UNIVERSAL_ROLES = ['super_admin', 'general_manager', 'central_storekeeper', 'auditor', 'hr_manager', 'director'];

const enrichUserBranch = async (user: any): Promise<any> => {
  const branchId = user?.branch_id ?? user?.branchId;
  if (!branchId) return user;

  try {
    const { data: branch } = await supabase
      .from('branches')
      .select('id, name, code, location, address')
      .eq('id', branchId)
      .maybeSingle();

    if (!branch) return user;

    return {
      ...user,
      branch_name: branch.name || user.branch_name || user.branchName || null,
      branchName: branch.name || user.branchName || user.branch_name || null,
      branch
    };
  } catch (error) {
    logger.warn('Failed to enrich user branch context', {
      userId: user?.id,
      branchId,
      error
    });
    return user;
  }
};

const issueLocalSession = (
  userId: string,
  email: string,
  role: string,
  activeRole?: string,
  activeBranchId?: number | null
) => {
  const jwtSecret = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'fallback-secret-key';

  const payload: any = {
    sub: userId,
    email,
    role,
    aud: 'authenticated'
  };

  if (activeRole) payload.active_role = activeRole;
  if (activeBranchId !== undefined && activeBranchId !== null) payload.active_branch_id = activeBranchId;

  const accessToken = jwt.sign(payload, jwtSecret, { expiresIn: '24h' });

  const refreshToken = jwt.sign(
    { sub: userId, type: 'refresh' },
    jwtSecret,
    { expiresIn: '7d' }
  );

  return {
    secretSource: process.env.JWT_SECRET ? 'JWT_SECRET' : (process.env.SUPABASE_JWT_SECRET ? 'SUPABASE_JWT_SECRET' : 'fallback'),
    session: {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      user: { id: userId, email }
    }
  };
};

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
      const { error } = await supabase.auth.admin.deleteUser(authUser.user.id);
      if (error) {
        console.error('Database error:', error);
        throw error;
      }
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
    
    await logAuthAttempt({
      email,
      status: 'success',
      userId: profile.id,
      req,
      message: 'New account registered',
      authMethod: 'password'
    });
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

    let storedHash: string | null = null;
    let userId: string | null = null;
    let userProfile: any = null;

    logger.info(`[AUTH-DEBUG] Attempting direct DB auth for ${email}`);

    try {
      // Get user profile with password_hash from users table using Supabase client
      logger.info(`[AUTH-DEBUG] Querying users table for email: ${email}`);
      const { data: dbUser, error: dbError } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, role, branch_id, status, password_hash')
        .eq('email', email)
        .single();

      logger.info(`[AUTH-DEBUG] Query result - dbUser: ${dbUser ? 'FOUND' : 'NULL'}, error: ${dbError ? JSON.stringify(dbError) : 'NONE'}`);

      if (dbError || !dbUser) {
        logger.warn(`User not found in users table: ${email} - Error: ${dbError ? JSON.stringify(dbError) : 'No error, but no data'}`);

        // Auto-heal: check if user exists in Supabase Auth and create the public.users row
        try {
          const { data: authList , error } = await supabase.auth.admin.listUsers();
          if (error) {
            console.error('Database error:', error);
            throw error;
          }
          const authUser = authList?.users?.find((u: any) => u.email === email);
          if (authUser) {
            logger.warn(`Auto-healing missing public.users row for ${email} (found in auth.users)`);
            const meta = authUser.user_metadata || {};
            const emailPrefix = email.split('@')[0];
            const { error } = await supabase.from('users').insert({
              id:         authUser.id,
              email,
              first_name: meta.first_name || emailPrefix || 'User',
              last_name:  meta.last_name  || 'Account',
              role:       meta.role       || 'guest',
              status:     'active',
              created_at: new Date().toISOString(),
            });

            if (error) {

              console.error('Database error:', error);

              throw error;

            }
            // Re-query after insert
            const { data: requeried } = await supabase
              .from('users')
              .select('id, email, first_name, last_name, role, branch_id, status, password_hash')
              .eq('email', email)
              .single();
            if (requeried) {
              userId = requeried.id;
              storedHash = requeried.password_hash;
              userProfile = {
                id: requeried.id, email: requeried.email,
                first_name: requeried.first_name, last_name: requeried.last_name,
                role: requeried.role, branch_id: requeried.branch_id, status: requeried.status
              };
            }
          }
        } catch (healErr: any) {
          logger.warn('Auto-heal attempt failed:', healErr.message);
        }
      } else {
        userId = dbUser.id;
        storedHash = dbUser.password_hash;
        userProfile = {
          id: dbUser.id,
          email: dbUser.email,
          first_name: dbUser.first_name,
          last_name: dbUser.last_name,
          role: dbUser.role,
          branch_id: dbUser.branch_id,
          status: dbUser.status
        };
      }
    } catch (dbError) {
      logger.error('Direct DB auth error:', dbError);
    }

    if (!storedHash || !userId) {
      logger.warn(`Login failed for ${email}: User found but no password hash in users table`);
      res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
      return;
    }

    // Verify password with bcrypt
    const passwordMatch = await bcrypt.compare(password, storedHash);

    if (!passwordMatch) {
      logger.warn(`Login failed: Password mismatch for ${email}`);
      res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });

      await logAuthAttempt({
        email,
        status: 'failed',
        req,
        message: 'Incorrect password (Fallback Auth)',
        authMethod: 'password'
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

    // Update last login using Supabase client
    try {
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', userId);
    } catch (updateError) {
      logger.warn('Failed to update last login:', updateError);
    }

    const { secretSource, session } = issueLocalSession(userId, userProfile.email, userProfile.role);

    logger.info('Generating local JWT token for user login', {
      userId,
      email: userProfile.email,
      secretSource
    });

    // Fetch all role+branch assignments for this user
    let allRoles: any[] = [];
    try {
      const { data: roleRows } = await supabase
        .from('user_branch_roles')
        .select('role, branch_id, is_primary, branches(id, name, code)')
        .eq('user_id', userId);
      allRoles = roleRows || [];
    } catch (roleErr) {
      logger.warn('Could not fetch user_branch_roles, defaulting to primary role', roleErr);
      allRoles = [{ role: userProfile.role, branch_id: userProfile.branch_id, is_primary: true }];
    }

    const isUniversal = UNIVERSAL_ROLES.includes(userProfile.role);
    const requiresContextSelection = !isUniversal && allRoles.length > 1;

    const enrichedUserProfile = await enrichUserBranch(userProfile);

    res.status(200).json({
      success: true,
      data: {
        user: { ...enrichedUserProfile, all_roles: allRoles },
        session,
        requires_context_selection: requiresContextSelection
      }
    });

    logger.info(`User logged in via direct DB auth: ${email}`);

    await logAuthAttempt({
      email,
      status: 'success',
      userId,
      req,
      authMethod: 'password',
      message: 'Direct DB Auth Success'
    });
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
    const incomingRefreshToken = req.body.refreshToken || req.body.refresh_token;

    if (!incomingRefreshToken) {
      res.status(400).json({
        success: false,
        message: 'Please provide refresh token'
      });
      return;
    }

    for (const secret of getJwtSecrets()) {
      try {
        const decoded = jwt.verify(incomingRefreshToken, secret) as any;

        if (decoded?.sub && decoded?.type === 'refresh') {
          const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, email, role')
            .eq('id', decoded.sub)
            .single();

          if (userError || !user) {
            res.status(401).json({
              success: false,
              message: 'Invalid refresh token'
            });
            return;
          }

          const { session } = issueLocalSession(user.id, user.email, user.role);

          res.status(200).json({
            success: true,
            token: session.access_token,
            refresh_token: session.refresh_token,
            data: {
              session
            }
          });

          logger.info(`Local token refreshed for user: ${user.email}`);
          return;
        }
      } catch {
      }
    }

    const { data: { session }, error: refreshError } = await supabase.auth.refreshSession({
      refresh_token: incomingRefreshToken
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
      token: session.access_token,
      refresh_token: session.refresh_token,
      data: {
        session
      }
    });

    logger.info(`Token refreshed for user: ${session.user.email}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Switch active role+branch context (multi-role users)
// @route   POST /api/auth/switch-context
// @access  Private
export const switchContext = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { role, branch_id } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    if (!role) {
      res.status(400).json({ success: false, message: 'role is required' });
      return;
    }

    // Validate that this user actually has this role+branch assignment
    const query = supabase
      .from('user_branch_roles')
      .select('id, role, branch_id')
      .eq('user_id', userId)
      .eq('role', role);

    if (branch_id !== undefined && branch_id !== null) {
      query.eq('branch_id', branch_id);
    } else {
      query.is('branch_id', null);
    }

    const { data: entry, error: entryError } = await query.maybeSingle();

    if (entryError || !entry) {
      logger.warn(`switchContext: user ${userId} attempted unauthorized context role=${role} branch=${branch_id}`);
      res.status(403).json({ success: false, message: 'This role/branch combination is not assigned to you' });
      return;
    }

    // Fetch user profile for email
    const { data: userProfile } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('id', userId)
      .single();

    if (!userProfile) {
      res.status(401).json({ success: false, message: 'User not found' });
      return;
    }

    const { session } = issueLocalSession(
      userId,
      userProfile.email,
      userProfile.role,   // primary role (unchanged in DB)
      role,              // active_role in JWT
      branch_id ?? null  // active_branch_id in JWT
    );

    res.status(200).json({
      success: true,
      data: {
        session,
        active_role: role,
        active_branch_id: branch_id ?? null
      }
    });

    logger.info(`User ${userProfile.email} switched context to role=${role} branch=${branch_id}`);
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

    // Get user profile from database (without joins to avoid RLS/FK issues)
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (profileError || !profile) {
      logger.error('getMe: User profile not found', {
        userId: req.user.id,
        error: profileError?.message || 'No profile data'
      });
      res.status(401).json({
        success: false,
        message: 'User profile not found — please log in again'
      });
      return;
    }

    // Optionally fetch staff_profile data (non-blocking)
    let idNumber = null;
    try {
      const { data: staffProfile } = await supabase
        .from('staff_profiles')
        .select('id_number')
        .eq('user_id', req.user.id)
        .maybeSingle();

      if (staffProfile) {
        idNumber = staffProfile.id_number;
      }
    } catch (staffErr) {
      logger.warn('getMe: Failed to fetch staff_profile, continuing without it', staffErr);
    }

    // Build response
    const responseData = await enrichUserBranch({
      ...profile,
      id_number: idNumber
    });

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
    if (!req.user?.id) {
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
      .eq('id', req.user.id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // If email is being updated, update auth email as well
    if (req.body.email && req.body.email !== req.user.email) {
      const { error: emailUpdateError } = await supabase.auth.admin.updateUserById(
        req.user.id,
        { email: req.body.email }
      );

      if (emailUpdateError) {
        logger.warn(`Failed to sync auth email for ${req.user.id}: ${emailUpdateError.message}`);
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
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: 'Not authorized'
      });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        message: 'Please provide current and new password'
      });
      return;
    }

    const { data: dbUser, error: userLookupError } = await supabase
      .from('users')
      .select('id, email, password_hash')
      .eq('id', req.user.id)
      .single();

    if (userLookupError || !dbUser?.password_hash) {
      res.status(400).json({
        success: false,
        message: 'Password change is unavailable for this account'
      });
      return;
    }

    const passwordMatch = await bcrypt.compare(currentPassword, dbUser.password_hash);

    if (!passwordMatch) {
      res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: hashedPassword,
        password_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', req.user.id);

    if (updateError) {
      throw updateError;
    }

    const { error: authPasswordUpdateError } = await supabase.auth.admin.updateUserById(
      req.user.id,
      { password: newPassword }
    );

    if (authPasswordUpdateError) {
      logger.warn(`Failed to sync auth password for ${req.user.id}: ${authPasswordUpdateError.message}`);
    }

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });

    logger.info(`User updated password: ${dbUser.email}`);
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
    const pin = String(req.body.pin || '').trim().toUpperCase();

    if (!pin) {
      res.status(400).json({
        success: false,
        message: 'Please provide a PIN'
      });
      return;
    }

    // Validate outlet-aware PIN format: R/M/E/N/C + 4 digits.
    const pinRegex = /^[RMENC]\d{4}$/;
    if (!pinRegex.test(pin)) {
      res.status(400).json({
        success: false,
        message: 'Invalid PIN format. Use RXXXX, MXXXX, EXXXX, NXXXX, or CXXXX'
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

      await logAuthAttempt({
        email: 'N/A (PIN)',
        status: 'invalid_pin',
        req,
        message: `Failed PIN attempt: ${pin[0]}****`,
        authMethod: 'pos_pin'
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
    const maskedPin = `${prefix}****`;
    const normalizedRole = String(user.role || '').toLowerCase();
    const outletTypeByPrefix: Record<string, string> = {
      R: 'restaurant',
      M: 'main_bar',
      E: 'executive_bar',
      N: 'non_consumables',
      C: 'cashier'
    };
    const outletTypeByRole: Record<string, string> = {
      cashier: 'cashier',
      kyogong_reception_cashier: 'kyogong_reception',
      kyogong_spa_cashier: 'kyogong_spa',
      kyogong_executive_bar_cashier: 'kyogong_executive_bar',
      kyogong_sports_bar_cashier: 'kyogong_sports_bar'
    };
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
      'kyogong_sports_bar_cashier', 'kyogong_reception_cashier',
      'general_manager', 'director', 'auditor'
    ];

    const cashierRoles = [
      'cashier', 'accountant', 'manager', 'branch_manager', 'super_admin',
      'kyogong_spa_cashier', 'kyogong_executive_bar_cashier',
      'kyogong_sports_bar_cashier', 'kyogong_reception_cashier',
      'general_manager', 'director', 'auditor', 'finance_manager',
      'branch_accountant'
    ];

    const nonConsumablesRoles = [
      ...cashierRoles,
      'branch_storekeeper',
      'storekeeper',
      'inventory_clerk',
      'procurement_manager',
      'procurement',
      'purchasing_manager'
    ];

    logger.info(`POS Login Attempt - User: ${user.email}, Role: ${user.role}, Prefix: ${prefix}, PIN: ${maskedPin}`);

    if (prefix === 'R' && !restaurantRoles.includes(normalizedRole)) {
      logger.warn(`POS Login role-prefix mismatch allowed: Role ${user.role} using prefix R`);
    }

    if ((prefix === 'M' || prefix === 'E') && !barRoles.includes(normalizedRole)) {
      logger.warn(`POS Login role-prefix mismatch allowed: Role ${user.role} using prefix ${prefix}`);
    }

    if (prefix === 'N' && !nonConsumablesRoles.includes(normalizedRole)) {
      logger.warn(`POS Login role-prefix mismatch allowed: Role ${user.role} using prefix N`);
    }

    if (prefix === 'C' && !cashierRoles.includes(normalizedRole)) {
      logger.warn(`POS Login role-prefix mismatch allowed: Role ${user.role} using prefix C`);
    }

    let outlet: any = null;
    let activeShiftId: string | null = null;
    let resolvedOutletType = outletTypeByRole[normalizedRole] || outletTypeByPrefix[prefix];

    if (user.branch_id) {
      let outletQuery = supabase
        .from('pos_outlets')
        .select('*')
        .eq('branch_id', user.branch_id)
        .eq('is_active', true);

      if (outletTypeByRole[normalizedRole]) {
        outletQuery = outletQuery.eq('outlet_type', outletTypeByRole[normalizedRole]);
      } else {
        outletQuery = outletQuery.eq('pin_prefix', prefix);
      }

      const { data: outletData, error: outletError } = await outletQuery.limit(1);

      if (outletError) {
        logger.warn('Failed to resolve POS outlet during PIN login', {
          userId: user.id,
          prefix,
          error: outletError.message
        });
      }

      outlet = Array.isArray(outletData) && outletData.length ? outletData[0] : null;
      resolvedOutletType = outlet?.outlet_type || resolvedOutletType;
    }

    if (outlet && prefix !== 'C') {
      const managerOverrideRoles = new Set([
        'super_admin',
        'general_manager',
        'director',
        'auditor',
        'branch_manager',
        'cashier',
        'accountant',
        'branch_accountant',
        'finance_manager'
      ]);
      const { data: assignment, error: assignmentError } = await supabase
        .from('pos_outlet_assignments')
        .select('id')
        .eq('outlet_id', outlet.id)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (assignmentError) {
        logger.warn('Failed to verify POS outlet assignment', {
          userId: user.id,
          outletId: outlet.id,
          error: assignmentError.message
        });
      }

      if (!assignment && !managerOverrideRoles.has(normalizedRole)) {
        logger.warn('POS PIN login allowed without explicit outlet assignment', {
          userId: user.id,
          outletId: outlet.id,
          role: user.role,
          prefix
        });
      }
    }

    if (outlet) {
      const { data: activeShift } = await supabase
        .from('pos_outlet_shifts')
        .select('id')
        .eq('outlet_id', outlet.id)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      activeShiftId = activeShift?.id || null;
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
        isPosLogin: true,
        active_outlet_id: outlet?.id || null,
        active_outlet_type: resolvedOutletType,
        active_outlet_prefix: prefix
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

    const enrichedPosUser = await enrichUserBranch({
      ...user,
      outlet,
      active_outlet_id: outlet?.id || null,
      active_outlet_type: resolvedOutletType,
      active_outlet_prefix: prefix,
      active_shift_id: activeShiftId
    });

    res.status(200).json({
      success: true,
      data: {
        user: enrichedPosUser,
        outlet,
        active_shift_id: activeShiftId,
        session: {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
          user: { id: user.id, email: user.email }
        }
      }
    });

    logger.info(`User ${user.email} logged in via POS PIN: ${maskedPin}`);

    await logAuthAttempt({
      email: user.email,
      status: 'success',
      userId: user.id,
      req,
      authMethod: 'pos_pin',
      message: `POS PIN Success: ${maskedPin}`
    });
  } catch (error) {
    next(error);
  }
};
