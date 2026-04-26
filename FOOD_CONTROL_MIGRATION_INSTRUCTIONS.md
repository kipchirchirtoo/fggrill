# Food Control System - Migration Instructions

## Prerequisites

Before running the migration, ensure you have:
1. Supabase credentials set in environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
2. Database backup (recommended)
3. Node.js installed

## Migration Steps

### Step 1: Run Database Migration

```bash
# Set environment variables (if not already set)
export SUPABASE_URL="your_supabase_url"
export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"

# Run migration
node backend/run-food-control-migration.js
```

### Step 2: Verify Migration

After running the migration, verify the following tables were created:

**New Tables:**
- `buffets` - Buffet event management
- `buffet_menu_items` - Buffet menu items
- `catering_events` - Catering event management
- `catering_menu_items` - Catering menu items
- `catering_stock_allocations` - Stock allocated to catering
- `food_control_variance` - Variance tracking
- `shift_financials` - Shift P&L data
- `stock_issues` - Stock issue tracking
- `waste_logs` - Enhanced waste logging
- `recipe_change_log` - Recipe change audit trail
- `branch_food_control_config` - Branch-specific configuration

**Extended Tables:**
- `inventory_items` - Added `cost_per_unit` column
- `restaurant_menu_items` - Added `category` column
- `recipes` - Added `is_locked`, `locked_by`, `locked_at` columns

### Step 3: Verify Database Functions

Check that these functions were created:
- `get_next_buffet_number(p_branch_id INT)`
- `get_next_catering_number(p_branch_id INT)`
- `get_next_stock_issue_number(p_branch_id INT)`

### Step 4: Verify Triggers

Check that these triggers were created:
- `set_buffet_number` on `buffets` table
- `set_catering_number` on `catering_events` table
- `set_stock_issue_number` on `stock_issues` table
- `update_buffet_updated_at` on `buffets` table
- `update_catering_updated_at` on `catering_events` table

### Step 5: Test Backend Endpoints

Test the new API endpoints:

```bash
# Test buffet endpoints
curl -X GET http://localhost:5000/api/buffet \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test catering endpoints
curl -X GET http://localhost:5000/api/catering-food-control \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test food control endpoints
curl -X GET http://localhost:5000/api/food-control/variance/pending \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test shift P&L endpoints
curl -X GET http://localhost:5000/api/finance/shift-pnl \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test branch config endpoints
curl -X GET http://localhost:5000/api/branch-food-control-config/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Step 6: Configure Branch Settings

For each branch, configure food control settings:

```bash
curl -X PUT http://localhost:5000/api/branch-food-control-config/1 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "variance_threshold_kes": 200,
    "variance_threshold_percent": 10,
    "food_cost_alert_threshold": 35,
    "allowed_waste_reason_codes": ["SPOILAGE", "OVERCOOKING", "CUSTOMER_RETURN", "PREPARATION_ERROR", "THEFT", "OTHER"],
    "require_manager_approval_for_theft": true,
    "auto_submit_to_accountant_on_close": true
  }'
```

## Rollback Instructions

If you need to rollback the migration:

```sql
-- Drop new tables
DROP TABLE IF EXISTS buffets CASCADE;
DROP TABLE IF EXISTS buffet_menu_items CASCADE;
DROP TABLE IF EXISTS catering_events CASCADE;
DROP TABLE IF EXISTS catering_menu_items CASCADE;
DROP TABLE IF EXISTS catering_stock_allocations CASCADE;
DROP TABLE IF EXISTS food_control_variance CASCADE;
DROP TABLE IF EXISTS shift_financials CASCADE;
DROP TABLE IF EXISTS stock_issues CASCADE;
DROP TABLE IF EXISTS waste_logs CASCADE;
DROP TABLE IF EXISTS recipe_change_log CASCADE;
DROP TABLE IF EXISTS branch_food_control_config CASCADE;

-- Remove added columns
ALTER TABLE inventory_items DROP COLUMN IF EXISTS cost_per_unit;
ALTER TABLE restaurant_menu_items DROP COLUMN IF EXISTS category;
ALTER TABLE recipes DROP COLUMN IF EXISTS is_locked;
ALTER TABLE recipes DROP COLUMN IF EXISTS locked_by;
ALTER TABLE recipes DROP COLUMN IF EXISTS locked_at;

-- Drop functions
DROP FUNCTION IF EXISTS get_next_buffet_number(INT);
DROP FUNCTION IF EXISTS get_next_catering_number(INT);
DROP FUNCTION IF EXISTS get_next_stock_issue_number(INT);
```

## Post-Migration Tasks

1. **Backfill Cost Data**: Update `cost_per_unit` for existing inventory items
2. **Test Shift Close**: Verify shift close triggers P&L generation
3. **Test Recipe Locking**: Verify managers can lock/unlock recipes
4. **Test Buffet Flow**: Create → Open → Close → Variance
5. **Test Catering Flow**: Create → Allocate → Close → P&L
6. **User Training**: Train staff on new workflows

## Troubleshooting

### Migration Fails with "Missing Credentials"
- Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
- Check `.env` file in backend directory

### Migration Fails with "Table Already Exists"
- Some tables may already exist from previous attempts
- Either drop existing tables or skip those creation statements

### Functions Not Created
- Check Supabase logs for errors
- Verify you have sufficient permissions
- Try running function creation SQL manually in Supabase SQL Editor

### Triggers Not Working
- Verify functions exist first
- Check trigger syntax in migration file
- Test manually by inserting a record

## Support

For issues or questions:
1. Check migration logs in console
2. Review Supabase dashboard for errors
3. Verify all prerequisites are met
4. Contact development team with error details
