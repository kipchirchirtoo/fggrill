BEGIN;

ALTER TABLE public.channel_food_standards
  ADD COLUMN IF NOT EXISTS package_name VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_channel_food_standards_branch_channel_package
  ON public.channel_food_standards(branch_id, channel, package_name);

COMMIT;
