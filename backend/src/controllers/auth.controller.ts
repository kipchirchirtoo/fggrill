import { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
dotenv.config();
import { supabase } from '../config/supabase';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import db from '../db';
import { logAuthAttempt, logSecurityEvent } from '../utils/audit';
import { resolvePosTerminalContext, isBranchScopedPinsEnabled } from '../utils/posTerminalContext';
import {
  registerManagedSession,
  revokeManagedSession
} from '../services/session-registry.service';
import {
  getDefaultUserInventoryContext,
  getUserInventoryContexts,
  type UserInventoryContext,
} from '../services/inventory-warehouse.service';

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
const UNIVERSAL_ROLES = ['super_admin', 'general_manager', 'auditor', 'hr_manager', 'director'];

const parseBooleanConfig = (value: unknown, fallback = true): boolean => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'enabled', 'active'].includes(normalized)) return true;
  if (['false', '0', 'no', 'disabled', 'inactive'].includes(normalized)) return false;
  return fallback;
};

const readSystemConfig = async (keys: string[]): Promise<Record<string, any>> => {
  const { data, error } = await supabase
    .from('system_config_values')
    .select('key, value')
    .in('key', keys);

  if (error) {
    logger.warn('Failed to read system configuration', { keys, error });
    return {};
  }

  return (data || []).reduce((acc: Record<string, any>, row: any) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
};

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

const serializeActiveContext = (context: UserInventoryContext | null) => {
  if (!context) return null;

  return {
    role: context.role,
    role_name: context.role_name,
    context_type: context.context_type,
    branch_id: context.branch_id,
    branch_name: context.branch_name,
    branch_code: context.branch_code,
    warehouse_id: context.warehouse_id,
    warehouse_name: context.warehouse_name,
    warehouse_code: context.warehouse_code,
    operating_branch_id: context.operating_branch_id,
    operating_branch_name: context.operating_branch_name,
    is_default: context.is_default,
    display_name: context.display_name,
  };
};

// @desc    Validate local deployment license and bind terminal to a branch
// @route   POST /api/auth/license/validate
// @access  Public
export const validateLicense = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const licenseKey = String(req.body.license_key ?? req.body.licenseKey ?? '').trim();
    const branchCode = String(req.body.branch_code ?? req.body.branchCode ?? '').trim().toUpperCase();

    if (!licenseKey || !branchCode) {
      res.status(400).json({
        success: false,
        message: 'License key and branch code are required',
        is_valid: false
      });
      return;
    }

    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .select('id, name, code, status')
      .ilike('code', branchCode)
      .maybeSingle();

    if (branchError) throw branchError;

    if (!branch) {
      res.status(404).json({
        success: false,
        message: 'Branch code not found',
        is_valid: false
      });
      return;
    }

    const config = await readSystemConfig(['licenseKey', 'licenseExpiry', 'isLicenseValid']);
    const configuredKey = String(
      config.licenseKey ?? process.env.APP_LICENSE_KEY ?? process.env.FG_LICENSE_KEY ?? ''
    ).trim();
    const expiryDate = String(
      config.licenseExpiry ?? process.env.APP_LICENSE_EXPIRY ?? ''
    ).trim();
    const licenseEnabled = parseBooleanConfig(
      config.isLicenseValid ?? process.env.APP_LICENSE_ENABLED,
      true
    );
    const expiryMs = expiryDate ? Date.parse(expiryDate) : NaN;
    const notExpired = !expiryDate || (Number.isFinite(expiryMs) && expiryMs >= Date.now());
    const keyMatches = configuredKey ? configuredKey === licenseKey : true;
    const branchActive = String(branch.status || 'active').toLowerCase() !== 'inactive';
    const isValid = Boolean(licenseEnabled && notExpired && keyMatches && branchActive);

    const payload = {
      branch_id: String(branch.id),
      branchId: String(branch.id),
      branch_name: branch.name,
      branchName: branch.name,
      branch_code: branch.code,
      branchCode: branch.code,
      expiry_date: expiryDate || null,
      expiryDate: expiryDate || null,
      is_valid: isValid,
      isValid
    };

    if (!isValid) {
      res.status(401).json({
        success: false,
        message: 'License is not valid for this branch',
        ...payload
      });
      return;
    }

    res.json({
      success: true,
      ...payload,
      data: payload
    });
  } catch (error) {
    next(error);
  }
};

