-- Migration: Fix user foreign key constraints to prevent deletion block errors
-- Description: When deleting a user, restrictive foreign keys (like room_status_history_changed_by_fkey) block user deletion.
-- Changing foreign keys to ON DELETE SET NULL allows user deletion to proceed while keeping history records intact.

ALTER TABLE IF EXISTS public.room_status_history ALTER COLUMN changed_by DROP NOT NULL;
ALTER TABLE IF EXISTS public.room_status_history DROP CONSTRAINT IF EXISTS room_status_history_changed_by_fkey;
ALTER TABLE IF EXISTS public.room_status_history 
  ADD CONSTRAINT room_status_history_changed_by_fkey 
  FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.hk_room_status_history ALTER COLUMN changed_by DROP NOT NULL;
ALTER TABLE IF EXISTS public.hk_room_status_history DROP CONSTRAINT IF EXISTS hk_room_status_history_changed_by_fkey;
ALTER TABLE IF EXISTS public.hk_room_status_history 
  ADD CONSTRAINT hk_room_status_history_changed_by_fkey 
  FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL;
