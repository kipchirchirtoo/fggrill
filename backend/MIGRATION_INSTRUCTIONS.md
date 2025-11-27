# Storekeeping Module - Migration Instructions

## 🚀 Quick Start - Run Migrations

### Option 1: Supabase Dashboard (RECOMMENDED - Easiest)

1. **Open Supabase Dashboard**
   - Go to: https://app.supabase.com
   - Select your project

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and Paste SQL**
   - Open file: `backend/supabase/migrations/11_COMPLETE_storekeeping.sql`
   - Copy ALL content (2458 lines)
   - Paste into SQL Editor

4. **Run the Migration**
   - Click "Run" button (or press Ctrl+Enter / Cmd+Enter)
   - Wait for completion (may take 30-60 seconds)

5. **Verify Success**
   - Check for success message
   - Go to "Table Editor" and verify new tables starting with `store_`

### Option 2: Run Individual Migration Files

If the complete file is too large, run these files one by one in order:

1. `11a_storekeeping_core.sql` - Core tables (items, departments, locations)
2. `11b_storekeeping_suppliers.sql` - Supplier management
3. `11c_storekeeping_purchase.sql` - Purchase requisitions & orders
4. `11d_storekeeping_stock_operations.sql` - Stock movements & operations
5. `11e_storekeeping_policies.sql` - Row Level Security policies
6. `11f_storekeeping_functions.sql` - Database functions & triggers

### Option 3: Using Supabase CLI (If linked)

```bash
cd backend
supabase db push
```

## ✅ Verification Checklist

After running migrations, verify in Supabase Dashboard:

### Tables Created (28 tables)
- [ ] store_departments
- [ ] store_locations
- [ ] store_items
- [ ] store_item_suppliers
- [ ] store_item_batches
- [ ] store_suppliers
- [ ] store_supplier_quotations
- [ ] store_supplier_performance
- [ ] store_purchase_requisitions
- [ ] store_requisition_items
- [ ] store_purchase_orders
- [ ] store_po_items
- [ ] store_grn
- [ ] store_grn_items
- [ ] store_stock_movements
- [ ] store_stock_issues
- [ ] store_issue_items
- [ ] store_stock_returns
- [ ] store_return_items
- [ ] store_stock_transfers
- [ ] store_transfer_items
- [ ] store_stock_adjustments
- [ ] store_adjustment_items
- [ ] store_physical_counts
- [ ] store_count_items

### Enums Created
- [ ] item_category
- [ ] unit_of_measurement
- [ ] costing_method
- [ ] supplier_status
- [ ] payment_terms
- [ ] requisition_status
- [ ] requisition_priority
- [ ] po_status
- [ ] grn_status
- [ ] movement_type
- [ ] issue_status
- [ ] adjustment_reason
- [ ] transfer_status

### Functions Created
- [ ] generate_item_code()
- [ ] generate_supplier_code()
- [ ] generate_quotation_number()
- [ ] generate_requisition_number()
- [ ] generate_po_number()
- [ ] generate_grn_number()
- [ ] generate_movement_number()
- [ ] generate_issue_number()
- [ ] generate_transfer_number()
- [ ] process_grn_receipt()
- [ ] process_stock_issue()
- [ ] process_stock_return()
- [ ] process_stock_transfer()
- [ ] process_stock_adjustment()
- [ ] update_po_status()
- [ ] update_supplier_performance()
- [ ] calculate_grn_totals()
- [ ] check_expiring_items()
- [ ] get_items_to_reorder()

### Policies Created
- [ ] RLS enabled on all store_* tables
- [ ] View policies for all roles
- [ ] Manage policies for authorized roles

## 🐛 Troubleshooting

### Error: "type already exists"
**Solution**: The migration was partially run. Either:
- Drop existing types: `DROP TYPE IF EXISTS item_category CASCADE;`
- Or skip to the next migration file

### Error: "relation already exists"
**Solution**: Table already created. Either:
- Drop the table: `DROP TABLE IF EXISTS store_items CASCADE;`
- Or skip to the next migration file

### Error: "permission denied"
**Solution**: Make sure you're using the Service Role Key, not the Anon Key

### Error: "function already exists"
**Solution**: Functions were created. You can:
- Drop and recreate: `DROP FUNCTION IF EXISTS generate_item_code CASCADE;`
- Or skip the function creation

## 🎯 What Gets Created

### Database Schema
- **28 tables** for complete inventory management
- **13 enums** for data validation
- **19 functions** for automation
- **25+ triggers** for auto-updates
- **100+ RLS policies** for security

### Key Features
- ✅ Item master with batch/serial/expiry tracking
- ✅ Multi-location inventory
- ✅ Supplier management with performance tracking
- ✅ Purchase requisitions with approval workflow
- ✅ Purchase orders with multi-level approval
- ✅ Goods Receipt Notes (GRN) with quality check
- ✅ Stock issues, returns, transfers, adjustments
- ✅ Physical stock counting
- ✅ Complete audit trail
- ✅ Automated stock updates
- ✅ Low stock & expiry alerts

## 🔄 After Migration

### 1. Test the Database
```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'store_%';

-- Check if functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%store%';
```

### 2. Start the Backend
```bash
cd backend
npm install
npm run dev
```

### 3. Test API Endpoints
```bash
# Health check
curl http://localhost:5000/api/health

# Get items (requires auth token)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/store/items
```

## 📞 Need Help?

If you encounter issues:
1. Check the Supabase logs in Dashboard
2. Review the error message carefully
3. Try running migrations one file at a time
4. Check if tables/functions already exist

## 🎉 Success!

Once migrations complete successfully:
- ✅ Database schema is ready
- ✅ API endpoints are functional
- ✅ You can start creating items, suppliers, and purchase orders
- ✅ Ready for frontend development

---

**Next Steps**: See `STOREKEEPING_QUICK_START.md` for API usage examples
