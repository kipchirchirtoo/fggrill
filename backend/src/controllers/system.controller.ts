import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

// =====================================================
// BRANCHES
// =====================================================

// @desc    Get all branches
// @route   GET /api/system/branches
// @access  Private
export const getBranches = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status } = req.query;

    let query = supabase
      .from('branches')
      .select('*')
      .order('name', { ascending: true });

    if (status) {
      query = query.eq('status', status);
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

// @desc    Get single branch
// @route   GET /api/system/branches/:id
// @access  Private
export const getBranch = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('id', req.params.id)
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

// @desc    Create branch
// @route   POST /api/system/branches
// @access  Private (Admin)
export const createBranch = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, code, location, address, phone, email, manager_id, is_main_branch } = req.body;

    const branch = {
      name,
      code,
      location,
      address,
      phone,
      email,
      manager_id,
      is_main_branch,
      status: 'active',
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('branches')
      .insert([branch])
      .select()
      .single();

    if (error) throw error;

    logger.info(`Branch created: ${name} (${code}) by user ${req.user.id}`);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update branch
// @route   PUT /api/system/branches/:id
// @access  Private (Super Admin)
export const updateBranch = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const allowed = [
      'name',
      'code',
      'location',
      'address',
      'phone',
      'email',
      'manager_id',
      'is_main_branch',
      'status',
      'branch_type',
      'number_of_rooms',
      'timezone',
      'currency',
      'settings'
    ];
    const payload = Object.fromEntries(
      Object.entries(req.body).filter(([key, value]) => allowed.includes(key) && value !== undefined)
    );

    const { data, error } = await supabase
      .from('branches')
      .update({
        ...payload,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    logger.info(`Branch updated: ${req.params.id} by user ${req.user.id}`);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Deactivate branch
// @route   DELETE /api/system/branches/:id
// @access  Private (Super Admin)
export const deleteBranch = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('branches')
      .update({
        status: 'inactive',
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    logger.info(`Branch deactivated: ${req.params.id} by user ${req.user.id}`);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// =====================================================
// DEPARTMENTS
// =====================================================

// @desc    Get all departments
// @route   GET /api/system/departments
// @access  Private
export const getDepartments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { branch_id, status } = req.query;

    let query = supabase
      .from('departments')
      .select(`
        *,
        branch:branches(id, name)
      `)
      .order('name', { ascending: true });

    if (branch_id) {
      query = query.eq('branch_id', branch_id);
    }

    if (status) {
      query = query.eq('status', status);
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

// @desc    Get single department
// @route   GET /api/system/departments/:id
// @access  Private
export const getDepartment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('departments')
      .select(`
        *,
        branch:branches(id, name)
      `)
      .eq('id', req.params.id)
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

// @desc    Create department
// @route   POST /api/system/departments
// @access  Private (Admin)
export const createDepartment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { branch_id, name, code, supervisor_id, budget_allocated } = req.body;

    const department = {
      branch_id,
      name,
      code,
      supervisor_id,
      budget_allocated: budget_allocated || 0,
      status: 'active',
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('departments')
      .insert([department])
      .select()
      .single();

    if (error) throw error;

    logger.info(`Department created: ${name} (${code}) by user ${req.user.id}`);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update department
// @route   PUT /api/system/departments/:id
// @access  Private (Super Admin / General Manager)
export const updateDepartment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const allowed = [
      'branch_id',
      'name',
      'code',
      'supervisor_id',
      'budget_allocated',
      'status'
    ];
    const payload = Object.fromEntries(
      Object.entries(req.body).filter(([key, value]) => allowed.includes(key) && value !== undefined)
    );

    const { data, error } = await supabase
      .from('departments')
      .update({
        ...payload,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select(`
        *,
        branch:branches(id, name)
      `)
      .single();

    if (error) throw error;

    logger.info(`Department updated: ${req.params.id} by user ${req.user.id}`);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Deactivate department
// @route   DELETE /api/system/departments/:id
// @access  Private (Super Admin / General Manager)
export const deleteDepartment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('departments')
      .update({
        status: 'inactive',
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select(`
        *,
        branch:branches(id, name)
      `)
      .single();

    if (error) throw error;

    logger.info(`Department deactivated: ${req.params.id} by user ${req.user.id}`);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// =====================================================
// ROLES & PERMISSIONS
// =====================================================

// @desc    Get all roles
// @route   GET /api/system/roles
// @access  Private
export const getRoles = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .order('role_name', { ascending: true });

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

// @desc    Get role permissions
// @route   GET /api/system/roles/:id/permissions
// @access  Private
export const getRolePermissions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('permissions')
      .select('*')
      .eq('role_id', req.params.id);

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

// =====================================================
// SYSTEM STATUS / HEALTH
// =====================================================

// @desc    Get system health and performance metrics
// @route   GET /api/system/status
// @access  Private (Super Admin)
export const getSystemStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // ---- Database ping ----
    const dbStart = Date.now();
    const { error: dbError } = await supabase.from('branches').select('id').limit(1);
    const dbLatency = Date.now() - dbStart;

    // ---- Active sessions (last 15 min) ----
    const { count: activeConnections } = await supabase
      .from('auth_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'success')
      .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString());

    // ---- Process uptime ----
    const uptimeSec = process.uptime();
    const days    = Math.floor(uptimeSec / 86400);
    const hours   = Math.floor((uptimeSec % 86400) / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const uptimeStr = days > 0
      ? `${days}d ${hours}h ${minutes}m`
      : `${hours}h ${minutes}m`;

    // ---- Memory ----
    const mem = process.memoryUsage();
    const memPercent = Math.round((mem.heapUsed / mem.heapTotal) * 100);

    res.status(200).json({
      success: true,
      // Fields are at top level so the Flutter section can access them directly
      database:    { status: dbError ? 'unhealthy' : 'healthy', latency: `${dbLatency}ms` },
      api:         { status: 'healthy' },
      cache:       { status: 'healthy' },
      queue:       { status: 'healthy' },
      uptime:      uptimeStr,
      cpu:         0,          // Requires native OS module — surfaced as 0
      memory:      memPercent,
      disk:        0,          // Requires native OS module — surfaced as 0
      connections: activeConnections || 0,
    });
  } catch (error) {
    next(error);
  }
};

// =====================================================
// USERS (SYSTEM-WIDE)
// =====================================================

// @desc    Get all system users
// @route   GET /api/system/users
// @access  Private
export const getSystemUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, phone_number, role, avatar, status, branch_id, created_at')
      .order('first_name', { ascending: true });

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
