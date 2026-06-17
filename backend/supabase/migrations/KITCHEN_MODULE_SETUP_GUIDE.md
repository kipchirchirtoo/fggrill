# Kitchen Module Complete Setup Guide

## Overview
This guide provides step-by-step instructions to set up the complete kitchen management module with all required database tables, relationships, and security policies.

## Files Created

### 1. Database Migration
**File:** `20260617_complete_kitchen_module.sql`
**Purpose:** Creates all missing kitchen tables with proper relationships and RLS policies

### 2. Restored Controllers
**File:** `kitchen-ledger.controller.RESTORED.ts`
**Purpose:** Updated controller that works with the new table schema

## Database Tables Created

### Core Tables

#### 1. **kitchen_store_receipts**
- Records items received by kitchen from dispatch notes
- Links to dispatch_notes table
- Tracks verification status
- Contains header-level information

#### 2. **kitchen_store_receipt_items**
- Line items for each receipt
- Tracks expected vs received quantities
- Automatically calculates variance
- Links to parent receipt

#### 3. **kitchen_expected_portions**
- Tracks expected vs actual portion production
- Links to food control recipes
- Records variance and reasons
- Requires verification by manager/chef

#### 4. **kitchen_portion_tracking**
- Real-time production tracking during shifts
- Links raw materials to finished portions
- Tracks chef/staff responsible
- Status-based workflow (tracking → completed/variance)

#### 5. **kitchen_daily_variance**
- End-of-day reconciliation
- Tracks opening, received, issued, physical stock
- Auto-calculates variance and cost impact
- Requires reason and approval for variances
- Locked after approval

#### 6. **kitchen_portion_stock**
- Current stock levels of prepared portions
- Cost per portion tracking
- Reorder level management
- Branch-specific balances

#### 7. **kitchen_portion_ledger**
- Movement history for portions
- Tracks production, sales, wastage, transfers
- Opening/closing balance tracking
- Audit trail for all portion movements

#### 8. **kitchen_variance_logs**
- Detailed variance tracking
- Links to portion tracking records
- Requires approval workflow
- Cost impact calculation

#### 9. **wastage_records**
- General wastage tracking
- Multiple wastage reasons (spoilage, expiry, etc.)
- Cost impact tracking
- Logged by user with timestamp

## Features

### 1. Automated Calculations
- **Variance auto-calculation** in receipts and daily variance
- **Closing balance** computed from opening + in - out
- **Status auto-assignment** based on variance (ok/shortage/excess)

### 2. Security Features
- **Row Level Security (RLS)** enabled on all tables
- **Branch isolation** - users see only their branch data
- **Role-based access** - admins/auditors see all branches
- **Audit trail** - all changes tracked with user ID and timestamp

### 3. Data Integrity
- **Foreign key constraints** ensure referential integrity
- **Check constraints** validate status values
- **NOT NULL constraints** on critical fields
- **Unique constraints** prevent duplicates

### 4. Helper Functions
- `generate_kitchen_receipt_number()` - Auto-generates receipt numbers (KR000001, KR000002, etc.)
- `generate_portion_tracking_number()` - Auto-generates tracking numbers (PT000001, PT000002, etc.)
- `update_updated_at_column()` - Auto-updates timestamp on record changes

## Deployment Steps

### Step 1: Run the Migration

Connect to your Supabase database and run the migration:

```bash
# Option A: Via Supabase Dashboard
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of 20260617_complete_kitchen_module.sql
3. Click "Run"

# Option B: Via psql
psql "postgresql://[YOUR_CONNECTION_STRING]" -f database/migrations/20260617_complete_kitchen_module.sql

# Option C: Via Supabase CLI
supabase db push
```

### Step 2: Verify Tables Created

Run this query to verify all tables exist:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'kitchen_%' 
OR table_name = 'wastage_records'
ORDER BY table_name;
```

**Expected Result:**
```
kitchen_daily_variance
kitchen_expected_portions
kitchen_food_controls
kitchen_portion_ledger
kitchen_portion_stock
kitchen_portion_tracking
kitchen_stock
kitchen_stock_ledger
kitchen_store_receipt_items
kitchen_store_receipts
kitchen_variance_logs
kitchen_variance_reasons
wastage_records
```

### Step 3: Verify RLS Policies

```sql
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename LIKE 'kitchen_%' 
OR tablename = 'wastage_records'
ORDER BY tablename, policyname;
```

### Step 4: Test Helper Functions

```sql
-- Test receipt number generation
SELECT generate_kitchen_receipt_number();

