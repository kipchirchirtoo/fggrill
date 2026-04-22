/**
 * types.ts — Universal Domain Types for FamousGate API
 * Every API request/response should use these instead of 'any'.
 */

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
  count?: number; // For paginated results
  pages?: number;
  stats?: any;
  summary?: any;
  // Legacy Aliases (Partial compatibility for existing consumers)
  staff?: any;
  branches?: any;
  rooms?: any;
  bookings?: any;
  items?: any;
  invoices?: any;
  transactions?: any;
  users?: any;
  products?: any;
  payroll?: any;
  attendance?: any;
  receipts?: any;
  orders?: any;
  payments?: any;
}

// ─── System & Auth ───────────────────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: string;
  branch_id: number | null;
  is_active: boolean;
  photo_url?: string;
  permissions?: string[];
  
  // UI Compatibility Aliases
  first_name?: string;
  last_name?: string;
  firstName?: string;
  lastName?: string;
  branch_name?: string;
  is_central?: boolean;
  department?: string;
  employee_id?: string;
  start_date?: string;
  profile_photo?: string;
  id_number?: string;
  phone_number?: string;
}

export interface AuthResponse {
  user: User;
  session: {
    access_token: string;
    refresh_token?: string;
  };
}

export interface Branch {
  id: any;
  name: string;
  code: string;
  location: string;
  is_main_branch?: boolean;
  is_active?: boolean;
  is_central?: any; // UI compatibility
  is_central_warehouse?: boolean;
  branch_type?: string;
  status: any;
  number_of_rooms?: number;
  room_count?: number; // Alias
  occupancy_rate?: number;
  daily_revenue?: number;
  staff_count?: number;
  settings?: Record<string, any>;
}

export interface Department {
  id: number;
  name: string;
  branch_id?: number;
  staff_count?: number;
  status?: 'active' | 'inactive';
}

export interface Role {
  id: string;
  name: string;
  permissions: string[];
}

// ─── Staff & Payroll ──────────────────────────────────────────────────────────

export interface StaffMember {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  email?: any;
  phone?: any;
  branch_id: number;
  branch_name?: string; // Alias
  department_id?: number;
  department?: string; // Alias
  role_id?: string;
  role?: string; // Alias
  status: any;
  id_number?: string;
  national_id?: string; // Alias
  nssf_number?: string;
  nhif_number?: string;
  kra_pin?: string;
  base_salary: number;
  join_date: string;
  photo_url?: string;
  phoneNumber?: string; // Alias
}

export interface AttendanceRecord {
  id: string;
  staff_id: string;
  staff_name?: string; // UI compatibility
  date: string;
  clock_in?: string;
  clock_out?: string;
  status: 'present' | 'absent' | 'late' | 'half-day' | 'holiday' | 'leave';
  is_approved: boolean;
  approved_by?: string;
}

export interface AttendanceStats {
  total_present: number;
  total_absent: number;
  total_late: number;
  on_leave: number;
  unrecorded: number;
  branch_stats?: any;
}

export interface LeaveRequest {
  id: string;
  staff_id: string;
  type: any;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approved_by?: string;
  // Report to Duty fields
  reported_to_duty?: boolean;
  actual_return_date?: string;
  reported_at?: string;
  reported_by?: string;
  report_notes?: string;
}

export interface PayrollRecord {
  id: string;
  staff_id: string;
  month: number;
  year: number;
  base_salary: number;
  gross_pay: number;
  net_pay: number;
  deductions: number;
  status: 'draft' | 'approved' | 'paid';
  branch_id: number;
}

export interface Driver {
  id: string;
  employee_id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string;
  license_number: string;
  status: 'active' | 'inactive';
}

export interface Trip {
  id: string;
  driver_id: string;
  vehicle_id: string;
  start_location: string;
  end_location: string;
  status: 'scheduled' | 'on-going' | 'completed' | 'cancelled';
  distance?: number;
}

// ─── Store & Inventory ────────────────────────────────────────────────────────

export interface InventoryItem {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  category: string;
  unit: string;
  unit_price: number;
  cost_price?: number;
  current_stock: number;
  min_stock: number;
  max_stock?: number;
  reorder_level?: number;
  supplier?: string;
  is_active: boolean;
  branch_id?: number;
  quantity?: number; // Alias
  item_name?: any; // Alias
  unit_of_measure?: string; // Alias
  branch_name?: string; // For audit logs
  retail_price?: number; // Alias
}

