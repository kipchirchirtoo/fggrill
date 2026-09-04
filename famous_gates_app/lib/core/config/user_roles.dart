// User roles for Famous Gates Hotels Management System
// Matches exactly with frontend: /frontend/src/lib/user-roles.ts

enum UserRole {
  // Admin roles
  superAdmin('super_admin'),
  director('director'),
  global('global'),

  // Legacy roles - to be migrated
  generalManager('general_manager'),
  branchManager('branch_manager'),
  centralStorekeeper('central_storekeeper'),
  branchStorekeeper('branch_storekeeper'),
  housekeeping('housekeeping'),
  housekeepingSupervisor('housekeeping_supervisor'),
  maintenance('maintenance'),

  // New consolidated roles
  branchOperationsManager('branch_operations_manager'),
  centralOperationsManager('central_operations_manager'),
  facilitiesManager('facilities_manager'),

  // Other roles
  receptionist('receptionist'),
  restaurant('restaurant'),
  posKitchen('pos_kitchen'),
  kitchen('kitchen'),
  kitchenOperations('kitchen_operations'),
  chomaZoneKds('choma_zone_kds'),
  bartender('bartender'),
  waiter('waiter'),
  waitress('waitress'),
  headWaiter('head_waiter'),
  barman('barman'),
  barmaid('barmaid'),
  barManager('bar_manager'),
  chef('chef'),
  headChef('head_chef'),
  cook('cook'),
  accountant('accountant'),
  branchAccountant('branch_accountant'),
  auditor('auditor'),
  procurement('procurement'),
  storekeeper('storekeeper'),
  purchasingManager('purchasing_manager'),
  cashier('cashier'),
  restaurantCashier('restaurant_cashier'),
  mainBarCashier('main_bar_cashier'),
  executiveBarCashier('executive_bar_cashier'),
  nonConsumablesCashier('non_consumables_cashier'),
  hrManager('hr_manager'),
  employee('employee'),
  driver('driver'),
  guest('guest'),

  // Kyogong Branch Cashiers
  kyogongSpaCashier('kyogong_spa_cashier'),
  kyogongExecutiveBarCashier('kyogong_executive_bar_cashier'),
  kyogongSportsBarCashier('kyogong_sports_bar_cashier'),
  kyogongReceptionCashier('kyogong_reception_cashier'),
  chomaZoneCashier('choma_zone_cashier'),

  // Additional restaurant roles
  foodRunner('food_runner'),
  hostHostess('host_hostess'),

  // Additional kitchen roles
  sousChef('sous_chef'),

  // Additional reception roles
  branchReceptionist('branch_receptionist'),
  frontDeskSupervisor('front_desk_supervisor'),
  concierge('concierge'),

  // Additional store roles
  inventoryClerk('inventory_clerk'),

  // Additional housekeeping roles
  roomAttendant('room_attendant'),
  laundryAttendant('laundry_attendant'),

  // Additional maintenance roles
  maintenanceSupervisor('maintenance_supervisor'),
  electrician('electrician'),
  plumber('plumber'),

  // Additional finance roles
  financeManager('finance_manager'),
  nightAuditor('night_auditor');

  final String value;
  const UserRole(this.value);

  static UserRole fromString(String role) {
    return UserRole.values.firstWhere(
      (r) => r.value == role,
      orElse: () => UserRole.guest,
    );
  }

