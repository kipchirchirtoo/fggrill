// Role-based navigation map — mirrors the existing UserRole enum

export const UserRole = {
  // Admin & Management
  SUPER_ADMIN: 'super_admin',
  GENERAL_MANAGER: 'general_manager',
  BRANCH_MANAGER: 'branch_manager',
  BRANCH_OPERATIONS_MANAGER: 'branch_operations_manager',
  CENTRAL_OPERATIONS_MANAGER: 'central_operations_manager',
  FACILITIES_MANAGER: 'facilities_manager',
  
  // Front Desk
  RECEPTIONIST: 'receptionist',
  
  // Food & Beverage
  RESTAURANT: 'restaurant',
  POS_KITCHEN: 'pos_kitchen',
  KITCHEN: 'kitchen',
  KITCHEN_OPERATIONS: 'kitchen_operations',
  BARTENDER: 'bartender',
  BARMAN: 'barman',
  BARMAID: 'barmaid',
  BAR_MANAGER: 'bar_manager',
  WAITER: 'waiter',
  WAITRESS: 'waitress',
  HEAD_WAITER: 'head_waiter',
  CHEF: 'chef',
  HEAD_CHEF: 'head_chef',
  COOK: 'cook',
  
  // Finance
  CASHIER: 'cashier',
  ACCOUNTANT: 'accountant',
  BRANCH_ACCOUNTANT: 'branch_accountant',
  AUDITOR: 'auditor',
  
  // Support & Logistics
  HR_MANAGER: 'hr_manager',
  PROCUREMENT: 'procurement',
  PURCHASING_MANAGER: 'purchasing_manager',
  CENTRAL_STOREKEEPER: 'central_storekeeper',
  BRANCH_STOREKEEPER: 'branch_storekeeper',
  STOREKEEPER: 'storekeeper',
  HOUSEKEEPING: 'housekeeping',
  HOUSEKEEPING_SUPERVISOR: 'housekeeping_supervisor',
  MAINTENANCE: 'maintenance',
  DRIVER: 'driver',
  EMPLOYEE: 'employee',
  GUEST: 'guest',
  
  // Kyogong Specific
  KYOGONG_SPA_CASHIER: 'kyogong_spa_cashier',
  KYOGONG_EXECUTIVE_BAR_CASHIER: 'kyogong_executive_bar_cashier',
  KYOGONG_SPORTS_BAR_CASHIER: 'kyogong_sports_bar_cashier',
  KYOGONG_RECEPTION_CASHIER: 'kyogong_reception_cashier',
} as const;

export type UserRoleType = typeof UserRole[keyof typeof UserRole];

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

