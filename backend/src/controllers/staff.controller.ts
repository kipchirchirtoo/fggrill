import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AttendanceService } from '../services/attendance.service';

// Helper to sanitize UUID fields that might come as "null" string from frontend
const sanitizeUUID = (val: any) => {
  if (val === 'null' || val === '' || val === 'undefined' || val === null) return null;
  return val;
};

// Staff ID generation utility
const generateStaffId = async (branchId: number | string | null, role: string): Promise<string> => {
  try {
    // 1. Get branch code (Using padded Branch ID e.g. 01)
    let branchCode = '00';
    if (branchId) {
      // Only if numeric
      if (!Number.isNaN(Number(branchId))) {
        branchCode = String(branchId).padStart(2, '0');
      }
    }
    const prefix = `FG${branchCode}`;

    // 2. Determine if management role
    const managementRoles = ['super_admin', 'branch_manager', 'general_manager', 'ceo', 'admin'];
    const isManagement = managementRoles.includes(role.toLowerCase());

    // 3. Get existing staff count for this branch
    let countQuery = supabase
      .from('staff_profiles')
      .select('id', { count: 'exact', head: true });

    if (branchId === null || branchId === undefined || branchId === 'null') {
      countQuery = countQuery.is('branch_id', null);
    } else {
      countQuery = countQuery.eq('branch_id', branchId);
    }

    const { count } = await countQuery;

    const currentCount = count || 0;

    // 4. Calculate sequential number
    // Reserved 001-010 for management. Others start at 011.
    let sequenceNumber: number;
    if (isManagement) {
      // For management, use 1-10 range. If 10 is exceeded, it will just keep growing but starting from 1.
      sequenceNumber = (currentCount % 10) + 1;
    } else {
      // For others, start from 11.
      sequenceNumber = currentCount + 11;
    }

    const paddedNumber = String(sequenceNumber).padStart(3, '0');
    return `${prefix}${paddedNumber}`;
  } catch (error) {
    logger.error('Error generating staff ID:', error);
    return `STF${Math.floor(1000 + Math.random() * 9000)}`;
  }
};

