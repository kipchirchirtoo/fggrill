# Restaurant Module - Implementation Quick Start Guide

## Overview

This guide provides step-by-step instructions to implement the comprehensive restaurant module enhancements for Famous Gate Hotel.

---

## Prerequisites

### System Requirements
- Node.js 18+ (backend)
- Python 3.10+ (analytics service)
- PostgreSQL 14+ (Supabase)
- Redis (optional, for caching)
- npm or yarn
- pip or poetry

### Database Access
- Supabase connection URL
- Service role key
- Database admin access

---

## Phase 1: Database Migration (CRITICAL - DO FIRST)

### Step 1: Backup Current Database

```bash
# Using Supabase CLI
supabase db dump > backup_before_restaurant_enhancement.sql

# Or using pg_dump
pg_dump "postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-0-eu-west-1.pooler.supabase.com:5432/postgres" > backup.sql
```

### Step 2: Review Migration File

```bash
cd /home/john/fggrill/backend/supabase/migrations
cat 12_restaurant_enhancements.sql | less
```

**Review checklist**:
- [ ] All foreign key references are valid
- [ ] No conflicting table or column names
- [ ] Enum types don't already exist
- [ ] RLS policies are appropriate

### Step 3: Test Migration Locally (OPTIONAL but RECOMMENDED)

```bash
# Set up local Supabase instance
supabase init
supabase start
supabase db reset

# Apply migration
supabase migration up
```

### Step 4: Apply to Production Database

**IMPORTANT**: Run during off-peak hours!

```bash
# Method 1: Using Supabase Dashboard
# - Go to Supabase Dashboard → SQL Editor
# - Copy contents of 12_restaurant_enhancements.sql
# - Run query
# - Verify no errors

# Method 2: Using psql
psql "postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-0-eu-west-1.pooler.supabase.com:5432/postgres" < 12_restaurant_enhancements.sql
```

### Step 5: Verify Migration

```sql
-- Check new tables created (should return 40+ rows)
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'restaurant_%'
ORDER BY table_name;

-- Check new enums
SELECT typname 
FROM pg_type 
WHERE typname LIKE '%status' OR typname LIKE '%type';

-- Check views created
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name LIKE 'restaurant_%';

-- Verify sample data inserted
SELECT * FROM restaurant_sections;
```

### Expected Results:
- **Tables**: 46 total (6 existing + 40 new)
- **Enums**: 7 new types
- **Views**: 4 analytics views
- **Functions**: 3+ new functions
- **Triggers**: 3+ new triggers

---

## Phase 2: Python Analytics Service Setup

### Step 1: Create Virtual Environment

```bash
cd /home/john/fggrill/analytics-service

# Create virtual environment
python3 -m venv venv

# Activate
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Step 2: Configure Environment Variables

```bash
# Create .env file
cat > .env << EOL
# Database Configuration
SUPABASE_URL=https://utsvlihpudfraxzcmtle.supabase.co
SUPABASE_KEY=your_service_role_key_here
DATABASE_URL=postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-0-eu-west-1.pooler.supabase.com:5432/postgres

# Service Configuration
SERVICE_PORT=8001
SERVICE_HOST=0.0.0.0
ENVIRONMENT=development

# Redis (Optional)
REDIS_URL=redis://localhost:6379

# Celery (Optional - for scheduled reports)
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# Reports
REPORTS_DIRECTORY=/home/john/fggrill/analytics-service/generated_reports
EOL
```

### Step 3: Create Service Modules (Stubs for now)

```bash
# Database config
cat > config/database.py << 'EOL'
import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()

def get_db_connection():
    """Get PostgreSQL database connection"""
    return psycopg2.connect(os.getenv('DATABASE_URL'))
EOL

# Create empty service files
touch services/__init__.py
touch services/sales_analytics.py
touch services/demand_forecast.py
touch services/menu_optimization.py
touch services/inventory_optimizer.py
touch services/customer_segmentation.py

# Create empty report files
touch reports/__init__.py
touch reports/pdf_generator.py
touch reports/excel_exporter.py
```

### Step 4: Test Analytics Service

```bash
# Start service
python app.py

# In another terminal, test health endpoint
curl http://localhost:8001/health

# Expected response:
# {"status":"healthy","database":"connected"}
```

---

## Phase 3: Node.js Backend Extensions

### Step 1: Create New Controller Files

```bash
cd /home/john/fggrill/backend/src/controllers