  String get displayName {
    switch (this) {
      case UserRole.superAdmin:
        return 'Super Admin';
      case UserRole.global:
        return 'Global';
      case UserRole.generalManager:
        return 'General Manager';
      case UserRole.branchManager:
        return 'Branch Manager';
      case UserRole.centralStorekeeper:
        return 'Central Storekeeper';
      case UserRole.branchStorekeeper:
        return 'Branch Storekeeper';
      case UserRole.housekeeping:
        return 'Housekeeping';
      case UserRole.housekeepingSupervisor:
        return 'Housekeeping Supervisor';
      case UserRole.maintenance:
        return 'Maintenance';
      case UserRole.branchOperationsManager:
        return 'Branch Operations Manager';
      case UserRole.centralOperationsManager:
        return 'Central Operations Manager';
      case UserRole.facilitiesManager:
        return 'Facilities Manager';
      case UserRole.receptionist:
        return 'Receptionist';
      case UserRole.restaurant:
        return 'Restaurant';
      case UserRole.posKitchen:
        return 'POS Kitchen';
      case UserRole.kitchen:
        return 'Kitchen';
      case UserRole.kitchenOperations:
        return 'Kitchen Operations';
      case UserRole.chomaZoneKds:
        return 'Choma Zone KDS';
      case UserRole.bartender:
        return 'Bartender';
      case UserRole.waiter:
        return 'Waiter';
      case UserRole.waitress:
        return 'Waitress';
      case UserRole.headWaiter:
        return 'Head Waiter';
      case UserRole.barman:
        return 'Barman';
      case UserRole.barmaid:
        return 'Barmaid';
      case UserRole.barManager:
        return 'Bar Manager';
      case UserRole.chef:
        return 'Chef';
      case UserRole.headChef:
        return 'Head Chef';
      case UserRole.cook:
        return 'Cook';
      case UserRole.accountant:
        return 'Accountant';
      case UserRole.branchAccountant:
        return 'Branch Accountant';
      case UserRole.auditor:
        return 'Auditor';
      case UserRole.procurement:
        return 'Procurement';
      case UserRole.storekeeper:
        return 'Storekeeper';
      case UserRole.purchasingManager:
        return 'Purchasing Manager';
      case UserRole.cashier:
        return 'Cashier';
      case UserRole.restaurantCashier:
        return 'Restaurant Cashier';
      case UserRole.mainBarCashier:
        return 'Main Bar Cashier';
      case UserRole.executiveBarCashier:
        return 'Executive Bar Cashier';
      case UserRole.nonConsumablesCashier:
        return 'Non-consumables Cashier';
      case UserRole.hrManager:
        return 'HR Manager';
      case UserRole.employee:
        return 'Employee';
      case UserRole.driver:
        return 'Driver';
      case UserRole.guest:
        return 'Guest';
      case UserRole.kyogongSpaCashier:
        return 'Kyogong Spa Cashier';
      case UserRole.kyogongExecutiveBarCashier:
        return 'Kyogong Executive Bar Cashier';
      case UserRole.kyogongSportsBarCashier:
        return 'Kyogong Sports Bar Cashier';
      case UserRole.kyogongReceptionCashier:
        return 'Kyogong Reception Cashier';
      case UserRole.chomaZoneCashier:
        return 'Choma Zone Cashier';
      case UserRole.director:
        return 'Director';
      case UserRole.foodRunner:
        return 'Food Runner';
      case UserRole.hostHostess:
        return 'Host/Hostess';
      case UserRole.sousChef:
        return 'Sous Chef';
      case UserRole.branchReceptionist:
        return 'Branch Receptionist';
      case UserRole.frontDeskSupervisor:
        return 'Front Desk Supervisor';
      case UserRole.concierge:
        return 'Concierge';
      case UserRole.inventoryClerk:
        return 'Inventory Clerk';
      case UserRole.maintenanceSupervisor:
        return 'Maintenance Supervisor';
      case UserRole.electrician:
        return 'Electrician';
      case UserRole.plumber:
        return 'Plumber';
      case UserRole.financeManager:
        return 'Finance Manager';
      case UserRole.nightAuditor:
        return 'Night Auditor';
      case UserRole.roomAttendant:
        return 'Room Attendant';
      case UserRole.laundryAttendant:
        return 'Laundry Attendant';
    }
  }

  // Role categories for route access
  static Set<String> get adminRoles => {
        superAdmin.value,
        generalManager.value,
        global.value,
      };

  static Set<String> get cashierRoles => {
        cashier.value,
        restaurantCashier.value,
        mainBarCashier.value,
        executiveBarCashier.value,
        nonConsumablesCashier.value,
        kyogongReceptionCashier.value,
        chomaZoneCashier.value,
      };

  static Set<String> get barRoles => {
        bartender.value,
        barManager.value,
        barman.value,
        barmaid.value,
        kyogongExecutiveBarCashier.value,
        kyogongSportsBarCashier.value,
      };

  static Set<String> get restaurantRoles => {
        waiter.value,
        waitress.value,
        headWaiter.value,
        foodRunner.value,
        hostHostess.value,
        restaurant.value,
      };

