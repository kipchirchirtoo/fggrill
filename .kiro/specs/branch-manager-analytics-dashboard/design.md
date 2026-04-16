# Design Document: Branch Manager Analytics and Reporting Module

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 14)                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Branch Manager Dashboard Page                         │ │
│  │  - Sales Metrics Cards                                 │ │
│  │  - Filter Controls (Date, Payment, Category)          │ │
│  │  - Charts (Bar, Line, Pie)                            │ │
│  │  - Export Buttons (PDF, CSV)                          │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTP/REST
┌─────────────────────────────────────────────────────────────┐
│              Backend API (Node.js + TypeScript)              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Analytics Routes (/api/analytics/branch-sales)        │ │
│  │  - Authentication Middleware (JWT validation)          │ │
│  │  - Branch Isolation Middleware                         │ │
│  │  - Analytics Controller                                │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTP/REST
┌─────────────────────────────────────────────────────────────┐
│         Python Analytics Service (FastAPI)                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Branch Sales Analytics Service                        │ │
│  │  - Data Aggregation from multiple tables              │ │
│  │  - Filter Processing                                   │ │
│  │  - PDF Report Generation (ReportLab)                  │ │
│  │  - CSV Export                                          │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓ SQL
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL Database (Supabase)                  │
│  - bookings (branch_id, total_amount, payment_method)       │
│  - restaurant_orders (branch_id, total_amount, order_type)  │
│  - shift_transactions (branch_id, total_amount)             │
│  - booking_payments (booking_id, amount, payment_method)    │
│  - branches (id, name, code)                                │
│  - users (id, branch_id, role)                              │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Dashboard Load Flow
```
User → Frontend → Backend API → Supabase
                     ↓
              Validate JWT
              Extract branch_id
              Apply RLS
                     ↓
              Return aggregated metrics
```

### 2. Report Generation Flow
```
User → Frontend → Backend API → Python Service → Database
                                      ↓
                              Aggregate data
                              Generate PDF/CSV
                              Return file
```

## Database Schema Analysis

### Tables Involved

**bookings**
- `id` (UUID, PK)
- `branch_id` (INTEGER, FK → branches.id)
- `total_amount` (DECIMAL)
- `payment_method` (ENUM: cash, card, mpesa)
- `status` (ENUM: pending, confirmed, checked_in, checked_out, cancelled)
- `check_in_date` (DATE)
- `created_at` (TIMESTAMP)

**restaurant_orders**
- `id` (UUID, PK)
- `branch_id` (INTEGER, FK → branches.id)
- `total_amount` (DECIMAL)
- `payment_method` (ENUM: cash, card, mpesa)
- `order_type` (ENUM: dine_in, takeaway, room_service)
- `status` (ENUM: pending, confirmed, completed, cancelled)
- `created_at` (TIMESTAMP)

**shift_transactions**
- `id` (UUID, PK)
- `branch_id` (INTEGER, FK → branches.id)
- `total_amount` (DECIMAL)
- `payment_method` (ENUM: cash, card, mpesa)
- `service_category` (VARCHAR: rooms, restaurant, bar, spa, conference)
- `transaction_date` (TIMESTAMP)

**booking_payments**
- `id` (UUID, PK)
- `booking_id` (UUID, FK → bookings.id)
- `amount` (DECIMAL)
- `payment_method` (ENUM: cash, card, mpesa)
- `payment_date` (TIMESTAMP)

### Aggregation Query Strategy

```sql
-- Unified sales query with branch isolation
WITH bookings_sales AS (
  SELECT 
    branch_id,
    total_amount,
    payment_method,
    'booking' as source,
    created_at as transaction_date
  FROM bookings
  WHERE branch_id = $1
    AND status NOT IN ('cancelled')
    AND created_at BETWEEN $2 AND $3
),
restaurant_sales AS (
  SELECT 
    branch_id,
    total_amount,
    payment_method,
    'restaurant' as source,
    created_at as transaction_date
  FROM restaurant_orders
  WHERE branch_id = $1
    AND status NOT IN ('cancelled')
    AND created_at BETWEEN $2 AND $3
),
shift_sales AS (
  SELECT 
    branch_id,
    total_amount,
    payment_method,
    service_category as source,
    transaction_date
  FROM shift_transactions
  WHERE branch_id = $1
    AND transaction_date BETWEEN $2 AND $3
),
all_sales AS (
  SELECT * FROM bookings_sales
  UNION ALL
  SELECT * FROM restaurant_sales
  UNION ALL
  SELECT * FROM shift_sales
)
SELECT 
  COUNT(DISTINCT id) as transaction_count,
  SUM(total_amount) as total_sales,
  AVG(total_amount) as avg_transaction_value,
  payment_method,
  source,
  DATE(transaction_date) as sale_date
FROM all_sales
GROUP BY payment_method, source, DATE(transaction_date)
ORDER BY sale_date DESC;
```

