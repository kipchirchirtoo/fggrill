// Comprehensive System Types for Famous Gates Hotels Management System

// ============= BOOKING SYSTEM =============
export interface Booking {
  id: string;
  bookingNumber: string;
  guestId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  roomId: string;
  roomNumber: string;
  roomType: string;
  checkInDate: Date;
  checkOutDate: Date;
  adults: number;
  children: number;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: 'pending' | 'partial' | 'paid' | 'refunded';
  bookingStatus: 'pending' | 'confirmed' | 'checked-in' | 'checked-out' | 'cancelled' | 'no-show';
  bookingSource: 'direct' | 'website' | 'phone' | 'walk-in' | 'ota' | 'corporate';
  specialRequests?: string;
  discountCode?: string;
  discountAmount?: number;
  createdAt: Date;
  updatedAt: Date;
  confirmationSent: boolean;
  reminderSent: boolean;
  notes?: string;
}

export interface RoomAvailability {
  roomId: string;
  date: Date;
  isAvailable: boolean;
  bookingId?: string;
  status: 'available' | 'occupied' | 'maintenance' | 'blocked';
  price: number;
  dynamicPrice?: number;
}

// ============= INVENTORY MANAGEMENT =============
import { Branch, Category, SubCategory } from './inventory';

export interface InventoryItem {
  id: string;
  itemCode: string;
  name: string;
  category: Category;
  sub_category: SubCategory;
  branch: Branch;
  unit: string;
  currentStock: number;
  minimumStock: number;
  maximumStock: number;
  reorderPoint: number;
  unitCost: number;
  supplier_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  tags: string[];
  isActive: boolean;
}

export interface StockMovement {
  id: string;
  itemId: string;
  movementType: 'in' | 'out' | 'transfer' | 'adjustment' | 'damage' | 'return';
  quantity: number;
  fromLocation?: string;
  toLocation?: string;
  reason: string;
  performedBy: string;
  timestamp: Date;
  referenceNumber?: string;
  notes?: string;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  items: Array<{
    itemId: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  totalAmount: number;
  status: 'draft' | 'pending' | 'approved' | 'ordered' | 'received' | 'cancelled';
  orderDate: Date;
  expectedDelivery?: Date;
  actualDelivery?: Date;
  approvedBy?: string;
  notes?: string;
}

// ============= HR & PAYROLL =============
export interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  employmentType: 'full-time' | 'part-time' | 'contract' | 'intern';
  joinDate: Date;
  status: 'active' | 'on-leave' | 'suspended' | 'terminated';
  baseSalary: number;
  allowances: Array<{
    type: string;
    amount: number;
  }>;
  bankDetails?: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    branch: string;
  };
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  documents: Array<{
    type: string;
    url: string;
    uploadedAt: Date;
  }>;
}

export interface Payroll {
  id: string;
  employeeId: string;
  payPeriod: {
    start: Date;
    end: Date;
  };
  baseSalary: number;
  allowances: number;
  overtime: number;
  deductions: {
    tax: number;
    insurance: number;
    pension: number;
    other: number;
  };
  netPay: number;
  status: 'draft' | 'approved' | 'paid' | 'cancelled';
  paymentMethod: 'bank' | 'cash' | 'cheque';
  paymentDate?: Date;
  approvedBy?: string;
  payslipUrl?: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveType: 'annual' | 'sick' | 'maternity' | 'paternity' | 'unpaid' | 'other';
  startDate: Date;
  endDate: Date;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approvedBy?: string;
  approvalDate?: Date;
  comments?: string;
}

export interface Attendance {
  id: string;
  employeeId: string;
  date: Date;
  checkIn?: Date;
  checkOut?: Date;
  shiftType: 'morning' | 'evening' | 'night';
  status: 'present' | 'absent' | 'late' | 'half-day' | 'holiday' | 'leave';
  overtimeHours?: number;
  notes?: string;
}

// ============= HOUSEKEEPING =============
export interface HousekeepingTask {
  id: string;
  roomId: string;
  roomNumber: string;
  taskType: 'daily-clean' | 'deep-clean' | 'check-out-clean' | 'check-in-prep' | 'maintenance';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'assigned' | 'in-progress' | 'completed' | 'inspected' | 'failed';
  assignedTo?: string;
  assignedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  inspectedBy?: string;
  inspectionNotes?: string;
  checklist: Array<{
    item: string;
    completed: boolean;
  }>;
  suppliesUsed: Array<{
    itemId: string;
    quantity: number;
  }>;
  estimatedDuration: number; // in minutes
  actualDuration?: number;
  notes?: string;
}

