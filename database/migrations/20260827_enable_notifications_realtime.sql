-- Enable Supabase Realtime for public.notifications so in-app notification
-- subscriptions can receive INSERT events reliably.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'notifications'
    ) THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
    END IF;
END $$;

ALTER TABLE IF EXISTS public.notifications REPLICA IDENTITY FULL;
