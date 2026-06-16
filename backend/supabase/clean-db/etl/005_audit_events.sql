-- Clean DB ETL: normalize fragmented audit logs into audit_events.

BEGIN;

INSERT INTO public.audit_events (branch_id, actor_id, module, action, entity_type, entity_id, old_data, new_data, reason, severity, created_at)
SELECT
  NULLIF(al.branch_id::text, '')::integer,
  NULLIF(al.user_id::text, '')::uuid,
  COALESCE(NULLIF(al.module::text, ''), 'legacy'),
  COALESCE(NULLIF(al.action::text, ''), NULLIF(al.operation::text, ''), 'legacy_event'),
  COALESCE(NULLIF(al.table_name::text, ''), NULLIF(al.entity_type::text, ''), 'legacy_record'),
  CASE WHEN al.record_id::text ~* '^[0-9a-f-]{36}$' THEN al.record_id::uuid ELSE NULL END,
  CASE WHEN al.old_values IS NULL THEN NULL ELSE al.old_values::jsonb END,
  CASE WHEN al.new_values IS NULL THEN NULL ELSE al.new_values::jsonb END,
  NULLIF(al.reason::text, ''),
  'info',
  COALESCE(al.created_at::timestamptz, al.timestamp::timestamptz, NOW())
FROM legacy_import.audit_logs al
WHERE al.id IS NOT NULL;

INSERT INTO public.audit_events (branch_id, actor_id, module, action, entity_type, entity_id, old_data, new_data, reason, severity, created_at)
SELECT
  NULLIF(i.branch_id::text, '')::integer,
  NULLIF(i.actor_id::text, '')::uuid,
  'inventory',
  COALESCE(NULLIF(i.action::text, ''), 'inventory_event'),
  COALESCE(NULLIF(i.entity_type::text, ''), 'inventory_record'),
  CASE WHEN i.entity_id::text ~* '^[0-9a-f-]{36}$' THEN i.entity_id::uuid ELSE NULL END,
  CASE WHEN i.before_value IS NULL THEN NULL ELSE i.before_value::jsonb END,
  CASE WHEN i.after_value IS NULL THEN NULL ELSE i.after_value::jsonb END,
  NULLIF(i.reason::text, ''),
  CASE WHEN lower(i.severity::text) IN ('info', 'warning', 'critical') THEN lower(i.severity::text) ELSE 'info' END,
  COALESCE(i.created_at::timestamptz, NOW())
FROM legacy_import.inventory_audit_logs i
WHERE i.id IS NOT NULL;

INSERT INTO public.audit_events (branch_id, actor_id, module, action, entity_type, entity_id, old_data, new_data, reason, severity, created_at)
SELECT
  NULLIF(f.branch_id::text, '')::integer,
  NULLIF(f.actor_id::text, '')::uuid,
  'finance',
  COALESCE(NULLIF(f.action_type::text, ''), NULLIF(f.action::text, ''), 'finance_event'),
  COALESCE(NULLIF(f.entity_type::text, ''), 'finance_record'),
  CASE WHEN f.entity_id::text ~* '^[0-9a-f-]{36}$' THEN f.entity_id::uuid ELSE NULL END,
  CASE WHEN f.old_data IS NULL THEN NULL ELSE f.old_data::jsonb END,
  CASE WHEN f.new_data IS NULL THEN NULL ELSE f.new_data::jsonb END,
  NULLIF(f.reason::text, ''),
  'info',
  COALESCE(f.created_at::timestamptz, NOW())
FROM legacy_import.financial_audit_logs f
WHERE f.id IS NOT NULL;

COMMIT;

