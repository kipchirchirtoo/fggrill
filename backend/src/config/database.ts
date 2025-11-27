import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

// Check required environment variables
const requiredEnvVars = [
  'SUPABASE_PROJECT_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_JWT_SECRET'
];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    logger.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export const connectDB = async (): Promise<void> => {
  const isDev = process.env.NODE_ENV !== 'production';

  try {
    // Test the connection by checking auth status
    const { data: sessionData, error: configError } = await supabase.auth.getSession();
    
    if (configError) {
      throw configError;
    }

    // Test database access
    const { data: dbData, error: dbError } = await supabase
      .from('users')
      .select('count')
      .limit(1)
      .single();

    // Ignore "no rows returned" error, but fail on anything else in non-dev
    if (dbError && dbError.code !== 'PGRST116') {
      throw dbError;
    }

    logger.info('Supabase Connected');
    logger.debug('Connection test result:', { session: sessionData, dbTest: dbData });
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Error connecting to Supabase:', error.message);
      if ('code' in error) {
        logger.error('Error code:', (error as any).code);
      }
    } else {
      logger.error('Unknown error connecting to Supabase:', error);
    }

    // In development, do NOT crash the app – just log and continue
    if (isDev) {
      logger.warn('Continuing without verified Supabase connection in development mode');
      return;
    }

    // In non-dev environments, propagate the error so the app can fail fast
    throw error;
  }
};

// Export supabase client for use in other files
export { supabase };
