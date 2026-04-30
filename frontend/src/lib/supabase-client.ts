import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});

/**
 * Set Supabase session from user data
 * This allows RLS policies to work correctly
 */
export async function setSupabaseAuth(userId: string, email: string) {
  try {
    // For now, we'll use the anon key which should work with our permissive RLS policies
    // In production, you'd want to implement proper Supabase auth
    return true;
  } catch (error) {
    console.error('Error setting Supabase auth:', error);
    return false;
  }
}

/**
 * Upload file to Supabase Storage
 */
export async function uploadFile(file: File, userId: string) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${userId}/${fileName}`;

  const { data, error } = await supabase.storage
    .from('communications')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('Upload error details:', error);
    throw error;
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('communications')
    .getPublicUrl(filePath);

  return {
    path: data.path,
    url: publicUrl,
    name: file.name,
    size: file.size,
    type: file.type
  };
}

/**
 * Delete file from Supabase Storage
 */
export async function deleteFile(filePath: string) {
  const { error } = await supabase.storage
    .from('communications')
    .remove([filePath]);

  if (error) {
    throw error;
  }

  return true;
}

/**
 * Subscribe to real-time channel messages
 */
export function subscribeToMessages(channelId: string, callback: (payload: any) => void) {
  const subscription = supabase
    .channel(`messages:${channelId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'channel_messages',
        filter: `channel_id=eq.${channelId}`
      },
      callback
    )
    .subscribe();

  return subscription;
}

/**
 * Subscribe to real-time message reactions
 */
export function subscribeToReactions(callback: (payload: any) => void) {
  const subscription = supabase
    .channel('reactions')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'message_reactions'
      },
      callback
    )
    .subscribe();

  return subscription;
}

/**
 * Subscribe to channel updates
 */
export function subscribeToChannels(callback: (payload: any) => void) {
  const subscription = supabase
    .channel('channels')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'communication_channels'
      },
      callback
    )
    .subscribe();

  return subscription;
}
