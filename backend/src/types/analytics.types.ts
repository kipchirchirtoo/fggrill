// Analytics Types for Branch Manager Dashboard
// Defines all TypeScript interfaces and types for analytics features

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  MPESA = 'mpesa',
  MIXED = 'mixed'
}

export enum OrderType {
  WALK_IN = 'walk_in',
  ONLINE = 'online',
  BOOKING = 'booking',
  ROOM_SERVICE = 'room_service',
  DINE_IN = 'dine_in',
  TAKEAWAY = 'takeaway'
}

export enum ServiceCategory {
  ROOMS = 'rooms',
  RESTAURANT = 'restaurant',
  BAR = 'bar',
  SPA = 'spa',
  CONFERENCE = 'conference',
  DYNAMIC_SERVICES = 'dynamic_services'
}

export interface SalesFilter {
  payment_methods?: PaymentMethod[];
  order_types?: OrderType[];
  categories?: ServiceCategory[];
}

export interface BranchSalesRequest {
  branch_id: number;
  start_date: string; // ISO 8601 format (YYYY-MM-DD)
  end_date: string;   // ISO 8601 format (YYYY-MM-DD)
  filters?: SalesFilter;
}

export interface SalesMetrics {
  total_sales: number;
  transaction_count: number;
  avg_transaction_value: number;
}

export interface DailyBreakdown {
  date: string;
  total_sales: number;
  transaction_count: number;
  avg_transaction_value: number;
}

export interface PaymentMethodBreakdown {
  payment_method: PaymentMethod;
  total_sales: number;
  transaction_count: number;
  percentage: number;
}

export interface CategoryBreakdown {
  category: ServiceCategory;
  total_sales: number;
  transaction_count: number;
  percentage: number;
}

export interface BranchSalesData {
  summary: SalesMetrics;
  daily_breakdown: DailyBreakdown[];
  payment_method_breakdown: PaymentMethodBreakdown[];
  category_breakdown: CategoryBreakdown[];
  transactions?: TransactionRecord[];
}

export interface BranchSalesResponse {
  data: BranchSalesData;
  metadata: {
    branch_id: number;
    branch_name: string;
    date_range: {
      start: string;
      end: string;
    };
    generated_at: string;
    filters_applied: SalesFilter;
  };
}

export interface ExportRequest {
  branch_id: number;
  start_date: string;
  end_date: string;
  filters?: SalesFilter;
  format: 'pdf' | 'csv';
}

export interface TransactionRecord {
  id: string;
  branch_id: number;
  transaction_date: string;
  category: ServiceCategory;
  payment_method: PaymentMethod;
  order_type?: OrderType;
  total_amount: number;
  status: string;
  source: 'booking' | 'restaurant' | 'shift_transaction';
}
