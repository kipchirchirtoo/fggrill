import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';

// Cache maintenance state for 30s to avoid DB hit on every request
let _maintenanceCache: { enabled: boolean; message: string; cachedAt: number } | null = null;

export const maintenanceMode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Always allow superadmin and health checks through
  const role = req.user?.role;
  if (role === 'super_admin' || req.path === '/health') {
    next();
    return;
  }

  try {
    const now = Date.now();
    if (!_maintenanceCache || now - _maintenanceCache.cachedAt > 30_000) {
      const { data } = await supabase
        .from('security_config')
        .select('maintenance_mode, maintenance_message')
        .eq('id', 1)
        .single();
      _maintenanceCache = {
        enabled: data?.maintenance_mode ?? false,
        message: data?.maintenance_message ?? 'System under maintenance',
        cachedAt: now,
      };
    }

    if (_maintenanceCache.enabled) {
      res.status(503).json({
        success: false,
        message: _maintenanceCache.message,
        maintenance: true,
      });
      return;
    }
    next();
  } catch {
    next(); // On error, allow through to avoid locking out users
  }
};

// Call this after toggling maintenance mode to bust the cache immediately
export const bustMaintenanceCache = () => { _maintenanceCache = null; };
