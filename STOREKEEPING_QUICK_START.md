# Storekeeping Module - Quick Start Guide

## 🚀 Getting Started

### 1. Run Database Migrations

Execute migrations in order:

```bash
cd backend/supabase/migrations

# Run in Supabase SQL Editor or via CLI:
psql -U postgres -d your_database -f 11a_storekeeping_core.sql
psql -U postgres -d your_database -f 11b_storekeeping_suppliers.sql
psql -U postgres -d your_database -f 11c_storekeeping_purchase.sql
psql -U postgres -d your_database -f 11d_storekeeping_stock_operations.sql
psql -U postgres -d your_database -f 11e_storekeeping_policies.sql
psql -U postgres -d your_database -f 11f_storekeeping_functions.sql
```

### 2. Verify Installation

```sql
-- Check tables created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'store_%';

-- Should return 28 tables

-- Check functions created
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%store%' OR routine_name LIKE '%item%';

-- Should return 15+ functions
```

### 3. Test API Endpoints

Start the backend server:

```bash
cd backend
npm install
npm run dev
```

Test endpoints:

```bash
# Health check
curl http://localhost:5000/api/health

# Get items (requires authentication)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/store/items

# Get low stock items
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/store/items/low-stock

# Get suppliers
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/store/suppliers
```

## 📋 Common Operations

### Create an Item

```bash
curl -X POST http://localhost:5000/api/store/items \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Laundry Detergent",
    "category": "cleaning_supplies",
    "unit": "kg",
    "minimum_stock": 20,
    "maximum_stock": 100,
    "reorder_level": 30,
    "reorder_quantity": 50,
    "unit_cost": 450,
    "storage_location_id": "location-uuid"
  }'
```

### Create a Supplier

```bash
curl -X POST http://localhost:5000/api/store/suppliers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ABC Supplies Ltd",
    "email": "sales@abcsupplies.com",
    "phone": "+254700000000",
    "payment_terms": "credit_30_days",
    "credit_limit": 500000,
    "city": "Nairobi",
    "country": "Kenya"
  }'
```

### Create a Purchase Requisition

```bash
curl -X POST http://localhost:5000/api/store/requisitions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "department_id": "dept-uuid",
    "priority": "normal",
    "purpose": "Monthly stock replenishment",
    "items": [
      {
        "item_id": "item-uuid",
        "quantity_requested": 50,
        "specification": "5kg bags"
      }
    ]
  }'
```

### Approve a Requisition

```bash
curl -X PUT http://localhost:5000/api/store/requisitions/req-uuid/approve \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "approval_notes": "Approved for procurement"
  }'
```

### Create a Purchase Order

```bash
curl -X POST http://localhost:5000/api/store/purchase-orders \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "supplier_id": "supplier-uuid",
    "requisition_id": "req-uuid",
    "expected_delivery_date": "2025-12-15",
    "payment_terms": "credit_30_days",
    "items": [
      {
        "item_id": "item-uuid",
        "quantity_ordered": 50,
        "unit_price": 445
      }
    ]
  }'
```

## 🔐 User Roles & Permissions

### Super Admin
- Full access to all operations
- Can delete items and suppliers
- Can approve all transactions

### Manager
- Approve requisitions
- Approve purchase orders
- Approve adjustments
- View all reports
- Manage suppliers

### Storekeeper
- Create and manage items
- Create and manage suppliers
- Create purchase orders
- Receive goods (GRN)
- Issue stock
- Process transfers
- Conduct physical counts

### Department Staff (Housekeeping, Restaurant, Maintenance)
- View items
- Create requisitions
- View their requisitions
- View their stock issues

## 📊 Database Schema Overview

### Core Tables
- `store_items` - Item master
- `store_departments` - Departments
- `store_locations` - Storage locations
- `store_item_batches` - Batch tracking

### Supplier Tables
- `store_suppliers` - Supplier master
- `store_supplier_quotations` - Quotations
- `store_supplier_performance` - Performance ratings

### Purchase Tables
- `store_purchase_requisitions` - Requisitions
- `store_requisition_items` - Requisition items
- `store_purchase_orders` - Purchase orders
- `store_po_items` - PO items
- `store_grn` - Goods receipt notes
- `store_grn_items` - GRN items

### Stock Operation Tables
- `store_stock_movements` - All stock movements (ledger)
- `store_stock_issues` - Stock issues
- `store_issue_items` - Issue items
- `store_stock_returns` - Stock returns
- `store_return_items` - Return items
- `store_stock_transfers` - Stock transfers
- `store_transfer_items` - Transfer items
- `store_stock_adjustments` - Stock adjustments
- `store_adjustment_items` - Adjustment items
- `store_physical_counts` - Physical counts
- `store_count_items` - Count items

## 🔧 Useful SQL Queries

