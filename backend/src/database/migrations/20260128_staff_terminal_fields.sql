-- Add terminal fields to users and staff_profiles
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pos_pin TEXT;
ALTER TABLE public.staff_profiles ADD COLUMN IF NOT EXISTS national_id TEXT;

-- Update users.pos_pin to treat it as a string for PINs (handling leading zeros)
-- Note: It might already be TEXT, but ensuring consistency here.

-- Add index for Staff ID lookup
CREATE INDEX IF NOT EXISTS idx_staff_profiles_id_number ON public.staff_profiles(id_number);
