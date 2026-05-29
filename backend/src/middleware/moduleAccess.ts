import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../models/User';
import { AppError } from './errorHandler';

/**
 * Module definitions for access control
 */
export enum SourceModule {
    INVENTORY = 'inventory',
    CENTRAL_STORE = 'central_store',
    BRANCH_STORE = 'branch_store',
    BRANCH_ACCOUNTING = 'branch_accounting',
    RESTAURANT = 'restaurant'
}

/**
 * Role to module access mapping
 */
const ROLE_MODULE_ACCESS: Record<string, SourceModule[]> = {
    [UserRole.SUPER_ADMIN]: [
        SourceModule.INVENTORY,
        SourceModule.CENTRAL_STORE,
        SourceModule.BRANCH_STORE,
        SourceModule.BRANCH_ACCOUNTING,
        SourceModule.RESTAURANT
    ],
    [UserRole.GENERAL_MANAGER]: [
        SourceModule.INVENTORY,
        SourceModule.CENTRAL_STORE,
        SourceModule.BRANCH_STORE,
        SourceModule.BRANCH_ACCOUNTING,
        SourceModule.RESTAURANT
    ],
    [UserRole.CENTRAL_STOREKEEPER]: [
        SourceModule.CENTRAL_STORE
    ],
    [UserRole.BRANCH_STOREKEEPER]: [
        SourceModule.BRANCH_STORE
    ],
    [UserRole.BRANCH_ACCOUNTANT]: [
        SourceModule.BRANCH_ACCOUNTING
    ],
    [UserRole.AUDITOR]: [
        SourceModule.INVENTORY,
        SourceModule.CENTRAL_STORE,
        SourceModule.BRANCH_STORE,
        SourceModule.BRANCH_ACCOUNTING,
        SourceModule.RESTAURANT
    ],
    [UserRole.ACCOUNTANT]: [
        SourceModule.BRANCH_ACCOUNTING
    ],
    [UserRole.PROCUREMENT]: [
        SourceModule.CENTRAL_STORE
    ],
    [UserRole.PURCHASING_MANAGER]: [
        SourceModule.CENTRAL_STORE
    ]
};

/**
 * Middleware to validate module access based on user role
 * @param allowedModules - Array of modules that can be accessed via this endpoint
 */
export const validateModuleAccess = (allowedModules: SourceModule[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            const user = (req as any).user;
            
            if (!user) {
                throw new AppError('Authentication required', 401);
            }

            // Get requested module from query/body, or default to the first module
            // the caller's role actually has access to (prevents spurious 403 when
            // a branch_accountant calls without source_module and the first allowed
            // module happens to be central_store which they cannot access).
            const userModulesForDefault = ROLE_MODULE_ACCESS[user?.role] || [];
            const requestedModule =
                req.query.source_module as string ||
                req.body.source_module as string ||
                allowedModules.find(m => userModulesForDefault.includes(m)) ||
                allowedModules[0];

            // Check if requested module is in allowed list for this endpoint
            if (!allowedModules.includes(requestedModule as SourceModule)) {
                throw new AppError(
                    `Module '${requestedModule}' is not accessible via this endpoint`,
                    403
                );
            }

            // Check if user's role has access to this module
            const userModules = ROLE_MODULE_ACCESS[user.role] || [];
            if (!userModules.includes(requestedModule as SourceModule)) {
                throw new AppError(
                    `Your role '${user.role}' does not have access to module '${requestedModule}'`,
                    403
                );
            }

            // Attach validated module to request for use in controllers
            (req as any).sourceModule = requestedModule;
            
            next();
        } catch (error) {
            next(error);
        }
    };
};

/**
 * Middleware to enforce branch scoping for branch-level modules
 */
export const enforceBranchScoping = (req: Request, res: Response, next: NextFunction): void => {
    try {
        const user = (req as any).user;
        const sourceModule = (req as any).sourceModule;

        if (!user) {
            throw new AppError('Authentication required', 401);
        }

        // Branch-level modules require branch_id
        const branchLevelModules = [
            SourceModule.BRANCH_STORE,
            SourceModule.BRANCH_ACCOUNTING,
            SourceModule.RESTAURANT
        ];

        if (branchLevelModules.includes(sourceModule)) {
            // For branch-level roles, enforce their assigned branch
            const isBranchRole = ![
                UserRole.SUPER_ADMIN,
                UserRole.GENERAL_MANAGER,
                UserRole.AUDITOR
            ].includes(user.role);

            if (isBranchRole) {
                if (!user.branch_id && !user.branchId) {
                    throw new AppError('Branch assignment required for this operation', 403);
                }

                // Force the user's branch_id (prevent accessing other branches)
                (req as any).enforcedBranchId = user.branch_id || user.branchId;
            }
        } else if (sourceModule === SourceModule.CENTRAL_STORE) {
            // Central store should not have branch_id
            (req as any).enforcedBranchId = null;
        }

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Helper function to apply module and branch filters to a Supabase query
 */
export const applyModuleBranchFilter = (query: any, req: Request): any => {
    const sourceModule = (req as any).sourceModule;
    const enforcedBranchId = (req as any).enforcedBranchId;

    // Always filter by source_module
    if (sourceModule) {
        query = query.eq('source_module', sourceModule);
    }

    // Apply branch filter if enforced
    if (enforcedBranchId !== undefined) {
        if (enforcedBranchId === null) {
            // Central store: branch_id must be NULL
            query = query.is('branch_id', null);
        } else {
            // Branch-level: must match user's branch
            query = query.eq('branch_id', enforcedBranchId);
        }
    }

    return query;
};

/**
 * Helper function to validate and set module/branch on create operations
 */
export const setModuleBranchOnCreate = (data: any, req: Request): any => {
    const sourceModule = (req as any).sourceModule;
    const enforcedBranchId = (req as any).enforcedBranchId;
    const user = (req as any).user;

    return {
        ...data,
        source_module: sourceModule,
        branch_id: enforcedBranchId !== undefined ? enforcedBranchId : (user.branch_id || user.branchId || null),
        created_by: user.id
    };
};

/**
 * Get user's accessible modules based on role
 */
export const getUserModules = (userRole: string): SourceModule[] => {
    return ROLE_MODULE_ACCESS[userRole] || [];
};

/**
 * Check if user can access a specific module
 */
export const canAccessModule = (userRole: string, module: SourceModule): boolean => {
    const userModules = ROLE_MODULE_ACCESS[userRole] || [];
    return userModules.includes(module);
};
