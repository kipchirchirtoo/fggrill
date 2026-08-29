import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import db from '../db';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { applyBranchFilter } from '../utils/branchIsolation';
import { requiresPosPinForLogin } from '../utils/posPinRules';
import { isBranchScopedPinsEnabled } from '../utils/posTerminalContext';

const GLOBAL_USER_ADMIN_ROLES = new Set(['super_admin', 'general_manager']);
const BRANCH_MANAGER_BLOCKED_ROLES = new Set([
  'super_admin',
  'general_manager',
  'director',
  'auditor',
  'hr_manager',
  'central_storekeeper',
  'finance_manager'
]);

const roleForRequest = (req: Request): string =>
  String((req as any).user?.role || '').toLowerCase();

const branchIdForRequest = (req: Request): number | null => {
  const raw = (req as any).user?.branch_id ?? (req as any).user?.branchId;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const isBranchManagerRequest = (req: Request): boolean =>
  ['branch_manager', 'branch_accountant'].includes(roleForRequest(req));

const isGlobalUserAdminRequest = (req: Request): boolean =>
  GLOBAL_USER_ADMIN_ROLES.has(roleForRequest(req));

const branchManagerCanAssignRole = (role: unknown): boolean =>
  !BRANCH_MANAGER_BLOCKED_ROLES.has(String(role || '').toLowerCase());

const sameBranch = (a: unknown, b: unknown): boolean =>
  Number(a) === Number(b) && Number.isFinite(Number(a)) && Number.isFinite(Number(b));

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
export const getUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let query = supabase
      .from('users')
      .select(`
        *,
        branch:branches!users_branch_id_fkey(id, name, code)
      `);

    query = applyBranchFilter(query, req);

    if (req.query.role && req.query.role !== 'all') {
      query = query.eq('role', String(req.query.role));
    }
    if (req.query.status && req.query.status !== 'all') {
      query = query.eq('status', String(req.query.status));
    }
    if (req.query.search) {
      const search = String(req.query.search).trim();
      if (search) {
        query = query.or([
          `first_name.ilike.%${search}%`,
          `last_name.ilike.%${search}%`,
          `email.ilike.%${search}%`,
          `role.ilike.%${search}%`,
          `department.ilike.%${search}%`,
          `employee_id.ilike.%${search}%`
        ].join(','));
      }
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    const userIds = (data || []).map((user: any) => user.id).filter(Boolean);
    const { data: staffProfiles, error: staffError } = userIds.length
      ? await supabase
          .from('staff_profiles')
          .select(
            'id, user_id, first_name, last_name, email, phone, employee_number, department, role, position, branch_id'
          )
          .in('user_id', userIds)
      : { data: [], error: null };

    if (staffError) throw staffError;

    const staffByUserId = new Map(
      (staffProfiles || []).map((profile: any) => [profile.user_id, profile])
    );

    // Transform the data to include branch_name for frontend compatibility
    const transformedData = data?.map(user => {
      let profile_photo_url = null;
      if (user.profile_photo) {
        const { data: { publicUrl } } = supabase.storage
          .from('profile-photos')
          .getPublicUrl(user.profile_photo);
        profile_photo_url = publicUrl;
      }

      const linkedStaff = staffByUserId.get(user.id) || null;

      return {
        ...user,
        branch_name: user.branch?.name || null,
        branch_code: user.branch?.code || null,
        profile_photo_url,
        staff_profile_id: linkedStaff?.id || null,
        staff_profile: linkedStaff,
        linked_staff_name: linkedStaff
          ? `${linkedStaff.first_name || ''} ${linkedStaff.last_name || ''}`.trim()
          : null
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

    if (!isGlobalUserAdminRequest(req) && !sameBranch(data.branch_id, branchIdForRequest(req))) {
      res.status(403).json({
        success: false,
        message: 'Forbidden: user belongs to another branch'
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
      department,
      address,
      staffProfileId, staff_profile_id
    } = req.body;

    let fName = (firstName || first_name || '').trim();
    let lName = (lastName || last_name || '').trim();
    let userRole = role;
    let bId = branchId || branch_id;
    let pNumber = phoneNumber || phone_number;
    let empId = employeeId || employee_id;
    let dept = department;
    let userEmail = email;

    // If creating from a staff profile, fetch staff data first
    const staffProfileIdVal = staffProfileId || staff_profile_id;
    let staffProfile: any = null;

    if (!staffProfileIdVal) {
      res.status(400).json({
        success: false,
        message: 'Select an existing staff profile to create a login account. New employees must be created in Staff Profiles first.'
      });
      return;
    }

    if (staffProfileIdVal) {
      const { data: sp, error: spError } = await supabase
        .from('staff_profiles')
        .select('*')
        .eq('id', staffProfileIdVal)
        .single();

      if (spError || !sp) {
        res.status(404).json({ success: false, message: 'Staff profile not found' });
        return;
      }

      if (sp.user_id) {
        res.status(409).json({
          success: false,
          message: 'This staff profile already has a user login account'
        });
        return;
      }

      staffProfile = sp;
      // Use staff profile data as defaults, but allow explicit overrides
      fName = fName || sp.first_name || '';
      lName = lName || sp.last_name || '';
      userRole = userRole || sp.role || 'employee';
      bId = bId ?? sp.branch_id;
      pNumber = pNumber || sp.phone;
      empId = empId || sp.employee_number;
      dept = dept || sp.department;
      userEmail = userEmail || sp.email;
    }

    if (isBranchManagerRequest(req)) {
      const managerBranchId = branchIdForRequest(req);
      if (!managerBranchId) {
        res.status(403).json({
          success: false,
          message: 'Branch manager account is not assigned to a branch'
        });
        return;
      }
      bId = bId ?? managerBranchId;
      if (!sameBranch(bId, managerBranchId) || (staffProfile && !sameBranch(staffProfile.branch_id, managerBranchId))) {
        res.status(403).json({
          success: false,
          message: 'Branch managers can only create accounts for staff in their own branch'
        });
        return;
      }
      if (!branchManagerCanAssignRole(userRole)) {
        res.status(403).json({
          success: false,
          message: 'Branch managers cannot create global or executive user roles'
        });
        return;
      }
    }

    // Validate required fields
    if (!fName || !lName || !userRole) {
      res.status(400).json({ success: false, message: 'Please provide firstName, lastName, and role' });
      return;
    }

    // POS staff (waiters, bar, carwash, etc.) log in by PIN and usually have
    // no email, but Supabase Auth requires one. When the staff profile has no
    // email, synthesize a unique placeholder from the employee number or name
    // + the staff-profile id so the login can still be created. An admin can
    // set a real address later.
    if (!userEmail) {
      const slugBase = String(empId || `${fName}.${lName}` || 'staff')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '.')
        .replace(/(^\.+|\.+$)/g, '') || 'staff';
      const idFrag = String(staffProfileIdVal).replace(/[^a-z0-9]/gi, '').slice(0, 8);
      userEmail = `${slugBase}.${idFrag}@staff.famousgate.local`;
    }

    const posPinRequired = requiresPosPinForLogin(userRole);

    // Validate POS PIN format and uniqueness only for PIN-login roles.
    if (
      posPinRequired &&
      (pos_pin === undefined || pos_pin === null || String(pos_pin).trim() === '')
    ) {
      res.status(400).json({
        success: false,
        message: `POS PIN is required for ${userRole} logins.`
      });
      return;
    }

    let normalizedPin: string | null = null;
    if (pos_pin !== undefined && pos_pin !== null && String(pos_pin).trim() !== '') {
      normalizedPin = String(pos_pin).trim().toUpperCase();
      if (!/^[RMNCE]\d{4}$/.test(normalizedPin)) {
        res.status(400).json({
          success: false,
          message: 'POS PIN must strictly start with R, M, N, C, or E followed by exactly 4 digits (e.g., R1234).'
        });
        return;
      }

      // Branch-scoped uniqueness only when the feature is enabled; otherwise PINs
      // stay globally unique so grandfathered (branch-blind) logins remain safe.
      let pinConflictQuery = supabase
        .from('users')
        .select('id, first_name, last_name')
        .eq('pos_pin', normalizedPin);
      if (isBranchScopedPinsEnabled() && bId) {
        pinConflictQuery = pinConflictQuery.eq('branch_id', bId);
      }
      const { data: pinConflict } = await pinConflictQuery.maybeSingle();
      if (pinConflict) {
        res.status(409).json({
          success: false,
          message: `PIN ${normalizedPin[0]}**** is already assigned to ${pinConflict.first_name} ${pinConflict.last_name}. Each staff member must have a unique POS PIN.`
        });
        return;
      }
    }

    // Step 1: Create auth user via Supabase Admin API
    const userPassword = password || (Math.random().toString(36).substr(2, 12) + 'Aa1!');

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

    // Hash password for local database fallback
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(userPassword, salt);

    // Step 2: Upsert public.users profile
    const profileData: Record<string, any> = {
      id: userId,
      email: userEmail,
      first_name: fName,
      last_name: lName,
      role: userRole,
      branch_id: bId || null,
      phone_number: pNumber || null,
      employee_id: empId || null,
      department: dept || null,
      address: address || null,
      status: status || 'active',
      pos_pin: normalizedPin,
      password_hash: passwordHash,
      updated_at: new Date().toISOString()
    };

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

    // Step 3: Link staff profile to user if provided
    if (staffProfileIdVal) {
      const { error: linkError } = await supabase
        .from('staff_profiles')
        .update({ user_id: userId, email: userEmail })
        .eq('id', staffProfileIdVal);

      if (linkError) {
        logger.warn('Failed to link staff profile to user:', linkError.message);
      }
    }

    res.status(201).json({
      success: true,
      data: { ...profile, temp_password: password === undefined ? userPassword : undefined },
      message: 'User created successfully'
    });
    logger.info(`User created by admin: ${userEmail} (${userRole})`);

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
    const hasStaffProfileField =
      Object.prototype.hasOwnProperty.call(fields, 'staff_profile_id') ||
      Object.prototype.hasOwnProperty.call(fields, 'staffProfileId');
    const requestedStaffProfileId =
      fields.staff_profile_id ?? fields.staffProfileId ?? null;

    const { data: existingUser, error: existingUserError } = await supabase
      .from('users')
      .select('id, email, role, branch_id')
      .eq('id', req.params.id)
      .single();

    if (existingUserError || !existingUser) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    if (isBranchManagerRequest(req)) {
      const managerBranchId = branchIdForRequest(req);
      if (!managerBranchId || !sameBranch(existingUser.branch_id, managerBranchId)) {
        res.status(403).json({
          success: false,
          message: 'Branch managers can only update users in their own branch'
        });
        return;
      }

      const requestedBranchId = fields.branch_id ?? fields.branchId;
      if (requestedBranchId !== undefined && !sameBranch(requestedBranchId, managerBranchId)) {
        res.status(403).json({
          success: false,
          message: 'Branch managers cannot move users to another branch'
        });
        return;
      }

      if (fields.role !== undefined && !branchManagerCanAssignRole(fields.role)) {
        res.status(403).json({
          success: false,
          message: 'Branch managers cannot assign global or executive roles'
        });
        return;
      }
    }

    let selectedStaffProfile: any = null;
    if (hasStaffProfileField && requestedStaffProfileId) {
      const { data: staffProfile, error: staffProfileError } = await supabase
        .from('staff_profiles')
        .select(
          'id, user_id, first_name, last_name, email, phone, employee_number, department, role, position, branch_id'
        )
        .eq('id', requestedStaffProfileId)
        .single();

      if (staffProfileError || !staffProfile) {
        res.status(404).json({
          success: false,
          message: 'Staff profile not found'
        });
        return;
      }

      if (staffProfile.user_id && staffProfile.user_id !== req.params.id) {
        res.status(409).json({
          success: false,
          message: 'This staff profile is already linked to another user account'
        });
        return;
      }

      if (isBranchManagerRequest(req) && !sameBranch(staffProfile.branch_id, branchIdForRequest(req))) {
        res.status(403).json({
          success: false,
          message: 'Branch managers can only link staff from their own branch'
        });
        return;
      }

      selectedStaffProfile = staffProfile;
    }

    // Validate POS PIN format and uniqueness on update
    let normalizedPin: string | null | undefined = undefined;
    if (fields.pos_pin !== undefined) {
      if (fields.pos_pin === null || String(fields.pos_pin).trim() === '') {
        normalizedPin = null;
      } else {
        normalizedPin = String(fields.pos_pin).trim().toUpperCase();
        if (!/^[RMNCE]\d{4}$/.test(normalizedPin)) {
          res.status(400).json({
            success: false,
            message: 'POS PIN must strictly start with R, M, N, C, or E followed by exactly 4 digits (e.g., R1234).'
          });
          return;
        }

        let updateConflictQuery = supabase
          .from('users')
          .select('id, first_name, last_name')
          .eq('pos_pin', normalizedPin)
          .neq('id', req.params.id);
        if (isBranchScopedPinsEnabled()) {
          // Scope to the branch the PIN will live in: the incoming branch if it
          // is being changed, otherwise the user's current branch.
          let effBranch = fields.branch_id || fields.branchId;
          if (!effBranch) {
            const { data: cur } = await supabase
              .from('users')
              .select('branch_id')
              .eq('id', req.params.id)
              .maybeSingle();
            effBranch = cur?.branch_id;
          }
          if (effBranch) updateConflictQuery = updateConflictQuery.eq('branch_id', effBranch);
        }
        const { data: pinConflict } = await updateConflictQuery.maybeSingle();
        if (pinConflict) {
          res.status(409).json({
            success: false,
            message: `PIN ${normalizedPin[0]}**** is already assigned to ${pinConflict.first_name} ${pinConflict.last_name}. Each staff member must have a unique POS PIN.`
          });
          return;
        }
      }
    }

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
      address: fields.address,
      pos_pin: normalizedPin,
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

    const profileEmail = data?.email || userFields.email || existingUser.email || null;

    if (hasStaffProfileField) {
      const { error: unlinkError } = await supabase
        .from('staff_profiles')
        .update({ user_id: null })
        .eq('user_id', req.params.id)
        .neq('id', requestedStaffProfileId || '');

      if (unlinkError) throw unlinkError;

      if (requestedStaffProfileId) {
        const staffUpdate: Record<string, any> = {
          user_id: req.params.id
        };
        if (profileEmail) {
          staffUpdate.email = profileEmail;
        }

        const { error: linkError } = await supabase
          .from('staff_profiles')
          .update(staffUpdate)
          .eq('id', requestedStaffProfileId);

        if (linkError) throw linkError;
      } else {
        const { error: clearLinkError } = await supabase
          .from('staff_profiles')
          .update({ user_id: null })
          .eq('user_id', req.params.id);

        if (clearLinkError) throw clearLinkError;
      }
    } else if (profileEmail && profileEmail !== existingUser.email) {
      await supabase
        .from('staff_profiles')
        .update({ email: profileEmail })
        .eq('user_id', req.params.id);
    }

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
      data: {
        ...data,
        staff_profile_id: requestedStaffProfileId,
        staff_profile: selectedStaffProfile
      }
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

    // Safely un-link audit/history references so deletion is clean
    await db.query('UPDATE room_status_history SET changed_by = NULL WHERE changed_by = $1', [id]).catch(() => {});
    await db.query('UPDATE hk_room_status_history SET changed_by = NULL WHERE changed_by = $1', [id]).catch(() => {});

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
    let countQuery = supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
      
    countQuery = applyBranchFilter(countQuery, req);
    const { count: totalUsers, error: countError } = await countQuery;

    if (countError) throw countError;

    let activeQuery = supabase
      .from('users')
      .select('id')
      .eq('status', 'active');
      
    activeQuery = applyBranchFilter(activeQuery, req);
    const { data: activeUsers, error: activeError } = await activeQuery;

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
// @route   PUT /api/users/password
// @access  Private
export const updateUserPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        message: 'Please provide current and new password'
      });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
      return;
    }

    // Verify current password
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Check if current password matches
    if (user.password_hash) {
      const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isMatch) {
        res.status(401).json({
          success: false,
          message: 'Current password is incorrect'
        });
        return;
      }
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update password in database
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        password_hash: passwordHash,
        password_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    // Update in Supabase Auth
    const { error: authError } = await supabase.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (authError) {
      logger.error('Supabase Auth password update error:', authError);
      // Don't fail the request if auth update fails
    }

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });

    logger.info(`Password updated for user ${userId}`);
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