// Password generation utility
const generateStrongPassword = (): string => {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';

  // Ensure at least one character from each category
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // Uppercase
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // Lowercase
  password += '0123456789'[Math.floor(Math.random() * 10)]; // Number
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // Special char

  // Fill remaining length
  for (let i = 4; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

// @desc    Get all available user roles
// @route   GET /api/staff/roles
// @access  Private (Admin, Manager)
export const getRoles = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get roles from UserRole enum
    const roles = [
      { value: 'super_admin', label: 'Super Admin', description: 'Full system access' },
      { value: 'general_manager', label: 'General Manager', description: 'Multi-branch management' },
      { value: 'branch_manager', label: 'Branch Manager', description: 'Single branch management' },
      { value: 'receptionist', label: 'Receptionist', description: 'Front desk operations' },
      { value: 'housekeeping', label: 'Housekeeping', description: 'Room cleaning and maintenance' },
      { value: 'restaurant', label: 'Restaurant Staff', description: 'Food & beverage service' },
      { value: 'maintenance', label: 'Maintenance', description: 'Facility maintenance' },
      { value: 'accountant', label: 'Accountant', description: 'Financial management' },
      { value: 'auditor', label: 'Auditor', description: 'Financial auditing' },
      { value: 'central_storekeeper', label: 'Central Storekeeper', description: 'Central inventory management' },
      { value: 'branch_storekeeper', label: 'Branch Storekeeper', description: 'Branch inventory management' },
      { value: 'driver', label: 'Driver', description: 'Delivery and transportation' },
      { value: 'employee', label: 'Employee', description: 'General employee access' }
    ];

    res.status(200).json({
      success: true,
      data: roles
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all staff members
// @route   GET /api/staff
// @access  Private (Admin, Manager)
export const getStaff = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const startIndex = (page - 1) * limit;

    let query = supabase
      .from('staff_profiles')
      .select(`
        *,
        user:users!user_id(
          id,
          email,
          first_name,
          last_name,
          phone_number,
          role,
          avatar
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(startIndex, startIndex + limit - 1);

    // Add filters
    if (req.query.branch_id) {
      query = query.eq('branch_id', req.query.branch_id);
    }
    if (req.query.department) {
      query = query.eq('department', req.query.department);
    }
    if (req.query.status) {
      query = query.eq('status', req.query.status);
    }
    if (req.query.role) {
      query = query.eq('user.role', req.query.role);
    }
    if (req.query.search) {
      const search = req.query.search as string;
      query = query.or(`user.first_name.ilike.%${search}%,user.last_name.ilike.%${search}%,user.email.ilike.%${search}%`);
    }

    const { data: staff, error, count } = await query;

    if (error) {
      throw error;
    }

    const formattedData = staff.map((s: any) => ({
      ...s,
      first_name: s.first_name || s.user?.first_name || '',
      last_name: s.last_name || s.user?.last_name || '',
      email: s.email || s.user?.email || '',
      phone_number: s.phone || s.user?.phone_number || '',
      avatar: s.user?.avatar || '',
      profile_photo: s.user?.avatar || s.profile_photo,
      employee_id: s.id_number || s.employee_id || s.id.substring(0, 8).toUpperCase(),
      id_number: s.id_number || s.employee_id || s.id.substring(0, 8).toUpperCase()
    }));

    res.status(200).json({
      success: true,
      count: staff.length,
      total: count || 0,
      page,
      pages: Math.ceil((count || 0) / limit),
      data: formattedData
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single staff member
// @route   GET /api/staff/:id
// @access  Private (Admin, Manager)
export const getStaffMember = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    let query = supabase
      .from('staff_profiles')
      .select(`
        *,
        user:users!user_id(
          id,
          email,
          first_name,
          last_name,
          phone_number,
          role,
          avatar
        ),
        schedules:staff_schedules(*)
      `);

    if (isUUID) {
      query = query.eq('id', id);
    } else {
      // Use double quotes for values in .or() to handle special characters (e.g. spaces, dots)
      // This matches PostgREST syntax requirements for strings with special characters
      query = query.or(`id_number.eq."${id}", rfid_tag.eq."${id}", national_id.eq."${id}"`);
    }

    logger.debug?.('Executing getStaffMember query', { id, isUUID });

    const { data: staff, error } = await query.maybeSingle();

    if (error) {
      // Hyper-granular logging for diagnosis
      logger.error('CRITICAL DATABASE ERROR in getStaffMember:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        lookupId: id,
        stack: new Error().stack
      });

      // Provide more info in dev, but keep it safe in prod
      res.status(500).json({
        success: false,
        message: 'Database error loading staff member details',
        error: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        } : undefined
      });
      return;
    }

    if (!staff) {
      logger.warn('Staff member not found in getStaffMember', { lookupId: id });
      res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        ...staff,
        first_name: staff.first_name || staff.user?.first_name || '',
        last_name: staff.last_name || staff.user?.last_name || '',
        email: staff.email || staff.user?.email || '',
        phone_number: staff.phone || staff.user?.phone_number || '',
        avatar: staff.user?.avatar || '',
        profile_photo: staff.user?.avatar || staff.profile_photo,
        employee_id: staff.id_number || staff.employee_id || staff.id.substring(0, 8).toUpperCase(),
        id_number: staff.id_number || staff.employee_id || staff.id.substring(0, 8).toUpperCase()
      }
    });
  } catch (error: any) {
    logger.error('Exception in getStaffMember:', error);
    next(error);
  }
};

// @desc    Create new staff member (staff profile only, no user account)
// @route   POST /api/staff
// @access  Private (Admin, Manager)
export const createStaffMember = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      first_name,
      last_name,
      national_id,
      department,
      position,
      branch_id,
      phone,
      email,
      basic_salary,
      shift,
      start_date,
      employment_type,
      contract_expiry,
      kra_pin,
      nssf_number,
      nhif_number,
      shif_number,
      bank_name,
      bank_branch,
      account_number,
      mpesa_number,
      next_of_kin_name,
      next_of_kin_phone,
      next_of_kin_relationship,
      supervisor_id,
      // Legacy field support (frontends may still send these)
      firstName,
      lastName,
      nationalId,
      branchId
    } = req.body;

    // Normalize legacy field names
    const staffFirstName = first_name || firstName;
    const staffLastName = last_name || lastName;
    const staffNationalId = national_id || nationalId;
    const staffBranchId = branch_id || branchId;

    // Validate required fields
    if (!staffFirstName || !staffLastName || !staffNationalId || !department) {
      res.status(400).json({
        success: false,
        message: 'Please provide all required fields: first_name, last_name, national_id, department'
      });
      return;
    }

    // Normalize department to lowercase to accept both "Housekeeping" and "housekeeping"
    const normalizedDepartment = (department || '').toLowerCase().replace(/[\s\-]/g, '_');

    // Validate department against allowed values
    const validDepartments = [
      'housekeeping', 'restaurant', 'reception', 'maintenance',
      'finance', 'management', 'security', 'bar_lounge', 'administration', 'general',
      'front_office', 'store', 'logistics', 'it', 'kitchen', 'food_beverage',
      'food_&_beverage', 'laundry', 'procurement', 'operations', 'hr', 'accounts',
      'service/f&b', 'service_f&b'
    ];
    // Accept any department value — the departments table is the source of truth.
    // Only reject if the department is completely empty.
    if (!normalizedDepartment) {
      res.status(400).json({
        success: false,
        message: `Invalid department. Must be one of: ${validDepartments.join(', ')}`
      });
      return;
    }
    // Use the lowercase normalized value going forward
    const finalDepartment = validDepartments.includes(normalizedDepartment)
      ? normalizedDepartment
      : department; // Keep original if it's a custom value from the DB


    // Branch Manager staff limit enforcement (max 10 staff per branch)
    const callerRole = (req as any).user?.role;
    if (callerRole === 'branch_manager' && staffBranchId) {
      const { count, error: countError } = await supabase
        .from('staff_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('branch_id', parseInt(staffBranchId))
        .eq('status', 'active');

      if (countError) {
        logger.error('Error counting branch staff:', countError);
      } else if ((count || 0) >= 10) {
        res.status(400).json({
          success: false,
          message: 'Staff limit reached. Branch managers can only add up to 10 staff members per branch.'
        });
        return;
      }
    }

    // Generate Staff ID
    const idNumber = await generateStaffId(staffBranchId, finalDepartment);

    // Create staff profile (NO user account created)
    const staffData: any = {
      first_name: staffFirstName,
      last_name: staffLastName,
      email: email || null,
      phone: phone || null,
      national_id: staffNationalId,
      department: finalDepartment,
      position: position || finalDepartment,
      role: position || finalDepartment, // legacy 'role' column stores position
      shift: shift || 'morning',
      basic_salary: basic_salary ? parseFloat(basic_salary) : 0,
      start_date: start_date || new Date().toISOString().split('T')[0],
      id_number: idNumber,
      status: 'active',
      employment_type: employment_type || 'permanent',
      contract_expiry: contract_expiry || null,
      kra_pin: kra_pin || null,
      nssf_number: nssf_number || null,
      nhif_number: nhif_number || null,
      shif_number: shif_number || null,
      bank_name: bank_name || null,
      bank_branch: bank_branch || null,
      account_number: account_number || null,
      mpesa_number: mpesa_number || null,
      next_of_kin_name: next_of_kin_name || null,
      next_of_kin_phone: next_of_kin_phone || null,
      next_of_kin_relationship: next_of_kin_relationship || null,
      supervisor_id: sanitizeUUID(supervisor_id),
      updated_at: new Date().toISOString()
    };

    // Add branch_id if provided
    if (staffBranchId) {
      staffData.branch_id = parseInt(staffBranchId);
    }

    logger.debug?.('createStaffMember inserting staff profile', { staffData });

    const { data: staffProfile, error: staffError } = await supabase
      .from('staff_profiles')
      .insert([staffData])
      .select()
      .single();

    if (staffError) {
      logger.error('Error creating staff profile:', staffError);
      logger.error('Staff profile payload:', staffData);
      throw new Error(`Failed to create staff profile: ${staffError.message}`);
    }

    res.status(201).json({
      success: true,
      data: {
        staff: staffProfile
      },
      message: 'Staff member created successfully'
    });

    logger.info(`Staff member created: ${staffFirstName} ${staffLastName} in ${department}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Update staff member
// @route   PUT /api/staff/:id
// @access  Private (Admin, Manager)
export const updateStaffMember = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      first_name,
      last_name,
      email,
      phone_number,
      role,
      department,
      shift,
      basic_salary,
      start_date,
      national_id,
      status,
      employee_id,
      kra_pin,
      nssf_number,
      nhif_number,
      shif_number,
      bank_name,
      bank_branch,
      account_number,
      mpesa_number,
      employment_type,
      contract_expiry,
      next_of_kin_name,
      next_of_kin_phone,
      next_of_kin_relationship,
      supervisor_id,
      archive_notes
    } = req.body;

    logger.debug('Update staff request:', { id: req.params.id, body: req.body });
    // console.log('DEBUG: Update staff request body:', JSON.stringify(req.body, null, 2));

    // Get staff profile
    let { data: staff, error: getError } = await supabase
      .from('staff_profiles')
      .select('*, user_id')
      .eq('id', req.params.id)
      .single();

    if (getError || !staff) {
      // If not in staff_profiles, check if they exist in the users table
      const { data: userProfile, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', req.params.id)
        .single();

      if (userError || !userProfile) {
        // Finally, check if it's a driver
        const { data: driverProfile, error: driverError } = await supabase
          .from('drivers')
          .select('*')
          .eq('id', req.params.id)
          .single();

        if (driverProfile) {
          // Update driver payroll fields directly
          const { data: updatedDriver, error: updateDriverError } = await supabase
            .from('drivers')
            .update({
              basic_salary: basic_salary !== undefined ? basic_salary : driverProfile.basic_salary,
              bank_name: bank_name !== undefined ? bank_name : driverProfile.bank_name,
              account_number: account_number !== undefined ? account_number : driverProfile.account_number,
              updated_at: new Date().toISOString()
            })
            .eq('id', req.params.id)
            .select()
            .single();

          if (updateDriverError) {
            logger.error('Failed to update driver salary:', updateDriverError);
            res.status(500).json({ success: false, message: 'Failed to update driver salary' });
            return;
          }

          res.json({ success: true, data: updatedDriver, message: 'Driver salary updated successfully' });
          return;
        }

        logger.error('Staff member, user, or driver not found:', { getError, userError, driverError });
        res.status(404).json({
          success: false,
          message: 'Staff member not found'
        });
        return;
      }

      // Map user roles to valid database departments
      // Valid departments: 'housekeeping','restaurant','reception','maintenance','finance','management','security','bar_lounge','administration','general'
      const roleToDept: Record<string, string> = {
        // Management
        'super_admin': 'management',
        'admin': 'management',
        'manager': 'management',
        'general_manager': 'management',
        'branch_manager': 'management',
        'hr_manager': 'management',
        'finance_manager': 'management',
        'branch_operations_manager': 'management',
        'central_operations_manager': 'management',
        'facilities_manager': 'management',
        'restaurant_manager': 'management',
        'maintenance_supervisor': 'management',
        'housekeeping_supervisor': 'management',
        'front_desk_supervisor': 'management',
        'security_supervisor': 'management',
        // Finance
        'accountant': 'finance',
        'auditor': 'finance',
        'branch_accountant': 'finance',
        'night_auditor': 'finance',
        'payroll_clerk': 'finance',
        // Restaurant / F&B
        'restaurant': 'restaurant',
        'pos_kitchen': 'restaurant',
        'kitchen': 'restaurant',
        'kitchen_operations': 'restaurant',
        'kitchen_helper': 'restaurant',
        'head_chef': 'restaurant',
        'sous_chef': 'restaurant',
        'chef': 'restaurant',
        'cook': 'restaurant',
        'line_cook': 'restaurant',
        'prep_cook': 'restaurant',
        'waiter': 'restaurant',
        'waitress': 'restaurant',
        'head_waiter': 'restaurant',
        'food_runner': 'restaurant',
        'busser': 'restaurant',
        'host_hostess': 'restaurant',
        'dishwasher': 'restaurant',
        // Bar & Lounge
        'bartender': 'bar_lounge',
        'barista': 'bar_lounge',
        'barman': 'bar_lounge',
        'barmaid': 'bar_lounge',
        'bar_manager': 'bar_lounge',
        // Reception
        'receptionist': 'reception',
        'concierge': 'reception',
        'bell_captain': 'reception',
        'bellhop': 'reception',
        // Housekeeping
        'housekeeping': 'housekeeping',
        'room_attendant': 'housekeeping',
        'laundry_attendant': 'housekeeping',
        // Maintenance
        'maintenance': 'maintenance',
        'electrician': 'maintenance',
        'plumber': 'maintenance',
        'hvac_technician': 'maintenance',
        'groundskeeper': 'maintenance',
        // Security
        'security': 'security',
        'security_guard': 'security',
        // Administration
        'cashier': 'administration',
        'kyogong_spa_cashier': 'administration',
        'kyogong_executive_bar_cashier': 'administration',
        'kyogong_sports_bar_cashier': 'administration',
        'kyogong_reception_cashier': 'administration',
        'procurement': 'administration',
        'central_storekeeper': 'administration',
        'branch_storekeeper': 'administration',
        'storekeeper': 'administration',
        'employee': 'administration',
      };

      const userRole = (userProfile.role || 'employee') as string;
      const mappedDepartment = roleToDept[userRole] || 'general';

      const idNumber = await generateStaffId(userProfile.branch_id, userRole);

      const newProfileInfo = {
        id: userProfile.id,
        user_id: userProfile.id,
        first_name: userProfile.first_name,
        last_name: userProfile.last_name,
        phone: userProfile.phone_number,
        email: userProfile.email,
        role: userRole,
        status: userProfile.status || 'active',
        branch_id: userProfile.branch_id,
        department: mappedDepartment,
        basic_salary: 0,
        shift: 'morning',
        start_date: new Date().toISOString().split('T')[0],
        id_number: idNumber
      };

      const { data: newStaff, error: createError } = await supabase
        .from('staff_profiles')
        .upsert(newProfileInfo, { onConflict: 'id', ignoreDuplicates: false })
        .select()
        .single();

      if (createError || !newStaff) {
        logger.error(`Failed to auto-create staff_profile for user ${userProfile.id}:`, createError);
        res.status(500).json({
          success: false,
          message: 'Failed to initialize staff profile for user'
        });
        return;
      }

      staff = newStaff;
      logger.info('Auto-created missing staff_profiles row for user:', userProfile.id);
    }

    // Get current email from users table for comparison
    let currentEmail = null;
    if (email) {
      const { data: userData } = await supabase
        .from('users')
        .select('email')
        .eq('id', staff.user_id)
        .single();

      currentEmail = userData?.email;
    }

    // Update user profile in users table ONLY if user_id is a valid UUID
    const sanitizedUserId = sanitizeUUID(staff.user_id);
    if (sanitizedUserId) {
      const userUpdateData: any = {
        updated_at: new Date().toISOString()
      };

      if (first_name !== undefined) userUpdateData.first_name = first_name;
      if (last_name !== undefined) userUpdateData.last_name = last_name;
      if (phone_number !== undefined) userUpdateData.phone_number = phone_number;
      if (role !== undefined) userUpdateData.role = role;
      if (department !== undefined) userUpdateData.department = department;
      if (email !== undefined) userUpdateData.email = email;

      const { error: userError } = await supabase
        .from('users')
        .update(userUpdateData)
        .eq('id', sanitizedUserId);

      if (userError) {
        logger.error('Error updating user profile:', userError);
        throw userError;
      }
    }

    // Update email in Supabase Auth if changed and user exists
    if (email && email !== currentEmail) {
      try {
        // First check if the auth user exists
        const { data: authUser, error: authCheckError } = await supabase.auth.admin.getUserById(staff.user_id);

        if (authCheckError) {
          logger.warn(`Auth user not found for staff ${req.params.id}, skipping email update:`, authCheckError);
        } else if (authUser) {
          const { error: emailError } = await supabase.auth.admin.updateUserById(
            staff.user_id,
            { email }
          );

          if (emailError) {
            logger.error('Error updating email in auth:', emailError);
            // Don't throw - continue with other updates
            logger.warn('Continuing with staff profile update despite auth email update failure');
          }
        }
      } catch (authError: any) {
        logger.warn('Failed to update auth email, continuing with profile update:', authError.message);
      }
    }

    // Update staff profile
    const staffUpdateData: any = {
      updated_at: new Date().toISOString()
    };

    if (shift !== undefined) staffUpdateData.shift = shift;
    if (basic_salary !== undefined) staffUpdateData.basic_salary = basic_salary;
    if (status !== undefined) staffUpdateData.status = status;
    if (start_date) staffUpdateData.start_date = start_date;
    if (national_id !== undefined) staffUpdateData.national_id = national_id;
    if (department !== undefined) staffUpdateData.department = department;
    if (role !== undefined) staffUpdateData.role = role;
    // Note: email and phone_number are in users table, not staff_profiles
    if (employee_id !== undefined) staffUpdateData.id_number = employee_id;
    if (kra_pin !== undefined) staffUpdateData.kra_pin = kra_pin;
    if (nssf_number !== undefined) staffUpdateData.nssf_number = nssf_number;
    if (nhif_number !== undefined) staffUpdateData.nhif_number = nhif_number;
    if (shif_number !== undefined) staffUpdateData.shif_number = shif_number;
    if (bank_name !== undefined) staffUpdateData.bank_name = bank_name;
    if (bank_branch !== undefined) staffUpdateData.bank_branch = bank_branch;
    if (account_number !== undefined) staffUpdateData.account_number = account_number;
    if (mpesa_number !== undefined) staffUpdateData.mpesa_number = mpesa_number;
    if (employment_type !== undefined) staffUpdateData.employment_type = employment_type;
    if (contract_expiry !== undefined) staffUpdateData.contract_expiry = contract_expiry;
    if (next_of_kin_name !== undefined) staffUpdateData.next_of_kin_name = next_of_kin_name;
    if (next_of_kin_phone !== undefined) staffUpdateData.next_of_kin_phone = next_of_kin_phone;
    if (next_of_kin_relationship !== undefined) staffUpdateData.next_of_kin_relationship = next_of_kin_relationship;
    if (supervisor_id !== undefined) staffUpdateData.supervisor_id = sanitizeUUID(supervisor_id);
    if (archive_notes !== undefined) staffUpdateData.archive_notes = archive_notes;

    // Sync contact fields to staff_profiles (decoupled architecture support)
    if (first_name !== undefined) staffUpdateData.first_name = first_name;
    if (last_name !== undefined) staffUpdateData.last_name = last_name;
    if (email !== undefined) staffUpdateData.email = email;
    if (phone_number !== undefined) staffUpdateData.phone = phone_number;

    const { data: updatedStaff, error: updateError } = await supabase
      .from('staff_profiles')
      .update(staffUpdateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateError) {
      logger.error('Error updating staff profile:', updateError);
      throw updateError;
    }

    // Step 4: Track significant changes in history
    const historyEntries = [];
    if (basic_salary !== undefined && staff.basic_salary !== parseFloat(basic_salary)) {
      historyEntries.push({
        staff_id: req.params.id,
        change_type: 'salary_adjustment',
        old_value: staff.basic_salary?.toString() || '0',
        new_value: basic_salary.toString(),
        created_by: sanitizeUUID(req.user?.id),
        notes: 'Manual adjustment'
      });
    }
    if (role !== undefined && staff.role !== role) {
      historyEntries.push({
        staff_id: req.params.id,
        change_type: 'role_change',
        old_value: staff.role,
        new_value: role,
        created_by: sanitizeUUID(req.user?.id)
      });
    }
    if (department !== undefined && staff.department !== department) {
      historyEntries.push({
        staff_id: req.params.id,
        change_type: 'department_transfer',
        old_value: staff.department,
        new_value: department,
        created_by: sanitizeUUID(req.user?.id)
      });
    }
    if (status !== undefined && staff.status !== status) {
      historyEntries.push({
        staff_id: req.params.id,
        change_type: 'status_change',
        old_value: staff.status,
        new_value: status,
        created_by: sanitizeUUID(req.user?.id),
        notes: archive_notes
      });
    }

    if (historyEntries.length > 0) {
      const { error: historyError } = await supabase
        .from('staff_employment_history')
        .insert(historyEntries);
      if (historyError) logger.error('Error logging staff history:', historyError);
    }

    res.status(200).json({
      success: true,
      data: updatedStaff
    });

    logger.info(`Staff member updated: ${email || updatedStaff.id}`);
  } catch (error) {
    logger.error('Error in updateStaffMember:', error);
    next(error);
  }
};

// @desc    Archive staff member (Termination)
// @route   POST /api/staff/:id/archive
// @access  Private (Admin, HR Manager)
export const archiveStaff = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { notes } = req.body;

    // Get current status
    const { data: staff, error: getError } = await supabase
      .from('staff_profiles')
      .select('status')
      .eq('id', req.params.id)
      .single();

    if (getError || !staff) {
      res.status(404).json({ success: false, message: 'Staff member not found' });
      return;
    }

    // Update status and archive notes
    const { data: updatedStaff, error: updateError } = await supabase
      .from('staff_profiles')
      .update({
        status: 'terminated',
        archive_notes: notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Create history entry
    await supabase.from('staff_employment_history').insert([{
      staff_id: req.params.id,
      change_type: 'termination',
      old_value: staff.status,
      new_value: 'terminated',
      notes,
      created_by: sanitizeUUID(req.user?.id)
    }]);

    res.status(200).json({
      success: true,
      data: updatedStaff,
      message: 'Staff member archived/terminated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get staff employment history
// @route   GET /api/staff/:id/history
// @access  Private (Admin, HR Manager)
export const getStaffHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('staff_employment_history')
      .select('*')
      .eq('staff_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch creator names separately to avoid FK schema cache issues
    const creatorIds = [...new Set((data || []).map((r: any) => r.created_by).filter(Boolean))];
    let creatorMap: Record<string, string> = {};
    if (creatorIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .in('id', creatorIds);
      (users || []).forEach((u: any) => {
        creatorMap[u.id] = `${u.first_name || ''} ${u.last_name || ''}`.trim();
      });
    }

    const enriched = (data || []).map((r: any) => ({
      ...r,
      creator: r.created_by ? { id: r.created_by, full_name: creatorMap[r.created_by] || 'Unknown' } : null,
    }));

    res.status(200).json({
      success: true,
      data: enriched
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create staff schedule
// @route   POST /api/staff/schedule
// @access  Private (Admin, Manager)
export const createStaffSchedule = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { staff, shift, date, notes } = req.body;

    // Create schedules
    const { data: schedules, error } = await supabase
      .from('staff_schedules')
      .insert(
        staff.map((staffId: string) => ({
          staff_id: staffId,
          shift,
          date,
          notes,
          created_by: req.user?.id
        }))
      )
      .select();

    if (error) {
      throw error;
    }

    res.status(201).json({
      success: true,
      data: schedules
    });

    logger.info(`Staff schedules created for ${date}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Process staff payroll
// @route   POST /api/staff/payroll
// @access  Private (Admin, Manager, Accountant)
export const processPayroll = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { staff, month, year, notes } = req.body;

    // Get staff profiles with base salary
    const { data: staffProfiles, error: staffError } = await supabase
      .from('staff_profiles')
      .select('id, salary')
      .in('id', staff);

    if (staffError || !staffProfiles) {
      throw staffError || new Error('Failed to get staff profiles');
    }

    // Create payroll records
    const { data: payroll, error: payrollError } = await supabase
      .from('staff_payroll')
      .insert(
        staffProfiles.map(profile => ({
          staff_id: profile.id,
          month,
          year,
          base_salary: profile.salary,
          net_salary: profile.salary, // Add deductions/bonuses logic here
          notes,
          processed_by: req.user?.id,
          processed_at: new Date().toISOString(),
          status: 'processed'
        }))
      )
      .select();

    if (payrollError) {
      throw payrollError;
    }

    res.status(201).json({
      success: true,
      data: payroll
    });

    logger.info(`Payroll processed for ${month} / ${year}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Submit staff performance review
// @route   POST /api/staff/performance
// @access  Private (Admin, Manager)
export const submitPerformanceReview = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      staffId,
      rating,
      attendance,
      punctuality,
      teamwork,
      customerService,
      notes
    } = req.body;

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const { data: review, error } = await supabase
      .from('staff_performance')
      .insert([
        {
          staff_id: staffId,
          reviewer_id: sanitizeUUID(req.user?.id),
          review_period_month: month,
          review_period_year: year,
          rating,
          attendance,
          punctuality,
          teamwork,
          customer_service: customerService,
          notes
        }
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      success: true,
      data: review
    });

    logger.info(`Performance review submitted for staff ${staffId}`);
  } catch (error) {
    next(error);
  }
};

// =====================================================
// ATTENDANCE MANAGEMENT
// =====================================================

// @desc    Get staff attendance records
// @route   GET /api/staff/attendance
// @access  Private (Admin, Manager)
export const getAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { staff_id, branch_id, date, startDate, endDate, status } = req.query;

    // If filtering by branch_id, first get staff_ids for that branch
    let staffIds: string[] | null = null;
    if (branch_id) {
      const { data: branchStaff } = await supabase
        .from('staff_profiles')
        .select('id')
        .eq('branch_id', branch_id);
      staffIds = (branchStaff || []).map((s: any) => s.id);
      if (staffIds.length === 0) {
        res.status(200).json({ success: true, count: 0, data: [] });
        return;
      }
    }

    let query = supabase
      .from('staff_attendance')
      .select('*')
      .order('attendance_date', { ascending: false });

    if (staff_id) {
      query = query.eq('staff_id', staff_id);
    }

    if (staffIds) {
      query = query.in('staff_id', staffIds);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (date) {
      query = query.eq('attendance_date', date);
    } else {
      if (startDate) {
        query = query.gte('attendance_date', startDate);
      }
      if (endDate) {
        query = query.lte('attendance_date', endDate);
      }
    }

    const { data, error } = await query;

    if (error) throw error;

    res.status(200).json({
      success: true,
      count: data?.length || 0,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Clock in staff member
// @route   POST /api/staff/attendance/clock-in
// @access  Private
export const clockIn = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let { staff_id, notes, in_method, device_id } = req.body;
    const attendance_date = new Date().toISOString().split('T')[0];
    const clock_in = new Date().toISOString();

    // 1. If staff_id is missing, try to find it from the logged-in user's profile
    if (!staff_id && req.user?.id) {
      const { data: profile, error: profileError } = await supabase
        .from('staff_profiles')
        .select('id')
        .eq('user_id', req.user.id)
        .single();

      if (!profileError && profile) {
        staff_id = profile.id;
      }
    }

    if (!staff_id) {
      res.status(400).json({ success: false, message: 'Staff ID is required' });
      return;
    }

    // 2. Fetch Staff Profile to check branch and permissions
    const { data: staff, error: staffError } = await supabase
      .from('staff_profiles')
      .select('id, branch_id, status, user_id')
      .eq('id', staff_id)
      .single();

    if (staffError || !staff) {
      res.status(404).json({ success: false, message: 'Staff member not found' });
      return;
    }

    if (staff.status !== 'active') {
      res.status(403).json({ success: false, message: 'Staff account is not active' });
      return;
    }

    // 3. Branch Validation (Only if logged in)
    if (device_id && device_id.startsWith('FG-') && req.user?.branch_id) {
      if (staff.branch_id !== req.user.branch_id) {
        res.status(403).json({
          success: false,
          message: `Cross-branch clock-in not allowed. Staff belongs to branch ${staff.branch_id}`
        });
        return;
      }
    }

    // 4. Check if there's an open shift for this staff member
    const { data: openShift, error: checkError } = await supabase
      .from('staff_attendance')
      .select('id')
      .eq('staff_id', staff_id)
      .is('clock_out', null)
      .maybeSingle();

    if (checkError) throw checkError;
    if (openShift) {
      res.status(400).json({
        success: false,
        message: 'Staff member is already clocked in'
      });
      return;
    }

    // A manager clocking someone else in should be auto-approved
    const isManagerAction = req.user &&
      ['super_admin', 'general_manager', 'branch_manager', 'hr_manager'].includes(req.user.role) &&
      req.user.id !== staff.user_id;

    const is_pin_fallback = (in_method === 'pin' || in_method === 'manual');

    const attendance = {
      staff_id,
      branch_id: staff.branch_id,
      attendance_date,
      clock_in,
      in_method: in_method || 'pin',
      device_id,
      status: 'present',
      notes,
      is_approved: isManagerAction || !is_pin_fallback,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('staff_attendance')
      .insert(attendance)
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Clock out staff member
// @route   POST /api/staff/attendance/clock-out
// @access  Private
export const clockOut = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let { staff_id, notes, out_method, device_id } = req.body;
    const clock_out = new Date().toISOString();

    // 1. If staff_id is missing, try to find it from the logged-in user's profile
    if (!staff_id && req.user?.id) {
      const { data: profile, error: profileError } = await supabase
        .from('staff_profiles')
        .select('id')
        .eq('user_id', req.user.id)
        .single();

      if (!profileError && profile) {
        staff_id = profile.id;
      }
    }

    if (!staff_id) {
      res.status(400).json({ success: false, message: 'Staff ID is required' });
      return;
    }

    // Find the latest open shift
    const { data: openShift, error: findError } = await supabase
      .from('staff_attendance')
      .select('*')
      .eq('staff_id', staff_id)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError) throw findError;
    if (!openShift) {
      res.status(400).json({
        success: false,
        message: 'No active clock-in found for this staff member'
      });
      return;
    }

    // CALCULATE HOURS using Service
    const hoursData = await AttendanceService.calculateShiftHours(staff_id, openShift.clock_in, clock_out);

    const { data, error } = await supabase
      .from('staff_attendance')
      .update({
        clock_out,
        out_method: out_method || 'pin',
        device_id: device_id || openShift.device_id,
        notes: notes || openShift.notes,
        hours_normal: hoursData.hoursNormal,
        hours_ot_weekday: hoursData.hoursOTWeekday,
        hours_ot_rest: hoursData.hoursOTRest,
        hours_ot_holiday: hoursData.hoursOTHoliday,
        hours_night: hoursData.hoursNight,
        updated_at: new Date().toISOString()
      })
      .eq('id', openShift.id)
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

// @desc    Update attendance record (Manual Adjustment)
// @route   PUT /api/staff/attendance/:id
// @access  Private (Admin, Manager)
export const updateAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { clock_in, clock_out, reason } = req.body;

    if (!reason) {
      res.status(400).json({ success: false, message: 'Reason is required for manual adjustment' });
      return;
    }

    const { data: oldRecord } = await supabase.from('staff_attendance').select('*').eq('id', id).single();
    if (!oldRecord) {
      res.status(404).json({ success: false, message: 'Record not found' });
      return;
    }

    if (oldRecord.is_confirmed) {
      res.status(403).json({ success: false, message: 'Cannot update confirmed attendance. Unlock first.' });
      return;
    }

    const effectiveIn = clock_in || oldRecord.clock_in;
    const effectiveOut = clock_out || oldRecord.clock_out;

    let hoursData = {};
    if (effectiveOut) {
      hoursData = await AttendanceService.calculateShiftHours(oldRecord.staff_id, effectiveIn, effectiveOut);
    }

    const updateData = {
      clock_in: effectiveIn,
      clock_out: effectiveOut,
      ...hoursData,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('staff_attendance')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log the audit
    await AttendanceService.logAttendanceEdit(id, req.user?.id || '', oldRecord, updateData, reason);

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve/Reject attendance record
// @route   PUT /api/staff/attendance/:id/approve
// @access  Private (Admin, Manager)
export const approveAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { approved, rejection_reason } = req.body;

    const { data, error } = await supabase
      .from('staff_attendance')
      .update({
        is_approved: approved,
        rejection_reason: approved ? null : rejection_reason,
        approved_by: req.user?.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Get attendance summary
// @route   GET /api/staff/attendance/summary
// @access  Private (Admin, Manager)
export const getAttendanceSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { staff_id, month, year } = req.query;

    let query = supabase
      .from('staff_attendance')
      .select('*');

    if (staff_id) {
      query = query.eq('staff_id', staff_id);
    }

    if (month && year) {
      const startDate = `${year} -${String(month).padStart(2, '0')}-01`;
      const endDate = `${year} -${String(month).padStart(2, '0')} -31`;
      query = query.gte('attendance_date', startDate).lte('attendance_date', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Calculate summary
    const summary = {
      totalDays: data?.length || 0,
      presentDays: data?.filter(a => a.status === 'present').length || 0,
      absentDays: data?.filter(a => a.status === 'absent').length || 0,
      lateDays: data?.filter(a => a.status === 'late').length || 0,
      leaveDays: data?.filter(a => a.status === 'leave').length || 0,
      totalOvertimeHours: data?.reduce((sum, a) => sum + (a.overtime_hours || 0), 0) || 0
    };

    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Batch confirm attendance for a period
// @route   POST /api/staff/attendance/confirm
// @access  Private (Admin, HR Manager)
export const batchConfirmAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { startDate, endDate, department } = req.body;

    let query = supabase
      .from('staff_attendance')
      .update({
        is_confirmed: true,
        confirmed_by: req.user?.id,
        confirmed_at: new Date().toISOString()
      })
      .gte('attendance_date', startDate)
      .lte('attendance_date', endDate);

    if (department) {
      // Need to filter by staff profiles department
      const { data: staffIds } = await supabase
        .from('staff_profiles')
        .select('id')
        .eq('department', department);

      const ids = staffIds?.map(s => s.id) || [];
      query = query.in('staff_id', ids);
    }

    const { error } = await query;
    if (error) throw error;

    res.status(200).json({
      success: true,
      message: 'Attendance records confirmed for the period'
    });
  } catch (error) {
    next(error);
  }
};

// =====================================================
// LEAVE MANAGEMENT
// =====================================================

// @desc    Get leave requests
// @route   GET /api/staff/leave
// @access  Private (Admin, Manager)
export const getLeaveRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { staff_id, status, branch_id } = req.query;

    // Step 1: fetch leave records without cross-table joins (no FK in schema cache)
    let query = supabase
      .from('staff_leave')
      .select('*')
      .order('created_at', { ascending: false });

    if (staff_id) query = query.eq('staff_id', staff_id);
    if (status) query = query.eq('status', status);

    const { data: leaves, error } = await query;
    if (error) throw error;
    if (!leaves || leaves.length === 0) {
      return res.status(200).json({ success: true, count: 0, data: [] }) as any;
    }

    // Step 2: collect IDs for manual joins
    const staffIds = [...new Set(leaves.map((l: any) => l.staff_id).filter(Boolean))];
    const approverIds = [...new Set(leaves.map((l: any) => l.approved_by).filter(Boolean))];

    const [profilesRes, approversRes] = await Promise.all([
      staffIds.length
        ? supabase.from('staff_profiles').select('id, department, status, user_id').in('id', staffIds as string[])
        : { data: [] },
      approverIds.length
        ? supabase.from('users').select('id, first_name, last_name').in('id', approverIds as string[])
        : { data: [] },
    ]);

    const userIds = [...new Set((profilesRes.data || []).map((p: any) => p.user_id).filter(Boolean))];
    const usersRes = userIds.length
      ? await supabase.from('users').select('id, first_name, last_name, email').in('id', userIds as string[])
      : { data: [] };

    const profileMap: Record<string, any> = Object.fromEntries((profilesRes.data || []).map((p: any) => [p.id, p]));
    const userMap: Record<string, any> = Object.fromEntries((usersRes.data || []).map((u: any) => [u.id, u]));
    const approverMap: Record<string, any> = Object.fromEntries((approversRes.data || []).map((u: any) => [u.id, u]));

    // Step 3: stitch together
    const data = leaves.map((leave: any) => {
      const profile = profileMap[leave.staff_id] || null;
      const user = profile ? (userMap[profile.user_id] || null) : null;
      const approver = leave.approved_by ? (approverMap[leave.approved_by] || null) : null;
      return {
        ...leave,
        staff: profile ? { ...profile, user } : null,
        approver,
      };
    });

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Create leave request
// @route   POST /api/staff/leave
// @access  Private
export const createLeaveRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { staff_id, leave_type, start_date, end_date, reason } = req.body;

    const { data, error } = await supabase
      .from('staff_leave')
      .insert([{
        staff_id,
        leave_type,
        start_date,
        end_date,
        reason,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update leave request status
// @route   PUT /api/staff/leave/:id
// @access  Private (Admin, Manager)
export const updateLeaveRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const userId = (req as any).user?.id;

    // Check if record is locked
    const { data: existing } = await supabase
      .from('staff_leave')
      .select('is_locked')
      .eq('id', id)
      .single();

    if (existing?.is_locked) {
      res.status(403).json({
        success: false,
        message: 'Cannot update locked leave request. Locked for payroll processing.'
      });
      return;
    }

    const updateData: any = { status };
    if (notes) updateData.notes = notes;
    if (status === 'approved' || status === 'rejected') {
      updateData.approved_by = userId;
    }

    const { data, error } = await supabase
      .from('staff_leave')
      .update(updateData)
      .eq('id', id)
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

// @desc    Approve leave request
// @route   PUT /api/staff/leave/:id/approve
// @access  Private (Admin, Manager)
export const approveLeaveRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const { data, error } = await supabase
      .from('staff_leave')
      .update({ status: 'approved', approved_by: userId })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: 'Leave request approved',
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reject leave request
// @route   PUT /api/staff/leave/:id/reject
// @access  Private (Admin, Manager)
export const rejectLeaveRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = (req as any).user?.id;

    const { data, error } = await supabase
      .from('staff_leave')
      .update({ status: 'rejected', approved_by: userId, notes: reason })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: 'Leave request rejected',
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Batch lock leave records for a period
// @route   POST /api/staff/leave/lock
// @access  Private (Admin, HR Manager)
export const batchLockLeave = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { startDate, endDate } = req.body;

    const { error } = await supabase
      .from('staff_leave')
      .update({
        is_locked: true,
        locked_by: req.user?.id,
        locked_at: new Date().toISOString()
      })
      .gte('start_date', startDate)
      .lte('end_date', endDate)
      .eq('status', 'approved'); // Only lock approved leaves

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: 'Approved leave records locked for the period'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get detailed attendance reports with compliance flags
// @route   GET /api/staff/attendance/reports
// @access  Private (Admin, Manager)
export const getAttendanceReports = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { startDate, endDate, branchId, staffId } = req.query;

    // Step 1: fetch attendance records without cross-table FK joins
    let attQuery = supabase
      .from('staff_attendance')
      .select('*')
      .order('attendance_date', { ascending: false });

    if (startDate) attQuery = attQuery.gte('attendance_date', startDate as string);
    if (endDate) attQuery = attQuery.lte('attendance_date', endDate as string);
    if (staffId) attQuery = attQuery.eq('staff_id', staffId as string);

    const { data: records, error } = await attQuery;
    if (error) throw error;

    let filtered = records || [];

    // Step 2: manual joins for staff profiles + users
    const staffIds = [...new Set(filtered.map((r: any) => r.staff_id).filter(Boolean))];
    const [profilesRes] = await Promise.all([
      staffIds.length
        ? supabase.from('staff_profiles').select('id, branch_id, rest_day, user_id').in('id', staffIds as string[])
        : { data: [] },
    ]);

    const profileMap: Record<string, any> = Object.fromEntries((profilesRes.data || []).map((p: any) => [p.id, p]));

    // Filter by branch after joining
    if (branchId) {
      filtered = filtered.filter((r: any) => profileMap[r.staff_id]?.branch_id === branchId);
    }

    const userIds = [...new Set(Object.values(profileMap).map((p: any) => p.user_id).filter(Boolean))];
    const usersRes = userIds.length
      ? await supabase.from('users').select('id, first_name, last_name, department').in('id', userIds as string[])
      : { data: [] };

    const userMap: Record<string, any> = Object.fromEntries((usersRes.data || []).map((u: any) => [u.id, u]));

    filtered = filtered.map((r: any) => {
      const profile = profileMap[r.staff_id] || null;
      const user = profile ? (userMap[profile.user_id] || null) : null;
      return { ...r, staff: profile ? { ...profile, user } : null };
    });

    // Compliance & Summaries
    const reports = filtered.map(rec => {
      const issues = [];
      const totalHours = Number(rec.hours_normal || 0) + Number(rec.hours_ot_weekday || 0) +
        Number(rec.hours_ot_rest || 0) + Number(rec.hours_ot_holiday || 0);

      if (totalHours > 12) {
        issues.push('Excessive daily hours (>12h)');
      }
      if (!rec.is_approved) {
        issues.push('Pending supervisor approval (PIN clock-in)');
      }
      return { ...rec, issues };
    });

    const summary = reports.reduce((acc: any, rec: any) => {
      acc.totalNormal = (acc.totalNormal || 0) + Number(rec.hours_normal || 0);
      acc.totalOTWeekday = (acc.totalOTWeekday || 0) + Number(rec.hours_ot_weekday || 0);
      acc.totalOTRest = (acc.totalOTRest || 0) + Number(rec.hours_ot_rest || 0);
      acc.totalOTHoliday = (acc.totalOTHoliday || 0) + Number(rec.hours_ot_holiday || 0);
      acc.totalNight = (acc.totalNight || 0) + Number(rec.hours_night || 0);
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: reports,
      summary
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload staff profile photo
// @route   POST /api/staff/:id/photo
// @access  Private (Admin, Manager)
export const uploadStaffPhoto = async (
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

    logger.debug('Uploading staff photo:', { staffId: req.params.id, filename: file.originalname });

    // Get staff to find user_id
    const { data: staff, error: staffError } = await supabase
      .from('staff_profiles')
      .select('user_id')
      .eq('id', req.params.id)
      .single();

    if (staffError || !staff) {
      logger.error('Staff not found:', staffError);
      res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
      return;
    }

    // Upload to Supabase Storage using user_id for RLS compliance
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${staff.user_id}-${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('profile')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (error) {
      logger.error('Error uploading to storage:', error);
      throw error;
    }

    logger.info('Photo uploaded to storage:', data.path);

    // Update user profile with photo path (avatar is in users table)
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ avatar: data.path })
      .eq('id', staff.user_id)
      .select()
      .single();

    if (updateError) {
      logger.error('Error updating user profile photo:', updateError);
      throw updateError;
    }

    logger.info(`Staff photo updated successfully for user ${staff.user_id}`);

    res.status(200).json({
      success: true,
      data: {
        user_id: staff.user_id,
        profile_photo: data.path,
        profile_photo_url: `${process.env.SUPABASE_PROJECT_URL}/storage/v1/object/public/profile/${data.path}`
      },
      message: 'Photo uploaded successfully'
    });
  } catch (error) {
    logger.error('Error in uploadStaffPhoto:', error);
    next(error);
  }
};

// @desc    Upload staff document (ID, Contract, CV)
// @route   POST /api/staff/:id/documents
// @access  Private (Admin, HR Manager)
export const uploadStaffDocument = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const file = req.file as Express.Multer.File;
    const { documentType } = req.body;

    if (!file || !documentType) {
      res.status(400).json({ success: false, message: 'No file or document type provided' });
      return;
    }

    // Check staff
    const { data: staff, error: staffError } = await supabase
      .from('staff_profiles')
      .select('user_id')
      .eq('id', req.params.id)
      .single();

    if (staffError || !staff) {
      res.status(404).json({ success: false, message: 'Staff member not found' });
      return;
    }

    const fileExt = file.originalname.split('.').pop();
    const fileName = `${req.params.id}-${documentType}-${Date.now()}.${fileExt}`;

    const { data: storageData, error: storageError } = await supabase.storage
      .from('staff-documents')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (storageError) throw storageError;

    // Record in database
    const { data: docRecord, error: dbError } = await supabase
      .from('staff_documents')
      .insert([{
        staff_id: req.params.id,
        document_type: documentType,
        file_name: file.originalname,
        file_path: storageData.path,
        file_size: file.size,
        mime_type: file.mimetype
      }])
      .select()
      .single();

    if (dbError) throw dbError;

    res.status(200).json({
      success: true,
      data: docRecord,
      message: 'Document uploaded successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get staff documents
// @route   GET /api/staff/:id/documents
// @access  Private (Admin, HR Manager)
export const getStaffDocuments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('staff_documents')
      .select('*')
      .eq('staff_id', req.params.id)
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

// @desc    Get staff member by National ID or Staff ID
// @route   GET /api/staff/by-identifier/:identifier
// @access  Private
export const getStaffByIdentifier = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { identifier } = req.params;

    if (!identifier) {
      res.status(400).json({ success: false, message: 'Identifier is required' });
      return;
    }

    const { data: staff, error } = await supabase
      .from('staff_profiles')
      .select(`
        *,
        user: users!user_id(id, first_name, last_name, email, phone_number, role, department)
      `)
      .or(`id_number.eq."${identifier}",national_id.eq."${identifier}"`)
      .single();

    if (error || !staff) {
      res.status(404).json({ success: false, message: 'Staff member not found with this identifier' });
      return;
    }

    res.status(200).json({
      success: true,
      data: staff
    });
  } catch (error) {
    next(error);
  }
};