-- Test tracking number generation
SELECT generate_portion_tracking_number();
```

### Step 5: Update Backend Controllers

Replace the current kitchen controllers with the restored versions:

```bash
cd /home/john/fggrill-1/backend/src/controllers

# Backup current controller
cp kitchen-ledger.controller.ts kitchen-ledger.controller.BACKUP.ts

# Replace with restored version
cp kitchen-ledger.controller.RESTORED.ts kitchen-ledger.controller.ts
```

Similarly update these controllers:
- `wastage.controller.ts`
- `kitchen/expected-portions.controller.ts`
- `kitchen/variance-reconciliation.controller.ts`
- `kitchen/reports.controller.ts`

### Step 6: Rebuild and Deploy Backend

```bash
cd /home/john/fggrill-1/backend

# Install dependencies (if needed)
npm install

# Build
npm run build

# Verify no errors
echo $?  # Should output 0

# Deploy
# (Your deployment command here)
```

### Step 7: Test API Endpoints

Test each endpoint category:

#### Kitchen Store Receipts
```bash
# Get receipts
GET /api/kitchen-ledger/receipts?branch_id=2

# Create receipt
POST /api/kitchen-ledger/receipts
{
  "branch_id": 2,
  "dispatch_note_id": "uuid-here",
  "received_from": "Central Store",
  "items": [...],
  "remarks": "All items received in good condition"
}
```

#### Portion Tracking
```bash
# Get tracking records
GET /api/kitchen-ledger/portion-tracking?branch_id=2&status=tracking

# Create tracking
POST /api/kitchen-ledger/portion-tracking
{
  "branch_id": 2,
  "item_sku": "RAW001",
  "item_name": "Beef 1kg",
  "menu_item_name": "Beef Stew",
  "received_quantity": 10,
  "unit_of_measure": "kg",
  "expected_portions": 40
}
```

#### Variance Logs
```bash
# Get variance logs
GET /api/kitchen-ledger/variance-logs?branch_id=2&approval_status=pending

# Approve variance
POST /api/kitchen-ledger/variance-logs/:id/approve
{
  "approval_status": "approved",
  "remarks": "Variance justified - spoilage due to power outage"
}
```

#### Wastage Records
```bash
# Get wastage
GET /api/wastage?branch_id=2&startDate=2026-06-01

# Create wastage record
POST /api/wastage
{
  "item_name": "Tomatoes",
  "item_type": "raw_material",
  "quantity": 5,
  "unit": "kg",
  "reason": "spoilage",
  "cost_impact": 500,
  "description": "Over-ripe, not suitable for use"
}
```

## Data Flow Example

### Scenario: Receiving Raw Materials and Tracking Production

1. **Dispatch from Central Store**
   - Central store creates dispatch note
   - Kitchen receives dispatch notification

2. **Kitchen Receipt**
   ```sql
   -- Kitchen creates receipt record
   INSERT INTO kitchen_store_receipts (...)
   
   -- Kitchen records items received
   INSERT INTO kitchen_store_receipt_items (...)
   
   -- Manager verifies receipt
   UPDATE kitchen_store_receipts SET status = 'verified'
   ```

3. **Portion Production**
   ```sql
   -- Chef starts portion tracking
   INSERT INTO kitchen_portion_tracking (
     item_name, 
     received_quantity, 
     expected_portions
   )
   
   -- After production, chef records actual
   UPDATE kitchen_portion_tracking 
   SET actual_portions_produced = 38  -- Expected was 40
   ```

4. **Variance Handling**
   ```sql
   -- If variance exists, create log
   INSERT INTO kitchen_variance_logs (
     variance_type = 'shortage',
     variance_amount = 2,
     reason = 'Quality issue with 2 portions'
   )
   
   -- Manager approves
   UPDATE kitchen_variance_logs 
   SET approval_status = 'approved'
   ```

5. **Daily Reconciliation**
   ```sql
   -- End of day variance check
   INSERT INTO kitchen_daily_variance (
     opening_stock, received, issued, 
     physical_closing
   )
   -- Variance auto-calculated
   ```

## Monitoring and Reports

### Available Reports

#### 1. Yield Report
Shows conversion efficiency from raw materials to portions
```sql
SELECT 
  raw_item_name,
  SUM(expected_portions) as total_expected,
  SUM(actual_portions) as total_actual,
  AVG(variance_percentage) as avg_variance_pct
