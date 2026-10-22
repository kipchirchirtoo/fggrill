import { supabase } from '../config/database';
import { logger } from '../utils/logger';

/**
 * Central stock-count guard.
 *
 * Central Store stock is reset by a physical count, and branch stock is counted too. From the count date on, dispatch
 * notes created BEFORE the count must not move stock at their source, and the old ones must not be confirmed at the
 * destination, because both would change numbers the count replaces.
 *
 * ONE setting drives it, in system_config_values (key / jsonb value):
 *
 *     central_count_cutoff_at   ISO timestamp of the stock count (planned or loaded). Notes dated before it are
 *                               "pre-count" notes.
 *
 * THE GUARD DOES NOTHING UNTIL THAT SETTING EXISTS. Absent, empty or invalid = guard inactive: dispatch and confirm
 * behave exactly as before. Set it (SQL or the config screen) on the day you decide; clear it to switch the guard off.
 *
 * Rules once the cutoff C is set
 *   SOURCE   A note dated before C never posts a source deduction (Central is reset by the count). Notes dated on or
 *            after C deduct from Central as normal.
 *   CONFIRM  For a note dated before C:
 *              - going to Kyogong (branch 1): refused. Kyogong's physical count covers it.
 *              - dated more than 7 days before C: refused. After the count it is closed as "superseded by stock take".
 *              - dated within the 7 days before C: another branch may confirm it after physically checking the goods.
 *                Destination effect only (the confirm code never touches the source).
 *            Notes dated on or after C are confirmed normally.
 *   Every refusal is logged (application log + a row in audit_logs) and the refusal message tells the staff member why.
 */

export interface CountGuard {
  cutoff: Date | null;
}

export const COUNT_CUTOFF_KEY = 'central_count_cutoff_at';
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
      .eq('key', COUNT_CUTOFF_KEY)
      .maybeSingle();
    if (error) throw error;
    const guard: CountGuard = { cutoff: toDate(data?.value) };
    cached = { at: Date.now(), guard };
    return guard;
  } catch (error: any) {
    // The guard is opt-in, so a read failure must not stop dispatching: keep the last value we knew, else inactive.
    logger.warn('Central count guard: could not read the cutoff setting; using the last known value', { message: error?.message });
    return cached ? cached.guard : { cutoff: null };
  }
}

/** SOURCE rule: may this note post a deduction at its source? */
export function sourceDeductionAllowed(noteCreatedAt: string | Date | null | undefined, guard: CountGuard): boolean {
  if (!guard.cutoff) return true; // guard inactive
  const created = toDate(noteCreatedAt);
  if (!created) return false; // cannot place the note in time: do not deduct
  return created.getTime() >= guard.cutoff.getTime();
}

export type ConfirmDecision = { allowed: true } | { allowed: false; rule: 'kyogong' | 'older_than_window'; reason: string };

/** CONFIRM rule: may the destination confirm this note? The reason is written for staff. */
export function destinationConfirmDecision(
  note: { created_at?: string | Date | null; to_branch_id?: number | string | null; dispatch_number?: string | null },
  guard: CountGuard,
): ConfirmDecision {
  if (!guard.cutoff) return { allowed: true }; // guard inactive
  const created = toDate(note.created_at);
  if (!created) return { allowed: true }; // no date to judge by: leave it to the normal checks
  if (created.getTime() >= guard.cutoff.getTime()) return { allowed: true };

  const label = note.dispatch_number ? `Dispatch ${note.dispatch_number}` : 'This dispatch note';
  const countDay = guard.cutoff.toISOString().slice(0, 10);
  if (Number(note.to_branch_id) === KYOGONG_BRANCH_ID) {
    return {
      allowed: false,
      rule: 'kyogong',
      reason:
        `${label} cannot be confirmed. It was created before the stock count (${countDay}) and is going to Kyogong, ` +
        `and Kyogong's physical stock count already covers this delivery. Do not receive it in the system. ` +
        `If goods really arrived and are not on your count sheet, tell your branch accountant.`,
    };
  }
  const windowStart = guard.cutoff.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  if (created.getTime() < windowStart) {
    return {
      allowed: false,
      rule: 'older_than_window',
      reason:
        `${label} cannot be confirmed. It is more than ${WINDOW_DAYS} days older than the stock count (${countDay}). ` +
        `It will be closed as "superseded by stock take" and has no effect on stock. ` +
        `If goods really arrived and are not on your count sheet, tell your branch accountant.`,
    };
  }
  return { allowed: true };
}

/** Every refused confirmation is logged: application log + audit_logs (best effort, never blocks the refusal). */
export async function logConfirmRefusal(input: {
  dispatchId: string;
  dispatchNumber?: string | null;
  toBranchId?: number | string | null;
  noteCreatedAt?: string | Date | null;
  userId?: string | null;
  rule: string;
  reason: string;
  cutoff: Date | null;
}): Promise<void> {
  const details = {
    dispatch_id: input.dispatchId,
    dispatch_number: input.dispatchNumber || null,
    to_branch_id: input.toBranchId ?? null,
    note_created_at: input.noteCreatedAt ? new Date(input.noteCreatedAt as any).toISOString() : null,
    cutoff: input.cutoff ? input.cutoff.toISOString() : null,
    rule: input.rule,
    user_id: input.userId || null,
  };
  logger.warn('Dispatch confirmation refused by the stock-count guard', { ...details, reason: input.reason });
  try {
    const { error } = await supabase.from('audit_logs').insert({
      user_id: input.userId || null,
      branch_id: input.toBranchId != null ? Number(input.toBranchId) : null,
      action: 'dispatch_confirm_refused_stock_count',
      table_name: 'dispatch_notes',
      record_id: input.dispatchId,
      metadata: { ...details, reason: input.reason },
      severity: 'warning',
    });
    if (error) throw error;
  } catch (error: any) {
    logger.error('Could not write the count-guard refusal to audit_logs', { message: error?.message, dispatch_id: input.dispatchId });
  }
}

export const countGuardTestHooks = { reset: () => { cached = null; } };
