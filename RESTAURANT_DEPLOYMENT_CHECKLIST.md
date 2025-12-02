# Restaurant Module Enhancement - Deployment Checklist

## 🎯 Pre-Deployment Validation

### Database Migration Checklist

#### Before Migration
- [ ] **Backup Production Database**
  ```bash
  pg_dump "postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-0-eu-west-1.pooler.supabase.com:5432/postgres" > restaurant_pre_migration_backup_$(date +%Y%m%d_%H%M%S).sql
  ```
- [ ] **Verify Required Tables Exist**
  ```sql
  SELECT table_name FROM information_schema.tables 
  WHERE table_name IN ('branches', 'users', 'staff_profiles', 'guests');
  ```
- [ ] **Check Existing Restaurant Tables**
  ```sql
  SELECT table_name FROM information_schema.tables 
  WHERE table_name LIKE 'restaurant_%';
  ```
- [ ] **Review Migration File**
  - Read through `12_restaurant_enhancements.sql`
  - Check for naming conflicts
  - Verify foreign key references

#### During Migration
- [ ] **Run in Transaction** (for easy rollback)
  ```sql
  BEGIN;
  \i /home/john/fggrill/backend/supabase/migrations/12_restaurant_enhancements.sql
  -- Review results
  COMMIT; -- or ROLLBACK if issues
  ```
- [ ] **Monitor for Errors**
  - Watch for constraint violations
  - Check for duplicate object errors
  - Verify all tables created

#### After Migration
- [ ] **Verify Table Count**
  ```sql
  SELECT COUNT(*) FROM information_schema.tables 
  WHERE table_name LIKE 'restaurant_%';
  -- Expected: 40+ tables
  ```
- [ ] **Check Sample Data**
  ```sql
  SELECT * FROM restaurant_sections;
  SELECT * FROM restaurant_menu_categories;
  ```
- [ ] **Verify Views Created**
  ```sql
  SELECT table_name FROM information_schema.views 
  WHERE table_name LIKE 'restaurant_%';
  -- Expected: 4 views
  ```
- [ ] **Test Triggers**
  ```sql
  -- Test order number generation
  SELECT generate_order_number();
  
  -- Test reservation number generation
  SELECT generate_reservation_number();
  ```

---

## 🐍 Python Analytics Service Deployment

### Environment Setup
- [ ] **Create Virtual Environment**
  ```bash
  cd /home/john/fggrill/analytics-service
  python3 -m venv venv
  source venv/bin/activate
  ```

- [ ] **Install Dependencies**
  ```bash
  pip install --upgrade pip
  pip install -r requirements.txt
  ```

- [ ] **Configure Environment Variables**
  ```bash
  cp .env.example .env
  # Edit .env with production values
  nano .env
  ```

### Service Configuration
- [ ] **Create Service Files Directory**
  ```bash
  mkdir -p config services reports tasks
  touch config/__init__.py
  touch services/__init__.py
  touch reports/__init__.py
  touch tasks/__init__.py
  ```

- [ ] **Create Database Config** (`config/database.py`)
  ```python
  import os
  from dotenv import load_dotenv
  import psycopg2
  from supabase import create_client
  
  load_dotenv()
  
  def get_db_connection():
      return psycopg2.connect(os.getenv('DATABASE_URL'))
  
  def get_supabase_client():
      return create_client(
          os.getenv('SUPABASE_URL'),
          os.getenv('SUPABASE_KEY')
      )
  ```

- [ ] **Test Service Health**
  ```bash
  python app.py &
  curl http://localhost:8001/health
  # Expected: {"status":"healthy","database":"connected"}
  ```

### Deployment Options

#### Option 1: Systemd Service (Linux)
```bash
# Create service file
sudo nano /etc/systemd/system/restaurant-analytics.service

# Add content:
[Unit]
Description=Restaurant Analytics Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/home/john/fggrill/analytics-service
Environment="PATH=/home/john/fggrill/analytics-service/venv/bin"
ExecStart=/home/john/fggrill/analytics-service/venv/bin/python app.py

[Install]
WantedBy=multi-user.target

# Enable and start
sudo systemctl enable restaurant-analytics
sudo systemctl start restaurant-analytics
sudo systemctl status restaurant-analytics
```

