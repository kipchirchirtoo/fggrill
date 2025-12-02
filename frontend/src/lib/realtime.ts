import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;

export function subscribeToReceptionRealtime(onChange: (source: 'rooms' | 'reservations', payload: any) => void) {
  if (!supabase) {
    // No client configured; return noop unsubscribe
    return () => {};
  }

  const channel = supabase
    .channel('reception-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, (payload) => {
      onChange('rooms', payload);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, (payload) => {
      onChange('reservations', payload);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
