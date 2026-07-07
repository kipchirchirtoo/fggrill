import { supabase } from '../config/supabase';

export function todayInBranchTimezone(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });
}

export async function getActiveShiftMode(branchId: number, businessDate?: string): Promise<'SINGLE_SHIFT' | 'TWO_SHIFT' | null> {
  const targetDate = businessDate || todayInBranchTimezone();
  
  const { data, error } = await supabase
    .from('branch_shift_config')
    .select('shift_mode')
    .eq('branch_id', branchId)
    .lte('effective_from_business_date', targetDate)
    .order('effective_from_business_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null; // hard block fallback
  }

  return data.shift_mode as 'SINGLE_SHIFT' | 'TWO_SHIFT';
}
