# Kyogong Shift POS System - Quick Start Guide

## 🚀 Getting Started

### Step 1: Run Database Migration

```bash
# Option 1: Using Supabase CLI
supabase db push

# Option 2: Direct SQL execution
psql -h <your-supabase-host> -U postgres -d postgres -f backend/supabase/migrations/28_kyogong_shift_pos_system.sql
```

### Step 2: Restart Backend Server

```bash
cd backend
npm run build
npm start
```

### Step 3: Verify Installation

```bash
# Check if API is accessible
curl http://localhost:5000/api/kyogong/sales-points

# Expected response:
{
  "success": true,
  "data": [
    { "id": 1, "code": "SPA", "name": "SPA Cashier", ... },
    { "id": 2, "code": "EXEC_BAR", "name": "Executive Bar Cashier", ... },
    { "id": 3, "code": "SPORTS_BAR", "name": "Sports Bar Cashier", ... },
    { "id": 4, "code": "RECEPTION", "name": "Reception/Overall Cashier", ... }
  ]
}
```

---

## 📋 Testing Workflow

### Test 1: Open a Shift (SPA Cashier)

```bash
POST http://localhost:5000/api/kyogong/shifts/open
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "sales_point_id": 1,
  "opening_cash_float": 5000
}
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Shift opened successfully",
  "data": {
    "id": "uuid-here",
    "shift_number": "KYG-SPA-20260219-001",
    "status": "OPEN",
    "opening_cash_float": 5000,
    ...
  }
}
```

### Test 2: Get Current Shift

```bash
GET http://localhost:5000/api/kyogong/shifts/current
Authorization: Bearer <your-token>
```

### Test 3: Create a Transaction (SPA Service)

```bash
POST http://localhost:5000/api/kyogong/shifts/{shift_id}/transactions
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "service_category": "SPA",
  "items": [
    {
      "item_type": "SPA_SERVICE",
      "item_id": "1",
      "item_name": "Full Body Massage",
      "quantity": 1,
      "unit_price": 2500
    },
    {
      "item_type": "SPA_SERVICE",
      "item_id": "7",
      "item_name": "Manicure",
      "quantity": 1,
      "unit_price": 800
    }
  ],
  "customer_name": "Jane Doe",
  "customer_phone": "0712345678",
  "payment_method": "CASH",
  "cash_amount": 3300
}
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Transaction created successfully",
  "data": {
    "id": "uuid-here",
    "transaction_number": "SPA-20260219-0001",
    "total_amount": 3300,
    "items": [...]
  }
}
```

### Test 4: Close the Shift

```bash
PUT http://localhost:5000/api/kyogong/shifts/{shift_id}/close
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "closing_cash_counted": 8300,
  "variance_reason": "All cash accounted for"
}
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Shift closed successfully",
  "data": {
    "id": "uuid-here",
    "status": "CLOSED",
    "cash_expected": 8300,
    "cash_variance": 0,
    ...
  }
}
```

### Test 5: Approve Shift (Branch Accountant)

```bash
PUT http://localhost:5000/api/kyogong/shifts/{shift_id}/approve
Authorization: Bearer <accountant-token>
Content-Type: application/json

{
  "review_notes": "Shift reconciled correctly. No issues found."
}
```

---

## 🧪 Postman Collection

Import this collection for quick testing:

```json
{
  "info": {
    "name": "Kyogong Shift POS",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "1. Get Sales Points",
      "request": {
        "method": "GET",
        "url": "{{base_url}}/api/kyogong/sales-points"
      }
    },
    {
      "name": "2. Open Shift",
      "request": {
        "method": "POST",
        "url": "{{base_url}}/api/kyogong/shifts/open",
        "body": {
          "mode": "raw",
          "raw": "{\n  \"sales_point_id\": 1,\n  \"opening_cash_float\": 5000\n}"
        }
      }
    },
    {
      "name": "3. Get Current Shift",
      "request": {
        "method": "GET",
        "url": "{{base_url}}/api/kyogong/shifts/current"
      }
    },
    {
      "name": "4. Create Transaction",
      "request": {
        "method": "POST",
        "url": "{{base_url}}/api/kyogong/shifts/{{shift_id}}/transactions",
        "body": {
          "mode": "raw",
          "raw": "{\n  \"service_category\": \"SPA\",\n  \"items\": [\n    {\n      \"item_type\": \"SPA_SERVICE\",\n      \"item_id\": \"1\",\n      \"item_name\": \"Full Body Massage\",\n      \"quantity\": 1,\n      \"unit_price\": 2500\n    }\n  ],\n  \"customer_name\": \"Jane Doe\",\n  \"payment_method\": \"CASH\",\n  \"cash_amount\": 2500\n}"
        }
      }
    },
    {
      "name": "5. Close Shift",
      "request": {
        "method": "PUT",
        "url": "{{base_url}}/api/kyogong/shifts/{{shift_id}}/close",
        "body": {
          "mode": "raw",
          "raw": "{\n  \"closing_cash_counted\": 7500\n}"
        }
      }
    }
  ]
}
```

