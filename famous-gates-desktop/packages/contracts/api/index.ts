// ── API Request / Response Contracts ─────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
    branch_id?: string;
    full_name?: string;
  };
}

export interface PinLoginRequest {
  pin: string;
}

export interface BookingCreateRequest {
  guest_name: string;
  guest_email?: string;
  guest_phone?: string;
  room_id: string;
  check_in: string;
  check_out: string;
  adults: number;
  children?: number;
  notes?: string;
}

export interface BookingUpdateRequest {
  status?: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
  check_in?: string;
  check_out?: string;
  notes?: string;
}

export interface PaymentCreateRequest {
  booking_id?: string;
  amount: number;
  method: 'cash' | 'card' | 'mobile_money' | 'bank_transfer';
  reference?: string;
  notes?: string;
}

export interface StockAdjustmentRequest {
  sku: string;
  quantity_delta: number;
  reason: string;
  notes?: string;
}

export interface DispatchRequest {
  items: Array<{ sku: string; quantity: number }>;
  destination: string;
  notes?: string;
}

export interface PurchaseOrderCreateRequest {
  supplier_id: string;
  items: Array<{ sku: string; quantity: number; unit_cost: number }>;
  expected_delivery?: string;
  notes?: string;
}
