-- Add missing profile fields to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS shift TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS emergency_contact JSONB;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Add constraints if needed
-- ALTER TABLE public.users ADD CONSTRAINT status_check CHECK (status IN ('active', 'inactive', 'suspended'));
