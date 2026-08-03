import { supabase } from '../config/supabase';
import db from '../db';

export function todayInBranchTimezone(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });
}

export async function getActiveShiftMode(branchId: number, businessDate?: string): Promise<'SINGLE_SHIFT' | 'TWO_SHIFT' | null> {
  const targetDate = businessDate || todayInBranchTimezone();
  
  try {
    const { data, error } = await supabase
      .from('branch_shift_config')
      .select('shift_mode')
      .eq('branch_id', branchId)
      .lte('effective_from_business_date', targetDate)
      .order('effective_from_business_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.shift_mode) {
      return data.shift_mode as 'SINGLE_SHIFT' | 'TWO_SHIFT';
    }

    if (!error) {
      const { data: latestConfig } = await supabase
        .from('branch_shift_config')
        .select('shift_mode')
        .eq('branch_id', branchId)
        .order('effective_from_business_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestConfig?.shift_mode) {
        return latestConfig.shift_mode as 'SINGLE_SHIFT' | 'TWO_SHIFT';
      }
    }
  } catch (supabaseErr) {
    // Fall back to direct PostgreSQL query below
  }

  // Direct PostgreSQL Pool Fallback
  try {
    const pgRes = await db.query(
      'SELECT shift_mode FROM branch_shift_config WHERE branch_id = $1 ORDER BY effective_from_business_date DESC LIMIT 1',
      [branchId]
    );
    if (pgRes.rows && pgRes.rows.length > 0 && pgRes.rows[0].shift_mode) {
      return pgRes.rows[0].shift_mode as 'SINGLE_SHIFT' | 'TWO_SHIFT';
    }
  } catch (pgErr) {
    // Database query error
  }

  return null;
}
