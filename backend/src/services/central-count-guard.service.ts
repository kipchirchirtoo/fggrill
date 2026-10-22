import { supabase } from '../config/database';
import { logger } from '../utils/logger';

/**
 * Central stock-count guard.
 *
 * Central Store stock is being reset by a physical count, and branch stock is being counted too. Until that count is
 * loaded, dispatch notes must not move any stock at their SOURCE, and old notes must not be confirmed at the
 * destination, because both would change numbers the count is about to replace.
 *
 * Two settings in system_config_values (key / jsonb value) drive it. Neither exists yet, so the guard starts ON:
 *   central_count_loaded_at   ISO timestamp, set when the Central and Kyogong counts have been loaded.
 *                             Absent / null = the count is not loaded: the guard is ON for every note.
 *   central_count_planned_at  ISO timestamp of the planned count (optional). Only used to place the 7-day window
 *                             before the count; when absent the window is the 7 days before now.
 *
 * Rules
 *   1. SOURCE: a dispatch note dated before the count is loaded never posts a source deduction. Notes dated after it
 *      deduct from Central as normal.
 *   2. DESTINATION, notes dated before the count:
 *        - destination = Kyogong (branch 1): cannot be confirmed (Kyogong's count covers it);
 *        - dated more than 7 days before the count: cannot be confirmed (they are closed as "superseded by stock
 *          take" after the count, with no stock effect on either side);
 *        - dated within the 7 days before the count: the receiving branch may confirm after physically checking the
 *          goods. Destination effect only (the confirm code never touches the source).
 */

export interface CountGuard {
  loadedAt: Date | null;
  plannedAt: Date | null;
}

const KEY_LOADED = 'central_count_loaded_at';
const KEY_PLANNED = 'central_count_planned_at';
const KYOGONG_BRANCH_ID = 1;
const WINDOW_DAYS = 7;
const CACHE_MS = 30_000;

let cached: { at: number; guard: CountGuard } | null = null;

const toDate = (value: unknown): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

export async function getCountGuard(): Promise<CountGuard> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.guard;
  try {
    const { data, error } = await supabase
      .from('system_config_values')
      .select('key, value')
      .in('key', [KEY_LOADED, KEY_PLANNED]);
    if (error) throw error;
    const byKey = new Map((data || []).map((row: any) => [row.key, row.value]));
    const guard: CountGuard = { loadedAt: toDate(byKey.get(KEY_LOADED)), plannedAt: toDate(byKey.get(KEY_PLANNED)) };
    cached = { at: Date.now(), guard };
    return guard;
  } catch (error: any) {
    // Fail closed: if the setting cannot be read, behave as "count not loaded yet".
    logger.warn('Central count guard: could not read settings, guard stays ON', { message: error?.message });
    return { loadedAt: null, plannedAt: null };
  }
}

/** Rule 1: may this note post a deduction at its source? */
export function sourceDeductionAllowed(noteCreatedAt: string | Date | null | undefined, guard: CountGuard): boolean {
  const created = toDate(noteCreatedAt);
  if (!guard.loadedAt || !created) return false;
  return created.getTime() >= guard.loadedAt.getTime();
}

/** Rule 2: may the destination confirm this note? */
export function destinationConfirmDecision(
  note: { created_at?: string | Date | null; to_branch_id?: number | string | null; dispatch_number?: string | null },
  guard: CountGuard,
): { allowed: boolean; reason?: string } {
  const created = toDate(note.created_at);
  if (guard.loadedAt && created && created.getTime() >= guard.loadedAt.getTime()) return { allowed: true };

  const label = note.dispatch_number ? `Dispatch ${note.dispatch_number}` : 'This dispatch note';
  if (Number(note.to_branch_id) === KYOGONG_BRANCH_ID) {
    return {
      allowed: false,
      reason: `${label} is dated before the stock count and goes to Kyogong. Kyogong's physical count covers it, so it cannot be confirmed.`,
    };
  }
  const reference = guard.loadedAt || guard.plannedAt || new Date();
  const windowStart = reference.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  if (created && created.getTime() < windowStart) {
    return {
      allowed: false,
      reason: `${label} is dated more than ${WINDOW_DAYS} days before the stock count. It will be closed as "superseded by stock take" and cannot be confirmed.`,
    };
  }
  return { allowed: true };
}

export const countGuardTestHooks = { reset: () => { cached = null; } };
