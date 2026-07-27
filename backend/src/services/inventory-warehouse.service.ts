import { supabase } from '../config/database';
import { logger } from '../utils/logger';

type UserLike = {
  id?: string;
  role?: string;
  branch_id?: number | null;
  branchId?: number | null;
  context_type?: 'branch' | 'warehouse' | string | null;
  warehouse_id?: string | null;
};

export type InventoryWarehouse = {
  id: string;
  code: string;
  name: string;
  operating_branch_id: number | null;
  is_active: boolean;
  metadata?: Record<string, any> | null;
};

export type UserInventoryContext = {
  role: string;
  role_name: string;
  context_type: 'branch' | 'warehouse';
  branch_id: number | null;
  branch_name: string | null;
  branch_code: string | null;
  warehouse_id: string | null;
  warehouse_name: string | null;
  warehouse_code: string | null;
  operating_branch_id: number | null;
  operating_branch_name: string | null;
  is_default: boolean;
  display_name: string;
};

type StoreContextResolution =
  | {
      scope: 'warehouse';
      warehouse: InventoryWarehouse;
      warehouseLocationId: string | null;
      operatingBranchId: number | null;
      branchId: number | null;
      displayName: string;
    }
  | {
      scope: 'branch';
      branchId: number | null;
      branchName: string | null;
      branchCode: string | null;
      branchLocationId: string | null;
      displayName: string;
    };

let schemaProbeComplete = false;
let warehouseSchemaAvailable = false;
const CENTRAL_WAREHOUSE_ROLES = new Set([
  'central_storekeeper',
  'central_operations_manager',
]);

function isCentralWarehouseRole(role?: string | null): boolean {
  return CENTRAL_WAREHOUSE_ROLES.has(String(role || '').trim().toLowerCase());
}

async function ensureWarehouseSchemaAvailability(): Promise<boolean> {
  if (schemaProbeComplete) return warehouseSchemaAvailable;

  try {
    const { error } = await supabase
      .from('inventory_warehouses')
      .select('id')
      .limit(1);

    if (error) {
      warehouseSchemaAvailable = false;
      logger.warn('Warehouse context schema probe failed; falling back to legacy central-store behavior', {
        message: error.message,
        code: error.code,
      });
    } else {
      warehouseSchemaAvailable = true;
    }
  } catch (error: any) {
    warehouseSchemaAvailable = false;
    logger.warn('Warehouse context schema probe threw an exception; falling back to legacy behavior', {
      message: error?.message || String(error),
    });
  }

  schemaProbeComplete = true;
  return warehouseSchemaAvailable;
}

async function getBranchesByIds(ids: number[]): Promise<Map<number, any>> {
  if (!ids.length) return new Map();

  const { data, error } = await supabase
    .from('branches')
    .select('id, name, code')
    .in('id', ids);

  if (error) throw error;
  return new Map((data || []).map((row: any) => [Number(row.id), row]));
}

async function getWarehousesByIds(ids: string[]): Promise<Map<string, InventoryWarehouse>> {
  if (!ids.length) return new Map();

  const { data, error } = await supabase
    .from('inventory_warehouses')
    .select('id, code, name, operating_branch_id, is_active, metadata')
    .in('id', ids);

  if (error) throw error;
  return new Map((data || []).map((row: any) => [String(row.id), row as InventoryWarehouse]));
}

function buildDisplayName(input: {
  contextType: 'branch' | 'warehouse';
  role: string;
  branchName?: string | null;
  warehouseName?: string | null;
  operatingBranchName?: string | null;
}): string {
  const normalizedRole = input.role
    .split('_')
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join(' ');

  if (input.contextType === 'warehouse') {
    const warehouseName = input.warehouseName || 'Central Store';
    const hostName = input.operatingBranchName ? `Hosted at ${input.operatingBranchName}` : 'Warehouse context';
    return `${normalizedRole} • ${warehouseName} • ${hostName}`;
  }

  return `${normalizedRole} • ${input.branchName || 'Branch'}`;
}

