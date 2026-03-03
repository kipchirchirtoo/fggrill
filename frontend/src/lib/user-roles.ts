// User roles for Kyogong
// NOTE: This file must NOT have 'use client' — keeping the enum here
// prevents Next.js RSC bundler from registering each member as a separate
// client module (which causes "Could not find the module" manifest errors).
export enum UserRole {
    // Admin roles
    SUPER_ADMIN = 'super_admin',

    // Legacy roles - to be migrated
    GENERAL_MANAGER = 'general_manager',
    BRANCH_MANAGER = 'branch_manager',
    CENTRAL_STOREKEEPER = 'central_storekeeper',
    BRANCH_STOREKEEPER = 'branch_storekeeper',
    HOUSEKEEPING = 'housekeeping',
    HOUSEKEEPING_SUPERVISOR = 'housekeeping_supervisor',
    MAINTENANCE = 'maintenance',

    // New consolidated roles
    BRANCH_OPERATIONS_MANAGER = 'branch_operations_manager',
    CENTRAL_OPERATIONS_MANAGER = 'central_operations_manager',
    FACILITIES_MANAGER = 'facilities_manager',

    // Other roles
    RECEPTIONIST = 'receptionist',
    RESTAURANT = 'restaurant',
    POS_KITCHEN = 'pos_kitchen',
    KITCHEN = 'kitchen',
    KITCHEN_OPERATIONS = 'kitchen_operations',
    BARTENDER = 'bartender',
    WAITER = 'waiter',
    WAITRESS = 'waitress',
    HEAD_WAITER = 'head_waiter',
    BARMAN = 'barman',
    BARMAID = 'barmaid',
    BAR_MANAGER = 'bar_manager',
    CHEF = 'chef',
    HEAD_CHEF = 'head_chef',
    COOK = 'cook',
    ACCOUNTANT = 'accountant',
    BRANCH_ACCOUNTANT = 'branch_accountant',
    AUDITOR = 'auditor',
    PROCUREMENT = 'procurement',
    STOREKEEPER = 'storekeeper',
    PURCHASING_MANAGER = 'purchasing_manager',
    CASHIER = 'cashier',
    HR_MANAGER = 'hr_manager',
    EMPLOYEE = 'employee',
    DRIVER = 'driver',
    GUEST = 'guest',

    // Kyogong Branch Cashiers
    KYOGONG_SPA_CASHIER = 'kyogong_spa_cashier',
    KYOGONG_EXECUTIVE_BAR_CASHIER = 'kyogong_executive_bar_cashier',
    KYOGONG_SPORTS_BAR_CASHIER = 'kyogong_sports_bar_cashier',
    KYOGONG_RECEPTION_CASHIER = 'kyogong_reception_cashier',
}
