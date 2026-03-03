import { UserRole } from './auth-context';

/**
 * Role Groups for Kyogong ERP
 * Use these constants for consistent role-based access control across the application
 */

// Executive roles - full access to all branches
export const EXECUTIVE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER
];

// Management roles - can view/manage branch operations
export const MANAGEMENT_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.BRANCH_MANAGER
];

// Financial roles - access to financial data
export const FINANCE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.ACCOUNTANT,
  UserRole.AUDITOR
];

// Financial roles with edit access
export const FINANCE_EDIT_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.ACCOUNTANT
];

// Audit roles - read-only financial and system access
export const AUDIT_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.AUDITOR,
  UserRole.ACCOUNTANT
];

// Reception roles
export const RECEPTION_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.BRANCH_MANAGER,
  UserRole.RECEPTIONIST
];

// Housekeeping roles
export const HOUSEKEEPING_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.BRANCH_MANAGER,
  UserRole.HOUSEKEEPING,
  UserRole.HOUSEKEEPING_SUPERVISOR
];

// Housekeeping supervisor roles
export const HOUSEKEEPING_SUPERVISOR_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.BRANCH_MANAGER,
  UserRole.HOUSEKEEPING_SUPERVISOR
];

// Restaurant roles
export const RESTAURANT_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.BRANCH_MANAGER,
  UserRole.RESTAURANT
];

// Maintenance roles
export const MAINTENANCE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.BRANCH_MANAGER,
  UserRole.MAINTENANCE
];

// Central store roles - can manage central warehouse
export const CENTRAL_STORE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.CENTRAL_STOREKEEPER
];

// Branch store roles - can manage branch inventory
export const BRANCH_STORE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.BRANCH_MANAGER,
  UserRole.CENTRAL_STOREKEEPER,
  UserRole.BRANCH_STOREKEEPER
];

// All inventory access (including view for auditors)
export const INVENTORY_VIEW_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.BRANCH_MANAGER,
  UserRole.CENTRAL_STOREKEEPER,
  UserRole.BRANCH_STOREKEEPER,
  UserRole.AUDITOR
];

// Roles that can view all branches
export const ALL_BRANCHES_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.CENTRAL_STOREKEEPER,
  UserRole.AUDITOR
];

// Staff management roles
export const STAFF_MANAGEMENT_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.BRANCH_MANAGER
];

// Report viewing roles
export const REPORT_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.BRANCH_MANAGER,
  UserRole.ACCOUNTANT,
  UserRole.AUDITOR
];

// Settings access roles
export const SETTINGS_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER
];

// All staff roles (for employee self-service features)
export const ALL_STAFF_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.BRANCH_MANAGER,
  UserRole.RECEPTIONIST,
  UserRole.HOUSEKEEPING,
  UserRole.HOUSEKEEPING_SUPERVISOR,
  UserRole.RESTAURANT,
  UserRole.MAINTENANCE,
  UserRole.ACCOUNTANT,
  UserRole.AUDITOR,
  UserRole.CENTRAL_STOREKEEPER,
  UserRole.BRANCH_STOREKEEPER,
  UserRole.EMPLOYEE
];

/**
 * Helper function to check if user has required role
 */
export const hasRole = (userRole: UserRole | undefined, allowedRoles: UserRole[]): boolean => {
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
};

/**
 * Helper function to check if user can view all branches
 */
export const canViewAllBranches = (userRole: UserRole | undefined): boolean => {
  return hasRole(userRole, ALL_BRANCHES_ROLES);
};

/**
 * Helper function to check if user is management level
 */
export const isManagement = (userRole: UserRole | undefined): boolean => {
  return hasRole(userRole, MANAGEMENT_ROLES);
};

/**
 * Helper function to check if user is executive level
 */
export const isExecutive = (userRole: UserRole | undefined): boolean => {
  return hasRole(userRole, EXECUTIVE_ROLES);
};
