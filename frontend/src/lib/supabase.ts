import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://utsvlihpudfraxzcmtle.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MTYzMzIsImV4cCI6MjA3OTQ5MjMzMn0.wPONqSZvgQQyrssA4wTbBfaUJO5HrV_XtA2AD7PaweA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