# Create new controllers
touch restaurant.table.controller.ts
touch restaurant.reservation.controller.ts
touch restaurant.waitlist.controller.ts
touch restaurant.pos.controller.ts
touch restaurant.kitchen.controller.ts
touch restaurant.customer.controller.ts
touch restaurant.delivery.controller.ts
touch restaurant.bar.controller.ts
```

### Step 2: Create Route Files

```bash
cd /home/john/fggrill/backend/src/routes

# Create new route files
touch restaurant.table.routes.ts
touch restaurant.reservation.routes.ts
touch restaurant.pos.routes.ts
touch restaurant.kitchen.routes.ts
```

### Step 3: Sample Controller Implementation

Example for `restaurant.table.controller.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

// Get all tables with status
export const getTables = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { branch_id, section_id, status } = req.query;
    
    let query = supabase
      .from('restaurant_tables')
      .select(`
        *,
        section:restaurant_sections(*),
        current_assignment:restaurant_table_assignments(
          *,
          server:staff_profiles(*)
        )
      `)
      .eq('is_active', true);
    
    if (branch_id) query = query.eq('branch_id', branch_id);
    if (section_id) query = query.eq('section_id', section_id);
    if (status) query = query.eq('status', status);
    
    const { data: tables, error } = await query.order('table_number');
    
    if (error) throw error;
    
    res.status(200).json({
      success: true,
      data: tables
    });
  } catch (error) {
    next(error);
  }
};

// Update table status
export const updateTableStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const { data: table, error } = await supabase
      .from('restaurant_tables')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    res.status(200).json({
      success: true,
      data: table
    });
  } catch (error) {
    next(error);
  }
};

// Add more controller functions...
```

### Step 4: Register New Routes

In `/home/john/fggrill/backend/src/routes/index.ts`:

```typescript
import restaurantTableRoutes from './restaurant.table.routes';
import restaurantReservationRoutes from './restaurant.reservation.routes';
import restaurantPOSRoutes from './restaurant.pos.routes';
import restaurantKitchenRoutes from './restaurant.kitchen.routes';

// Register routes
app.use('/api/restaurant/tables', restaurantTableRoutes);
app.use('/api/restaurant/reservations', restaurantReservationRoutes);
app.use('/api/restaurant/pos', restaurantPOSRoutes);
app.use('/api/restaurant/kitchen', restaurantKitchenRoutes);
```

---

## Phase 4: Frontend Implementation

### Step 1: Create New Pages

```bash
cd /home/john/fggrill/frontend/src/app/dashboard/restaurant

# Create new directories
mkdir -p tables reservations kitchen pos inventory customers reports

# Create page files
touch tables/page.tsx
touch reservations/page.tsx
touch kitchen/page.tsx
touch pos/page.tsx
```

### Step 2: Update API Library

In `/home/john/fggrill/frontend/src/lib/api.ts`, add:

```typescript
// Restaurant Tables API
export const restaurantTablesAPI = {
  getTables: (branchId?: string) =>
    fetch(`${API_BASE_URL}/restaurant/tables?branch_id=${branchId || ''}`),
  
  updateTableStatus: (tableId: string, status: string) =>
    fetch(`${API_BASE_URL}/restaurant/tables/${tableId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    }),
  
  assignServer: (tableId: string, serverId: string) =>
    fetch(`${API_BASE_URL}/restaurant/tables/${tableId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverId })
    })
};

