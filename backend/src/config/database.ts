import { supabase } from './supabase';
import { logger } from '../utils/logger';


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
