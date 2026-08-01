type SupabaseLike = {
  from: (table: string) => any;
};

export type PosOutlet = {
  id?: string;
  outlet_type?: string | null;
  branch_id?: number | string | null;
  name?: string | null;
};

const KYOGONG_BRANCH_ID = 1;
const KYOGONG_RESTAURANT_RECEPTION_ROLES = new Set([
  'receptionist',
  'branch_receptionist',
  'front_desk_supervisor',
]);

export const POS_STATION_CASHIER_ROLE_TYPES: Record<string, string[]> = {
  choma_zone_cashier: ['choma_zone'],
  restaurant_cashier: ['restaurant', 'choma_zone', 'non_consumables'],
  main_bar_cashier: ['main_bar', 'kyogong_sports_bar'],
  executive_bar_cashier: ['executive_bar', 'kyogong_executive_bar'],
  non_consumables_cashier: ['non_consumables'],
  kyogong_reception_cashier: ['cashier', 'kyogong_reception'],
  kyogong_spa_cashier: ['kyogong_spa'],
  kyogong_executive_bar_cashier: ['executive_bar', 'kyogong_executive_bar'],
  kyogong_sports_bar_cashier: ['main_bar', 'kyogong_sports_bar'],
};

const EXPLICIT_ASSIGNMENT_CASHIER_ROLES = new Set([
  'cashier',
  ...Object.keys(POS_STATION_CASHIER_ROLE_TYPES)
]);

/**
 * Canonical, branch-agnostic list of every cashier-station role in the system.
 *
 * This is the SINGLE source of truth for "who is a cashier." To onboard a new
 * branch or a new cashier variant, add it to POS_STATION_CASHIER_ROLE_TYPES
 * above — it then flows automatically into POS station access, petty-cash /
 * expenses authorization, and anywhere else that reads this list. Never
 * re-list cashier roles inline in a route file; import this instead so the
 * 10-branch (and growing) estate stays in sync.
 */
export const CASHIER_STATION_ROLES: string[] = Array.from(
  EXPLICIT_ASSIGNMENT_CASHIER_ROLES
);

export const normalizePosRole = (role: unknown): string =>
  String(role || '').trim().toLowerCase();

const normalizeBranchId = (branchId: unknown): number | null => {
  const parsed = Number(branchId);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const resolveCashierStationRole = (
  role: unknown,
  branchId?: unknown
): string => {
  const normalizedRole = normalizePosRole(role);
  if (
    normalizeBranchId(branchId) === KYOGONG_BRANCH_ID &&
    KYOGONG_RESTAURANT_RECEPTION_ROLES.has(normalizedRole)
  ) {
    return 'restaurant_cashier';
  }
  return normalizedRole;
};

export const stationTypesForCashierRole = (
  role: unknown,
  branchId?: unknown
): string[] => POS_STATION_CASHIER_ROLE_TYPES[
  resolveCashierStationRole(role, branchId)
] || [];

export const isCashierStationRole = (
  role: unknown,
  branchId?: unknown
): boolean =>
  EXPLICIT_ASSIGNMENT_CASHIER_ROLES.has(
    resolveCashierStationRole(role, branchId)
  );

export const isBarStationType = (outletType: unknown): boolean =>
  ['main_bar', 'executive_bar', 'kyogong_executive_bar', 'kyogong_sports_bar']
    .includes(String(outletType || '').toLowerCase());

export const shouldRestrictCashierStationAccess = (
  role: unknown,
  assignedOutletIds: string[],
  branchId?: unknown
): boolean => {
  const normalizedRole = resolveCashierStationRole(role, branchId);
  if (!isCashierStationRole(normalizedRole)) return false;
  if (stationTypesForCashierRole(normalizedRole, branchId).length > 0) return true;
  return assignedOutletIds.length > 0;
};

export const canAccessPosOutlet = (
  role: unknown,
  outlet: PosOutlet | null | undefined,
  assignedOutlets: PosOutlet[],
  branchId?: unknown
): boolean => {
  if (!outlet?.id) return false;
  const assignedOutletIds = assignedOutlets
    .map((item) => String(item.id || ''))
    .filter(Boolean);
  const effectiveBranchId =
    branchId ?? outlet.branch_id ?? assignedOutlets[0]?.branch_id;
  if (!shouldRestrictCashierStationAccess(role, assignedOutletIds, effectiveBranchId)) {
    return true;
  }
  if (assignedOutletIds.includes(String(outlet.id))) return true;
  return stationTypesForCashierRole(role, effectiveBranchId).includes(
    String(outlet.outlet_type || '').toLowerCase()
  );
};

export const loadAssignedPosOutlets = async (
  supabase: SupabaseLike,
  userId: string | undefined
): Promise<PosOutlet[]> => {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from('pos_outlet_assignments')
      .select('outlet:pos_outlets(id, outlet_type, branch_id, name)')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) throw error;
    return ((data || []) as Array<Record<string, any>>)
      .map((row) => Array.isArray(row.outlet) ? row.outlet[0] : row.outlet)
      .filter(Boolean) as PosOutlet[];
  } catch (error: any) {
    if (['42P01', '42703', 'PGRST200', 'PGRST204', 'PGRST205'].includes(error?.code)) {
      return [];
    }
    throw error;
  }
};