## API Endpoints Design

### Backend Node.js API

**POST /api/analytics/branch-sales**
```typescript
Request:
{
  branch_id: number,
  start_date: string, // ISO 8601
  end_date: string,   // ISO 8601
  filters?: {
    payment_methods?: string[],
    order_types?: string[],
    categories?: string[]
  }
}

Response:
{
  data: {
    summary: {
      total_sales: number,
      transaction_count: number,
      avg_transaction_value: number
    },
    daily_breakdown: Array<{
      date: string,
      total_sales: number,
      transaction_count: number
    }>,
    payment_method_breakdown: Array<{
      payment_method: string,
      total_sales: number,
      transaction_count: number
    }>,
    category_breakdown: Array<{
      category: string,
      total_sales: number,
      transaction_count: number
    }>
  },
  metadata: {
    branch_id: number,
    branch_name: string,
    date_range: { start: string, end: string },
    generated_at: string
  }
}
```

### Python Analytics Service

**POST /api/analytics/branch-sales**
- Receives request from Node.js backend
- Validates branch_id matches authenticated user
- Executes aggregation queries
- Returns JSON response

**POST /api/reports/branch-sales-pdf**
- Generates branded PDF report
- Includes charts and tables
- Returns file download

**POST /api/reports/branch-sales-csv**
- Exports data to CSV format
- Includes all filtered records
- Returns file download

## Frontend Components

### Page Structure
```
/dashboard/branch-manager/analytics
├── components/
│   ├── SalesMetricsCards.tsx
│   ├── FilterPanel.tsx
│   ├── SalesChart.tsx
│   ├── PaymentMethodChart.tsx
│   ├── CategoryBreakdownChart.tsx
│   ├── TransactionTable.tsx
│   └── ExportButtons.tsx
└── page.tsx
```

### Component Specifications

**SalesMetricsCards**
- Display: Total Sales, Transaction Count, Avg Transaction Value
- Loading states with skeleton loaders
- Error states with retry button
- Real-time updates (30-second polling)

**FilterPanel**
- Date range picker (custom, daily, weekly, monthly, yearly presets)
- Payment method multi-select (cash, card, mpesa)
- Category multi-select (rooms, restaurant, bar, spa, conference)
- Order type multi-select (walk_in, online, booking, room_service)
- Apply/Reset buttons
- Session storage persistence

**SalesChart**
- Line chart showing daily sales trend
- X-axis: Date
- Y-axis: Total Sales (KES)
- Responsive design

**PaymentMethodChart**
- Pie chart showing payment method distribution
- Legend with percentages
- Hover tooltips

**CategoryBreakdownChart**
- Bar chart showing sales by category
- Sorted by total sales descending

**TransactionTable**
- Paginated table (50 rows per page)
- Columns: Date, Category, Payment Method, Amount, Status
- Sortable columns
- Export to CSV button

**ExportButtons**
- PDF Export button
- CSV Export button
- Loading states during generation
- Success/error notifications

## Security Implementation

### Authentication Flow
```typescript
// Middleware chain
1. JWT Validation (auth.middleware.ts)
   - Verify token signature
   - Check expiration
   - Extract user_id

2. Branch Isolation (branch.middleware.ts)
   - Fetch user's branch_id from database
   - Attach to request context
   - Validate branch_id in request matches user's branch

3. Role Authorization
   - Check user role is 'branch_manager', 'general_manager', or 'super_admin'
   - Deny access for other roles
```