const issueLocalSession = (
  userId: string,
  email: string,
  role: string,
  activeRole?: string,
  activeBranchId?: number | null,
  options?: {
    activeOutletId?: string | null;
    activeOutletPrefix?: string | null;
    activeOutletType?: string | null;
    activeWarehouseId?: string | null;
    activeContextType?: 'branch' | 'warehouse';
    homeBranchId?: number | null;
    isPosLogin?: boolean;
    ttlHours?: number;
  }
) => {
  const jwtSecret = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'fallback-secret-key';
  const sessionId = crypto.randomUUID();
  const ttlHours = options?.ttlHours ?? 24;

  const payload: any = {
    sub: userId,
    email,
    role,
    aud: 'authenticated',
    sid: sessionId
  };

  if (activeRole) payload.active_role = activeRole;
  if (activeBranchId !== undefined && activeBranchId !== null) payload.active_branch_id = activeBranchId;
  if (options?.activeWarehouseId) payload.active_warehouse_id = options.activeWarehouseId;
  if (options?.activeContextType) payload.active_context_type = options.activeContextType;
  if (options?.homeBranchId !== undefined && options.homeBranchId !== null) payload.home_branch_id = options.homeBranchId;
  if (options?.activeOutletId) payload.active_outlet_id = options.activeOutletId;
  if (options?.activeOutletType) payload.active_outlet_type = options.activeOutletType;
  if (options?.activeOutletPrefix) payload.active_outlet_prefix = options.activeOutletPrefix;
  if (options?.isPosLogin) payload.isPosLogin = true;

  const accessToken = jwt.sign(payload, jwtSecret, { expiresIn: `${ttlHours}h` });

  const refreshToken = jwt.sign(
    {
      sub: userId,
      type: 'refresh',
      sid: sessionId,
      active_role: payload.active_role,
      active_branch_id: payload.active_branch_id,
      active_warehouse_id: payload.active_warehouse_id,
      active_context_type: payload.active_context_type,
      home_branch_id: payload.home_branch_id
    },
    jwtSecret,
    { expiresIn: '7d' }
  );

  return {
    secretSource: process.env.JWT_SECRET ? 'JWT_SECRET' : (process.env.SUPABASE_JWT_SECRET ? 'SUPABASE_JWT_SECRET' : 'fallback'),
    sessionId,
    session: {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString(),
      user: { id: userId, email },
      supabase_token: issueSupabaseBridgeToken(userId, ttlHours)
    }
  };
};

