import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
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
        branch:branches(id, name),
        supervisor:users(id, full_name)
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
