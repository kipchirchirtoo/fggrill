import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

const DEFAULT_SYSTEM_CONFIG: Record<string, any> = {
  vatRate: 16.0,
  currency: 'KES',
  timezone: 'Africa/Nairobi',
  logoUrl: '',
  hotelName: 'Famous Gates Hotels',
  address: '',
  phone: '',
  email: '',
  isLicenseValid: false,
  licenseExpiry: null,
  licenseKey: '',
  appVersion: process.env.APP_VERSION || '1.0.0',
};

const CONFIG_KEY_ALIASES: Record<string, string> = {
  vat_rate: 'vatRate',
  logo_url: 'logoUrl',
  hotel_name: 'hotelName',
  license_key: 'licenseKey',
  license_expiry: 'licenseExpiry',
  is_license_valid: 'isLicenseValid',
  app_version: 'appVersion',
};

const normalizeConfigKey = (key: string): string => CONFIG_KEY_ALIASES[key] || key;

const countRows = async (table: string, modifier?: (query: any) => any): Promise<number> => {
  let query = supabase.from(table).select('*', { count: 'exact', head: true });
  if (modifier) query = modifier(query);
  const { count, error } = await query;
  if (error) {
    logger.warn(`System stats count failed for ${table}: ${error.message}`);
    return 0;
  }
  return count || 0;
};

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
// NOTE: Roles are defined as a TypeScript enum (UserRole). The `roles` DB table
// is intentionally empty; we build the response directly from the enum so the
// frontend always gets the full, up-to-date list.
export const getRoles = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const roles = [
      // ── Management ──────────────────────────────────────────────────────
      { id: 'super_admin',               name: 'super_admin',               display_name: 'Super Admin',                    category: 'Management' },
      { id: 'general_manager',           name: 'general_manager',           display_name: 'General Manager',                category: 'Management' },
      { id: 'branch_manager',            name: 'branch_manager',            display_name: 'Branch Manager',                 category: 'Management' },
      { id: 'director',                  name: 'director',                  display_name: 'Director',                       category: 'Management' },
      { id: 'branch_operations_manager', name: 'branch_operations_manager', display_name: 'Branch Operations Manager',      category: 'Management' },
      { id: 'central_operations_manager',name: 'central_operations_manager',display_name: 'Central Operations Manager',     category: 'Management' },
      { id: 'facilities_manager',        name: 'facilities_manager',        display_name: 'Facilities Manager',             category: 'Management' },
      // ── Front Office ────────────────────────────────────────────────────
      { id: 'receptionist',              name: 'receptionist',              display_name: 'Receptionist',                   category: 'Front Office' },
      { id: 'front_desk_supervisor',     name: 'front_desk_supervisor',     display_name: 'Front Desk Supervisor',          category: 'Front Office' },
      { id: 'concierge',                 name: 'concierge',                 display_name: 'Concierge',                      category: 'Front Office' },
      { id: 'bell_captain',              name: 'bell_captain',              display_name: 'Bell Captain',                   category: 'Front Office' },
      { id: 'bellhop',                   name: 'bellhop',                   display_name: 'Bellhop',                        category: 'Front Office' },
      // ── Housekeeping ────────────────────────────────────────────────────
      { id: 'housekeeping',              name: 'housekeeping',              display_name: 'Housekeeping',                   category: 'Housekeeping' },
      { id: 'housekeeping_supervisor',   name: 'housekeeping_supervisor',   display_name: 'Housekeeping Supervisor',        category: 'Housekeeping' },
      { id: 'room_attendant',            name: 'room_attendant',            display_name: 'Room Attendant',                 category: 'Housekeeping' },
      { id: 'laundry_attendant',         name: 'laundry_attendant',         display_name: 'Laundry Attendant',              category: 'Housekeeping' },
      // ── Restaurant & Food Service ────────────────────────────────────────
      { id: 'restaurant',                name: 'restaurant',                display_name: 'Restaurant',                     category: 'Restaurant' },
      { id: 'restaurant_manager',        name: 'restaurant_manager',        display_name: 'Restaurant Manager',             category: 'Restaurant' },
      { id: 'head_chef',                 name: 'head_chef',                 display_name: 'Head Chef',                      category: 'Restaurant' },
      { id: 'sous_chef',                 name: 'sous_chef',                 display_name: 'Sous Chef',                      category: 'Restaurant' },
      { id: 'line_cook',                 name: 'line_cook',                 display_name: 'Line Cook',                      category: 'Restaurant' },
      { id: 'prep_cook',                 name: 'prep_cook',                 display_name: 'Prep Cook',                      category: 'Restaurant' },
      { id: 'waiter',                    name: 'waiter',                    display_name: 'Waiter',                         category: 'Restaurant' },
      { id: 'waitress',                  name: 'waitress',                  display_name: 'Waitress',                       category: 'Restaurant' },
      { id: 'head_waiter',               name: 'head_waiter',               display_name: 'Head Waiter',                    category: 'Restaurant' },
      { id: 'bartender',                 name: 'bartender',                 display_name: 'Bartender',                      category: 'Restaurant' },
      { id: 'barista',                   name: 'barista',                   display_name: 'Barista',                        category: 'Restaurant' },
      { id: 'food_runner',               name: 'food_runner',               display_name: 'Food Runner',                    category: 'Restaurant' },
      { id: 'busser',                    name: 'busser',                    display_name: 'Busser',                         category: 'Restaurant' },
      { id: 'host_hostess',              name: 'host_hostess',              display_name: 'Host / Hostess',                 category: 'Restaurant' },
      // ── Kitchen & POS ───────────────────────────────────────────────────
      { id: 'pos_kitchen',               name: 'pos_kitchen',               display_name: 'POS Kitchen',                    category: 'Kitchen' },
      { id: 'kitchen',                   name: 'kitchen',                   display_name: 'Kitchen',                        category: 'Kitchen' },
      { id: 'kitchen_operations',        name: 'kitchen_operations',        display_name: 'Kitchen Operations',             category: 'Kitchen' },
      { id: 'kitchen_helper',            name: 'kitchen_helper',            display_name: 'Kitchen Helper',                 category: 'Kitchen' },
      { id: 'dishwasher',                name: 'dishwasher',                display_name: 'Dishwasher',                     category: 'Kitchen' },
      // ── Maintenance ─────────────────────────────────────────────────────
      { id: 'maintenance',               name: 'maintenance',               display_name: 'Maintenance',                    category: 'Maintenance' },
      { id: 'maintenance_supervisor',    name: 'maintenance_supervisor',    display_name: 'Maintenance Supervisor',         category: 'Maintenance' },
      { id: 'electrician',               name: 'electrician',               display_name: 'Electrician',                    category: 'Maintenance' },
      { id: 'plumber',                   name: 'plumber',                   display_name: 'Plumber',                        category: 'Maintenance' },
      { id: 'hvac_technician',           name: 'hvac_technician',           display_name: 'HVAC Technician',                category: 'Maintenance' },
      { id: 'groundskeeper',             name: 'groundskeeper',             display_name: 'Groundskeeper',                  category: 'Maintenance' },
      // ── Security ────────────────────────────────────────────────────────
      { id: 'security_supervisor',       name: 'security_supervisor',       display_name: 'Security Supervisor',            category: 'Security' },
      { id: 'security_guard',            name: 'security_guard',            display_name: 'Security Guard',                 category: 'Security' },
      { id: 'night_auditor',             name: 'night_auditor',             display_name: 'Night Auditor',                  category: 'Security' },
      // ── Finance & Administration ─────────────────────────────────────────
      { id: 'accountant',                name: 'accountant',                display_name: 'Accountant',                     category: 'Finance' },
      { id: 'branch_accountant',         name: 'branch_accountant',         display_name: 'Branch Accountant',              category: 'Finance' },
      { id: 'auditor',                   name: 'auditor',                   display_name: 'Auditor',                        category: 'Finance' },
      { id: 'finance_manager',           name: 'finance_manager',           display_name: 'Finance Manager',                category: 'Finance' },
      { id: 'hr_manager',                name: 'hr_manager',                display_name: 'HR Manager',                     category: 'Finance' },
      { id: 'payroll_clerk',             name: 'payroll_clerk',             display_name: 'Payroll Clerk',                  category: 'Finance' },
      { id: 'cashier',                   name: 'cashier',                   display_name: 'Cashier',                        category: 'Finance' },
      { id: 'restaurant_cashier',        name: 'restaurant_cashier',        display_name: 'Restaurant Cashier',             category: 'Finance' },
      { id: 'main_bar_cashier',          name: 'main_bar_cashier',          display_name: 'Main Bar Cashier',               category: 'Finance' },
      { id: 'executive_bar_cashier',     name: 'executive_bar_cashier',     display_name: 'Executive Bar Cashier',          category: 'Finance' },
      { id: 'non_consumables_cashier',   name: 'non_consumables_cashier',   display_name: 'Non-consumables Cashier',        category: 'Finance' },
      { id: 'kyogong_spa_cashier',       name: 'kyogong_spa_cashier',       display_name: 'Kyogong Spa Cashier',            category: 'Finance' },
      { id: 'kyogong_executive_bar_cashier', name: 'kyogong_executive_bar_cashier', display_name: 'Kyogong Executive Bar Cashier', category: 'Finance' },
      { id: 'kyogong_sports_bar_cashier',name: 'kyogong_sports_bar_cashier',display_name: 'Kyogong Sports Bar Cashier',    category: 'Finance' },
      { id: 'kyogong_reception_cashier', name: 'kyogong_reception_cashier', display_name: 'Kyogong Reception Cashier',      category: 'Finance' },
      { id: 'choma_zone_cashier',        name: 'choma_zone_cashier',        display_name: 'Choma Zone Cashier',             category: 'Finance' },
      // ── Store & Inventory ────────────────────────────────────────────────
      { id: 'central_storekeeper',       name: 'central_storekeeper',       display_name: 'Central Storekeeper',            category: 'Store' },
      { id: 'branch_storekeeper',        name: 'branch_storekeeper',        display_name: 'Branch Storekeeper',             category: 'Store' },
      { id: 'inventory_clerk',           name: 'inventory_clerk',           display_name: 'Inventory Clerk',                category: 'Store' },
      { id: 'purchasing_manager',        name: 'purchasing_manager',        display_name: 'Purchasing Manager',             category: 'Store' },
      { id: 'procurement',               name: 'procurement',               display_name: 'Procurement',                    category: 'Store' },
      { id: 'storekeeper',               name: 'storekeeper',               display_name: 'Storekeeper',                    category: 'Store' },
      // ── General ──────────────────────────────────────────────────────────
      { id: 'employee',                  name: 'employee',                  display_name: 'Employee',                       category: 'General' },
      { id: 'driver',                    name: 'driver',                    display_name: 'Driver',                         category: 'General' },
    ].sort((a, b) => a.display_name.localeCompare(b.display_name));

    res.status(200).json({
      success: true,
      count: roles.length,
      data: roles
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
    const roleParam = String(req.params.id || '').trim();
    let roleId: number | null = /^\d+$/.test(roleParam) ? Number(roleParam) : null;

    if (roleId === null) {
      const roleLookups = [
        { column: 'name', select: 'id, name' },
        { column: 'role_name', select: 'id, role_name' }
      ];

      for (const lookup of roleLookups) {
        const { data: role, error: roleError } = await supabase
          .from('roles')
          .select(lookup.select)
          .eq(lookup.column, roleParam)
          .maybeSingle();

        if (roleError) {
          logger.warn(`Role permission lookup skipped for ${lookup.column}: ${roleError.message}`);
          continue;
        }

        const id = (role as { id?: unknown } | null)?.id;
        if (typeof id === 'number') {
          roleId = id;
          break;
        }
        if (typeof id === 'string' && /^\d+$/.test(id)) {
          roleId = Number(id);
          break;
        }
      }
    }

    if (roleId === null) {
      res.status(200).json({
        success: true,
        count: 0,
        data: []
      });
      return;
    }

    const { data, error } = await supabase
      .from('permissions')
      .select('*')
      .eq('role_id', roleId);

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

// @desc    Get system-wide summary counts for mobile/admin dashboards
// @route   GET /api/system/stats
// @access  Private (Super Admin)
export const getSystemStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalBranches,
      totalRoles,
      todayTransactions,
    ] = await Promise.all([
      countRows('users'),
      countRows('branches'),
      countRows('roles'),
      countRows('payments', query => query.gte('created_at', today.toISOString())),
    ]);

    res.status(200).json({
      success: true,
      data: {
        total_users: totalUsers,
        users_count: totalUsers,
        total_branches: totalBranches,
        branches_count: totalBranches,
        total_roles: totalRoles,
        roles_count: totalRoles,
        today_transactions: todayTransactions,
        transactions_today: todayTransactions,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get system configuration values
// @route   GET /api/system/config
// @access  Private (Super Admin)
export const getSystemConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const config = { ...DEFAULT_SYSTEM_CONFIG };

    const { data, error } = await supabase
      .from('system_config_values')
      .select('key, value');

    if (error) {
      logger.warn(`System config table unavailable: ${error.message}`);
    } else {
      for (const row of data || []) {
        config[normalizeConfigKey(row.key)] = row.value;
      }
    }

    res.status(200).json({
      success: true,
      data: config,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update system configuration values
// @route   PUT /api/system/config
// @access  Private (Super Admin)
export const updateSystemConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const entries = Object.entries(req.body || {})
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => ({
        key: normalizeConfigKey(key),
        value,
        updated_by: req.user?.id || null,
        updated_at: new Date().toISOString(),
      }));

    if (!entries.length) {
      res.status(400).json({ success: false, message: 'No config values supplied' });
      return;
    }

    const { error } = await supabase
      .from('system_config_values')
      .upsert(entries, { onConflict: 'key' });

    if (error) throw error;

    await supabase.from('system_config_history').insert(
      entries.map(entry => ({
        changed_by: req.user?.id || null,
        field_path: entry.key,
        old_value: null,
        new_value: entry.value,
      })),
    );

    await getSystemConfig(req, res, next);
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
