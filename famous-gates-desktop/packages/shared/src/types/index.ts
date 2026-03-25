// ── Shared DTOs ───────────────────────────────────────────────────────────────
// These types are shared between the UI and service layers.

export interface User {
  id: string;
  email: string;
  role: string;
  branch_id?: string;
  full_name?: string;
  avatar_url?: string;
}

export interface Session {
  user: User;
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

export interface Booking {
  id: string;
  confirmation_number: string;
  guest_name: string;
  room_id: string;
  check_in: string;
  check_out: string;
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
  total_amount: number;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string;
  number: string;
  type: string;
  floor: number;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  rate_per_night: number;
}

export interface Payment {
  id: string;
  booking_id?: string;
  amount: number;
  method: 'cash' | 'card' | 'mobile_money' | 'bank_transfer';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  reference?: string;
  created_at: string;
}

export interface StockItem {
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  reorder_level: number;
  unit_cost: number;
}

export interface OutboxEntry {
  id: string;
  entity: string;
  operation: 'create' | 'update' | 'delete';
  payload: Record<string, unknown>;
  status: 'pending' | 'syncing' | 'done' | 'failed';
  retry_count: number;
  created_at: string;
}

export interface SyncStatus {
  last_synced_at: string | null;
  pending_count: number;
  is_syncing: boolean;
  error?: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
}
