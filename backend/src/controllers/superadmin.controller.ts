import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/database';

// ─── Helper ───────────────────────────────────────────────────────────────────

const SECURITY_CONFIG_DEFAULTS: Record<string, any> = {
  maintenance_mode: false,
  maintenance_message: null,
  session_timeout_minutes: 60,
  max_failed_login_attempts: 5,
  two_factor_required: false,
  password_expiry_days: 90,
};

const SECURITY_CONFIG_KEYS: Record<string, string> = {
  maintenance_mode: 'maintenanceMode',
  maintenance_message: 'maintenanceMessage',
  session_timeout_minutes: 'sessionTimeoutMinutes',
  max_failed_login_attempts: 'maxFailedLoginAttempts',
  two_factor_required: 'twoFactorRequired',
  password_expiry_days: 'passwordExpiryDays',
};

function parseAuditState(value: any) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function isMissingSchemaObject(error: any): boolean {
  const code = error?.code;
  const text = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return code === '42P01' ||
    code === '42703' ||
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    text.includes('could not find the table') ||
    text.includes('schema cache') ||
    text.includes('does not exist');
}

async function auditLog(
  actorId: string,
  actionType: string,
  justification: string,
  extra: Record<string, any> = {}
) {
  const row: Record<string, any> = {
    actor_id: actorId,
    action_type: actionType,
    target_type: extra.target_type,
    target_id: extra.target_id,
    before_state: parseAuditState(extra.before_state ?? extra.old_value),
    after_state: parseAuditState(extra.after_state ?? extra.new_value),
    justification: justification || 'SuperAdmin system action',
    ip_address: extra.ip_address,
    session_id: extra.session_id,
  };

  Object.keys(row).forEach((key) => row[key] === undefined && delete row[key]);

  const { error } = await supabase.from('superadmin_audit_log').insert(row);
  if (error) throw error;
}

async function readSecurityConfig() {
  const config = { ...SECURITY_CONFIG_DEFAULTS };
  const keys = Object.values(SECURITY_CONFIG_KEYS);
  const { data, error } = await supabase
    .from('system_config_values')
    .select('key,value')
    .in('key', keys);

  if (error) throw error;

  const reverseKeys = Object.fromEntries(
    Object.entries(SECURITY_CONFIG_KEYS).map(([apiKey, storageKey]) => [storageKey, apiKey])
  );

  for (const row of data || []) {
    const apiKey = reverseKeys[row.key];
    if (apiKey) config[apiKey] = row.value;
  }

  return config;
}

async function writeSecurityConfig(fields: Record<string, any>, userId: string) {
  const rows = Object.entries(fields)
    .filter(([key]) => SECURITY_CONFIG_KEYS[key])
    .map(([key, value]) => ({
      key: SECURITY_CONFIG_KEYS[key],
      value,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }));

  if (rows.length === 0) return;

  const { error } = await supabase
    .from('system_config_values')
    .upsert(rows, { onConflict: 'key' });
  if (error) throw error;
}

async function fetchUsersByIds(ids: string[]) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map<string, any>();

  const { data, error } = await supabase
    .from('users')
    .select('id, first_name, last_name, email')
    .in('id', uniqueIds);
  if (error) throw error;

  return new Map((data || []).map((user: any) => [user.id, user]));
}

// ─── Feature Flags ────────────────────────────────────────────────────────────