export const ROLE_NAV_MAP: Record<string, NavItem[]> = {
  [UserRole.SUPER_ADMIN]: [
    { path: '/dashboard/admin', label: 'Admin Dashboard', icon: '⚙️' },
    { path: '/dashboard/admin/restaurant/menu', label: 'Restaurant Menu', icon: '🍽️' },
    { path: '/dashboard/admin/bar/menu', label: 'Bar Menu', icon: '🍺' },
    { path: '/dashboard/admin/kyogong/services', label: 'Kyogong Services', icon: '🧖' },
    { path: '/dashboard/admin/wastage', label: 'Wastage Analytics', icon: '🗑️' },
    { path: '/dashboard/cashier', label: 'Cashier Station', icon: '💳' },
    { path: '/dashboard/branch-accounting/bookings', label: 'Bookings', icon: '📅' },
    { path: '/dashboard/admin/docs', label: 'Employee Docs', icon: '📄' },
    { path: '/dashboard/auditor', label: 'Auditor Overview', icon: '🛡️' },
    { path: '/dashboard/central-store', label: 'Central Store', icon: '🏪' },
    { path: '/dashboard/procurement', label: 'Procurement', icon: '🛒' },
    { path: '/dashboard/hr', label: 'HR Dashboard', icon: '👥' },
    { path: '/dashboard/branch-operations', label: 'Branch Operations', icon: '🏢' },
    { path: '/dashboard/facilities', label: 'Facilities', icon: '🔧' },
    { path: '/dashboard/kitchen-operations', label: 'Kitchen Ops', icon: '👨‍🍳' },
  ],
  [UserRole.GENERAL_MANAGER]: [
    { path: '/dashboard/gm', label: 'GM Overview', icon: '🏢' },
    { path: '/dashboard/gm/branches', label: 'Branches', icon: '🏘️' },
    { path: '/dashboard/gm/reservations', label: 'Reservations', icon: '📅' },
    { path: '/dashboard/gm/staff', label: 'All Staff', icon: '👥' },
    { path: '/dashboard/gm/finance', label: 'Finance', icon: '💰' },
    { path: '/dashboard/gm/reports', label: 'Reports', icon: '📊' },
    { path: '/dashboard/central-store', label: 'Central Store', icon: '🏪' },
    { path: '/dashboard/procurement', label: 'Procurement', icon: '🛒' },
  ],
  [UserRole.BRANCH_MANAGER]: [
    { path: '/dashboard/branch-manager', label: 'Manager Overview', icon: '🏢' },
    { path: '/dashboard/branch-manager/reservations', label: 'Reservations', icon: '📅' },
    { path: '/dashboard/branch-manager/checkin', label: 'Check-in Desk', icon: '🔑' },
    { path: '/dashboard/branch-manager/guests', label: 'Guests', icon: '👥' },
    { path: '/dashboard/branch-manager/rooms', label: 'Rooms', icon: '🛏️' },
    { path: '/dashboard/branch-manager/staff', label: 'Staff', icon: '👥' },
    { path: '/dashboard/branch-manager/restaurant', label: 'Restaurant', icon: '🍽️' },
  ],
  [UserRole.RECEPTIONIST]: [
    { path: '/dashboard/reception', label: 'Reception Overview', icon: '🏠' },
    { path: '/dashboard/reception/checkin', label: 'Check-in/Out', icon: '🔑' },
    { path: '/dashboard/reception/reservations', label: 'Reservations', icon: '📅' },
    { path: '/dashboard/reception/guests', label: 'Guests', icon: '👥' },
    { path: '/dashboard/reception/rooms', label: 'Rooms', icon: '🛏️' },
    { path: '/dashboard/branch-accounting/bookings', label: 'Bookings', icon: '📅' },
    { path: '/dashboard/cashier', label: 'Cashier Station', icon: '💳' },
  ],
  [UserRole.POS_KITCHEN]: [
    { path: '/dashboard/pos-kitchen', label: 'POS Overview', icon: '🍴' },
    { path: '/dashboard/pos-kitchen?tab=restaurant', label: 'Take Orders', icon: '🛒' },
    { path: '/dashboard/pos-kitchen?tab=recent', label: 'Recent Orders', icon: '🕒' },
  ],
  [UserRole.KITCHEN]: [
    { path: '/dashboard/kitchen', label: 'Kitchen Display', icon: '👨‍🍳' },
    { path: '/dashboard/kitchen?tab=kitchen', label: 'Active Orders', icon: '🔥' },
    { path: '/dashboard/kitchen?tab=wastage', label: 'Wastage Record', icon: '🗑️' },
  ],
  [UserRole.BARTENDER]: [
    { path: '/dashboard/bar', label: 'Bar Overview', icon: '🍷' },
    { path: '/dashboard/pos-kitchen?tab=bar', label: 'Unified POS', icon: '💳' },
    { path: '/dashboard/bar/tabs', label: 'Customer Tabs', icon: '🧾' },
    { path: '/dashboard/bar/inventory', label: 'Bar Inventory', icon: '📦' },
  ],
  [UserRole.AUDITOR]: [
    { path: '/dashboard/auditor', label: 'Auditor Overview', icon: '🛡️' },
    { path: '/dashboard/auditor/search', label: 'Search', icon: '🔍' },
    { path: '/dashboard/auditor/financial-verification', label: 'Financials', icon: '💰' },
    { path: '/dashboard/auditor/revenue-oversight', label: 'Revenue', icon: '📈' },
    { path: '/dashboard/auditor/stock', label: 'Stock Levels', icon: '📦' },
    { path: '/dashboard/hr/performance', label: 'Performance', icon: '🏆' },
  ],
  [UserRole.ACCOUNTANT]: [
    { path: '/dashboard/branch-accounting', label: 'Accounting Overview', icon: '📊' },
    { path: '/dashboard/branch-accounting/shift-review', label: 'Shift Recon', icon: '📖' },
    { path: '/dashboard/branch-accounting/payments', label: 'Payments', icon: '💳' },
    { path: '/dashboard/branch-accounting/record-banking', label: 'Banking', icon: '➕' },
    { path: '/dashboard/branch-accounting/bookings', label: 'Bookings', icon: '📅' },
  ],
  [UserRole.BRANCH_ACCOUNTANT]: [
    { path: '/dashboard/branch-accounting', label: 'Accounting Overview', icon: '📊' },
    { path: '/dashboard/branch-accounting/shift-review', label: 'Shift Recon', icon: '📖' },
    { path: '/dashboard/branch-accounting/payments', label: 'Payments', icon: '💳' },
  ],
  [UserRole.CASHIER]: [
    { path: '/dashboard/cashier', label: 'Cashier Station', icon: '💳' },
  ],
  [UserRole.KYOGONG_SPA_CASHIER]: [
    { path: '/dashboard/kyogong/spa', label: 'Spa POS', icon: '🧖' },
    { path: '/dashboard/cashier', label: 'Cashier Station', icon: '💳' },
  ],
  [UserRole.KYOGONG_SPORTS_BAR_CASHIER]: [
    { path: '/dashboard/kyogong/sports-bar', label: 'Sports Bar POS', icon: '🏆' },
    { path: '/dashboard/cashier', label: 'Cashier Station', icon: '💳' },
  ],
  [UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER]: [
    { path: '/dashboard/kyogong/executive-bar', label: 'Exec Bar POS', icon: '🍸' },
    { path: '/dashboard/cashier', label: 'Cashier Station', icon: '💳' },
  ],
  [UserRole.KYOGONG_RECEPTION_CASHIER]: [
    { path: '/dashboard/kyogong/reception', label: 'Reception POS', icon: '🏨' },
    { path: '/dashboard/cashier', label: 'Cashier Station', icon: '💳' },
  ],
  default: [
    { path: '/dashboard', label: 'Dashboard', icon: '🏠' },
    { path: '/profile', label: 'Profile', icon: '👤' },
  ],
};
