-- Enables Supabase Realtime (Postgres logical replication publication) on
-- the notifications table, so RealtimeService.watchNotifications() in the
-- Flutter app receives INSERT events live instead of only ever seeing
-- notifications via polling GET /notifications. Idempotent — ALTER
-- PUBLICATION ... ADD TABLE has no IF NOT EXISTS form, so this guards the
-- add with an explicit membership check (safe to re-run this migration).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- Full row (not just changed columns) on UPDATE, matching how this app
-- already configures the other realtime-enabled tables (see
-- lib/core/realtime/realtime_channel_keys.dart's tracked tables) — mostly
-- relevant for a future "mark read" realtime consumer, INSERT already
-- carries the full row regardless of this setting.
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