// Restaurant Reservations API
export const restaurantReservationsAPI = {
  getReservations: (date?: string) =>
    fetch(`${API_BASE_URL}/restaurant/reservations?date=${date || ''}`),
  
  createReservation: (data: any) =>
    fetch(`${API_BASE_URL}/restaurant/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }),
  
  checkAvailability: (date: string, time: string, partySize: number) =>
    fetch(`${API_BASE_URL}/restaurant/reservations/availability?date=${date}&time=${time}&partySize=${partySize}`)
};

// Add more API wrappers for POS, Kitchen, Inventory, etc.
```

### Step 3: Create Real-time Subscriptions

```typescript
// In src/lib/realtime.ts

export const subscribeToKitchenOrders = (callback: (payload: any) => void) => {
  const subscription = supabase
    .channel('kitchen-orders')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'restaurant_orders',
        filter: 'status=in.(confirmed,preparing)'
      },
      callback
    )
    .subscribe();
  
  return () => subscription.unsubscribe();
};

export const subscribeToTableStatus = (callback: (payload: any) => void) => {
  const subscription = supabase
    .channel('table-status')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'restaurant_tables'
      },
      callback
    )
    .subscribe();
  
  return () => subscription.unsubscribe();
};
```

---

## Phase 5: Testing

### Database Testing

```sql
-- Test table creation
INSERT INTO restaurant_tables (branch_id, table_number, capacity, status)
VALUES (
  (SELECT id FROM branches LIMIT 1),
  'T101',
  4,
  'available'
);

-- Test reservation creation
INSERT INTO restaurant_reservations (
  reservation_number,
  guest_name,
  guest_email,
  guest_phone,
  party_size,
  reservation_date,
  reservation_time,
  status
) VALUES (
  'RES' || TO_CHAR(NOW(), 'YYMMDD') || '0001',
  'John Doe',
  'john@example.com',
  '+254712345678',
  4,
  CURRENT_DATE + 1,
  '19:00:00',
  'confirmed'
);

-- Test order with modifiers
INSERT INTO restaurant_order_items (
  order_id,
  menu_item_id,
  quantity,
  unit_price,
  total_price,
  status,
  course_number
) VALUES (
  (SELECT id FROM restaurant_orders ORDER BY created_at DESC LIMIT 1),
  (SELECT id FROM restaurant_menu_items LIMIT 1),
  2,
  25.00,
  50.00,
  'pending',
  1
);
```

### API Testing

```bash
# Test new endpoints
curl http://localhost:5000/api/restaurant/tables
curl http://localhost:5000/api/restaurant/reservations
curl http://localhost:5000/api/restaurant/kitchen/orders

# Test analytics service
curl http://localhost:8001/analytics/sales/daily \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"start_date":"2025-01-01","end_date":"2025-01-31"}'
```

---

## Phase 6: Deployment

### Database Migration Rollback Plan

```sql
-- If migration needs to be rolled back
-- Save this as rollback_restaurant_enhancements.sql

DROP VIEW IF EXISTS restaurant_daily_revenue CASCADE;
DROP VIEW IF EXISTS restaurant_item_popularity CASCADE;
DROP VIEW IF EXISTS restaurant_low_stock_items CASCADE;
DROP VIEW IF EXISTS restaurant_table_occupancy CASCADE;

DROP TABLE IF EXISTS restaurant_supplier_quality_ratings CASCADE;
DROP TABLE IF EXISTS restaurant_food_safety_checks CASCADE;
DROP TABLE IF EXISTS restaurant_cocktail_recipes CASCADE;
DROP TABLE IF EXISTS restaurant_bar_inventory CASCADE;
-- ... drop all other new tables in reverse order

DROP TYPE IF EXISTS waste_reason CASCADE;
DROP TYPE IF EXISTS delivery_status CASCADE;
-- ... drop all new enums
```

### Production Deployment Checklist

- [ ] Database backup completed
- [ ] Migration tested in staging
- [ ] All new API endpoints documented
- [ ] Frontend components tested
- [ ] Real-time subscriptions working
- [ ] Analytics service deployed
- [ ] Staff training completed
- [ ] Rollback plan prepared
- [ ] Monitoring configured
- [ ] Go-live scheduled

---

## Troubleshooting

### Common Issues

**Issue**: Migration fails with "relation already exists"
**Solution**: Some tables may already exist. Drop conflicting tables or modify migration.

**Issue**: Foreign key constraint violation
**Solution**: Ensure referenced tables (branches, users, staff_profiles) exist and have data.

**Issue**: Analytics service can't connect to database
**Solution**: Check DATABASE_URL in .env, verify network access, check firewall rules.

**Issue**: Real-time updates not working
**Solution**: Verify Supabase realtime is enabled, check RLS policies, confirm subscription syntax.

---

## Next Steps

1. ✅ **Phase 1 Complete**: Database schema enhanced with 40+ tables
2. ⏳ **Phase 2 In Progress**: Python analytics service structure created
3. 📋 **Phase 3 Pending**: Node.js controllers and routes
4. 📋 **Phase 4 Pending**: Frontend pages and components
5. 📋 **Phase 5 Pending**: Testing and QA
6. 📋 **Phase 6 Pending**: Production deployment

---

## Support & Resources

- **Database Schema Documentation**: `/home/john/fggrill/RESTAURANT_MODULE_ANALYSIS.md`
- **Migration File**: `/home/john/fggrill/backend/supabase/migrations/12_restaurant_enhancements.sql`
- **Analytics Service**: `/home/john/fggrill/analytics-service/`
- **API Documentation**: Auto-generated at `http://localhost:8001/docs` (FastAPI)

---

**Last Updated**: December 1, 2025  
**Version**: 1.0.0  
**Status**: Database migration ready, backend implementation in progress
