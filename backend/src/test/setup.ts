import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

// Create test client
const supabase = createClient(
  process.env.SUPABASE_TEST_URL || '',
  process.env.SUPABASE_TEST_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

beforeAll(async () => {
  try {
    // SECURITY FIX: Use getUser() instead of getSession() to prevent client-side spoofing
    // Test connection by verifying auth configuration
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    logger.info('Connected to test Supabase instance');
  } catch (error) {
    logger.error('Error setting up test database:', error);
    throw error;
  }
});

afterEach(async () => {
  try {
    // Clear all tables after each test
    const tables = ['users', 'bookings', 'rooms', 'inventory_items', 'maintenance_tasks', 'reports'];
    for (const table of tables) {
      const { error } = await supabase.from(table).delete();
      if (error) throw error;
    }
  } catch (error) {
    logger.error('Error clearing test data:', error);
    throw error;
  }
});

afterAll(async () => {
  // No need to close connection with Supabase
  logger.info('Test cleanup completed');
});

export { supabase };
