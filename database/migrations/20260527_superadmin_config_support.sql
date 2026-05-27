-- SuperAdmin configuration support
-- Adds the template marker used by /api/reports/templates.

ALTER TABLE IF EXISTS public.reports
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_reports_is_template
  ON public.reports(is_template);