#### Option 2: Docker (Recommended)
```dockerfile
# Create Dockerfile in analytics-service/
FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8001

CMD ["python", "app.py"]
```

```bash
# Build and run
docker build -t restaurant-analytics .
docker run -d -p 8001:8001 --env-file .env restaurant-analytics
```

---

## 🔧 Node.js Backend Implementation

### Create Controller Template
```bash
cd /home/john/fggrill/backend/src/controllers

# Use this template for new controllers
cat > restaurant.template.controller.ts << 'EOF'
import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

// @desc    Get all [resources]
// @route   GET /api/restaurant/[resource]
// @access  Private
export const getAll = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { branch_id } = req.query;
    
    let query = supabase.from('[table_name]').select('*');
    
    if (branch_id) {
      query = query.eq('branch_id', branch_id);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// Add more controller functions...
EOF
```

### Priority Controllers to Implement

#### 1. Table Management (`restaurant.table.controller.ts`)
- [ ] `getTables` - List all tables
- [ ] `getTableById` - Get single table
- [ ] `createTable` - Add new table
- [ ] `updateTable` - Update table details
- [ ] `updateTableStatus` - Change status
- [ ] `assignServer` - Assign to server
- [ ] `getFloorPlan` - Get layout
- [ ] `updateFloorPlan` - Save positions

#### 2. Reservation System (`restaurant.reservation.controller.ts`)
- [ ] `getReservations` - List bookings
- [ ] `createReservation` - New booking
- [ ] `updateReservation` - Modify booking
- [ ] `confirmReservation` - Confirm booking
- [ ] `seatReservation` - Mark seated
- [ ] `cancelReservation` - Cancel booking
- [ ] `checkAvailability` - Check slots
- [ ] `sendReminder` - Send SMS/email

#### 3. Kitchen Display (`restaurant.kitchen.controller.ts`)
- [ ] `getKitchenOrders` - Active orders
- [ ] `getStationOrders` - By prep station
- [ ] `updateItemStatus` - Update item
- [ ] `bumpItem` - Mark complete
- [ ] `fireOrder` - Start prep
- [ ] `rushOrder` - Mark urgent

#### 4. POS System (`restaurant.pos.controller.ts`)
- [ ] `applyDiscount` - Apply promo
- [ ] `calculateTax` - Compute tax
- [ ] `addTip` - Add gratuity
- [ ] `splitBill` - Create splits
- [ ] `processPayment` - Handle payment
- [ ] `voidItem` - Void item

### Route Registration Template
```typescript
// In src/routes/restaurant.table.routes.ts
import express from 'express';
import {
  getTables,
  getTableById,
  createTable,
  updateTable,
  updateTableStatus,
  assignServer
} from '../controllers/restaurant.table.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

router.use(protect);

router.get('/', 
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]),
  getTables
);

router.get('/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]),
  getTableById
);

router.post('/',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  createTable
);

router.put('/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  updateTable
);

router.put('/:id/status',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]),
  updateTableStatus
);

router.post('/:id/assign',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]),
  assignServer
);

export default router;
```

---

## 🎨 Frontend Implementation

### Create Page Structure
```bash
cd /home/john/fggrill/frontend/src/app/dashboard/restaurant

# Create directories
mkdir -p {tables,reservations,kitchen,pos,inventory,customers,delivery,reports}

# Create page files
for dir in tables reservations kitchen pos inventory customers delivery reports; do
  touch $dir/page.tsx
done
```

