import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.SUPABASE_PROJECT_URL && !process.env.SUPABASE_URL) {
  throw new Error('Missing Supabase URL: set SUPABASE_PROJECT_URL or SUPABASE_URL');
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

const supabaseUrl = (process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL)!;

/**
 * Admin Supabase client with service role key
 * - Bypasses Row Level Security (RLS)
 * - Used for admin operations, storage management, and system tasks
 * - DO NOT expose to client-side code
 */
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export default supabaseAdmin;