export async function getCentralWarehouseRecord(): Promise<InventoryWarehouse | null> {
  const hasWarehouseSchema = await ensureWarehouseSchemaAvailability();

  if (hasWarehouseSchema) {
    const { data, error } = await supabase
      .from('inventory_warehouses')
      .select('id, code, name, operating_branch_id, is_active, metadata')
      .eq('code', 'CENTRAL_STORE')
      .eq('is_active', true)
      .maybeSingle();

    if (!error && data) return data as InventoryWarehouse;
    if (error) {
      logger.warn('Failed to resolve central warehouse from inventory_warehouses; using legacy fallback', {
        message: error.message,
        code: error.code,
      });
    }
  }

  const { data: branch, error: branchError } = await supabase
    .from('branches')
    .select('id, code, name, is_central_warehouse')
    .or('code.eq.KYO,name.ilike.Kyogong,is_central_warehouse.eq.true')
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (branchError || !branch) return null;

  return {
    id: `legacy-branch-${branch.id}`,
    code: 'CENTRAL_STORE',
    name: 'Central Store',
    operating_branch_id: Number(branch.id),
    is_active: true,
    metadata: {
      legacy_branch_id: branch.id,
      legacy_mode: true,
    },
  };
}

export async function getUserInventoryContexts(
  userId: string,
  fallbackProfile?: { role?: string | null; branch_id?: number | null },
): Promise<UserInventoryContext[]> {
  const hasWarehouseSchema = await ensureWarehouseSchemaAvailability();
  const contexts: UserInventoryContext[] = [];
  let cachedCentralWarehouseContext:
    | { warehouse: InventoryWarehouse; operatingBranch: any | null }
    | null
    | undefined;

  const buildCentralWarehouseFallbackContext = async (
    role: string,
    isDefault: boolean,
  ): Promise<UserInventoryContext | null> => {
    if (cachedCentralWarehouseContext === undefined) {
      const warehouse = await getCentralWarehouseRecord();
      const operatingBranch = warehouse?.operating_branch_id
        ? (await getBranchesByIds([Number(warehouse.operating_branch_id)])).get(
            Number(warehouse.operating_branch_id),
          ) || null
        : null;
      cachedCentralWarehouseContext = warehouse ? { warehouse, operatingBranch } : null;
    }

    if (!cachedCentralWarehouseContext) return null;

    const { warehouse, operatingBranch } = cachedCentralWarehouseContext;
    return {
      role,
      role_name: role,
      context_type: 'warehouse',
      branch_id: null,
      branch_name: null,
      branch_code: null,
      warehouse_id: warehouse.id,
      warehouse_name: warehouse.name,
      warehouse_code: warehouse.code,
      operating_branch_id: warehouse.operating_branch_id == null ? null : Number(warehouse.operating_branch_id),
      operating_branch_name: operatingBranch?.name || null,
      is_default: isDefault,
      display_name: buildDisplayName({
        contextType: 'warehouse',
        role,
        warehouseName: warehouse.name,
        operatingBranchName: operatingBranch?.name || null,
      }),
    };
  };

  if (hasWarehouseSchema) {
    try {
      const { data: rows, error } = await supabase
        .from('user_context_assignments')
        .select('user_id, context_type, branch_id, warehouse_id, role, is_default')
        .eq('user_id', userId)
        .order('is_default', { ascending: false });

      if (!error && rows && rows.length > 0) {
        const branchIds = [...new Set(rows.map((row: any) => Number(row.branch_id)).filter(Boolean))];
        const warehouseIds = [...new Set(rows.map((row: any) => String(row.warehouse_id)).filter(Boolean))];

        const [branchesById, warehousesById] = await Promise.all([
          getBranchesByIds(branchIds),
          getWarehousesByIds(warehouseIds),
        ]);

        const operatingBranchIds = [...new Set(
          [...warehousesById.values()].map(warehouse => Number(warehouse.operating_branch_id)).filter(Boolean),
        )];
        const operatingBranchesById = await getBranchesByIds(operatingBranchIds);

        for (const row of rows) {
          const branch = row.branch_id ? branchesById.get(Number(row.branch_id)) : null;
          const warehouse = row.warehouse_id ? warehousesById.get(String(row.warehouse_id)) : null;
          const operatingBranch = warehouse?.operating_branch_id
            ? operatingBranchesById.get(Number(warehouse.operating_branch_id))
            : null;

          contexts.push({
            role: String(row.role),
            role_name: String(row.role),
            context_type: row.context_type as 'branch' | 'warehouse',
            branch_id: row.branch_id == null ? null : Number(row.branch_id),
            branch_name: branch?.name || null,
            branch_code: branch?.code || null,
            warehouse_id: warehouse?.id || (row.warehouse_id ? String(row.warehouse_id) : null),
            warehouse_name: warehouse?.name || null,
            warehouse_code: warehouse?.code || null,
            operating_branch_id: warehouse?.operating_branch_id == null ? null : Number(warehouse.operating_branch_id),
            operating_branch_name: operatingBranch?.name || null,
            is_default: row.is_default === true,
            display_name: buildDisplayName({
              contextType: row.context_type,
              role: String(row.role),
              branchName: branch?.name || null,
              warehouseName: warehouse?.name || null,
              operatingBranchName: operatingBranch?.name || null,
            }),
          });
        }
      }
    } catch (error: any) {
      logger.warn('Failed to fetch warehouse-aware user contexts; using branch-role fallback', {
        userId,
        message: error?.message || String(error),
      });
    }
  }

  if (!contexts.length) {
    try {
      const { data: rows, error } = await supabase
        .from('user_branch_roles')
        .select('role, branch_id, is_primary, branches(id, name, code)')
        .eq('user_id', userId)
        .order('is_primary', { ascending: false });

      if (!error && rows?.length) {
        for (const row of rows) {
          const role = String(row.role);
          if (isCentralWarehouseRole(role)) {
            const warehouseContext = await buildCentralWarehouseFallbackContext(
              role,
              row.is_primary === true,
            );
            if (warehouseContext) {
              contexts.push(warehouseContext);
              continue;
            }
          }

          const branch = Array.isArray(row.branches) ? row.branches[0] : row.branches;
          contexts.push({
            role,
            role_name: role,
            context_type: 'branch',
            branch_id: row.branch_id == null ? null : Number(row.branch_id),
            branch_name: branch?.name || null,
            branch_code: branch?.code || null,
            warehouse_id: null,
            warehouse_name: null,
            warehouse_code: null,
            operating_branch_id: null,
            operating_branch_name: null,
            is_default: row.is_primary === true,
            display_name: buildDisplayName({
              contextType: 'branch',
              role,
              branchName: branch?.name || null,
            }),
          });
        }
      }
    } catch (error: any) {
      logger.warn('Failed to fetch user_branch_roles fallback for contexts', {
        userId,
        message: error?.message || String(error),
      });
    }
  }

  if (!contexts.length && fallbackProfile?.role) {
    if (isCentralWarehouseRole(fallbackProfile.role)) {
      const warehouseContext = await buildCentralWarehouseFallbackContext(
        String(fallbackProfile.role),
        true,
      );
      if (warehouseContext) {
        contexts.push(warehouseContext);
      }
    }
  }

  if (!contexts.length && fallbackProfile?.role) {
    contexts.push({
      role: String(fallbackProfile.role),
      role_name: String(fallbackProfile.role),
      context_type: 'branch',
      branch_id: fallbackProfile.branch_id == null ? null : Number(fallbackProfile.branch_id),
      branch_name: null,
      branch_code: null,
      warehouse_id: null,
      warehouse_name: null,
      warehouse_code: null,
      operating_branch_id: null,
      operating_branch_name: null,
      is_default: true,
      display_name: buildDisplayName({
        contextType: 'branch',
        role: String(fallbackProfile.role),
      }),
    });
  }

  return contexts;
}