---

## 🔍 Verification Queries

Run these SQL queries to verify data:

### Check Sales Points
```sql
SELECT * FROM sales_points WHERE branch_id = 2;
```

### Check SPA Services
```sql
SELECT category, COUNT(*) as count, SUM(base_price) as total_value
FROM spa_services
WHERE branch_id = 2
GROUP BY category;
```

### Check Open Shifts
```sql
SELECT 
  cs.shift_number,
  cs.status,
  sp.name as sales_point,
  u.full_name as cashier,
  cs.opened_at
FROM cashier_shifts cs
JOIN sales_points sp ON cs.sales_point_id = sp.id
JOIN users u ON cs.cashier_id = u.id
WHERE cs.status = 'OPEN';
```

### Check Shift Transactions
```sql
SELECT 
  st.transaction_number,
  st.service_category,
  st.total_amount,
  st.payment_method,
  COUNT(sti.id) as items_count
FROM shift_transactions st
LEFT JOIN shift_transaction_items sti ON st.id = sti.transaction_id
WHERE st.shift_id = '<shift-id>'
GROUP BY st.id;
```

---

## 🐛 Troubleshooting

### Issue: "Sales point not found"
**Solution**: Check if sales points were created for the correct branch_id. Update migration if needed.

### Issue: "Cannot open shift - already has open shift"
**Solution**: Close existing shift first or query current shift to get its ID.

### Issue: "Variance explanation required"
**Solution**: Provide variance_reason when cash variance exceeds threshold (>5% or >1000 KES).

### Issue: "Payment amounts do not match total"
**Solution**: Ensure cash_amount + mpesa_amount + card_amount = total_amount (including tax).

---

## 📊 Sample Data

### SPA Services Available
1. Full Body Massage - KES 2,500
2. Back Massage - KES 1,500
3. Foot Massage - KES 1,000
4. Full Body Waxing - KES 3,000
5. Leg Waxing - KES 1,000
6. Arm Waxing - KES 800
7. Manicure - KES 800
8. Pedicure - KES 1,000
9. Gel Nails - KES 1,500
10. Hair Cut (Ladies) - KES 500
11. Hair Styling - KES 1,500
12. Hair Treatment - KES 2,000
13. Sauna Session (30 min) - KES 1,000
14. Sauna Session (60 min) - KES 1,500
15. Hair Cut (Gents) - KES 300
16. Shave - KES 200
17. Hair Cut + Shave - KES 450

### Dynamic Services Available
1. Saloon Car Wash - KES 500
2. SUV/4x4 Wash - KES 800
3. Pickup/Van Wash - KES 700
4. Swimming Pool Entry (Adult) - KES 300
5. Swimming Pool Entry (Child) - KES 200
6. Bouncing Castle (1 hour) - KES 500 + KES 200/hr
7. Quadbike Rental (30 min) - KES 1,000 + KES 500/hr
8. Conference Room (Half Day) - KES 5,000 + KES 1,000/hr
9. Conference Room (Full Day) - KES 8,000

---

## 📱 Next Steps

1. ✅ Verify database migration successful
2. ✅ Test all API endpoints with Postman
3. ✅ Confirm shift workflow (open → transact → close → approve)
4. ⏳ Build frontend POS interfaces (Phase 2)
5. ⏳ Implement reconciliation screens
6. ⏳ Create accountant dashboard
7. ⏳ Build auditor interface

---

## 📞 Support

For issues or questions:
- Check `KYOGONG_SHIFT_POS_SYSTEM_ANALYSIS.md` for complete specification
- Review `KYOGONG_PHASE1_COMPLETE.md` for implementation details
- Contact development team

**Last Updated**: February 19, 2026
