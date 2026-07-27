export const KYOGONG_BRANCH_ID = 1;
export const KYOGONG_BRANCH_STORE_CUTOVER_AT = '2026-07-27T00:00:00.000Z';

const CENTRAL_ONLY_ROLES = new Set([
  'central_storekeeper',
  'central_operations_manager',
  'super_admin',
  'general_manager',
  'auditor',
]);

export function isKyogongBranch(branchId?: number | null): boolean {
  return Number(branchId || 0) === KYOGONG_BRANCH_ID;
}

export function shouldUseKyogongBranchCutover(input: {
  branchId?: number | null;
  role?: string | null;
}): boolean {
  const role = String(input.role || '').trim().toLowerCase();
  return isKyogongBranch(input.branchId) && !CENTRAL_ONLY_ROLES.has(role);
}
