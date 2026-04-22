# FamousGate Mobile - API Reference

## Base Configuration

```typescript
// API Base URL
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';

// All requests include:
headers: {
  'Authorization': 'Bearer <jwt_token>',
  'Content-Type': 'application/json'
}
```

## Authentication

### Login
```typescript
POST /api/auth/login

Request:
{
  email: string;
  password: string;
}

Response:
{
  token: string;
  refresh_token?: string;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: 'central_storekeeper' | 'branch_storekeeper' | 'cashier' | 'super_admin';
    branch_id?: string;
    branch_name?: string;
  }
}
```

### Refresh Token
```typescript
POST /api/auth/refresh-token

Request:
{
  refresh_token: string;
}

Response:
{
  token: string;
}
```

## Cashier APIs

### Get Cashier Stats
```typescript
GET /api/cashier/stats

Response:
{
  total_transactions: number;
  unpaid_bills: number;
  today_revenue: number;
}
```

### Get Bill by ID
```typescript
GET /api/cashier/bill/:bookingId

Response:
{
  id: string;
  booking_number: string;
  customer_name: string;
  total_amount: number;
  amount_paid: number;
  balance: number;
  status: 'unpaid' | 'partial' | 'paid';
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
}
```

### Get Unpaid Bills
```typescript
GET /api/cashier/unpaid-bills

Response:
Array<{
  id: string;
  booking_number: string;
  customer_name: string;
  total_amount: number;
  balance: number;
  created_at: string;
}>
```

### Process Payment
```typescript
POST /api/cashier/pay

Request:
{
  booking_id: string;
  amount: number;
  payment_method: 'cash' | 'mpesa' | 'card';
}

Response:
{
  success: boolean;
  payment_id: string;
  receipt_number: string;
}
```

### Shift Management

#### Get Shifts
```typescript
GET /api/cashier/shifts

Response:
Array<{
  id: string;
  started_at: string;
  closed_at?: string;
  status: 'open' | 'closed';
  total_cash: number;
  total_mpesa: number;
  total_card: number;
  total_transactions: number;
}>
```

#### Start Shift
```typescript
POST /api/cashier/shifts/start

Response:
{
  id: string;
  started_at: string;
  status: 'open';
}
```

#### Close Shift
```typescript
PUT /api/cashier/shifts/:id/close

Response:
{
  id: string;
  closed_at: string;
  total_cash: number;
  total_mpesa: number;
  total_card: number;
  total_transactions: number;
}
```

## M-Pesa APIs

### Initiate M-Pesa Payment
```typescript
POST /api/payments/mpesa/initiate

Request:
{
  phone: string;          // Format: 0712345678 or 254712345678
  amount: number;
  booking_id: string;
  reference: string;
}

Response:
{
  CheckoutRequestID: string;
  MerchantRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
}
```

### Check M-Pesa Status
```typescript
GET /api/payments/mpesa/status/:checkoutRequestId

Response:
{
  ResultCode: string;     // '0' = success
  ResultDesc: string;
  status: 'pending' | 'completed' | 'failed';
}
```

## Dispatch/Delivery APIs

### Get Central Store Dashboard
```typescript
GET /api/storekeeping/dashboard/central

Response:
{
  total_items: number;
  low_stock_count: number;
  pending_dispatches: number;
  today_dispatches: number;
}
```

### Get Branch Store Dashboard
```typescript
GET /api/storekeeping/dashboard/branch

Response:
{
  pending_deliveries: number;
  today_receipts: number;
  total_items: number;
  low_stock: number;
}
```

### Create Dispatch Note
```typescript
POST /api/storekeeping/dispatch-notes

Request:
{
  to_branch_id: string;
  notes?: string;
  items: Array<{
    item_id: string;
    quantity: number;
    unit: string;
  }>;
}

Response:
{
  id: string;
  dispatch_number: string;
  status: 'draft';
}
```

### Dispatch (Generate OTP)
```typescript
PUT /api/storekeeping/dispatch-notes/:id/dispatch

Request:
{
  driver_name: string;
}

Response:
{
  id: string;
  dispatch_number: string;
  otp_code: string;
  otp_expires_at: string;
  status: 'dispatched';
}
```

### Get Incoming Dispatches (Branch)
```typescript
GET /api/storekeeping/incoming-dispatches

Response:
Array<{
  id: string;
  dispatch_number: string;
  from_branch_name: string;
  driver_name: string;
  status: 'dispatched' | 'in_transit' | 'delivered';
  items: Array<{
    item_id: string;
    name: string;
    quantity: number;
    unit: string;
  }>;
  dispatched_at: string;
}>
```