export type Product = InventoryItem;
export type Item = InventoryItem;
export type CatalogItem = InventoryItem;
export type StoreItem = InventoryItem;

export interface StockRequest {
  id: string;
  request_number: string;
  request_type?: any;
  requesting_branch_id: number;
  status: 'PENDING' | 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED' | 'FULFILLED' | 'CANCELLED' | 'IN_TRANSIT' | 'DELIVERED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  items_count?: number;
  reason?: string;
  notes?: string;
  needed_by_date?: string;
  created_at: string;
  branch_name?: any; // UI compatibility
  to_branch_id?: number; // For transfers
  branch?: {
    id: number;
    name: string;
    code: string;
    location: string;
  };
  items: Array<{
    id: string;
    item_sku: string;
    requested_quantity: number;
    approved_quantity?: number;
    status: string;
    item?: Partial<InventoryItem>;
  }>;
  auditor_id?: string;
  audited_at?: string;
  audit_notes?: string;
}

export interface StockAudit {
  id: string;
  branch_id: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  created_at: string;
  items: StockAuditItem[];
}

export interface StockAuditItem {
  id: string;
  audit_id: string;
  item_sku: string;
  item_name?: string;
  expected_quantity: number;
  actual_quantity: number;
  variance: number;
  notes?: string;
}

// ─── Finance & Accounting ─────────────────────────────────────────────────────

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_email?: string;
  customer?: {
    id: string;
    customer_name: string;
    email?: string;
    phone?: string;
  };
  invoice_date: string;
  due_date: string;
  subtotal?: number; // Alias
  vat_amount?: number; // Alias
  total_amount: number;
  balance?: number;
  status: 'draft' | 'sent' | 'paid' | 'unpaid' | 'partially_paid' | 'voided';
  branch_id: number;
  type: 'CONFERENCE' | 'HOTEL' | 'RESTAURANT' | 'GUEST' | 'GENERAL';
  reference_number?: string;
  supplier_name?: string;
}

export interface Customer {
  id: string;
  customer_name: string;
  name?: string; // Alias
  email?: string;
  phone?: string;
  address?: string;
  branch_id?: number;
}

export interface Transaction {
  id: string;
  date: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  payment_method: string;
  description?: string;
  reference?: string;
  status: 'completed' | 'pending' | 'voided';
  branch_id: number;
}

export interface PaymentVerification {
  id: string;
  source: 'banking' | 'pos' | 'payment' | 'manual';
  transaction_id?: string;
  description?: string;
  amount: number | string;
  payment_method: string;
  reference_number?: string;
  status: 'pending' | 'accountant_verified' | 'auditor_verified' | 'flagged';
  recorded_by?: string;
  recorded_at: string;
  created_at?: string;
  notes?: string;
  recorder_notes?: string;
  bill_reference?: string;
  accountant_verified_by?: string;
  accountant_verified_at?: string;
  accountant_notes?: string;
  auditor_verified_by?: string;
  auditor_verified_at?: string;
  auditor_notes?: string;
  auditor_status?: 'pending' | 'approved' | 'flagged';
  branch_id: number;
  customer_name?: string;
  recorded_by_user?: {
    full_name: string;
    email?: string;
    role?: string;
  };
  accountant_verified_by_user?: {
    full_name: string;
    email?: string;
    role?: string;
  };
  auditor_verified_by_user?: {
    full_name: string;
    email?: string;
    role?: string;
  };
  _source?: string;
  _transaction_date?: string;
  _banking_type?: string;
  _bank_name?: string;
}

export interface PaymentStats {
  [key: string]: number | undefined;
  total_payments: number;
  pending: number;
  accountant_verified: number;
  auditor_verified: number;
  flagged: number;
  total_amount?: number;
  banking_total?: number;
  pos_total?: number;
  payments_total?: number;
}

// ─── Rooms & Bookings ─────────────────────────────────────────────────────────

export interface RoomType {
  id: string;
  name: string;
  description?: string;
  base_price: number;
  capacity: number;
  amenities?: string[];
}

export interface Room {
  id: string;
  room_number: any;
  type_id: string;
  status: 'available' | 'occupied' | 'dirty' | 'maintenance' | 'out-of-service';
  branch_id: number;
  price_per_night: number;
  price?: number; // Alias
  floor?: string;
  max_occupancy?: number;
  amenities?: string[];
  type?: RoomType;
  room_type?: any; // Alias
}

