import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

// Support both SUPABASE_PROJECT_URL and SUPABASE_URL (common in production deployments)
const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  logger.error('Missing required Supabase env vars: SUPABASE_PROJECT_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// SUPABASE_JWT_SECRET is optional — warn but don't crash
if (!process.env.SUPABASE_JWT_SECRET && !process.env.JWT_SECRET) {
  logger.warn('Neither SUPABASE_JWT_SECRET nor JWT_SECRET is set — using fallback secret (NOT safe for production)');
}

// Initialize Supabase client
const supabase = createClient(
  supabaseUrl,
  supabaseServiceKey,
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
    // SECURITY FIX: Use getUser() instead of getSession() to prevent client-side spoofing
    // Test the connection by verifying auth configuration
    const { data: userData, error: configError } = await supabase.auth.getUser();

    // Note: getUser() may return null user if no session exists, which is fine for connection test
    if (configError) {
      throw configError;
    }

    // Test database access
    const { data: dbData, error: dbError } = await supabase
      .from('users')
      .select('count')
      .limit(1)
      .single();

    // Ignore "no rows returned" error, but fail on anything else
    if (dbError && dbError.code !== 'PGRST116') {
      throw dbError;
    }

    logger.info('Supabase Connected successfully');
    logger.debug('Connection test result:', { user: userData?.user?.id || 'no session', dbTest: dbData });
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Error connecting to Supabase:', error.message);
      if ('code' in error) {
        logger.error('Error code:', (error as any).code);
      }
    } else {
      logger.error('Unknown error connecting to Supabase:', error);
    }

    // In production, we log the error but don't necessarily crash immediately
    // to allow health checks to function. However, the app will be degraded.
    if (!isDev) {
      logger.warn('Production server running in degraded state (Database disconnected)');
    }
  }
};

// Export supabase client for use in other files
export { supabase };