export const assignedOutletIds = (assignedOutlets: PosOutlet[]): string[] =>
  assignedOutlets.map((item) => String(item.id || '')).filter(Boolean);

/**
 * "What was sold" on a stocktake (kitchen, bar, etc.) must be scoped to the
 * most recently CLOSED cashier shift (cashier_shift_logs — the real, gated
 * shift system) for whichever cashier role mans that station, not the
 * calendar day. A storekeeper often counts stock before today's shift has
 * even closed, so scoping to "today so far" reads as zero sales even when a
 * full shift's worth was sold yesterday and never reconciled. Falls back to
 * the calendar day only if no closed shift exists yet at all.
 */
export const getLastClosedCashierShiftWindow = async (
  supabase: SupabaseLike,
  branchId: number,
  cashierRoles: string[],
  stocktakeDate: string
): Promise<{ from: string; to: string; shiftId: string | null }> => {
  const dayStart = `${stocktakeDate}T00:00:00.000Z`;
  const dayEnd = new Date(new Date(dayStart).getTime() + 86400000).toISOString();
  try {
    if (cashierRoles.length === 0) return { from: dayStart, to: dayEnd, shiftId: null };

    const { data: cashiers } = await supabase
      .from('users')
      .select('id')
      .eq('branch_id', branchId)
      .in('role', cashierRoles);
    const cashierIds = ((cashiers || []) as Array<{ id: string }>).map((c) => c.id);
    if (cashierIds.length === 0) return { from: dayStart, to: dayEnd, shiftId: null };

    const { data: shift } = await supabase
      .from('cashier_shift_logs')
      .select('id, shift_start, shift_end')
      .eq('branch_id', branchId)
      .in('cashier_id', cashierIds)
      .eq('status', 'closed')
      .lt('shift_end', dayEnd)
      .order('shift_end', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!shift) return { from: dayStart, to: dayEnd, shiftId: null };

    return { from: shift.shift_start, to: shift.shift_end, shiftId: shift.id };
  } catch {
    return { from: dayStart, to: dayEnd, shiftId: null };
  }
};

export const stationDisplayName = (outletType: unknown): string => {
  switch (String(outletType || '').toLowerCase()) {
    case 'restaurant':
      return 'Restaurant';
    case 'main_bar':
      return 'Main Bar';
    case 'executive_bar':
    case 'kyogong_executive_bar':
      return 'Executive Bar';
    case 'kyogong_sports_bar':
      return 'Sports Bar';
    case 'non_consumables':
      return 'Non-consumables';
    case 'cashier':
    case 'kyogong_reception':
      return 'Reception Cashier';
    case 'kyogong_spa':
      return 'Kyogong Spa';
    case 'choma_zone':
      return 'Choma Zone';
    default:
      return 'POS Station';
  }
};