// Bridges this app's own login (bcrypt + custom JWT, never Supabase Auth)
// into a token Supabase's PostgREST/Realtime will actually accept for RLS.
// Registration already creates a matching auth.users row with this same
// UUID (see register() below), so `sub: userId` here is exactly what
// auth.uid() resolves to once a direct Supabase client attaches this token.
// Must be signed with the project's REAL Supabase JWT secret -- a token
// signed with JWT_SECRET (this app's own secret, used above for
// accessToken) would fail Supabase's signature check outright. The `role`
// claim here is the POSTGRES role PostgREST assumes ('authenticated'), not
// this user's app-level role (cashier/branch_manager/...) -- that
// distinction matters because RLS policies look up the app role from the
// `users` table themselves, not from this claim.
const issueSupabaseBridgeToken = (userId: string, ttlHours: number): string | null => {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    logger.warn('SUPABASE_JWT_SECRET not set — cannot issue a direct-Supabase bridge token; direct reads will fail RLS for this session');
    return null;
  }
  return jwt.sign(
    { sub: userId, role: 'authenticated', aud: 'authenticated' },
    secret,
    { expiresIn: `${ttlHours}h` }
  );
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
      let dbUser: any = null;
      let dbError: any = null;

      try {
        const res = await supabase
          .from('users')
          .select('id, email, first_name, last_name, role, branch_id, status, password_hash')
          .eq('email', email)
          .maybeSingle();
        dbUser = res.data;
        dbError = res.error;
      } catch (err: any) {
        dbError = err;
      }

      // Direct Postgres Pool Fallback if Supabase REST call failed or timed out
      if ((dbError || !dbUser) && email) {
        if (dbError) {
          logger.warn(`Supabase REST query failed/timed out for ${email}: ${dbError.message || JSON.stringify(dbError)}. Trying direct Postgres pool...`);
        }
        try {
          const pgRes = await db.query(
            'SELECT id, email, first_name, last_name, role, branch_id, status, password_hash FROM users WHERE email = $1 LIMIT 1',
            [email]
          );
          if (pgRes.rows && pgRes.rows.length > 0) {
            dbUser = pgRes.rows[0];
            dbError = null;
            logger.info(`[AUTH-DEBUG] Direct Postgres pool fallback succeeded for ${email}`);
          }
        } catch (pgErr: any) {
          logger.error(`Direct Postgres pool query also failed for ${email}:`, pgErr.message || pgErr);
        }
      }

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
              .maybeSingle();
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

    // If users.branch_id is null, derive it from user_branch_roles (primary or first assignment)
    if (!userProfile.branch_id && allRoles.length > 0) {
      const primary = allRoles.find((r: any) => r.is_primary) || allRoles[0];
      if (primary?.branch_id) {
        userProfile = { ...userProfile, branch_id: primary.branch_id, branchId: primary.branch_id };
      }
    }

    const availableContexts = await getUserInventoryContexts(userId, {
      role: userProfile.role,
      branch_id: userProfile.branch_id ?? null
    });
    const activeContext = getDefaultUserInventoryContext(availableContexts, userProfile.role);
    const activeRole = activeContext?.role || userProfile.role;
    const activeBranchId = activeContext?.context_type === 'branch'
      ? (activeContext.branch_id ?? userProfile.branch_id ?? null)
      : null;

    const { secretSource, sessionId, session } = issueLocalSession(
      userId,
      userProfile.email,
      userProfile.role,
      activeRole,
      activeBranchId,
      {
        activeWarehouseId: activeContext?.warehouse_id || null,
        activeContextType: activeContext?.context_type || 'branch',
        homeBranchId: userProfile.branch_id ?? null,
      }
    );

    await registerManagedSession({
      userId,
      sessionId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
      expiresAt: session.expires_at
    });

    logger.info('Generating local JWT token for user login', {
      userId,
      email: userProfile.email,
      secretSource,
      activeContextType: activeContext?.context_type || 'branch',
      activeWarehouseId: activeContext?.warehouse_id || null,
      activeBranchId
    });

    const isUniversal = UNIVERSAL_ROLES.includes(userProfile.role);
    const requiresContextSelection = !isUniversal && availableContexts.length > 1;

    const enrichedUserProfile = await enrichUserBranch({
      ...userProfile,
      role: activeRole,
      active_context: serializeActiveContext(activeContext),
      all_roles: allRoles,
      available_contexts: availableContexts.map(serializeActiveContext)
    });

    res.status(200).json({
      success: true,
      data: {
        user: {
          ...enrichedUserProfile,
          primary_role: userProfile.role,
          all_roles: allRoles,
          available_contexts: availableContexts.map(serializeActiveContext),
          active_context: serializeActiveContext(activeContext)
        },
        session,
        requires_context_selection: requiresContextSelection,
        available_contexts: availableContexts.map(serializeActiveContext),
        active_context: serializeActiveContext(activeContext)
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
            .select('id, email, role, branch_id')
            .eq('id', decoded.sub)
            .single();

          if (userError || !user) {
            res.status(401).json({
              success: false,
              message: 'Invalid refresh token'
            });
            return;
          }

          if (decoded.sid) {
            await revokeManagedSession(decoded.sid);
          }

          const availableContexts = await getUserInventoryContexts(user.id, {
            role: user.role,
            branch_id: user.branch_id ?? null
          });
          const requestedRole = decoded.active_role || user.role;
          const requestedContextType = decoded.active_context_type || 'branch';
          const requestedBranchId = requestedContextType === 'branch'
            ? (decoded.active_branch_id ?? null)
            : null;
          const requestedWarehouseId = decoded.active_warehouse_id ?? null;

          const requestedContext = availableContexts.find((context) =>
            context.role === requestedRole &&
            context.context_type === requestedContextType &&
            (context.branch_id ?? null) === (requestedBranchId ?? null) &&
            (context.warehouse_id ?? null) === (requestedWarehouseId ?? null)
          );

          const activeContext = requestedContext
            || getDefaultUserInventoryContext(availableContexts, requestedRole);
          const activeRole = activeContext?.role || requestedRole || user.role;
          const activeContextType = activeContext?.context_type || requestedContextType;
          const activeBranchId = activeContextType === 'warehouse'
            ? null
            : (activeContext?.branch_id ?? user.branch_id ?? null);
          const activeWarehouseId = activeContext?.warehouse_id ?? null;

          const { sessionId, session } = issueLocalSession(
            user.id,
            user.email,
            user.role,
            activeRole,
            activeBranchId,
            {
              activeWarehouseId,
              activeContextType,
              homeBranchId: user.branch_id ?? null
            }
          );

          await registerManagedSession({
            userId: user.id,
            sessionId,
            ipAddress: req.ip,
            userAgent: req.get('user-agent') || null,
            expiresAt: session.expires_at
          });

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
    const { role, branch_id, warehouse_id, context_type } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    if (!role) {
      res.status(400).json({ success: false, message: 'role is required' });
      return;
    }

    const availableContexts = await getUserInventoryContexts(userId);
    const entry = availableContexts.find((context) =>
      context.role === role &&
      (context_type == null || context.context_type === context_type) &&
      (context.branch_id ?? null) === (branch_id ?? null) &&
      (context.warehouse_id ?? null) === (warehouse_id ?? null)
    ) || availableContexts.find((context) =>
      context.role === role &&
      (context.branch_id ?? null) === (branch_id ?? null) &&
      (context.warehouse_id ?? null) === (warehouse_id ?? null)
    );

    if (!entry) {
      logger.warn(`switchContext: user ${userId} attempted unauthorized context role=${role} branch=${branch_id} warehouse=${warehouse_id}`);
      res.status(403).json({ success: false, message: 'This context is not assigned to you' });
      return;
    }

    // Fetch user profile for email
    const { data: userProfile } = await supabase
      .from('users')
      .select('id, email, role, branch_id')
      .eq('id', userId)
      .single();

    if (!userProfile) {
      res.status(401).json({ success: false, message: 'User not found' });
      return;
    }

    const { sessionId, session } = issueLocalSession(
      userId,
      userProfile.email,
      userProfile.role,   // primary role (unchanged in DB)
      entry.role,
      entry.context_type === 'branch' ? (entry.branch_id ?? null) : null,
      {
        activeWarehouseId: entry.warehouse_id,
        activeContextType: entry.context_type,
        homeBranchId: userProfile.branch_id ?? null
      }
    );

    await registerManagedSession({
      userId,
      sessionId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
      expiresAt: session.expires_at
    });

    res.status(200).json({
      success: true,
      data: {
        session,
        active_role: entry.role,
        active_branch_id: entry.context_type === 'branch' ? (entry.branch_id ?? null) : null,
        active_warehouse_id: entry.warehouse_id,
        active_context_type: entry.context_type,
        active_context: serializeActiveContext(entry),
        available_contexts: availableContexts.map(serializeActiveContext)
      }
    });

    logger.info(`User ${userProfile.email} switched context to role=${entry.role} branch=${entry.branch_id} warehouse=${entry.warehouse_id}`);
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
    await revokeManagedSession(req.user?.session_id || null);

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
        .select('national_id')
        .eq('user_id', req.user.id)
        .maybeSingle();

      if (staffProfile) {
        idNumber = staffProfile.national_id;
      }
    } catch (staffErr) {
      logger.warn('getMe: Failed to fetch staff_profile, continuing without it', staffErr);
    }

    // Include all assigned contexts so staff can move between branch and
    // warehouse work surfaces without re-authenticating.
    let allRoles: any[] = [];
    try {
      const { data: roleRows } = await supabase
        .from('user_branch_roles')
        .select('role, branch_id, is_primary, branches(id, name, code)')
        .eq('user_id', req.user.id);
      allRoles = roleRows || [];
    } catch (roleErr) {
      logger.warn('getMe: Could not fetch user_branch_roles, defaulting to primary role', roleErr);
    }
    if (!allRoles.length) {
      allRoles = [{ role: profile.role, branch_id: profile.branch_id, is_primary: true }];
    }

    const availableContexts = await getUserInventoryContexts(req.user.id, {
      role: profile.role,
      branch_id: profile.branch_id ?? null
    });
    const activeContext = availableContexts.find((context) =>
      context.role === req.user?.role &&
      context.context_type === (req.user?.context_type || 'branch') &&
      (context.branch_id ?? null) === ((req.user?.context_type === 'branch' ? req.user?.branch_id : null) ?? null) &&
      (context.warehouse_id ?? null) === (req.user?.warehouse_id ?? null)
    ) || getDefaultUserInventoryContext(availableContexts, req.user?.role || profile.role);

    // Build response
    const responseData = await enrichUserBranch({
      ...profile,
      id_number: idNumber,
      role: req.user?.role || profile.role,
      primary_role: profile.role,
      all_roles: allRoles,
      available_contexts: availableContexts.map(serializeActiveContext),
      active_context: serializeActiveContext(activeContext)
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

    // Resolve the POS terminal (device/branch) context, if this request came
    // from a registered terminal. Branch-aware login scopes the PIN lookup to
    // the terminal's branch, so the same PIN can exist in different branches.
    // A branch-blind request is only allowed while branch-scoped PINs are
    // disabled (grandfather mode); once enabled, a registered terminal is
    // required so the branch is never ambiguous.
    const terminalCtx = await resolvePosTerminalContext(req);
    if (isBranchScopedPinsEnabled() && !terminalCtx) {
      logger.warn('POS PIN login rejected: branch-scoped PINs enabled but no registered terminal', { ip: req.ip });
      res.status(401).json({
        success: false,
        code: 'POS_TERMINAL_REQUIRED',
        message: 'This device must be registered before POS login. Ask an administrator to register this terminal.'
      });
      return;
    }
    const scopeBranchId = terminalCtx?.branchId ?? null;

    // Find user by PIN — direct column first, then metadata->>'pos_pin' fallback
    // (handles rows migrated from the old DB before the pos_pin column existed).
    // Scoped to the terminal's branch when known; otherwise global, and an
    // ambiguous (multi-branch) match is rejected rather than guessed.
    let user: any = null;
    {
      let colQuery = supabase.from('users').select('*').eq('pos_pin', pin);
      if (scopeBranchId) colQuery = colQuery.eq('branch_id', scopeBranchId);
      const { data: colMatches } = await colQuery.limit(2);
      if ((colMatches || []).length > 1) {
        logger.warn('POS PIN login rejected: ambiguous PIN across branches', { ip: req.ip });
        res.status(409).json({
          success: false,
          code: 'PIN_AMBIGUOUS',
          message: 'This PIN exists in more than one branch. Register this terminal so the branch is known.'
        });
        return;
      }
      if ((colMatches || []).length === 1) {
        user = colMatches![0];
      } else {
        let metaQuery = supabase.from('users').select('*').filter('metadata->>pos_pin', 'eq', pin);
        if (scopeBranchId) metaQuery = metaQuery.eq('branch_id', scopeBranchId);
        const { data: metaMatches } = await metaQuery.limit(2);
        if ((metaMatches || []).length > 1) {
          res.status(409).json({
            success: false,
            code: 'PIN_AMBIGUOUS',
            message: 'This PIN exists in more than one branch. Register this terminal so the branch is known.'
          });
          return;
        }
        if ((metaMatches || []).length === 1) {
          user = metaMatches![0];
          // Backfill the column so future logins use the fast path.
          await supabase
            .from('users')
            .update({ pos_pin: pin, updated_at: new Date().toISOString() })
            .eq('id', user.id);
        }
      }
    }

    if (!user) {
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

      void supabase.from('pos_login_logs').insert({
        pin_prefix: pin[0],
        success: false,
        failure_reason: 'invalid_pin',
        ip_address: req.ip || null,
        user_agent: req.get('user-agent') || null,
        created_at: new Date().toISOString()
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
      restaurant_cashier: 'restaurant',
      main_bar_cashier: 'main_bar',
      executive_bar_cashier: 'executive_bar',
      non_consumables_cashier: 'non_consumables',
      kyogong_reception_cashier: 'kyogong_reception',
      kyogong_spa_cashier: 'kyogong_spa',
      kyogong_executive_bar_cashier: 'kyogong_executive_bar',
      kyogong_sports_bar_cashier: 'kyogong_sports_bar',
      choma_zone_cashier: 'choma_zone'
    };
    const restaurantRoles = [
      'restaurant', 'restaurant_manager', 'head_chef', 'sous_chef',
      'line_cook', 'prep_cook', 'waiter', 'waitress', 'head_waiter',
      'food_runner', 'busser', 'host_hostess', 'pos_kitchen',
      'kitchen', 'kitchen_helper', 'dishwasher', 'manager',
      'branch_manager', 'super_admin', 'cashier', 'restaurant_cashier',
      'kyogong_spa_cashier', 'kyogong_executive_bar_cashier',
      'kyogong_sports_bar_cashier', 'kyogong_reception_cashier',
      'choma_zone_cashier'
    ];

    const barRoles = [
      'barmaid', 'barman', 'bartender', 'barista', 'bar_manager',
      'manager', 'branch_manager', 'super_admin', 'cashier',
      'main_bar_cashier', 'executive_bar_cashier',
      'kyogong_spa_cashier', 'kyogong_executive_bar_cashier',
      'kyogong_sports_bar_cashier', 'kyogong_reception_cashier',
      'general_manager', 'director', 'auditor'
    ];

    const cashierRoles = [
      'cashier', 'accountant', 'manager', 'branch_manager', 'super_admin',
      'restaurant_cashier', 'main_bar_cashier', 'executive_bar_cashier',
      'non_consumables_cashier',
      'kyogong_spa_cashier', 'kyogong_executive_bar_cashier',
      'kyogong_sports_bar_cashier', 'kyogong_reception_cashier',
      'choma_zone_cashier',
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

    let resolvedOutletType = outletTypeByRole[normalizedRole] || outletTypeByPrefix[prefix];

    // ── Stage 2: outlet lookup + branch enrich — run in parallel ─────────────
    // Both only need the user object, so they can fire simultaneously.
    const outletQueryBuilder = () => {
      if (!user.branch_id) return Promise.resolve({ data: null, error: null });
      let q = supabase
        .from('pos_outlets')
        .select('*')
        .eq('branch_id', user.branch_id)
        .eq('is_active', true);
      if (outletTypeByRole[normalizedRole]) {
        q = q.eq('outlet_type', outletTypeByRole[normalizedRole]);
      } else {
        q = q.eq('pin_prefix', prefix);
      }
      return q.limit(1);
    };

    const [outletResult, enrichedBase] = await Promise.all([
      outletQueryBuilder(),
      enrichUserBranch({ ...user })
    ]);

    if (outletResult.error) {
      logger.warn('Failed to resolve POS outlet during PIN login', {
        userId: user.id, prefix, error: outletResult.error.message
      });
    }
    const outletData = outletResult.data;
    let outlet: any = Array.isArray(outletData) && outletData.length ? outletData[0] : null;
    resolvedOutletType = outlet?.outlet_type || resolvedOutletType;

    // ── Stage 3: assignment check + shift lookup — run in parallel ───────────
    // Both need outlet.id; neither blocks the other.
    const stationCashierRoles = new Set([
      'restaurant_cashier', 'main_bar_cashier', 'executive_bar_cashier',
      'non_consumables_cashier', 'kyogong_spa_cashier',
      'kyogong_executive_bar_cashier', 'kyogong_sports_bar_cashier',
      'kyogong_reception_cashier', 'choma_zone_cashier'
    ]);
    const managerOverrideRoles = new Set([
      'super_admin', 'general_manager', 'director', 'auditor',
      'branch_manager', 'cashier', 'accountant', 'branch_accountant', 'finance_manager'
    ]);

    const needsAssignmentCheck = outlet && prefix !== 'C';
    const [assignmentResult, shiftResult] = await Promise.all([
      needsAssignmentCheck
        ? supabase.from('pos_outlet_assignments').select('id')
            .eq('outlet_id', outlet.id).eq('user_id', user.id).eq('is_active', true).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      outlet
        ? supabase.from('pos_outlet_shifts').select('id')
            .eq('outlet_id', outlet.id).eq('status', 'open')
            .order('opened_at', { ascending: false }).limit(1).maybeSingle()
        : Promise.resolve({ data: null, error: null })
    ]);

    if (needsAssignmentCheck) {
      if (assignmentResult.error) {
        logger.warn('Failed to verify POS outlet assignment', {
          userId: user.id, outletId: outlet.id, error: assignmentResult.error.message
        });
      }
      if (!assignmentResult.data && stationCashierRoles.has(normalizedRole)) {
        res.status(403).json({
          success: false,
          message: `This cashier is not assigned to ${outlet.name || 'this POS station'}. Ask a manager to assign them to the station first.`
        });
        return;
      }
      if (!assignmentResult.data && !managerOverrideRoles.has(normalizedRole)) {
        logger.warn('POS PIN login allowed without explicit outlet assignment', {
          userId: user.id, outletId: outlet.id, role: user.role, prefix
        });
      }
    }

    const activeShiftId: string | null = shiftResult.data?.id || null;

    // Generate JWT token (synchronous — no network)
    const jwtSecret = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'fallback-secret-key';

    logger.debug('Generating token for POS login', {
      userId: user.id,
      email: user.email,
      hasSecret: !!jwtSecret,
      secretLength: jwtSecret.length
    });

    const { sessionId, session } = issueLocalSession(
      user.id,
      user.email,
      user.role,
      undefined,
      user.branch_id ?? null,
      {
        activeOutletId: outlet?.id || null,
        activeOutletPrefix: prefix,
        activeOutletType: resolvedOutletType,
        isPosLogin: true,
        ttlHours: 12
      }
    );

    // ── Fire-and-forget side effects — do NOT await these ────────────────────
    // last_login update, attendance clock-in, and session registry do not
    // affect the response and are best-effort.  Awaiting them sequentially was
    // the main source of the 30-second timeout.
    void supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    void (async () => {
      try {
        const { data: existingAttendance } = await supabase
          .from('staff_attendance')
          .select('id')
          .eq('user_id', user.id)
          .is('clock_out', null)
          .maybeSingle();
        if (!existingAttendance) {
          await supabase.from('staff_attendance').insert([{
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
    })();

    void registerManagedSession({
      userId: user.id,
      sessionId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
      expiresAt: session.expires_at,
      deviceInfo: {
        login_type: 'pos_pin',
        outlet_id: outlet?.id || null,
        outlet_type: resolvedOutletType,
        pin_prefix: prefix
      }
    });

    // Build enriched user from the branch-enriched base fetched in Stage 2
    const enrichedPosUser = {
      ...enrichedBase,
      outlet,
      active_outlet_id: outlet?.id || null,
      active_outlet_type: resolvedOutletType,
      active_outlet_prefix: prefix,
      active_shift_id: activeShiftId
    };

    res.status(200).json({
      success: true,
      data: {
        user: enrichedPosUser,
        outlet,
        active_shift_id: activeShiftId,
        session
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

    void supabase.from('pos_login_logs').insert({
      user_id: user.id,
      branch_id: user.branch_id || null,
      outlet_id: outlet?.id || null,
      outlet_type: resolvedOutletType || null,
      pin_prefix: prefix,
      success: true,
      session_id: sessionId,
      ip_address: req.ip || null,
      user_agent: req.get('user-agent') || null,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};
