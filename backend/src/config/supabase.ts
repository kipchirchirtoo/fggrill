import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Validation with descriptive errors
if (!supabaseUrl || supabaseUrl === 'undefined' || supabaseUrl === 'null') {
  const errorMsg = 'CRITICAL: Supabase URL is missing. Set SUPABASE_PROJECT_URL or SUPABASE_URL in environment.';
  console.error(errorMsg);
  // In production, we might want to exit, but during module load it's better to throw
  // to be caught by the server's uncaughtException handler
  throw new Error(errorMsg);
}

if (!supabaseServiceKey || supabaseServiceKey === 'undefined' || supabaseServiceKey === 'null') {
  const errorMsg = 'CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing from environment.';
  console.error(errorMsg);
  throw new Error(errorMsg);
}

// Shared fetch wrapper: add a 60-second timeout so slow network requests
// fail gracefully while giving cloud deployments enough time for batch operations.
const fetchWithTimeout: typeof fetch = (input, init) => {
  const timeoutMs = Number(process.env.SUPABASE_FETCH_TIMEOUT_MS) || 60_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const initSignal = init?.signal;
  if (initSignal) {
    if (initSignal.aborted) {
      controller.abort();
    } else {
      initSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
};

// Service role client — for all DB operations (bypasses RLS)
export const supabase = createClient(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: { fetch: fetchWithTimeout }
  }
);

// Anon client — only for signInWithPassword (must use anon key, not service role)
// If anon key is missing, this might still be needed for some public operations, 
// but we should warn if it's completely empty as createClient will throw.
export const supabaseAuth = createClient(
  supabaseUrl,
  supabaseAnonKey || 'missing-anon-key', 
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: { fetch: fetchWithTimeout }
  }
);