### Verify OTP
```typescript
POST /api/storekeeping/dispatch-notes/:id/verify-otp

Request:
{
  otp_code: string;
}

Response:
{
  success: boolean;
  dispatch: {
    id: string;
    items: Array<...>;
  };
}
```

### Confirm Delivery
```typescript
PUT /api/storekeeping/dispatch-notes/:id/confirm

Request:
{
  items_received: Array<{
    item_id: string;
    quantity_received: number;
  }>;
  has_discrepancy: boolean;
  discrepancy_note?: string;
}

Response:
{
  success: boolean;
  status: 'confirmed' | 'discrepancy';
}
```

### Get Dispatch History
```typescript
GET /api/storekeeping/dispatch-notes

Query Params:
- status?: string
- from_date?: string
- to_date?: string

Response:
Array<{
  id: string;
  dispatch_number: string;
  from_branch_name: string;
  to_branch_name: string;
  status: string;
  items_count: number;
  created_at: string;
}>
```

## Inventory APIs

### Search Items
```typescript
GET /api/storekeeping/items?search=<query>

Response:
Array<{
  id: string;
  name: string;
  sku?: string;
  unit: string;
  quantity: number;
  category?: string;
}>
```

### Get Low Stock Items
```typescript
GET /api/storekeeping/low-stock

Response:
Array<{
  id: string;
  name: string;
  current_quantity: number;
  minimum_quantity: number;
  unit: string;
}>
```

### Create Stock Intake (GRN)
```typescript
POST /api/storekeeping/grn

Request:
{
  supplier_id?: string;
  invoice_number?: string;
  items: Array<{
    item_id: string;
    quantity: number;
    unit_price?: number;
  }>;
  notes?: string;
}

Response:
{
  id: string;
  grn_number: string;
  status: 'completed';
}
```

### Log Waste
```typescript
POST /api/storekeeping/waste-logs

Request:
{
  item_id: string;
  quantity: number;
  reason: string;
  notes?: string;
}

Response:
{
  id: string;
  waste_log_number: string;
}
```

### Get Waste Logs
```typescript
GET /api/storekeeping/waste-logs

Query Params:
- from_date?: string
- to_date?: string
- branch_id?: string

Response:
Array<{
  id: string;
  item_name: string;
  quantity: number;
  reason: string;
  logged_by: string;
  created_at: string;
}>
```

## System APIs

### Get Branches
```typescript
GET /api/system/branches

Response:
Array<{
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}>
```

### Get Users
```typescript
GET /api/system/users

Response:
Array<{
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  branch_name?: string;
  is_active: boolean;
}>
```

### Create User
```typescript
POST /api/system/users

Request:
{
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: string;
  branch_id?: string;
}

Response:
{
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}
```

### Update User
```typescript
PUT /api/system/users/:id

Request:
{
  first_name?: string;
  last_name?: string;
  role?: string;
  branch_id?: string;
  is_active?: boolean;
}

Response:
{
  id: string;
  // updated user data
}
```

### Get Audit Logs
```typescript
GET /api/system/audit-logs

Query Params:
- user_id?: string
- action?: string
- from_date?: string
- to_date?: string
- limit?: number

Response:
Array<{
  id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: object;
  created_at: string;
}>
```

## Error Responses

All endpoints may return these error formats:

```typescript
// Validation Error
{
  error: string;
  code: 'VALIDATION_ERROR';
  field?: string;
}

// Authentication Error
{
  error: string;
  code: 'UNAUTHORIZED';
}

// Not Found
{
  error: string;
  code: 'NOT_FOUND';
}

// Server Error
{
  error: string;
  code: 'INTERNAL_ERROR';
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (invalid/expired token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `422` - Unprocessable Entity (business logic error)
- `500` - Internal Server Error

## Rate Limiting

- Most endpoints: 100 requests per minute
- Authentication endpoints: 10 requests per minute
- M-Pesa endpoints: 20 requests per minute

## Pagination

For list endpoints that support pagination:

```typescript
Query Params:
- page?: number (default: 1)
- limit?: number (default: 20, max: 100)

Response:
{
  data: Array<T>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

## Filtering & Sorting

Common query parameters:

```typescript
- sort?: string (e.g., 'created_at', '-created_at' for desc)
- filter?: string (JSON stringified filter object)
- search?: string (full-text search)
```

## WebSocket Events (Future)

For real-time updates:

```typescript
// Connect
const socket = io(API_BASE_URL, {
  auth: { token: jwt_token }
});

// Events
socket.on('dispatch:updated', (data) => {
  // Handle dispatch update
});

socket.on('payment:received', (data) => {
  // Handle payment notification
});

socket.on('stock:low', (data) => {
  // Handle low stock alert
});
```
