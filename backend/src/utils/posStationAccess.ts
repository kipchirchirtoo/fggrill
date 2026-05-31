type SupabaseLike = {
  from: (table: string) => any;
};

export type PosOutlet = {
  id?: string;
  outlet_type?: string | null;
  branch_id?: number | string | null;
  name?: string | null;
};

export const POS_STATION_CASHIER_ROLE_TYPES: Record<string, string[]> = {
  restaurant_cashier: ['restaurant'],
  main_bar_cashier: ['main_bar', 'kyogong_sports_bar'],
  executive_bar_cashier: ['executive_bar', 'kyogong_executive_bar'],
  non_consumables_cashier: ['non_consumables'],
  kyogong_reception_cashier: ['cashier', 'kyogong_reception'],
  kyogong_spa_cashier: ['kyogong_spa'],
  kyogong_executive_bar_cashier: ['executive_bar', 'kyogong_executive_bar'],
  kyogong_sports_bar_cashier: ['main_bar', 'kyogong_sports_bar']
};

const EXPLICIT_ASSIGNMENT_CASHIER_ROLES = new Set([
  'cashier',
  ...Object.keys(POS_STATION_CASHIER_ROLE_TYPES)
]);

export const normalizePosRole = (role: unknown): string =>
  String(role || '').trim().toLowerCase();

export const stationTypesForCashierRole = (role: unknown): string[] =>
  POS_STATION_CASHIER_ROLE_TYPES[normalizePosRole(role)] || [];

export const isCashierStationRole = (role: unknown): boolean =>
  EXPLICIT_ASSIGNMENT_CASHIER_ROLES.has(normalizePosRole(role));

export const isBarStationType = (outletType: unknown): boolean =>
  ['main_bar', 'executive_bar', 'kyogong_executive_bar', 'kyogong_sports_bar']
    .includes(String(outletType || '').toLowerCase());

export const shouldRestrictCashierStationAccess = (
  role: unknown,
  assignedOutletIds: string[]
): boolean => {
  const normalizedRole = normalizePosRole(role);
  if (!isCashierStationRole(normalizedRole)) return false;
  if (stationTypesForCashierRole(normalizedRole).length > 0) return true;
  return assignedOutletIds.length > 0;
};

export const canAccessPosOutlet = (
  role: unknown,
  outlet: PosOutlet | null | undefined,
  assignedOutlets: PosOutlet[]
): boolean => {
  if (!outlet?.id) return false;
  const assignedOutletIds = assignedOutlets
    .map((item) => String(item.id || ''))
    .filter(Boolean);
  if (!shouldRestrictCashierStationAccess(role, assignedOutletIds)) return true;
  if (assignedOutletIds.includes(String(outlet.id))) return true;
  return stationTypesForCashierRole(role).includes(String(outlet.outlet_type || '').toLowerCase());
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
    default:
      return 'POS Station';
  }
};
