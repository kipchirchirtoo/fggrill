import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

const STATION_LABEL: Record<string, string> = {
  restaurant: 'Restaurant',
  bar: 'Bar',
  executive_bar: 'Executive Bar',
  main_bar: 'Main Bar',
  sports_bar: 'Sports Bar',
  non_consumables: 'Non-Consumables',
};

// Roles allowed to place orders even when no station shift is open
// (managers / admins — waiters and cashiers are still gated).
const BYPASS_ROLES = new Set([
  'super_admin',
  'general_manager',
  'branch_manager',
  'director',
  'gm',
]);

/**
 * Normalizes a free-form station label into a canonical pos_outlets.outlet_type.
 * e.g. 'Executive Bar' / 'EXEC_BAR' -> 'executive_bar', 'Main Bar' -> 'main_bar'.
 */
export function normalizeBarStation(value: unknown): string | null {
  const v = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!v) return null;
  if (v.includes('exec')) return 'executive_bar';
  if (v.includes('sport')) return 'sports_bar';
  if (v.includes('main')) return 'main_bar';
  if (v === 'bar' || v.endsWith('_bar') || v.includes('bar')) return v;
  return null;
}

interface StationShiftGuard {
  branchId: number | string | null | undefined;
  role?: string | null;
  /** Human label for the station (defaults from STATION_LABEL). */
  label?: string;
  /** Exact outlet_type match (e.g. ['restaurant']). */
  types?: string[];
  /** Pattern match for outlet_type (e.g. '%bar%' for any bar station). */
  like?: string;
}

/**
 * Enforces that the POS station handling these orders has an OPEN cashier
 * shift before a waiter can place an order. If the branch does not run the
 * station-POS system (no matching outlet) the guard is a no-op, so branches
 * that don't use stations are never blocked.
 */
export async function assertStationShiftOpen(opts: StationShiftGuard): Promise<void> {
  const { branchId, role, types, like } = opts;
  if (!branchId) return; // Cannot resolve a station — don't block.
  if (role && BYPASS_ROLES.has(String(role).toLowerCase())) return;

  let outletQuery = supabase
    .from('pos_outlets')
    .select('id, outlet_type')
    .eq('branch_id', branchId);
  if (types && types.length) outletQuery = outletQuery.in('outlet_type', types);
  if (like) outletQuery = outletQuery.ilike('outlet_type', like);

  const { data: outlets } = await outletQuery;
  if (!outlets || outlets.length === 0) return; // Branch not using station POS.

  const outletIds = outlets.map((o: any) => o.id);
  const { data: openShift } = await supabase
    .from('pos_outlet_shifts')
    .select('id')
    .in('outlet_id', outletIds)
    .eq('status', 'open')
    .limit(1)
    .maybeSingle();

  if (!openShift) {
    const label = opts.label
      || STATION_LABEL[(types && types[0]) || '']
      || (like ? like.replace(/%/g, '') : 'station');
    throw new AppError(
      `The ${label} cashier has not opened a shift. Orders cannot be placed at this station until the cashier opens their shift.`,
      409
    );
  }
}
