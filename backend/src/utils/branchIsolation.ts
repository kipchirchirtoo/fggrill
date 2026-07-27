import { Request } from 'express';

/**
 * Determines if a user role is branch-restricted.
 * Roles like super_admin, general_manager, director, auditor, and hr_manager are typically global.
 */
export const isGlobalRole = (role: string | undefined): boolean => {
    if (!role) return false;
    // Global roles that can access data across all branches
    const globalRoles = [
        'super_admin',
        'general_manager',
        'central_storekeeper',
        'central_operations_manager',
        'hr_manager',
        'auditor',
        'director'
    ];
    return globalRoles.includes(role.toLowerCase());
};

/**
 * Appends a branch_id filter to a Supabase query if the requesting user is restricted to a specific branch.
 * @param query The Supabase query object
 * @param req The Express Request object (containing req.user)
 * @param tableAlias Optional table alias prefix (e.g., 'room' if filtering by 'room.branch_id')
 * @returns The modified query
 */
export const applyBranchFilter = (query: any, req: Request, tableAlias: string = '') => {
    const userRole = (req as any).user?.role;
    const userBranchIdRaw = (req as any).user?.branch_id ?? (req as any).user?.branchId;
    const userBranchId = userBranchIdRaw !== undefined && userBranchIdRaw !== null ? Number(userBranchIdRaw) : null;

    if (!isGlobalRole(userRole)) {
        const column = tableAlias ? `${tableAlias}.branch_id` : 'branch_id';
        
        // Defensive fallback: if user lookup failed / legacy token lacks branch_id,
        // use the query or header branch_id if available to prevent blank screens.
        const reqBranchIdRaw = req.query.branch_id || req.headers['x-branch-id'] || req.headers['branch-id'];
        const reqBranchId = reqBranchIdRaw ? Number(Array.isArray(reqBranchIdRaw) ? reqBranchIdRaw[0] : reqBranchIdRaw) : null;
        const resolvedBranchId = userBranchId !== null ? userBranchId : reqBranchId;

        if (resolvedBranchId !== null && Number.isFinite(resolvedBranchId) && resolvedBranchId > 0) {
            return query.eq(column, resolvedBranchId);
        } else {
            // Non-global user has no valid branch ID assigned -> restrict to -1 to return empty instead of leaking all branches
            return query.eq(column, -1);
        }
    }
    
    return query;
};
