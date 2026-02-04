import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AttendanceService } from '../services/attendance.service';

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
    const { count } = await supabase
      .from('staff_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId);

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
          role
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

    res.status(200).json({
      success: true,
      count: staff.length,
      total: count || 0,
      page,
      pages: Math.ceil((count || 0) / limit),
      data: staff
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
          role
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
      return res.status(500).json({
        success: false,
        message: 'Database error loading staff member details',
        error: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        } : undefined
      });
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
      data: staff
    });
  } catch (error: any) {
    logger.error('Exception in getStaffMember:', error);
    next(error);
  }
};

// @desc    Create new staff member
// @route   POST /api/staff
// @access  Private (Admin, Manager)
export const createStaffMember = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      role,
      department,
      shift,
      salary,
      startDate,
      idNumber,
      employeeId,
      nationalId,
      pos_pin,
      emergencyContact,
      address,
      branchId
    } = req.body;

    // Generate Staff ID if not provided
    const actualIdNumber = idNumber || await generateStaffId(branchId, role);

    // Validate required fields
    if (!firstName || !lastName || !email || !role) {
      res.status(400).json({
        success: false,
        message: 'Please provide all required fields: firstName, lastName, email, role'
      });
      return;
    }

    // Generate strong password
    const generatedPassword = generateStrongPassword();

    // Check if user with email already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    let userId: string;

    if (existingUser) {
      // User already exists, use their ID
      userId = existingUser.id;
    } else {
      // Map staff role to user role enum
      // The users table has a limited set of roles, so we map detailed staff roles to basic user roles
      const userRoleMap: { [key: string]: string } = {
        // Management
        'super_admin': 'super_admin',
        'general_manager': 'manager',
        'branch_manager': 'manager',
        'restaurant_manager': 'manager',
        // Sometimes department-like values may be sent
        'management': 'manager',

        // Front Office
        'receptionist': 'receptionist',
        'front_desk_supervisor': 'receptionist',
        'concierge': 'receptionist',
        'bell_captain': 'receptionist',
        'bellhop': 'receptionist',
        // Department-like aliases
        'front_office': 'receptionist',
        'reception': 'receptionist',

        // Housekeeping
        'housekeeping': 'housekeeping',
        'housekeeping_supervisor': 'housekeeping',
        'room_attendant': 'housekeeping',
        'laundry_attendant': 'housekeeping',

        // Restaurant & Kitchen
        'restaurant': 'restaurant',
        'head_chef': 'restaurant',
        'sous_chef': 'restaurant',
        'line_cook': 'restaurant',
        'prep_cook': 'restaurant',
        'waiter': 'restaurant',
        'waitress': 'restaurant',
        'head_waiter': 'restaurant',
        'bartender': 'restaurant',
        'barista': 'restaurant',
        'food_runner': 'restaurant',
        'host': 'restaurant',
        'hostess': 'restaurant',
        'sommelier': 'restaurant',
        'kitchen_helper': 'restaurant',
        'dishwasher': 'restaurant',

        // Maintenance
        'maintenance': 'maintenance',
        'maintenance_supervisor': 'maintenance',
        'electrician': 'maintenance',
        'plumber': 'maintenance',
        'hvac_technician': 'maintenance',
        'carpenter': 'maintenance',
        'painter': 'maintenance',
        'groundskeeper': 'maintenance',
        // Department-like alias
        'security': 'maintenance',

        // Security
        'security_guard': 'maintenance',
        'night_auditor': 'receptionist',

        // Finance & Admin
        'accountant': 'accountant',
        'auditor': 'accountant',
        'hr_manager': 'manager',
        'payroll_clerk': 'accountant',
        // Department-like alias
        'finance': 'accountant',

        // Inventory
        'central_storekeeper': 'accountant',
        'branch_storekeeper': 'accountant',
        'inventory_clerk': 'accountant',
        'purchasing_manager': 'accountant',
        'driver': 'restaurant' // default for others not in enum
      };

      const normalizedRole = String(role || '').toLowerCase();
      let userRole = userRoleMap[normalizedRole];
      // Fallback heuristics
      if (!userRole) {
        if (normalizedRole.includes('manager')) userRole = 'manager';
        else if (normalizedRole.includes('housekeep')) userRole = 'housekeeping';
        else if (normalizedRole.includes('maint')) userRole = 'maintenance';
        else if (normalizedRole.includes('front') || normalizedRole.includes('recept')) userRole = 'receptionist';
        else if (normalizedRole.includes('account') || normalizedRole.includes('finance')) userRole = 'accountant';
        else userRole = 'restaurant';
      }

      logger.debug?.('createStaffMember role mapping', { incomingRole: role, normalizedRole, mappedUserRole: userRole, department });

      // Generate UUID for the user using Node's crypto module
      const newUserId = crypto.randomUUID();

      // Create user directly in users table (skip Supabase Auth for now)
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert([{
          id: newUserId,
          email,
          first_name: firstName,
          last_name: lastName,
          phone_number: phone,
          role: userRole,
          department: department,
          pos_pin: pos_pin,
          address: address,
          emergency_contact: emergencyContact ? JSON.stringify(emergencyContact) : null,
          shift: shift || 'morning',
          branch_id: branchId ? parseInt(branchId) : null,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (userError) {
        logger.error('Error creating user:', userError);
        logger.error('User insert payload:', { id: newUserId, email, userRole, department });
        throw new Error('Database error creating new user');
      }

      if (!newUser) {
        throw new Error('Failed to create user account');
      }

      userId = newUser.id;
    }

    // Map role to valid department for staff_profiles table
    // The staff_profiles table only allows: housekeeping, restaurant, reception, maintenance, finance, management
    const departmentMap: { [key: string]: string } = {
      // Management roles
      'super_admin': 'management',
      'general_manager': 'management',
      'branch_manager': 'management',
      'restaurant_manager': 'management',
      'management': 'management',

      // Restaurant & Kitchen roles
      'restaurant': 'restaurant',
      'head_chef': 'restaurant',
      'sous_chef': 'restaurant',
      'line_cook': 'restaurant',
      'prep_cook': 'restaurant',
      'waiter': 'restaurant',
      'waitress': 'restaurant',
      'head_waiter': 'restaurant',
      'bartender': 'restaurant',
      'barista': 'restaurant',
      'food_runner': 'restaurant',
      'host': 'restaurant',
      'hostess': 'restaurant',
      'sommelier': 'restaurant',
      'kitchen_helper': 'restaurant',
      'dishwasher': 'restaurant',

      // Housekeeping roles
      'housekeeping': 'housekeeping',
      'housekeeping_supervisor': 'housekeeping',
      'room_attendant': 'housekeeping',
      'laundry_attendant': 'housekeeping',

      // Reception roles
      'receptionist': 'reception',
      'front_desk_supervisor': 'reception',
      'concierge': 'reception',
      'bell_captain': 'reception',
      'bellhop': 'reception',
      'front_office': 'reception',
      'reception': 'reception',
      'night_auditor': 'reception',

      // Maintenance roles
      'maintenance': 'maintenance',
      'maintenance_supervisor': 'maintenance',
      'electrician': 'maintenance',
      'plumber': 'maintenance',
      'hvac_technician': 'maintenance',
      'carpenter': 'maintenance',
      'painter': 'maintenance',
      'groundskeeper': 'maintenance',
      'security_guard': 'maintenance',
      'security': 'maintenance',

      // Finance roles
      'accountant': 'finance',
      'auditor': 'finance',
      'hr_manager': 'finance',
      'payroll_clerk': 'finance',
      'finance': 'finance',
      'central_storekeeper': 'finance',
      'branch_storekeeper': 'finance',
      'inventory_clerk': 'finance',
      'purchasing_manager': 'finance',
      'driver': 'maintenance'
    };

    const normalizedRole = String(role || '').toLowerCase();
    let validDepartment = departmentMap[normalizedRole];

    // Fallback heuristics for department
    if (!validDepartment) {
      if (normalizedRole.includes('manager') || normalizedRole.includes('admin')) validDepartment = 'management';
      else if (normalizedRole.includes('housekeep') || normalizedRole.includes('clean')) validDepartment = 'housekeeping';
      else if (normalizedRole.includes('maint') || normalizedRole.includes('repair')) validDepartment = 'maintenance';
      else if (normalizedRole.includes('front') || normalizedRole.includes('recept') || normalizedRole.includes('desk')) validDepartment = 'reception';
      else if (normalizedRole.includes('account') || normalizedRole.includes('finance') || normalizedRole.includes('store')) validDepartment = 'finance';
      else validDepartment = 'restaurant'; // Default fallback
    }

    // Map role to position (human readable label)
    const position = role.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

    logger.debug?.('createStaffMember mapping', { incomingRole: role, normalizedRole, mappedDepartment: validDepartment, position });

    // Create staff profile
    const staffData: any = {
      user_id: userId,
      department: validDepartment,
      role: role, // Changed from position to role to match schema
      shift: shift || 'morning',
      salary: salary ? parseFloat(salary) : 0,
      start_date: startDate || new Date().toISOString().split('T')[0], // Changed from hire_date to start_date
      id_number: actualIdNumber,
      national_id: nationalId || 'pending',
      status: 'active',
      updated_at: new Date().toISOString()
    };

    // Add branch_id if provided
    if (branchId) {
      staffData.branch_id = parseInt(branchId);
    }

    // Use upsert to handle the trigger conflict (trigger might have already created a profile)
    const { data: staffProfile, error: staffError } = await supabase
      .from('staff_profiles')
      .upsert([staffData], { onConflict: 'user_id' })
      .select(`
      *,
        user: users!user_id(
          id,
          email,
          first_name,
          last_name,
          phone_number,
          role
        )
        `)
      .single();

    if (staffError) {
      // If staff profile creation fails, clean up the user if we just created them
      if (!existingUser) {
        await supabase.from('users').delete().eq('id', userId);
      }
      logger.error('Error creating staff profile:', staffError);
      logger.error('Staff profile payload:', staffData);
      throw new Error(`Failed to create staff profile: ${staffError.message}`);
    }

    // ALSO update the user record if it already existed to ensure sync
    if (existingUser) {
      const userUpdateData: any = {
        phone_number: phone,
        pos_pin: pos_pin,
        address: address,
        emergency_contact: emergencyContact ? JSON.stringify(emergencyContact) : null,
        shift: shift || 'morning',
        branch_id: branchId ? parseInt(branchId) : null,
        department: department
      };

      await supabase.from('users').update(userUpdateData).eq('id', userId);
    }

    res.status(201).json({
      success: true,
      data: {
        staff: staffProfile,
        generatedPassword: existingUser ? undefined : generatedPassword
      },
      message: 'Staff member created successfully'
    });

    logger.info(`Staff member created: ${email} with role ${role} `);
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
      salary,
      start_date,
      national_id,
      status,
      employee_id
    } = req.body;

    logger.debug('Update staff request:', { id: req.params.id, body: req.body });

    // Get staff profile
    const { data: staff, error: getError } = await supabase
      .from('staff_profiles')
      .select('user_id')
      .eq('id', req.params.id)
      .single();

    if (getError || !staff) {
      logger.error('Staff member not found:', getError);
      res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
      return;
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

    // Update user profile in users table
    const userUpdateData: any = {
      first_name,
      last_name,
      phone_number,
      updated_at: new Date().toISOString()
    };

    if (role) userUpdateData.role = role;
    if (department) userUpdateData.department = department;
    if (email) userUpdateData.email = email;

    const { error: userError } = await supabase
      .from('users')
      .update(userUpdateData)
      .eq('id', staff.user_id);

    if (userError) {
      logger.error('Error updating user profile:', userError);
      throw userError;
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
    if (salary !== undefined) staffUpdateData.salary = salary;
    if (status !== undefined) staffUpdateData.status = status;
    if (start_date) staffUpdateData.start_date = start_date;
    if (national_id !== undefined) staffUpdateData.national_id = national_id;
    if (phone_number !== undefined) staffUpdateData.phone = phone_number;
    if (department !== undefined) staffUpdateData.department = department;
    if (role !== undefined) staffUpdateData.role = role;
    // Note: email is NOT in staff_profiles, it's in users table
    if (employee_id !== undefined) staffUpdateData.employee_id = employee_id;
    if (first_name !== undefined) staffUpdateData.first_name = first_name;
    if (last_name !== undefined) staffUpdateData.last_name = last_name;

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
          reviewer_id: req.user?.id,
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

    let query = supabase
      .from('staff_attendance')
      .select(`
      *,
      staff: staff_profiles!inner(
        id,
        branch_id,
        id_number,
        user: users!user_id(id, first_name, last_name, email)
      )
      `)
      .order('attendance_date', { ascending: false });

    if (staff_id) {
      query = query.eq('staff_id', staff_id);
    }

    if (branch_id) {
      query = query.eq('staff.branch_id', branch_id);
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
    const { staff_id, notes, in_method, device_id } = req.body;
    const attendance_date = new Date().toISOString().split('T')[0];
    const clock_in = new Date().toISOString();

    // 1. Fetch Staff Profile to check branch and permissions
    const { data: staff, error: staffError } = await supabase
      .from('staff_profiles')
      .select('id, branch_id, status')
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

    // 2. Branch Validation (If terminal device info is provided)
    // In a real scenario, device_id would be mapped to a branch
    if (device_id && device_id.startsWith('FG-') && req.user?.branch_id) {
      if (staff.branch_id !== req.user.branch_id) {
        res.status(403).json({
          success: false,
          message: `Cross - branch clock -in not allowed.Staff belongs to branch ${staff.branch_id} `
        });
        return;
      }
    }

    // 3. Check if there's an open shift for this staff member
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

    const is_pin_fallback = (in_method === 'pin' || in_method === 'manual');

    const attendance = {
      staff_id,
      attendance_date,
      clock_in,
      in_method: in_method || 'pin',
      device_id,
      status: 'present',
      notes,
      is_approved: !is_pin_fallback, // PIN fallback requires supervisor approval
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
    const { staff_id, notes, out_method, device_id } = req.body;
    const clock_out = new Date().toISOString();

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

    let query = supabase
      .from('staff_leave')
      .select(`
      *,
      staff: staff_profiles(
        id, department, status,
        user: users(id, first_name, last_name, email)
      ),
        approver: users!approved_by(first_name, last_name)
          `)
      .order('created_at', { ascending: false });

    if (staff_id) query = query.eq('staff_id', staff_id);
    if (status) query = query.eq('status', status);

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

    const { data: records, error } = await supabase
      .from('staff_attendance')
      .select(`
          *,
          staff: staff_profiles(
            id,
            branch_id,
            rest_day,
            user: users(first_name, last_name, department)
          )
            `)
      .order('attendance_date', { ascending: false });

    if (error) throw error;

    let filtered = records || [];
    if (startDate) filtered = filtered.filter(r => r.attendance_date >= startDate);
    if (endDate) filtered = filtered.filter(r => r.attendance_date <= endDate);
    if (branchId) filtered = filtered.filter(r => r.staff?.branch_id === branchId);
    if (staffId) filtered = filtered.filter(r => r.staff_id === staffId);

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

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('profile-photos')
      .upload(
        `staff/${req.params.id}/${Date.now()}-${file.originalname}`,
        file.buffer,
        {
          contentType: file.mimetype,
          upsert: true
        }
      );

    if (error) {
      logger.error('Error uploading to storage:', error);
      throw error;
    }

    logger.info('Photo uploaded to storage:', data.path);

    // Update staff_profiles with photo path
    const { data: staff, error: updateError } = await supabase
      .from('staff_profiles')
      .update({ profile_photo: data.path })
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateError) {
      logger.error('Error updating staff profile:', updateError);
      throw updateError;
    }

    logger.info(`Staff photo updated successfully for ${req.params.id}`);

    res.status(200).json({
      success: true,
      data: {
        ...staff,
        profile_photo_url: `${process.env.SUPABASE_PROJECT_URL}/storage/v1/object/public/profile-photos/${data.path}`
      },
      message: 'Photo uploaded successfully'
    });
  } catch (error) {
    logger.error('Error in uploadStaffPhoto:', error);
    next(error);
  }
};
