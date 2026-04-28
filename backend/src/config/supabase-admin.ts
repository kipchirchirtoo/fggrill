import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || supabaseUrl === 'undefined' || supabaseUrl === 'null') {
  const errorMsg = 'CRITICAL: Supabase URL is missing (Admin Client). Set SUPABASE_PROJECT_URL or SUPABASE_URL in environment.';
  console.error(errorMsg);
  throw new Error(errorMsg);
}

if (!supabaseServiceKey || supabaseServiceKey === 'undefined' || supabaseServiceKey === 'null') {
  const errorMsg = 'CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing (Admin Client).';
  console.error(errorMsg);
  throw new Error(errorMsg);
}

/**
 * Admin Supabase client with service role key
 * - Bypasses Row Level Security (RLS)
 * - Used for admin operations, storage management, and system tasks
 * - DO NOT expose to client-side code
 */
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export default supabaseAdmin;