export interface Booking {
  id: string;
  booking_number: string;
  guest_name: string;
  guest_email?: string;
  room_id: string;
  room_number?: any;
  check_in_date: string;
  check_out_date: string;
  check_in?: string; // Alias
  check_out?: string; // Alias
  status: 'pending' | 'confirmed' | 'checked-in' | 'checked-out' | 'cancelled';
  total_amount: number;
  total?: number; // Alias
  paid_amount: number;
  amount_paid?: number; // Alias
  nights?: number;
  invoice_id?: string;
  guest?: any; // Compatibility
  adults?: number;
  children?: number;
  confirmation_number?: string;
  room_type?: any;
  guest_id?: string;
  guest_phone?: string;
}

export interface BookingCreateResponse {
  booking: Booking;
  confirmationNumber: string;
  bookingId: string;
}

// ─── Kitchen & Food Control ───────────────────────────────────────────────────

export interface KitchenWastage {
  id: string;
  item_sku: string;
  item_name?: string;
  quantity: number;
  unit_of_measure: string;
  reason: string;
  estimated_value?: number;
  photo_url?: string;
  shift?: string;
  status: 'pending_review' | 'reviewed' | 'approved' | 'rejected';
  reported_by?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  auditor_id?: string;
  audited_at?: string;
  review_notes?: string;
  created_at: string;
}

export interface KitchenUsage {
  id: string;
  item_sku: string;
  item_name?: string;
  quantity: number;
  unit_of_measure: string;
  usage_type: string;
  shift?: string;
  chef_on_duty?: string;
  status: 'pending_review' | 'reviewed' | 'approved' | 'rejected';
  notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  auditor_id?: string;
  audited_at?: string;
  review_notes?: string;
  created_at: string;
}

// ─── Reports & Analytics ─────────────────────────────────────────────────────

export interface ReportTemplate {
  id: string;
  name: string;
  type: string;
  description?: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'on-demand';
}

export interface AuditLog {
  id: string;
  userId: string;
  user_name?: string;
  action: string;
  module: string;
  details: string;
  timestamp: string;
  created_at?: string;
  severity?: string;
  ip_address?: string;
}

export interface SystemNotification {
  id: number;
  type: 'booking' | 'payment' | 'inventory' | 'maintenance' | 'hr' | 'system';
  priority: 'low' | 'normal' | 'high' | 'critical';
  title: string;
  message: string;
  recipient_id?: string;
  recipient_role?: string;
  is_read: boolean;
  created_at: string;
  read_at?: string;
  action_url?: string;
  metadata?: Record<string, any>;
}

// ─── Kyogong POS ─────────────────────────────────────────────────────────────

export interface SalesPoint {
  id: number;
  name: string;
  code: string;
  branch_id: number;
  is_active: boolean;
  supports_petty_cash: boolean;
}

export interface Shift {
  id: string;
  sales_point_id: number;
  user_id: string;
  status: 'OPEN' | 'CLOSED' | 'FLAGGED' | 'APPROVED';
  opening_cash_float: number;
  opening_petty_cash: number;
  closing_cash_counted?: number;
  closing_petty_cash?: number;
  cash_sales: number;
  mpesa_sales: number;
  card_sales: number;
  total_sales: number;
  variance?: number;
  variance_reason?: string;
  opened_at: string;
  closed_at?: string;
  sales_point?: SalesPoint;
}

export interface KyogongTransaction {
  id: string;
  shift_id: string;
  transaction_number: string;
  customer_name?: string;
  customer_phone?: string;
  payment_method: 'CASH' | 'MPESA' | 'CARD' | 'BILL';
  total_amount: number;
  cash_amount: number;
  mpesa_amount: number;
  card_amount: number;
  items: Array<{
    item_type: string;
    item_id: string;
    item_name: string;
    quantity: number;
    unit_price: number;
  }>;
  created_at: string;
}

export interface DynamicService {
  id: number;
  service_type: string;
  name: string;
  pricing_model: 'fixed' | 'hourly';
  base_price: number;
  price_per_hour?: number;
  is_active: boolean;
}

export interface PettyCashEntry {
  id: string;
  shift_id: string;
  amount: number;
  transaction_type: 'CASH_IN' | 'CASH_OUT';
  purpose_category: string;
  purpose_description: string;
  paid_to_name?: string;
  receipt_number?: string;
  authorizer_name?: string;
  created_at: string;
}
