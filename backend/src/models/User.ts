import { supabase } from '../config/database';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  GENERAL_MANAGER = 'general_manager',
  BRANCH_MANAGER = 'branch_manager',
  DIRECTOR = 'director',

  // Front Office & Reception
  RECEPTIONIST = 'receptionist',
  FRONT_DESK_SUPERVISOR = 'front_desk_supervisor',
  CONCIERGE = 'concierge',
  BELL_CAPTAIN = 'bell_captain',
  BELLHOP = 'bellhop',

  // Housekeeping
  HOUSEKEEPING = 'housekeeping',
  HOUSEKEEPING_SUPERVISOR = 'housekeeping_supervisor',
  ROOM_ATTENDANT = 'room_attendant',
  LAUNDRY_ATTENDANT = 'laundry_attendant',

  // Restaurant & Food Service
  RESTAURANT = 'restaurant',
  RESTAURANT_MANAGER = 'restaurant_manager',
  HEAD_CHEF = 'head_chef',
  SOUS_CHEF = 'sous_chef',
  LINE_COOK = 'line_cook',
  PREP_COOK = 'prep_cook',
  WAITER = 'waiter',
  WAITRESS = 'waitress',
  HEAD_WAITER = 'head_waiter',
  BARTENDER = 'bartender',
  BARISTA = 'barista',
  FOOD_RUNNER = 'food_runner',
  BUSSER = 'busser',
  HOST_HOSTESS = 'host_hostess',

  // Kitchen & POS
  POS_KITCHEN = 'pos_kitchen',
  KITCHEN = 'kitchen',
  KITCHEN_OPERATIONS = 'kitchen_operations',
  CHOMA_ZONE_KDS = 'choma_zone_kds',
  KITCHEN_HELPER = 'kitchen_helper',
  DISHWASHER = 'dishwasher',

  // Maintenance & Engineering
  MAINTENANCE = 'maintenance',
  MAINTENANCE_SUPERVISOR = 'maintenance_supervisor',
  ELECTRICIAN = 'electrician',
  PLUMBER = 'plumber',
  HVAC_TECHNICIAN = 'hvac_technician',
  GROUNDSKEEPER = 'groundskeeper',

  // Security
  SECURITY_SUPERVISOR = 'security_supervisor',
  SECURITY_GUARD = 'security_guard',
  NIGHT_AUDITOR = 'night_auditor',

  // Finance & Administration
  ACCOUNTANT = 'accountant',
  BRANCH_ACCOUNTANT = 'branch_accountant',
  AUDITOR = 'auditor',
  FINANCE_MANAGER = 'finance_manager',
  HR_MANAGER = 'hr_manager',
  PAYROLL_CLERK = 'payroll_clerk',
  CASHIER = 'cashier',
  RESTAURANT_CASHIER = 'restaurant_cashier',
  MAIN_BAR_CASHIER = 'main_bar_cashier',
  EXECUTIVE_BAR_CASHIER = 'executive_bar_cashier',
  NON_CONSUMABLES_CASHIER = 'non_consumables_cashier',

  // FamousGateHotels Cashiers
  KYOGONG_SPA_CASHIER = 'kyogong_spa_cashier',
  KYOGONG_EXECUTIVE_BAR_CASHIER = 'kyogong_executive_bar_cashier',
  KYOGONG_SPORTS_BAR_CASHIER = 'kyogong_sports_bar_cashier',
  KYOGONG_RECEPTION_CASHIER = 'kyogong_reception_cashier',
  CHOMA_ZONE_CASHIER = 'choma_zone_cashier',

  // Store & Inventory
  CENTRAL_STOREKEEPER = 'central_storekeeper',
  BRANCH_STOREKEEPER = 'branch_storekeeper',
  INVENTORY_CLERK = 'inventory_clerk',
  PURCHASING_MANAGER = 'purchasing_manager',
  PROCUREMENT = 'procurement',
  STOREKEEPER = 'storekeeper',

  // Operations
  BRANCH_OPERATIONS_MANAGER = 'branch_operations_manager',
  CENTRAL_OPERATIONS_MANAGER = 'central_operations_manager',
  FACILITIES_MANAGER = 'facilities_manager',

  // General
  EMPLOYEE = 'employee',
  DRIVER = 'driver'
}