  static Set<String> get kitchenRoles => {
        kitchen.value,
        headChef.value,
        sousChef.value,
        chef.value,
        cook.value,
        posKitchen.value,
        chomaZoneKds.value,
      };

  static Set<String> get receptionRoles => {
        receptionist.value,
        branchReceptionist.value,
        frontDeskSupervisor.value,
        concierge.value,
      };

  static Set<String> get storeRoles => {
        branchStorekeeper.value,
        storekeeper.value,
        inventoryClerk.value,
      };

  static Set<String> get centralStoreRoles => {
        centralStorekeeper.value,
        centralOperationsManager.value,
      };

  static Set<String> get accountingRoles => {
        financeManager.value,
        branchAccountant.value,
        accountant.value,
      };

  static Set<String> get housekeepingRoles => {
        housekeeping.value,
        housekeepingSupervisor.value,
        roomAttendant.value,
        laundryAttendant.value,
      };

  static Set<String> get maintenanceRoles => {
        maintenance.value,
        maintenanceSupervisor.value,
        electrician.value,
        plumber.value,
      };

  static Set<String> get allAuthenticatedRoles => {
        ...cashierRoles,
        ...barRoles,
        ...restaurantRoles,
        ...kitchenRoles,
        ...receptionRoles,
        ...storeRoles,
        ...centralStoreRoles,
        ...accountingRoles,
        ...housekeepingRoles,
        ...maintenanceRoles,
        ...adminRoles,
        director.value,
        auditor.value,
        nightAuditor.value,
        hrManager.value,
        branchManager.value,
      };

  // Dashboard routes for each role
  String get dashboardRoute {
    switch (this) {
      case UserRole.superAdmin:
      case UserRole.generalManager:
      case UserRole.global:
        return '/admin';
      case UserRole.director:
        return '/director';
      case UserRole.branchManager:
        return '/branch-manager';
      case UserRole.receptionist:
      case UserRole.branchReceptionist:
      case UserRole.frontDeskSupervisor:
      case UserRole.concierge:
        return '/reception';
      case UserRole.cashier:
      case UserRole.kyogongReceptionCashier:
      case UserRole.kyogongSpaCashier:
      case UserRole.chomaZoneCashier:
        return '/pos';
      case UserRole.bartender:
      case UserRole.barman:
      case UserRole.barmaid:
      case UserRole.barManager:
      case UserRole.kyogongExecutiveBarCashier:
      case UserRole.kyogongSportsBarCashier:
        return '/bar-pos';
      case UserRole.waiter:
      case UserRole.waitress:
      case UserRole.headWaiter:
      case UserRole.foodRunner:
      case UserRole.hostHostess:
      case UserRole.restaurant:
        return '/restaurant';
      case UserRole.kitchen:
      case UserRole.headChef:
      case UserRole.sousChef:
      case UserRole.chef:
      case UserRole.cook:
      case UserRole.posKitchen:
      case UserRole.kitchenOperations:
        return '/kitchen';
      case UserRole.chomaZoneKds:
        return '/kitchen/choma-zone';
      case UserRole.centralStorekeeper:
      case UserRole.centralOperationsManager:
        return '/central-store';
      case UserRole.branchStorekeeper:
      case UserRole.storekeeper:
      case UserRole.inventoryClerk:
        return '/store';
      case UserRole.accountant:
      case UserRole.branchAccountant:
      case UserRole.financeManager:
        return '/accounting';
      case UserRole.housekeeping:
      case UserRole.housekeepingSupervisor:
      case UserRole.roomAttendant:
      case UserRole.laundryAttendant:
        return '/housekeeping';
      case UserRole.maintenance:
      case UserRole.maintenanceSupervisor:
      case UserRole.electrician:
      case UserRole.plumber:
      case UserRole.facilitiesManager:
        return '/maintenance';
      case UserRole.auditor:
      case UserRole.nightAuditor:
        return '/auditor';
      case UserRole.hrManager:
        return '/hr';
      default:
        return '/admin';
    }
  }
}

// Additional role aliases for compatibility
extension UserRoleAliases on UserRole {
  static const Map<String, String> legacyToNew = {
    'superadmin': 'super_admin',
    'general_manager': 'general_manager',
    'branch_manager': 'branch_manager',
  };
}
