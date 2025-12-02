import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

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
          phone_number
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(startIndex, startIndex + limit - 1);

    // Add filters
    if (req.query.department) {
      query = query.eq('department', req.query.department);
    }
    if (req.query.status) {
      query = query.eq('status', req.query.status);
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
    const { data: staff, error } = await supabase
      .from('staff_profiles')
      .select(`
        *,
        user:users!user_id(
          id,
          email,
          first_name,
          last_name,
          phone_number
        ),
        schedules:staff_schedules(*)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) {
      throw error;
    }

    if (!staff) {
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
  } catch (error) {
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
      emergencyContact,
      address,
      branchId
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !role || !department) {
      res.status(400).json({
        success: false,
        message: 'Please provide all required fields: firstName, lastName, email, role, department'
      });
      return;
    }

    // Generate strong password
    const generatedPassword = generateStrongPassword();
    
    // Create user in Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: generatedPassword,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        role: role
      }
    });

    if (authError) {
      throw authError;
    }

    if (!authUser.user) {
      throw new Error('Failed to create user account');
    }

    // Create user profile in users table
    const { data: userProfile, error: userError } = await supabase
      .from('users')
      .insert([{
        id: authUser.user.id,
        email,
        first_name: firstName,
        last_name: lastName,
        phone_number: phone,
        role: role,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (userError) {
      // If user profile creation fails, delete the auth user
      await supabase.auth.admin.deleteUser(authUser.user.id);
      throw userError;
    }

    // Create staff profile
    const { data: staffProfile, error: staffError } = await supabase
      .from('staff_profiles')
      .insert([{
        user_id: authUser.user.id,
        role,
        department,
        shift: shift || 'morning',
        salary: salary ? parseFloat(salary) : null,
        start_date: startDate || new Date().toISOString().split('T')[0],
        id_number: idNumber,
        emergency_contact: emergencyContact,
        address,
        branch_id: branchId ? parseInt(branchId) : null,
        status: 'active',
        created_at: new Date().toISOString()
      }])
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
      `)
      .single();

    if (staffError) {
      // If staff profile creation fails, clean up
      await supabase.auth.admin.deleteUser(authUser.user.id);
      await supabase.from('users').delete().eq('id', authUser.user.id);
      throw staffError;
    }

    res.status(201).json({
      success: true,
      data: {
        staff: staffProfile,
        generatedPassword: generatedPassword // Return password for admin to share with user
      },
      message: 'Staff member created successfully'
    });

    logger.info(`Staff member created: ${email} with role ${role}`);
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
      firstName,
      lastName,
      email,
      phone,
      role,
      department,
      shift,
      salary,
      idNumber,
      emergencyContact,
      address,
      status
    } = req.body;

    // Get staff profile
    const { data: staff, error: getError } = await supabase
      .from('staff_profiles')
      .select('user_id')
      .eq('id', req.params.id)
      .single();

    if (getError || !staff) {
      res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
      return;
    }

    // Update user profile
    const { error: userError } = await supabase
      .from('users')
      .update({
        first_name: firstName,
        last_name: lastName,
        phone_number: phone
      })
      .eq('id', staff.user_id);

    if (userError) {
      throw userError;
    }

    // Update email if changed
    if (email) {
      const { error: emailError } = await supabase.auth.admin.updateUserById(
        staff.user_id,
        { email }
      );

      if (emailError) {
        throw emailError;
      }
    }

    // Update staff profile
    const { data: updatedStaff, error: updateError } = await supabase
      .from('staff_profiles')
      .update({
        role,
        department,
        shift,
        salary,
        id_number: idNumber,
        emergency_contact: emergencyContact,
        address,
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    res.status(200).json({
      success: true,
      data: updatedStaff
    });

    logger.info(`Staff member updated: ${email || updatedStaff.id}`);
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

    logger.info(`Payroll processed for ${month}/${year}`);
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
    const { staff_id, startDate, endDate, status } = req.query;

    let query = supabase
      .from('staff_attendance')
      .select(`
        *,
        staff:staff_profiles(
          id,
          user:users!user_id(id, first_name, last_name, email)
        )
      `)
      .order('attendance_date', { ascending: false });

    if (staff_id) {
      query = query.eq('staff_id', staff_id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (startDate) {
      query = query.gte('attendance_date', startDate);
    }

    if (endDate) {
      query = query.lte('attendance_date', endDate);
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

// @desc    Record attendance (clock in/out)
// @route   POST /api/staff/attendance
// @access  Private
export const recordAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { staff_id, attendance_date, clock_in, clock_out, status, shift_type, notes } = req.body;

    const attendance = {
      staff_id,
      attendance_date: attendance_date || new Date().toISOString().split('T')[0],
      clock_in,
      clock_out,
      status: status || 'present',
      shift_type,
      notes,
      created_at: new Date().toISOString()
    };

    // Upsert attendance record (update if exists for same staff_id and date)
    const { data, error } = await supabase
      .from('staff_attendance')
      .upsert(attendance, { onConflict: 'staff_id,attendance_date' })
      .select()
      .single();

    if (error) throw error;

    logger.info(`Attendance recorded for staff ${staff_id} on ${attendance_date}`);

    res.status(201).json({
      success: true,
      data
    });
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
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
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
        staff:staff_profiles(
          id, department, status,
          user:users(id, first_name, last_name, email)
        ),
        approver:users!approved_by(first_name, last_name)
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