export function getDefaultUserInventoryContext(
  contexts: UserInventoryContext[],
  fallbackRole?: string | null,
): UserInventoryContext | null {
  if (!contexts.length) return null;

  if (isCentralWarehouseRole(fallbackRole)) {
    const preferredWarehouse = contexts.find(
      context => context.role === fallbackRole && context.context_type === 'warehouse',
    );
    if (preferredWarehouse) return preferredWarehouse;
  }

  const explicitDefault = contexts.find(context => context.is_default);
  if (explicitDefault) return explicitDefault;

  if (fallbackRole) {
    const preferred = contexts.find(context => context.role === fallbackRole);
    if (preferred) return preferred;
  }

  return contexts[0];
}

export async function getCanonicalCentralWarehouseLocation(): Promise<{ id: string | null; warehouse: InventoryWarehouse | null }> {
  const warehouse = await getCentralWarehouseRecord();
  if (!warehouse) return { id: null, warehouse: null };

  const hasWarehouseSchema = await ensureWarehouseSchemaAvailability();
  if (!hasWarehouseSchema || warehouse.id.startsWith('legacy-branch-')) {
    const operatingBranchId = warehouse.operating_branch_id;
    if (!operatingBranchId) return { id: null, warehouse };

    const { data } = await supabase
      .from('inventory_locations')
      .select('id, location_code, name, metadata')
      .eq('branch_id', operatingBranchId)
      .eq('location_type', 'central_store')
      .eq('is_active', true)
      .order('location_code')
      .limit(20);

    const rows = Array.isArray(data) ? data : [];
    const preferred = rows.find((row: any) => row?.metadata?.canonical === true)
      || rows.find((row: any) => row?.location_code === `WAREHOUSE-${warehouse.code}`)
      || rows.find((row: any) => row?.location_code === `CENTRAL-STORE-${operatingBranchId}`)
      || rows.find((row: any) => String(row?.name || '').trim().toLowerCase() === 'central store')
      || rows[0];

    return { id: preferred?.id || null, warehouse };
  }

  const { data, error } = await supabase
    .from('inventory_locations')
    .select('id')
    .eq('warehouse_id', warehouse.id)
    .eq('location_type', 'central_store')
    .eq('is_active', true)
    .order('location_code')
    .limit(1)
    .maybeSingle();

  if (!error && data?.id) return { id: String(data.id), warehouse };
  return { id: null, warehouse };
}

