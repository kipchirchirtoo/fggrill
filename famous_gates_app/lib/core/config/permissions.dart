// Permission-level access control for Famous Gates Hotels Management System
// Maps roles to granular permissions for UI-level access control

import 'user_roles.dart';

enum Permission {
  // Admin permissions
  canViewSuperAdmin,
  canViewDirector,
  canManageSystemSettings,

  // Branch Manager permissions
  canViewBranchAnalytics,
  canManageBranchStaff,
  canApproveLeaveRequests,
  canViewBranchReports,

  // HR permissions
  canViewHrDashboard,
  canManagePerformance,
  canApproveSalaryAdjustments,
  canViewHrReports,
  canEditPayrollPolicies,

  // Finance/Accounting permissions
  canViewAccounting,
  canManageBanking,
  canViewShiftPnl,
  canManageCreditBills,
  canProcessPayroll,
  canApprovePayroll,
  canViewFinanceReports,
  canVoidBills,

  // Store/Inventory permissions
  canViewStore,
  canManageInventory,
  canApproveStockRequests,
  canManageDispatch,
  canManageReceiving,
  canManageSpoilage,
  canManageSuppliers,
  canManageFleet,

  // Housekeeping permissions
  canViewHousekeeping,
  canManageInspections,
  canManageLostFound,
  canManageSupplies,
  canManageHousekeepingSchedule,

  // Maintenance permissions
  canViewMaintenance,
  canManageAssets,
  canManageMaintenanceSchedule,

  // Restaurant/Bar permissions
  canViewRestaurant,
  canManageOrders,
  canViewBarPos,
  canManageBarStock,

  // Kitchen permissions
  canViewKitchen,
  canManageMenu,
  canManageKitchenStock,

  // Reception permissions
  canViewReception,
  canManageBookings,
  canCheckInGuests,
  canCheckOutGuests,

  // Auditor permissions
  canViewAuditor,
  canAuditBranch,
  canVerifyFinance,
  canViewSalesByBranch,
  canVerifyShifts,
  canApprovePayrollAuditor,
  canViewVoidBills,

  // General permissions
  canViewReports,
  canExportData,
}

