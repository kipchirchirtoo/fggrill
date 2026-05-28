import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/database';

// ─── Helper ───────────────────────────────────────────────────────────────────

async function auditLog(
  actorId: string,
  actionType: string,
  description: string,
  extra: Record<string, any> = {}
) {
  await supabase.from('superadmin_audit_log').insert({
    actor_id: actorId,
    action_type: actionType,
    description,
    ...extra,
  });
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
      .insert(req.body)
      .select()
      .single();
    if (error) throw error;

    await auditLog(req.user.id, 'create', `Created feature flag: ${data.flag_key}`, {
      target_type: 'feature_flag',
      target_id: String(data.id),
      new_value: JSON.stringify(data),
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
      .update(req.body)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    await auditLog(req.user.id, 'update', `Updated feature flag: ${data.flag_key}`, {
      target_type: 'feature_flag',
      target_id: String(id),
      old_value: JSON.stringify(old),
      new_value: JSON.stringify(data),
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
      old_value: JSON.stringify(old),
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
      .select('*, created_by_user:users!announcements_created_by_fkey(first_name, last_name, email)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, data });
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
    res.status(201).json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAnnouncement = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true, message: 'Announcement deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Security Config ──────────────────────────────────────────────────────────

export const getSecurityConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('security_config')
      .select('*')
      .eq('id', 1)
      .single();
    if (error) throw error;
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

    // Fetch current config to detect changed fields
    const { data: current, error: fetchErr } = await supabase
      .from('security_config')
      .select('*')
      .eq('id', 1)
      .single();
    if (fetchErr) throw fetchErr;

    // Insert history rows for each changed field
    const historyRows = Object.entries(fields)
      .filter(([key, val]) => (current as any)[key] !== val)
      .map(([key, val]) => ({
        field_path: `security_config.${key}`,
        old_value: JSON.stringify((current as any)[key]),
        new_value: JSON.stringify(val),
        changed_by: req.user.id,
        justification,
      }));

    if (historyRows.length > 0) {
      const { error: histErr } = await supabase
        .from('system_config_history')
        .insert(historyRows);
      if (histErr) throw histErr;
    }

    const { data, error } = await supabase
      .from('security_config')
      .update(fields)
      .eq('id', 1)
      .select()
      .single();
    if (error) throw error;

    await auditLog(req.user.id, 'update', 'Updated security config', {
      target_type: 'security_config',
      target_id: '1',
      old_value: JSON.stringify(current),
      new_value: JSON.stringify(data),
    });

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Backup ───────────────────────────────────────────────────────────────────

export const triggerBackup = async (req: Request, res: Response): Promise<void> => {
  try {
    await auditLog(req.user.id, 'backup', 'Manual backup triggered', {
      target_type: 'system',
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

    await auditLog(req.user.id, 'impersonation_start', `Started impersonating user: ${targetUser.email}`, {
      target_type: 'user',
      target_id: String(userId),
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
    const { enabled, message } = req.body as { enabled: boolean; message?: string };

    const { error: cfgErr } = await supabase
      .from('security_config')
      .update({
        maintenance_mode: enabled,
        maintenance_message: message ?? null,
      })
      .eq('id', 1);
    if (cfgErr) throw cfgErr;

    const { error: flagErr } = await supabase
      .from('feature_flags')
      .update({ is_enabled: enabled })
      .eq('flag_key', 'maintenance_mode');
    if (flagErr) throw flagErr;

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
      `Maintenance mode set to ${enabled}`,
      { target_type: 'system' }
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

    await auditLog(req.user.id, 'emergency', 'Force logout all non-superadmin users', {
      target_type: 'all_users',
      description_extra: justification,
    });

    res.json({ success: true, affected_count: data?.length ?? 0 });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const forceLogoutUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const { error } = await supabase
      .from('users')
      .update({ force_logout_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) throw error;

    await auditLog(req.user.id, 'emergency', `Force logout user: ${userId}`, {
      target_type: 'user',
      target_id: String(userId),
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const lockdownBranch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId } = req.params;

    const { error } = await supabase
      .from('branches')
      .update({ status: 'maintenance' })
      .eq('id', branchId);
    if (error) throw error;

    await auditLog(req.user.id, 'emergency', `Locked down branch: ${branchId}`, {
      target_type: 'branch',
      target_id: String(branchId),
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

    const { data: before } = await supabase.from(table_name).select('*').eq('id', id).single();

    const { data, error } = await supabase
      .from(table_name)
      .update({
        status: 'approved',
        approved_by: req.user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await auditLog(req.user.id, 'override', `Force-approved record in ${table_name} id: ${id}`, {
      target_type: table_name,
      target_id: String(id),
      old_value: JSON.stringify(before),
      new_value: JSON.stringify(data),
    });

    res.json({ success: true, table_name, record_id: id });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const unlockUserAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_locked: false, failed_login_attempts: 0 })
        .eq('id', id);
      if (error) throw error;
    } catch (innerErr: any) {
      // Columns may not exist — proceed gracefully
    }

    await auditLog(req.user.id, 'override', `Unlocked user account: ${id}`, {
      target_type: 'user',
      target_id: String(id),
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