export async function resolveStoreContextForUser(user: UserLike): Promise<StoreContextResolution> {
  const branchId = user.branch_id ?? user.branchId ?? null;
  const contextType = user.context_type === 'warehouse' ? 'warehouse' : 'branch';

  if (contextType === 'warehouse') {
    const requestedWarehouseId = user.warehouse_id ? String(user.warehouse_id) : null;
    const defaultWarehouse = await getCentralWarehouseRecord();
    const targetWarehouse = requestedWarehouseId && defaultWarehouse?.id === requestedWarehouseId
      ? defaultWarehouse
      : requestedWarehouseId
        ? await getWarehousesByIds([requestedWarehouseId]).then(map => map.get(requestedWarehouseId) || defaultWarehouse || null)
        : defaultWarehouse;

    const locationResult = await getCanonicalCentralWarehouseLocation();
    const warehouse = targetWarehouse || locationResult.warehouse;

    return {
      scope: 'warehouse',
      warehouse: warehouse as InventoryWarehouse,
      warehouseLocationId: locationResult.id,
      operatingBranchId: warehouse?.operating_branch_id ?? null,
      branchId: branchId == null ? null : Number(branchId),
      displayName: warehouse?.name || 'Central Store',
    };
  }

  let branchName: string | null = null;
  let branchCode: string | null = null;
  let branchLocationId: string | null = null;

  if (branchId != null) {
    const { data: branch } = await supabase
      .from('branches')
      .select('id, name, code')
      .eq('id', branchId)
      .maybeSingle();

    branchName = branch?.name || null;
    branchCode = branch?.code || null;

    const { data: location } = await supabase
      .from('inventory_locations')
      .select('id')
      .eq('branch_id', branchId)
      .eq('location_type', 'branch_store')
      .eq('is_active', true)
      .order('location_code')
      .limit(1)
      .maybeSingle();

    branchLocationId = location?.id || null;
  }

  return {
    scope: 'branch',
    branchId: branchId == null ? null : Number(branchId),
    branchName,
    branchCode,
    branchLocationId,
    displayName: branchName || 'Branch Store',
  };
}

export function isWarehouseUserContext(user: UserLike | undefined | null): boolean {
  return user?.context_type === 'warehouse' || !!user?.warehouse_id;
}
