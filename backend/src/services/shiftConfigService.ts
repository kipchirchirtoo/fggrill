import { supabase } from '../config/supabase';
import db from '../db';

export function todayInBranchTimezone(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });
}

export async function getActiveShiftMode(branchId: number, businessDate?: string): Promise<'SINGLE_SHIFT' | 'TWO_SHIFT'> {
  return 'SINGLE_SHIFT';
}