export const getFeatureFlags = async (req: Request, res: Response): Promise<void> => {
  try {
    let query = supabase.from('feature_flags').select('*');
    if (req.query.branch_id) {
      query = query.eq('branch_id', req.query.branch_id as string);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createFeatureFlag = async (req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('feature_flags')
      .insert({
        ...req.body,
        updated_by: req.user.id,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;

    await auditLog(req.user.id, 'create', `Created feature flag: ${data.flag_key}`, {
      target_type: 'feature_flag',
      target_id: String(data.id),
      after_state: data,
    });

    res.status(201).json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateFeatureFlag = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const { data: old, error: fetchErr } = await supabase
      .from('feature_flags')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchErr) throw fetchErr;

    const { data, error } = await supabase
      .from('feature_flags')
      .update({
        ...req.body,
        updated_by: req.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    await auditLog(req.user.id, 'update', `Updated feature flag: ${data.flag_key}`, {
      target_type: 'feature_flag',
      target_id: String(id),
      before_state: old,
      after_state: data,
    });

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteFeatureFlag = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const { data: old } = await supabase
      .from('feature_flags')
      .select('*')
      .eq('id', id)
      .single();

    const { error } = await supabase.from('feature_flags').delete().eq('id', id);
    if (error) throw error;

    await auditLog(req.user.id, 'delete', `Deleted feature flag id: ${id}`, {
      target_type: 'feature_flag',
      target_id: String(id),
      before_state: old,
    });

    res.json({ success: true, message: 'Feature flag deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Announcements ────────────────────────────────────────────────────────────

export const getAnnouncements = async (req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const userMap = await fetchUsersByIds((data || []).map((row: any) => row.created_by));
    const enriched = (data || []).map((row: any) => ({
      ...row,
      created_by_user: userMap.get(row.created_by) || null,
    }));

    res.json({ success: true, data: enriched });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createAnnouncement = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, body, target_type, target_value, priority, expires_at } = req.body;
    const { data, error } = await supabase
      .from('announcements')
      .insert({
        title,
        body,
        target_type,
        target_value,
        priority,
        expires_at,
        created_by: req.user.id,
      })
      .select()
      .single();
    if (error) throw error;

    await auditLog(req.user.id, 'create', `Created announcement: ${title}`, {
      target_type: 'announcement',
      target_id: String(data.id),
      after_state: data,
    });

    res.status(201).json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAnnouncement = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { data: before } = await supabase.from('announcements').select('*').eq('id', id).single();
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) throw error;

    await auditLog(req.user.id, 'delete', `Deleted announcement: ${id}`, {
      target_type: 'announcement',
      target_id: String(id),
      before_state: before,
    });

    res.json({ success: true, message: 'Announcement deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Security Config ──────────────────────────────────────────────────────────

export const getSecurityConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await readSecurityConfig();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSecurityConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { justification, ...fields } = req.body;
    if (!justification) {
      res.status(400).json({ success: false, message: 'justification is required' });
      return;
    }

    const current = await readSecurityConfig();
    const normalizedFields = Object.fromEntries(
      Object.entries(fields).filter(([key]) => SECURITY_CONFIG_KEYS[key])
    );

    // Insert history rows for each changed field
    const historyRows = Object.entries(normalizedFields)
      .filter(([key, val]) => (current as any)[key] !== val)
      .map(([key, val]) => ({
        field_path: `security_config.${key}`,
        old_value: (current as any)[key],
        new_value: val,
        changed_by: req.user.id,
        justification,
      }));

    if (historyRows.length > 0) {
      const { error: histErr } = await supabase
        .from('system_config_history')
        .insert(historyRows);
      if (histErr) throw histErr;
    }

    await writeSecurityConfig(normalizedFields, req.user.id);
    const data = await readSecurityConfig();

    await auditLog(req.user.id, 'update', 'Updated security config', {
      target_type: 'security_config',
      target_id: 'system_config_values',
      before_state: current,
      after_state: data,
    });

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Backup ───────────────────────────────────────────────────────────────────

export const triggerBackup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { justification = 'Manual Supabase backup requested' } = req.body || {};
    await auditLog(req.user.id, 'backup', justification, {
      target_type: 'system',
      target_id: 'backup',
    });

    await supabase.from('system_config_history').insert({
      field_path: 'backup.trigger',
      old_value: null,
      new_value: { status: 'requested', requested_at: new Date().toISOString() },
      changed_by: req.user.id,
      justification,
    });

    res.json({ success: true, message: 'Backup triggered (managed by Supabase)' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getBackupHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('system_config_history')
      .select('*')
      .eq('field_path', 'backup.trigger')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Impersonation ────────────────────────────────────────────────────────────

export const startImpersonation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { justification } = req.body;

    if (!justification || justification.length < 10) {
      res.status(400).json({ success: false, message: 'justification must be at least 10 characters' });
      return;
    }

    const { data: targetUser, error: userErr } = await supabase
      .from('users')
      .select('id, email, role, first_name, last_name')
      .eq('id', userId)
      .single();

    if (userErr || !targetUser) {
      res.status(404).json({ success: false, message: 'Target user not found' });
      return;
    }

    if (targetUser.role === 'super_admin') {
      res.status(403).json({ success: false, message: 'Cannot impersonate another super_admin' });
      return;
    }

    const { data: session, error: sessErr } = await supabase
      .from('impersonation_sessions')
      .insert({
        superadmin_id: req.user.id,
        impersonated_user_id: userId,
        justification,
      })
      .select()
      .single();

    if (sessErr) throw sessErr;

    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
    const shadowToken = jwt.sign(
      {
        sub: targetUser.id,
        active_role: targetUser.role,
        actual_actor_id: req.user.id,
        impersonation_session_id: session.id,
        impersonation: true,
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      jwtSecret
    );

    await auditLog(req.user.id, 'impersonation_start', justification, {
      target_type: 'user',
      target_id: String(userId),
      after_state: { email: targetUser.email, role: targetUser.role },
    });

    res.status(201).json({
      success: true,
      session_id: session.id,
      shadow_token: shadowToken,
      impersonated_user: {
        id: targetUser.id,
        email: targetUser.email,
        role: targetUser.role,
        name: `${targetUser.first_name} ${targetUser.last_name}`,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const endImpersonation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const { data, error } = await supabase
      .from('impersonation_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('superadmin_id', req.user.id)
      .select()
      .single();

    if (error) throw error;

    await auditLog(req.user.id, 'impersonation_end', `Ended impersonation session: ${sessionId}`, {
      target_type: 'impersonation_session',
      target_id: String(sessionId),
      after_state: data,
    });

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Audit Log ────────────────────────────────────────────────────────────────

export const getSuperadminAuditLog = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const actionType = req.query.action_type as string | undefined;

    let query = supabase
      .from('superadmin_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (actionType) {
      query = query.eq('action_type', actionType);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data, limit, offset });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Emergency ────────────────────────────────────────────────────────────────

export const toggleMaintenanceMode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { enabled, message, justification } = req.body as {
      enabled: boolean;
      message?: string;
      justification?: string;
    };

    if (!justification) {
      res.status(400).json({ success: false, message: 'justification is required' });
      return;
    }

    const before = await readSecurityConfig();
    await writeSecurityConfig({
      maintenance_mode: enabled,
      maintenance_message: message ?? null,
    }, req.user.id);

    const { data: updatedFlags, error: flagErr } = await supabase
      .from('feature_flags')
      .update({
        is_enabled: enabled,
        updated_by: req.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('flag_key', 'maintenance_mode')
      .select('id');
    if (flagErr) throw flagErr;

    if (!updatedFlags || updatedFlags.length === 0) {
      const { error: insertFlagErr } = await supabase.from('feature_flags').insert({
        flag_key: 'maintenance_mode',
        flag_name: 'Maintenance Mode',
        description: 'Restrict non-admin access while the system is under maintenance.',
        is_global: true,
        is_enabled: enabled,
        updated_by: req.user.id,
        updated_at: new Date().toISOString(),
      });
      if (insertFlagErr) throw insertFlagErr;
    }

    const { error: legacySecurityConfigErr } = await supabase
      .from('security_config')
      .upsert({
        id: 1,
        maintenance_mode: enabled,
        maintenance_message: message ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    if (legacySecurityConfigErr && !isMissingSchemaObject(legacySecurityConfigErr)) {
      throw legacySecurityConfigErr;
    }

    // Bust maintenance cache immediately
    try {
      const { bustMaintenanceCache } = await import('../middleware/maintenanceMode');
      bustMaintenanceCache();
    } catch {
      // middleware may not be loaded — ignore
    }

    await auditLog(
      req.user.id,
      'emergency',
      justification,
      {
        target_type: 'system',
        target_id: 'maintenance_mode',
        before_state: before,
        after_state: {
          ...before,
          maintenance_mode: enabled,
          maintenance_message: message ?? null,
        },
      }
    );

    res.json({ success: true, maintenance_mode: enabled });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const forceLogoutAll = async (req: Request, res: Response): Promise<void> => {
  try {
    const { justification } = req.body;
    if (!justification) {
      res.status(400).json({ success: false, message: 'justification is required' });
      return;
    }

    const { data, error } = await supabase
      .from('users')
      .update({ force_logout_at: new Date().toISOString() })
      .neq('role', 'super_admin')
      .select('id');

    if (error) throw error;

    await auditLog(req.user.id, 'emergency', justification, {
      target_type: 'all_users',
      after_state: { affected_count: data?.length ?? 0 },
    });

    res.json({ success: true, affected_count: data?.length ?? 0 });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const forceLogoutUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { justification } = req.body;

    if (!justification) {
      res.status(400).json({ success: false, message: 'justification is required' });
      return;
    }

    const { error } = await supabase
      .from('users')
      .update({ force_logout_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) throw error;

    await auditLog(req.user.id, 'emergency', justification, {
      target_type: 'user',
      target_id: String(userId),
      after_state: { force_logout_at: new Date().toISOString() },
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const lockdownBranch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId } = req.params;
    const { justification } = req.body;

    if (!justification) {
      res.status(400).json({ success: false, message: 'justification is required' });
      return;
    }

    const { error } = await supabase
      .from('branches')
      .update({ status: 'maintenance' })
      .eq('id', branchId);
    if (error) throw error;

    await auditLog(req.user.id, 'emergency', justification, {
      target_type: 'branch',
      target_id: String(branchId),
      after_state: { status: 'maintenance' },
    });

    res.json({ success: true, branch_id: branchId, status: 'maintenance' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Data Overrides ───────────────────────────────────────────────────────────

const ALLOWED_APPROVAL_TABLES = [
  'staff_leave',
  'stock_requests',
  'purchase_orders',
  'store_purchase_orders',
];

const APPROVAL_UPDATE_BY_TABLE: Record<string, (userId: string, now: string) => Record<string, any>> = {
  staff_leave: (userId, now) => ({ status: 'approved', approved_by: userId, approved_at: now }),
  stock_requests: (userId, now) => ({ status: 'APPROVED', reviewed_by: userId, reviewed_at: now }),
  purchase_orders: (userId, now) => ({ status: 'APPROVED', approved_by: userId, approved_at: now }),
  store_purchase_orders: (userId, now) => ({ status: 'approved', approved_by_id: userId, approved_at: now }),
};

export const forceApproveRecord = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { table_name, justification } = req.body;

    if (!ALLOWED_APPROVAL_TABLES.includes(table_name)) {
      res.status(400).json({
        success: false,
        message: `table_name must be one of: ${ALLOWED_APPROVAL_TABLES.join(', ')}`,
      });
      return;
    }

    if (!justification) {
      res.status(400).json({ success: false, message: 'justification is required' });
      return;
    }

    const { data: before, error: fetchErr } = await supabase
      .from(table_name)
      .select('*')
      .eq('id', id)
      .single();
    if (fetchErr) throw fetchErr;

    const now = new Date().toISOString();
    const updatePayload = APPROVAL_UPDATE_BY_TABLE[table_name](req.user.id, now);

    const { data, error } = await supabase
      .from(table_name)
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await auditLog(req.user.id, 'override', justification, {
      target_type: table_name,
      target_id: String(id),
      before_state: before,
      after_state: data,
    });

    res.json({ success: true, table_name, record_id: id });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const unlockUserAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { justification } = req.body;

    if (!justification) {
      res.status(400).json({ success: false, message: 'justification is required' });
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_locked: false, failed_login_attempts: 0 })
        .eq('id', id);
      if (error) throw error;
    } catch (innerErr: any) {
      // Columns may not exist — proceed gracefully
    }

    await auditLog(req.user.id, 'override', justification, {
      target_type: 'user',
      target_id: String(id),
      after_state: { is_locked: false, failed_login_attempts: 0 },
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── SSE Stream ───────────────────────────────────────────────────────────────

export const getSystemStream = async (req: Request, res: Response): Promise<void> => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = () => {
    const payload = JSON.stringify({
      cpu_percent: Math.random() * 100 | 0,
      memory_percent: Math.random() * 100 | 0,
      uptime_seconds: process.uptime() | 0,
      timestamp: new Date().toISOString(),
    });
    res.write(`data: ${payload}\n\n`);
  };

  send();
  const interval = setInterval(send, 5000);

  req.on('close', () => {
    clearInterval(interval);
  });
};

// ─── Non-Consumables POS Items (dynamic_services) ───────────────────────────────
// The non-consumables POS station reads its catalogue from `dynamic_services`
// (synced into pos_outlet_items). These endpoints let SuperAdmin manage that
// catalogue per branch with name + price.

const NON_CONSUMABLE_SERVICE_TYPES = [
  'swimming',
  'pool',
  'pool_token',
  'pool_tokens',
  'car_wash',
  'sauna',
  'non_consumable',
  'non_consumables',
];

export const getNonConsumables = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branch_id } = req.query;
    let query = supabase
      .from('dynamic_services')
      .select('id, branch_id, service_type, name, pricing_model, base_price, price_per_hour, is_active, created_at, updated_at')
      .in('service_type', NON_CONSUMABLE_SERVICE_TYPES)
      .order('name', { ascending: true });

    if (branch_id !== undefined && branch_id !== null && branch_id !== '') {
      const bid = Number(branch_id);
      // include global (null branch) + the requested branch
      query = query.or(`branch_id.is.null,branch_id.eq.${bid}`);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createNonConsumable = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      base_price,
      service_type = 'non_consumable',
      branch_id,
      pricing_model = 'fixed',
      price_per_hour,
      is_active = true,
    } = req.body;

    if (!name || `${name}`.trim() === '') {
      res.status(400).json({ success: false, message: 'Name is required' });
      return;
    }
    const price = Number(base_price);
    if (!Number.isFinite(price) || price < 0) {
      res.status(400).json({ success: false, message: 'A valid base price is required' });
      return;
    }
    if (!NON_CONSUMABLE_SERVICE_TYPES.includes(service_type)) {
      res.status(400).json({ success: false, message: 'Invalid service type for non-consumables' });
      return;
    }

    const { data, error } = await supabase
      .from('dynamic_services')
      .insert({
        name: `${name}`.trim(),
        base_price: price,
        service_type,
        branch_id: branch_id === undefined || branch_id === null || branch_id === ''
          ? null
          : Number(branch_id),
        pricing_model,
        price_per_hour: price_per_hour !== undefined ? Number(price_per_hour) : 0,
        is_active,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateNonConsumable = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, base_price, service_type, branch_id, pricing_model, price_per_hour, is_active } = req.body;

    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name !== undefined) update.name = `${name}`.trim();
    if (base_price !== undefined) update.base_price = Number(base_price);
    if (service_type !== undefined) {
      if (!NON_CONSUMABLE_SERVICE_TYPES.includes(service_type)) {
        res.status(400).json({ success: false, message: 'Invalid service type' });
        return;
      }
      update.service_type = service_type;
    }
    if (branch_id !== undefined) {
      update.branch_id = branch_id === null || branch_id === '' ? null : Number(branch_id);
    }
    if (pricing_model !== undefined) update.pricing_model = pricing_model;
    if (price_per_hour !== undefined) update.price_per_hour = Number(price_per_hour);
    if (is_active !== undefined) update.is_active = is_active;

    const { data, error } = await supabase
      .from('dynamic_services')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteNonConsumable = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    // Soft-delete: deactivate so it stops appearing in the POS catalogue
    const { error } = await supabase
      .from('dynamic_services')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    res.json({ success: true, message: 'Non-consumable item deactivated' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Kitchen Ledger Items (configurable item list, per-branch) ────────────────
// kitchen_ledger_items (migration 20260622_famousgate_major_redesign.sql,
// section 11) — distinct from the existing kitchen_ledger_entries feature;
// this is just the enable/disable list of which inventory items appear on a
// branch's kitchen ledger.

export const getKitchenLedgerItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branch_id } = req.query;
    if (!branch_id) {
      res.status(400).json({ success: false, message: 'branch_id is required' });
      return;
    }
    const branchId = Number(branch_id);
    if (!Number.isInteger(branchId)) {
      res.status(400).json({ success: false, message: 'branch_id must be an integer' });
      return;
    }

    const { data, error } = await supabase
      .from('kitchen_ledger_items')
      .select('*, item:inventory_items(id, item_name, unit)')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addKitchenLedgerItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branch_id, item_id } = req.body || {};
    const branchId = Number(branch_id);
    if (!Number.isInteger(branchId)) {
      res.status(400).json({ success: false, message: 'branch_id must be an integer' });
      return;
    }
    if (!item_id) {
      res.status(400).json({ success: false, message: 'item_id is required' });
      return;
    }

    const { data, error } = await supabase
      .from('kitchen_ledger_items')
      .upsert(
        { branch_id: branchId, item_id: String(item_id), enabled_by: (req as any).user?.id || null },
        { onConflict: 'branch_id,item_id' }
      )
      .select('*, item:inventory_items(id, item_name, unit)')
      .single();
    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const removeKitchenLedgerItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('kitchen_ledger_items').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true, message: 'Kitchen ledger item removed' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