### Sample Page Template (Tables)
```typescript
// tables/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { restaurantTablesAPI } from '@/lib/api';
import { toast } from 'sonner';

export default function TablesPage() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    try {
      const response = await restaurantTablesAPI.getTables();
      const data = await response.json();
      setTables(data.data || []);
    } catch (error) {
      toast.error('Failed to load tables');
    } finally {
      setLoading(false);
    }
  };

  const updateTableStatus = async (tableId: string, status: string) => {
    try {
      await restaurantTablesAPI.updateTableStatus(tableId, status);
      toast.success('Table status updated');
      loadTables();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Table Management</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {tables.map((table: any) => (
          <div key={table.id} className="p-4 border rounded-lg">
            <h3 className="font-bold">Table {table.table_number}</h3>
            <p>Capacity: {table.capacity}</p>
            <p>Status: {table.status}</p>
            <div className="mt-2 flex gap-2">
              <button 
                onClick={() => updateTableStatus(table.id, 'occupied')}
                className="px-2 py-1 bg-red-500 text-white rounded"
              >
                Occupy
              </button>
              <button 
                onClick={() => updateTableStatus(table.id, 'available')}
                className="px-2 py-1 bg-green-500 text-white rounded"
              >
                Free
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 🧪 Testing Checklist

### Database Tests
- [ ] Insert test data into all new tables
- [ ] Test foreign key constraints
- [ ] Verify triggers fire correctly
- [ ] Test views return correct data
- [ ] Check RLS policies work

### API Tests
- [ ] Test all GET endpoints
- [ ] Test all POST endpoints
- [ ] Test all PUT endpoints
- [ ] Test all DELETE endpoints
- [ ] Verify error handling
- [ ] Check authentication/authorization

### Integration Tests
- [ ] Create reservation → Seat guest → Complete order → Close check
- [ ] Add to waitlist → Seat → Take order
- [ ] Kitchen order flow → Prepare → Serve → Bill
- [ ] Room service order → Charge to folio

### Performance Tests
- [ ] Load test with 100 concurrent orders
- [ ] Test KDS with 50 active orders
- [ ] Test reservation search performance
- [ ] Test analytics query speed

---

## 📊 Monitoring Setup

### Metrics to Track
- [ ] **Database**: Query performance, connection pool
- [ ] **API**: Response times, error rates
- [ ] **Analytics**: Service uptime, job completion
- [ ] **Business**: Orders per hour, table turnover, revenue

### Logging
```typescript
// Add to all controllers
import { logger } from '../utils/logger';

logger.info(`Table ${tableId} status updated to ${status}`);
logger.error(`Failed to create reservation: ${error.message}`);
```

### Alerts
- [ ] Low stock alerts
- [ ] Order delays (>30 minutes)
- [ ] High error rates
- [ ] Service downtime

---

## 🚀 Go-Live Checklist

### Week Before
- [ ] Final UAT completed
- [ ] Staff training completed
- [ ] Backup procedures tested
- [ ] Rollback plan documented
- [ ] Monitoring configured
- [ ] Support team briefed

### Day Before
- [ ] Database backup created
- [ ] All services tested
- [ ] Communication sent to staff
- [ ] Maintenance window scheduled

### Go-Live Day
- [ ] Deploy during off-peak hours
- [ ] Monitor logs closely
- [ ] Test critical workflows
- [ ] Verify real-time updates
- [ ] Check analytics service
- [ ] Confirm integrations working

### Day After
- [ ] Review error logs
- [ ] Gather staff feedback
- [ ] Monitor performance metrics
- [ ] Address any issues
- [ ] Document lessons learned

---

## 🆘 Rollback Procedures

### If Critical Issues Occur

```sql
-- Stop all services first
-- Then run rollback

BEGIN;

-- Drop all new tables in reverse order
DROP VIEW IF EXISTS restaurant_table_occupancy CASCADE;
DROP VIEW IF EXISTS restaurant_low_stock_items CASCADE;
DROP VIEW IF EXISTS restaurant_item_popularity CASCADE;
DROP VIEW IF EXISTS restaurant_daily_revenue CASCADE;

