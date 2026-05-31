export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  GENERAL_MANAGER = 'general_manager',
  BRANCH_MANAGER = 'branch_manager',
  RECEPTIONIST = 'receptionist',
  HOUSEKEEPING = 'housekeeping',
  RESTAURANT = 'restaurant',
  MAINTENANCE = 'maintenance',
  ACCOUNTANT = 'accountant',
  BRANCH_ACCOUNTANT = 'branch_accountant',
  AUDITOR = 'auditor',
  CENTRAL_STOREKEEPER = 'central_storekeeper',
  BRANCH_STOREKEEPER = 'branch_storekeeper',
  CASHIER = 'cashier',
  RESTAURANT_CASHIER = 'restaurant_cashier',
  MAIN_BAR_CASHIER = 'main_bar_cashier',
  EXECUTIVE_BAR_CASHIER = 'executive_bar_cashier',
  NON_CONSUMABLES_CASHIER = 'non_consumables_cashier',
  EMPLOYEE = 'employee',
  GUEST = 'guest'
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  avatar?: string;
  department?: string;
  phone_number?: string;
  address?: string;
  created_at: string;
  updated_at?: string;
  last_login?: string;
  password_changed_at?: string;
}

export interface AuthResponse {
  success: boolean;
  data?: {
    user: User;
    session: any;
  };
  message?: string;
}