FROM kitchen_expected_portions
WHERE verified_at IS NOT NULL
GROUP BY raw_item_name
ORDER BY avg_variance_pct DESC;
```

#### 2. Wastage Summary
```sql
SELECT 
  reason,
  COUNT(*) as count,
  SUM(quantity) as total_quantity,
  SUM(cost_impact) as total_cost
FROM wastage_records
WHERE logged_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY reason
ORDER BY total_cost DESC;
```

#### 3. Variance Analysis
```sql
SELECT 
  variance_date,
  COUNT(*) as items_with_variance,
  SUM(ABS(variance)) as total_variance_qty,
  SUM(cost_value) as total_cost_impact
FROM kitchen_daily_variance
WHERE variance != 0
GROUP BY variance_date
ORDER BY variance_date DESC
LIMIT 30;
```

#### 4. Accountability Report
```sql
SELECT 
  u.full_name as chef,
  COUNT(*) as productions,
  AVG(kpt.variance) as avg_variance
FROM kitchen_portion_tracking kpt
JOIN users u ON u.id = kpt.chef_id
WHERE tracking_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY u.full_name
ORDER BY AVG(ABS(kpt.variance)) DESC;
```

## Troubleshooting

### Issue: Tables not created
**Solution:** Check for errors in SQL output. Ensure you have superuser privileges.

### Issue: RLS blocking queries
**Solution:** Ensure `app.current_branch_id` and `app.user_role` are set in session:
```sql
SET app.current_branch_id = '2';
SET app.user_role = 'branch_manager';
```

### Issue: Foreign key constraint violations
**Solution:** Ensure referenced records exist first (e.g., branches, users, food_controls)

### Issue: Duplicate receipt/tracking numbers
**Solution:** Check sequence functions work correctly, or use UUID instead

## Maintenance

### Regular Tasks

1. **Archive old records** (after 2 years):
```sql
-- Archive variance logs
INSERT INTO kitchen_variance_logs_archive 
SELECT * FROM kitchen_variance_logs 
WHERE reported_at < NOW() - INTERVAL '2 years';

DELETE FROM kitchen_variance_logs 
WHERE reported_at < NOW() - INTERVAL '2 years';
```

2. **Rebuild indexes** (monthly):
```sql
REINDEX TABLE kitchen_portion_ledger;
REINDEX TABLE kitchen_daily_variance;
```

3. **Vacuum tables** (weekly):
```sql
VACUUM ANALYZE kitchen_portion_tracking;
VACUUM ANALYZE wastage_records;
```

## Security Best Practices

1. **Never disable RLS** - Keep Row Level Security enabled
2. **Use service role key carefully** - Only in backend, never in frontend
3. **Audit sensitive operations** - Log all variance approvals
4. **Regular backups** - Daily backups of kitchen data
5. **Monitor access patterns** - Alert on unusual query volumes

## Next Steps

1. ✅ Deploy migration
2. ✅ Verify tables and RLS
3. ✅ Update backend controllers
4. ✅ Test API endpoints
5. ⏳ Update Flutter app UI to use new endpoints
6. ⏳ Train staff on new workflows
7. ⏳ Monitor for 1 week and fix issues
8. ⏳ Roll out to all branches

## Support

For issues or questions:
1. Check logs: `/var/log/application.log`
2. Review database logs in Supabase Dashboard
3. Contact: dev@famousgate.com

---

**Created:** 2026-06-17  
**Version:** 1.0  
**Author:** System