### Row Level Security (RLS)
```sql
-- Apply to all transaction tables
CREATE POLICY "branch_isolation_policy"
ON bookings
FOR SELECT
USING (branch_id = current_setting('app.current_branch_id')::INTEGER);

-- Similar policies for restaurant_orders, shift_transactions
```

## Performance Optimization

### Database Indexes
```sql
-- Required indexes for optimal query performance
CREATE INDEX idx_bookings_branch_date ON bookings(branch_id, created_at);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_restaurant_orders_branch_date ON restaurant_orders(branch_id, created_at);
CREATE INDEX idx_restaurant_orders_status ON restaurant_orders(status);
CREATE INDEX idx_shift_transactions_branch_date ON shift_transactions(branch_id, transaction_date);
CREATE INDEX idx_booking_payments_booking ON booking_payments(booking_id);
CREATE INDEX idx_booking_payments_date ON booking_payments(payment_date);
```

### Caching Strategy
```typescript
// Redis cache for aggregated metrics
const cacheKey = `branch:${branch_id}:sales:${date_range}`;
const cachedData = await redis.get(cacheKey);

if (cachedData) {
  return JSON.parse(cachedData);
}

const freshData = await fetchFromDatabase();
await redis.setex(cacheKey, 300, JSON.stringify(freshData)); // 5-minute TTL
return freshData;
```

### Pagination
```typescript
// Frontend pagination
const PAGE_SIZE = 50;
const offset = (page - 1) * PAGE_SIZE;

// Backend query
SELECT * FROM transactions
WHERE branch_id = $1
ORDER BY transaction_date DESC
LIMIT $2 OFFSET $3;
```

## Error Handling

### Frontend Error States
```typescript
try {
  const response = await fetch('/api/analytics/branch-sales', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestData)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch analytics');
  }

  const data = await response.json();
  return data;
} catch (error) {
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';
  toast.error(message);
  throw error;
}
```

### Backend Error Responses
```typescript
// Standardized error format
{
  error: string,
  code: string,
  field?: string,
  details?: any
}

// HTTP Status Codes
400 - Bad Request (invalid input)
401 - Unauthorized (invalid/expired token)
403 - Forbidden (wrong branch access)
404 - Not Found (resource doesn't exist)
500 - Internal Server Error (database/server failure)
```

## Testing Strategy

### Unit Tests
- Data aggregation functions
- Filter parsing logic
- Date range validation
- Payment method enum validation

### Integration Tests
- API endpoint responses
- Database query correctness
- Branch isolation enforcement
- JWT validation

### End-to-End Tests
- Complete user workflow (login → dashboard → filter → export)
- Report generation
- Error handling flows

### Performance Tests
- Query execution time with 100k records
- Report generation time with 10k records
- Concurrent user load testing

## Deployment Checklist

- [ ] Database indexes created
- [ ] RLS policies applied
- [ ] Python service deployed and running
- [ ] Backend API routes registered
- [ ] Frontend components built and deployed
- [ ] Environment variables configured
- [ ] CORS settings updated
- [ ] JWT secret keys configured
- [ ] Redis cache configured (optional)
- [ ] Monitoring and logging enabled
- [ ] Performance testing completed
- [ ] Security audit completed
- [ ] User acceptance testing completed

## File Structure

```
backend/
├── src/
│   ├── controllers/
│   │   └── branch-analytics.controller.ts
│   ├── routes/
│   │   └── branch-analytics.routes.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts (existing)
│   │   └── branch.middleware.ts (existing)
│   └── types/
│       └── analytics.types.ts

analytics-service/
├── services/
│   └── branch_sales_analytics.py
├── reports/
│   ├── pdf_generator.py (enhance existing)
│   └── csv_exporter.py
└── app.py (add new routes)

frontend/
└── app/
    └── dashboard/
        └── branch-manager/
            └── analytics/
                ├── page.tsx
                └── components/
                    ├── SalesMetricsCards.tsx
                    ├── FilterPanel.tsx
                    ├── SalesChart.tsx
                    ├── PaymentMethodChart.tsx
                    ├── CategoryBreakdownChart.tsx
                    ├── TransactionTable.tsx
                    └── ExportButtons.tsx
```

---

*Design Document Version 1.0*  
*Created: 2025*  
*Feature: branch-manager-analytics-dashboard*