export interface IUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: UserRole;
  employeeId?: string;
  department?: string;
  position?: string;
  phoneNumber?: string;
  address?: string;
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  joinDate: Date;
  status: 'active' | 'inactive' | 'suspended';
  lastLogin?: Date;
  profilePhoto?: string;
  pos_pin?: string;
  permissions?: string[];
  refreshToken?: string;
  passwordChangedAt?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class User implements IUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: UserRole;
  employeeId?: string;
  department?: string;
  position?: string;
  phoneNumber?: string;
  address?: string;
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  joinDate: Date;
  status: 'active' | 'inactive' | 'suspended';
  lastLogin?: Date;
  profilePhoto?: string;
  pos_pin?: string;
  permissions?: string[];
  refreshToken?: string;
  passwordChangedAt?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<IUser>) {
    this.id = data.id || crypto.randomUUID();
    this.firstName = data.firstName || '';
    this.lastName = data.lastName || '';
    this.email = data.email || '';
    this.password = data.password || '';
    this.role = data.role || UserRole.EMPLOYEE;
    this.employeeId = data.employeeId;
    this.department = data.department;
    this.position = data.position;
    this.phoneNumber = data.phoneNumber;
    this.address = data.address;
    this.emergencyContact = data.emergencyContact;
    this.joinDate = data.joinDate || new Date();
    this.status = data.status || 'active';
    this.lastLogin = data.lastLogin;
    this.profilePhoto = data.profilePhoto;
    this.pos_pin = data.pos_pin;
    this.permissions = data.permissions;
    this.refreshToken = data.refreshToken;
    this.passwordChangedAt = data.passwordChangedAt;
    this.passwordResetToken = data.passwordResetToken;
    this.passwordResetExpires = data.passwordResetExpires;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  static async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !data) return null;
    return new User(data);
  }

  static async findById(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return new User(data);
  }

  async save(): Promise<User> {
    if (this.password && this.password.length >= 8) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }

    const { data, error } = await supabase
      .from('users')
      .upsert([
        {
          id: this.id,
          first_name: this.firstName,
          last_name: this.lastName,
          email: this.email,
          password: this.password,
          role: this.role,
          employee_id: this.employeeId,
          department: this.department,
          position: this.position,
          phone_number: this.phoneNumber,
          address: this.address,
          emergency_contact: this.emergencyContact,
          join_date: this.joinDate,
          status: this.status,
          last_login: this.lastLogin,
          profile_photo: this.profilePhoto,
          pos_pin: this.pos_pin,
          permissions: this.permissions,
          refresh_token: this.refreshToken,
          password_changed_at: this.passwordChangedAt,
          password_reset_token: this.passwordResetToken,
          password_reset_expires: this.passwordResetExpires,
          updated_at: new Date()
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return new User(data);
  }

  async delete(): Promise<void> {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', this.id);

    if (error) throw error;
  }

  getSignedJwtToken(): string {
    const secret = process.env.JWT_SECRET || '';
    const options: SignOptions = { expiresIn: Number(process.env.JWT_EXPIRES_IN_SECONDS) || 86400 };
    return jwt.sign({ id: this.id, role: this.role }, secret, options);
  }

  getRefreshToken(): string {
    const secret = process.env.JWT_REFRESH_SECRET || '';
    const options: SignOptions = { expiresIn: Number(process.env.JWT_REFRESH_EXPIRES_IN_SECONDS) || 2592000 };
    return jwt.sign({ id: this.id }, secret, options);
  }

  async comparePassword(candidatePassword: string): Promise<boolean> {
    return await bcrypt.compare(candidatePassword, this.password);
  }

  createPasswordResetToken(): string {
    const resetToken = crypto.randomBytes(32).toString('hex');

    this.passwordResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    this.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000);

    return resetToken;
  }
}