class RolePermissions {
  static Set<Permission> getPermissionsForRole(UserRole role) {
    switch (role) {
      // Super Admin - all permissions
      case UserRole.superAdmin:
        return Permission.values.toSet();

      // Director - most admin permissions
      case UserRole.director:
        return {
          ...Permission.values,
          // Exclude some operational permissions
        }.difference({
          Permission.canManageDispatch,
          Permission.canManageReceiving,
          Permission.canManageSpoilage,
          Permission.canManageFleet,
        });

      // General Manager
      case UserRole.generalManager:
        return {
          Permission.canViewBranchAnalytics,
          Permission.canManageBranchStaff,
          Permission.canApproveLeaveRequests,
          Permission.canViewBranchReports,
          Permission.canViewStore,
          Permission.canManageInventory,
          Permission.canApproveStockRequests,
          Permission.canViewHousekeeping,
          Permission.canViewMaintenance,
          Permission.canViewRestaurant,
          Permission.canViewKitchen,
          Permission.canViewReception,
          Permission.canViewReports,
          Permission.canExportData,
        };

      // Branch Manager
      case UserRole.branchManager:
        return {
          Permission.canViewBranchAnalytics,
          Permission.canManageBranchStaff,
          Permission.canApproveLeaveRequests,
          Permission.canViewBranchReports,
          Permission.canViewStore,
          Permission.canManageInventory,
          Permission.canApproveStockRequests,
          Permission.canViewHousekeeping,
          Permission.canViewMaintenance,
          Permission.canViewRestaurant,
          Permission.canViewKitchen,
          Permission.canViewReception,
          Permission.canViewReports,
        };

      // Branch Operations Manager
      case UserRole.branchOperationsManager:
        return {
          Permission.canViewBranchAnalytics,
          Permission.canManageBranchStaff,
          Permission.canApproveLeaveRequests,
          Permission.canViewStore,
          Permission.canManageInventory,
          Permission.canApproveStockRequests,
          Permission.canViewHousekeeping,
          Permission.canViewMaintenance,
          Permission.canViewRestaurant,
          Permission.canViewKitchen,
          Permission.canViewReception,
        };

      // Central Operations Manager
      case UserRole.centralOperationsManager:
        return {
          Permission.canViewStore,
          Permission.canManageInventory,
          Permission.canApproveStockRequests,
          Permission.canManageDispatch,
          Permission.canManageReceiving,
          Permission.canManageSpoilage,
          Permission.canManageSuppliers,
          Permission.canManageFleet,
          Permission.canViewReports,
          Permission.canExportData,
        };

      // Facilities Manager
      case UserRole.facilitiesManager:
        return {
          Permission.canViewMaintenance,
          Permission.canManageAssets,
          Permission.canManageMaintenanceSchedule,
          Permission.canViewHousekeeping,
          Permission.canManageHousekeepingSchedule,
        };

      // HR Manager
      case UserRole.hrManager:
        return {
          Permission.canViewHrDashboard,
          Permission.canManagePerformance,
          Permission.canApproveSalaryAdjustments,
          Permission.canViewHrReports,
          Permission.canEditPayrollPolicies,
          Permission.canViewBranchReports,
        };

      // Finance Manager
      case UserRole.financeManager:
        return {
          Permission.canViewAccounting,
          Permission.canManageBanking,
          Permission.canViewShiftPnl,
          Permission.canManageCreditBills,
          Permission.canProcessPayroll,
          Permission.canApprovePayroll,
          Permission.canViewFinanceReports,
          Permission.canViewBranchReports,
        };

      // Accountant / Branch Accountant
      case UserRole.accountant:
      case UserRole.branchAccountant:
        return {
          Permission.canViewAccounting,
          Permission.canManageBanking,
          Permission.canViewShiftPnl,
          Permission.canManageCreditBills,
          Permission.canViewFinanceReports,
          // Branch accountants register staff for their own branch (backend
          // enforces own-branch scope + blocks global/executive login roles).
          Permission.canManageBranchStaff,
        };

      // Auditor / Night Auditor
      case UserRole.auditor:
      case UserRole.nightAuditor:
        return {
          Permission.canViewAuditor,
          Permission.canAuditBranch,
          Permission.canVerifyFinance,
          Permission.canViewSalesByBranch,
          Permission.canVerifyShifts,
          Permission.canApprovePayrollAuditor,
          Permission.canViewVoidBills,
          Permission.canViewFinanceReports,
        };

      // Central Storekeeper
      case UserRole.centralStorekeeper:
        return {
          Permission.canViewStore,
          Permission.canManageInventory,
          Permission.canApproveStockRequests,
          Permission.canManageDispatch,
          Permission.canManageReceiving,
          Permission.canManageSpoilage,
          Permission.canManageSuppliers,
          Permission.canManageFleet,
        };

      // Branch Storekeeper / Storekeeper / Inventory Clerk
      case UserRole.branchStorekeeper:
      case UserRole.storekeeper:
      case UserRole.inventoryClerk:
        return {
          Permission.canViewStore,
          Permission.canManageInventory,
          Permission.canApproveStockRequests,
        };

      // Housekeeping Supervisor
      case UserRole.housekeepingSupervisor:
        return {
          Permission.canViewHousekeeping,
          Permission.canManageInspections,
          Permission.canManageLostFound,
          Permission.canManageSupplies,
          Permission.canManageHousekeepingSchedule,
        };

      // Housekeeping / Room Attendant / Laundry Attendant
      case UserRole.housekeeping:
      case UserRole.roomAttendant:
      case UserRole.laundryAttendant:
        return {
          Permission.canViewHousekeeping,
          Permission.canManageInspections,
          Permission.canManageLostFound,
        };

      // Maintenance Supervisor
      case UserRole.maintenanceSupervisor:
        return {
          Permission.canViewMaintenance,
          Permission.canManageAssets,
          Permission.canManageMaintenanceSchedule,
        };

      // Maintenance / Electrician / Plumber
      case UserRole.maintenance:
      case UserRole.electrician:
      case UserRole.plumber:
        return {
          Permission.canViewMaintenance,
          Permission.canManageMaintenanceSchedule,
        };

      // Bar Manager
      case UserRole.barManager:
        return {
          Permission.canViewBarPos,
          Permission.canManageOrders,
          Permission.canManageBarStock,
          Permission.canViewRestaurant,
        };

      // Bartender / Barman / Barmaid
      case UserRole.bartender:
      case UserRole.barman:
      case UserRole.barmaid:
        return {
          Permission.canViewBarPos,
          Permission.canManageOrders,
        };

      // Head Chef / Chef / Cook / Sous Chef
      case UserRole.headChef:
      case UserRole.chef:
      case UserRole.cook:
      case UserRole.sousChef:
        return {
          Permission.canViewKitchen,
          Permission.canManageMenu,
          Permission.canManageKitchenStock,
        };

      // Kitchen / Kitchen Operations / POS Kitchen
      case UserRole.kitchen:
      case UserRole.kitchenOperations:
      case UserRole.posKitchen:
        return {
          Permission.canViewKitchen,
          Permission.canManageMenu,
        };

      // Front Desk Supervisor / Concierge
      case UserRole.frontDeskSupervisor:
      case UserRole.concierge:
        return {
          Permission.canViewReception,
          Permission.canManageBookings,
          Permission.canCheckInGuests,
          Permission.canCheckOutGuests,
        };

      // Receptionist / Branch Receptionist
      case UserRole.receptionist:
      case UserRole.branchReceptionist:
        return {
          Permission.canViewReception,
          Permission.canManageBookings,
          Permission.canCheckInGuests,
          Permission.canCheckOutGuests,
        };

      // Head Waiter / Waiter / Waitress / Food Runner / Host/Hostess / Restaurant
      case UserRole.headWaiter:
      case UserRole.waiter:
      case UserRole.waitress:
      case UserRole.foodRunner:
      case UserRole.hostHostess:
      case UserRole.restaurant:
        return {
          Permission.canViewRestaurant,
          Permission.canManageOrders,
        };

      // Cashier / Kyogong cashiers
      case UserRole.cashier:
      case UserRole.restaurantCashier:
      case UserRole.mainBarCashier:
      case UserRole.executiveBarCashier:
      case UserRole.nonConsumablesCashier:
      case UserRole.kyogongSpaCashier:
      case UserRole.kyogongExecutiveBarCashier:
      case UserRole.kyogongSportsBarCashier:
      case UserRole.kyogongReceptionCashier:
      case UserRole.chomaZoneCashier:
        return {
          Permission.canViewRestaurant,
          Permission.canManageOrders,
        };

      // Procurement / Purchasing Manager
      case UserRole.procurement:
      case UserRole.purchasingManager:
        return {
          Permission.canViewStore,
          Permission.canManageInventory,
          Permission.canApproveStockRequests,
          Permission.canManageSuppliers,
        };

      // Driver
      case UserRole.driver:
        return {
          Permission.canViewMaintenance,
        };

      // Employee
      case UserRole.employee:
        return {
          Permission.canViewHrDashboard,
        };

      // Guest
      case UserRole.guest:
        return {};
    }
  }

  static bool hasPermission(UserRole role, Permission permission) {
    return getPermissionsForRole(role).contains(permission);
  }

  static bool hasAnyPermission(UserRole role, Set<Permission> permissions) {
    final rolePerms = getPermissionsForRole(role);
    return permissions.any((p) => rolePerms.contains(p));
  }

  static bool hasAllPermissions(UserRole role, Set<Permission> permissions) {
    final rolePerms = getPermissionsForRole(role);
    return permissions.every((p) => rolePerms.contains(p));
  }
}