DROP TABLE IF EXISTS restaurant_supplier_quality_ratings CASCADE;
DROP TABLE IF EXISTS restaurant_food_safety_checks CASCADE;
DROP TABLE IF EXISTS restaurant_cocktail_recipes CASCADE;
DROP TABLE IF EXISTS restaurant_bar_inventory CASCADE;
DROP TABLE IF EXISTS restaurant_server_performance CASCADE;
DROP TABLE IF EXISTS restaurant_server_sections CASCADE;
DROP TABLE IF EXISTS restaurant_delivery_drivers CASCADE;
DROP TABLE IF EXISTS restaurant_delivery_zones CASCADE;
DROP TABLE IF EXISTS restaurant_customer_feedback CASCADE;
DROP TABLE IF EXISTS restaurant_customers CASCADE;
DROP TABLE IF EXISTS restaurant_waste_log CASCADE;
DROP TABLE IF EXISTS restaurant_recipe_ingredients CASCADE;
DROP TABLE IF EXISTS restaurant_recipes CASCADE;
DROP TABLE IF EXISTS restaurant_inventory_batches CASCADE;
DROP TABLE IF EXISTS restaurant_purchase_order_items CASCADE;
DROP TABLE IF EXISTS restaurant_purchase_orders CASCADE;
DROP TABLE IF EXISTS restaurant_suppliers CASCADE;
DROP TABLE IF EXISTS restaurant_voids_refunds CASCADE;
DROP TABLE IF EXISTS restaurant_tips CASCADE;
DROP TABLE IF EXISTS restaurant_split_payments CASCADE;
DROP TABLE IF EXISTS restaurant_bill_splits CASCADE;
DROP TABLE IF EXISTS restaurant_discounts CASCADE;
DROP TABLE IF EXISTS restaurant_item_station_routing CASCADE;
DROP TABLE IF EXISTS restaurant_prep_stations CASCADE;
DROP TABLE IF EXISTS restaurant_menu_item_pricing CASCADE;
DROP TABLE IF EXISTS restaurant_pricing_tiers CASCADE;
DROP TABLE IF EXISTS restaurant_combo_items CASCADE;
DROP TABLE IF EXISTS restaurant_combos CASCADE;
DROP TABLE IF EXISTS restaurant_menu_item_modifiers CASCADE;
DROP TABLE IF EXISTS restaurant_menu_modifiers CASCADE;
DROP TABLE IF EXISTS restaurant_waitlist CASCADE;
DROP TABLE IF EXISTS restaurant_reservations CASCADE;
DROP TABLE IF EXISTS restaurant_table_assignments CASCADE;
DROP TABLE IF EXISTS restaurant_tables CASCADE;
DROP TABLE IF EXISTS restaurant_sections CASCADE;
DROP TABLE IF EXISTS restaurant_loyalty_tiers CASCADE;

-- Drop new enums
DROP TYPE IF EXISTS waste_reason CASCADE;
DROP TYPE IF EXISTS delivery_status CASCADE;
DROP TYPE IF EXISTS order_item_status CASCADE;
DROP TYPE IF EXISTS prep_station_type CASCADE;
DROP TYPE IF EXISTS payment_split_type CASCADE;
DROP TYPE IF EXISTS reservation_status CASCADE;
DROP TYPE IF EXISTS table_status CASCADE;

-- Restore from backup if needed
-- \i restaurant_pre_migration_backup.sql

COMMIT;
```

---

## ✅ Success Criteria

### Technical Success
- [ ] All 40+ tables created successfully
- [ ] All views returning data
- [ ] All triggers functioning
- [ ] All API endpoints responding
- [ ] Analytics service running
- [ ] Real-time updates working
- [ ] No critical errors in logs

### Business Success
- [ ] Staff can use new features
- [ ] Orders processing correctly
- [ ] Reservations working
- [ ] Kitchen display functioning
- [ ] Reports generating
- [ ] Integration with receptionist module working

---

**Status**: 📋 Ready for Deployment  
**Risk Level**: 🟡 Medium (comprehensive testing required)  
**Estimated Deployment Time**: 2-4 hours  
**Rollback Time**: 30 minutes  

**Last Updated**: December 1, 2025
