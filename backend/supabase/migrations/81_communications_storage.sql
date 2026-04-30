-- Communications File Storage
-- Create storage bucket for message attachments

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'communications',
  'communications',
  true,
  10485760, -- 10MB limit
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
DROP POLICY IF EXISTS "communications_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "communications_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "communications_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "communications_delete_policy" ON storage.objects;

-- Storage policies for communications bucket
-- Allow authenticated users to upload files
CREATE POLICY "communications_insert_policy"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'communications');

-- Allow authenticated users to view all files
CREATE POLICY "communications_select_policy"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'communications');

-- Allow users to update files
CREATE POLICY "communications_update_policy"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'communications')
WITH CHECK (bucket_id = 'communications');

-- Allow users to delete files
CREATE POLICY "communications_delete_policy"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'communications');

-- Enable realtime for communications tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.communication_channels;

-- Function to notify new messages
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'new_message',
    json_build_object(
      'channel_id', NEW.channel_id,
      'message_id', NEW.id,
      'user_id', NEW.user_id
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for new messages
DROP TRIGGER IF EXISTS on_new_message ON public.channel_messages;
CREATE TRIGGER on_new_message
  AFTER INSERT ON public.channel_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_message();

-- Add file metadata columns if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'channel_messages' 
                 AND column_name = 'file_size') THEN
    ALTER TABLE public.channel_messages ADD COLUMN file_size BIGINT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'channel_messages' 
                 AND column_name = 'file_mime_type') THEN
    ALTER TABLE public.channel_messages ADD COLUMN file_mime_type VARCHAR(100);
  END IF;
END $$;