export interface RoomStatus {
  roomId: string;
  roomNumber: string;
  currentStatus: 'clean' | 'dirty' | 'inspected' | 'out-of-service' | 'occupied';
  lastCleaned?: Date;
  lastInspected?: Date;
  nextScheduledCleaning?: Date;
  issues: Array<{
    type: string;
    description: string;
    reportedAt: Date;
    reportedBy: string;
    resolved: boolean;
  }>;
}

// ============= MAINTENANCE =============
export interface MaintenanceRequest {
  id: string;
  requestNumber: string;
  assetId?: string;
  location: string;
  category: 'electrical' | 'plumbing' | 'hvac' | 'furniture' | 'appliance' | 'structural' | 'other';
  issueDescription: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  status: 'pending' | 'assigned' | 'in-progress' | 'on-hold' | 'completed' | 'cancelled';
  reportedBy: string;
  reportedAt: Date;
  assignedTo?: string;
  assignedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedCost?: number;
  actualCost?: number;
  partsUsed: Array<{
    itemId: string;
    quantity: number;
    cost: number;
  }>;
  photos: string[];
  notes?: string;
  slaDeadline?: Date;
  preventive: boolean;
}

export interface Asset {
  id: string;
  assetCode: string;
  name: string;
  category: string;
  location: string;
  purchaseDate: Date;
  purchaseCost: number;
  warrantyExpiry?: Date;
  lastMaintenanceDate?: Date;
  nextMaintenanceDate?: Date;
  status: 'operational' | 'under-maintenance' | 'faulty' | 'decommissioned';
  specifications?: Record<string, any>;
  documents: string[];
  maintenanceHistory: Array<{
    date: Date;
    type: string;
    description: string;
    cost: number;
    performedBy: string;
  }>;
}

// ============= NOTIFICATIONS & EVENTS =============
export interface SystemNotification {
  id: string;
  type: 'booking' | 'payment' | 'inventory' | 'maintenance' | 'hr' | 'system';
  priority: 'low' | 'normal' | 'high' | 'critical';
  title: string;
  message: string;
  recipientId?: string;
  recipientRole?: string;
  isRead: boolean;
  createdAt: Date;
  readAt?: Date;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export interface SystemEvent {
  id: string;
  eventType: string;
  module: string;
  userId: string;
  timestamp: Date;
  description: string;
  metadata: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

// ============= REPORTS & ANALYTICS =============
export interface Report {
  id: string;
  name: string;
  type: 'occupancy' | 'revenue' | 'inventory' | 'payroll' | 'maintenance' | 'custom';
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'on-demand';
  parameters: Record<string, any>;
  format: 'pdf' | 'excel' | 'csv' | 'json';
  recipients: string[];
  lastGenerated?: Date;
  nextScheduled?: Date;
  isActive: boolean;
}

export interface KPI {
  id: string;
  name: string;
  module: string;
  value: number;
  unit: string;
  target?: number;
  trend: 'up' | 'down' | 'stable';
  period: {
    start: Date;
    end: Date;
  };
  comparison?: {
    previousValue: number;
    percentageChange: number;
  };
}

// ============= INTEGRATION INTERFACES =============
export interface APIEndpoint {
  id: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  module: string;
  authentication: boolean;
  roles: string[];
  rateLimit?: number;
  documentation?: string;
}

export interface WebSocketEvent {
  event: string;
  module: string;
  data: any;
  timestamp: Date;
  userId?: string;
  broadcast: boolean;
}

// ============= SMART FEATURES =============
export interface PredictiveAnalysis {
  id: string;
  type: 'demand-forecast' | 'maintenance-prediction' | 'inventory-forecast';
  module: string;
  prediction: any;
  confidence: number;
  factors: Array<{
    name: string;
    impact: number;
  }>;
  generatedAt: Date;
  validUntil: Date;
}

export interface AutomationRule {
  id: string;
  name: string;
  module: string;
  trigger: {
    type: string;
    conditions: Record<string, any>;
  };
  actions: Array<{
    type: string;
    parameters: Record<string, any>;
  }>;
  isActive: boolean;
  lastTriggered?: Date;
  triggerCount: number;
}