### Get items below reorder level
```sql
SELECT * FROM get_items_to_reorder();
```

### Get expiring items (next 30 days)
```sql
SELECT * FROM check_expiring_items();
```

### Get stock movement history for an item
```sql
SELECT * FROM store_stock_movements
WHERE item_id = 'your-item-uuid'
ORDER BY movement_date DESC;
```

### Get department consumption
```sql
SELECT 
  d.name as department,
  i.name as item,
  SUM(sm.quantity) as total_consumed,
  SUM(sm.total_value) as total_cost
FROM store_stock_movements sm
JOIN store_items i ON i.id = sm.item_id
JOIN store_departments d ON d.id = sm.to_department_id
WHERE sm.movement_type = 'issue'
AND sm.movement_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY d.name, i.name
ORDER BY total_cost DESC;
```

### Get supplier performance
```sql
SELECT 
  s.name,
  s.total_orders,
  s.total_purchase_value,
  s.on_time_delivery_rate,
  s.quality_rating
FROM store_suppliers s
WHERE s.status = 'active'
ORDER BY s.quality_rating DESC;
```

## 🎯 Workflow Examples

### Purchase Workflow
1. **Department creates requisition** → Status: `draft`
2. **Submit for approval** → Status: `pending_approval`
3. **Manager approves** → Status: `approved`
4. **Storekeeper creates PO** → Requisition: `converted_to_po`
5. **Manager approves PO** → PO Status: `approved`
6. **Send PO to supplier** → PO Status: `sent_to_supplier`
7. **Receive goods (GRN)** → PO Status: `partially_received` or `fully_received`
8. **Stock auto-updated** → Via triggers

### Stock Issue Workflow
1. **Department creates issue request** → Status: `pending`
2. **Manager approves** → Status: `approved`
3. **Storekeeper issues stock** → Status: `issued`
4. **Stock auto-reduced** → Via triggers
5. **Movement recorded** → In `store_stock_movements`

### Physical Count Workflow
1. **Start count** → Status: `in_progress`
2. **Record counts** → Update count items
3. **Complete count** → Status: `completed`
4. **Manager approves** → Status: `approved`
5. **Create adjustments** → For variances
6. **Approve adjustments** → Stock updated

## 📱 Integration Points

### F&B Integration
```typescript
// Get ingredients for recipe
const ingredients = await getItemsByCategory('food', 'beverage');

// Create recipe-based requisition
const requisition = await createRequisition({
  department_id: 'kitchen-dept',
  issue_type: 'recipe_based',
  items: recipeIngredients
});
```

### Housekeeping Integration
```typescript
// Track linen usage
const linenIssue = await createStockIssue({
  department_id: 'housekeeping-dept',
  items: [
    { item_id: 'bed-sheets-uuid', quantity: 50 },
    { item_id: 'towels-uuid', quantity: 100 }
  ]
});

// Track amenities per room
const amenitiesIssue = await createStockIssue({
  department_id: 'housekeeping-dept',
  issue_type: 'room_amenities',
  items: amenitiesPerRoom
});
```

### Accounting Integration
```typescript
// Get stock valuation
const valuation = await getStockValuation();

// Get department costs
const costs = await getDepartmentCosts(departmentId, dateRange);

// Generate journal entries
const entries = await generateJournalEntries('purchase', poId);
```

## 🐛 Troubleshooting

### Issue: Cannot create item
**Solution**: Check if user has `storekeeper`, `manager`, or `super_admin` role

### Issue: Stock not updating after GRN
**Solution**: Verify triggers are enabled:
```sql
SELECT * FROM pg_trigger WHERE tgname LIKE '%grn%';
```

### Issue: Low stock alerts not showing
**Solution**: Run the function manually:
```sql
SELECT * FROM get_items_to_reorder();
```

### Issue: Permission denied
**Solution**: Check RLS policies:
```sql
SELECT * FROM pg_policies WHERE tablename LIKE 'store_%';
```

## 📞 Support

For issues or questions:
1. Check the implementation summary: `STOREKEEPING_IMPLEMENTATION_SUMMARY.md`
2. Check the progress document: `STOREKEEPING_MODULE_PROGRESS.md`
3. Review database migrations in `backend/supabase/migrations/11*.sql`
4. Review controllers in `backend/src/controllers/storekeeping/`

## 🎓 Learning Resources

### Understanding the Schema
- Read `11a_storekeeping_core.sql` for core tables
- Read `11f_storekeeping_functions.sql` for business logic

### Understanding the API
- Check `backend/src/routes/storekeeping.routes.ts` for all endpoints
- Check controller files for implementation details

### Understanding Workflows
- Review trigger functions in migration files
- Check status enums in `backend/src/models/Storekeeping.ts`

---

**Quick Start Complete!** 🎉

You now have a fully functional storekeeping backend ready for testing and frontend development.
