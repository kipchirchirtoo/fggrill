import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

// Support both SUPABASE_PROJECT_URL and SUPABASE_URL (common in production deployments)
const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey || supabaseUrl === 'undefined' || supabaseServiceKey === 'undefined') {
  logger.error('CRITICAL: Missing required Supabase env vars in database config.');
  logger.error(`SUPABASE_URL present: ${!!supabaseUrl}`);
  logger.error(`SUPABASE_SERVICE_ROLE_KEY present: ${!!supabaseServiceKey}`);
  
  // In production, we might want to continue in degraded mode if it's not critical
  // but since this is database.ts, it's likely critical.
  if (process.env.NODE_ENV === 'production') {
    logger.warn('Production server attempting to start without database configuration!');
  }
}

// Initialize Supabase client
const supabase = createClient(
  supabaseUrl || 'missing-url',
  supabaseServiceKey || 'missing-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export const connectDB = async (): Promise<void> => {
  const isDev = process.env.NODE_ENV !== 'production';
  logger.info('Attempting to connect to Supabase...');

  try {
    // Test database access with the service-role client. Calling auth.getUser()
    // here is invalid because startup has no bearer token/session.
    const { count, error: dbError } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true });

    if (dbError) {
      throw dbError;
    }

    logger.info('Supabase Connected successfully');
    logger.debug('Connection test result:', { usersCount: count });
  } catch (error) {
    logger.error('Error connecting to Supabase:', {
      message: (error as any)?.message || String(error),
      code: (error as any)?.code,
      details: (error as any)?.details,
      hint: (error as any)?.hint,
    });

    // In production, we log the error but don't necessarily crash immediately
    // to allow health checks to function. However, the app will be degraded.
    if (!isDev) {
      logger.warn('Production server running in degraded state (Database disconnected)');
    }
  }
};

// Export supabase client for use in other files
export { supabase };
