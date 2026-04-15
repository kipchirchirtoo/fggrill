import { Request } from 'express';

/**
 * Determines if a user role is branch-restricted.
 * Roles like super_admin, general_manager, auditor, and hr_manager are typically global.
 */
export const isGlobalRole = (role: string | undefined): boolean => {
    if (!role) return false;
    // Global roles that can access data across all branches
    const globalRoles = ['super_admin', 'general_manager', 'hr_manager', 'central_storekeeper', 'auditor'];
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
    const userBranchId = (req as any).user?.branch_id;

    if (!isGlobalRole(userRole) && userBranchId) {
        const column = tableAlias ? `${tableAlias}.branch_id` : 'branch_id';
        return query.eq(column, userBranchId);
    }
    
    return query;
};
