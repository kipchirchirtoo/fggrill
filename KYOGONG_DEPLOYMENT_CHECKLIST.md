# Kyogong Shift POS System - Deployment Checklist

## 📋 Pre-Deployment Checklist

### 1. Database Preparation

- [ ] **Verify Kyogong Branch ID**
  ```sql
  SELECT id, name FROM branches WHERE name LIKE '%Kyogong%';
  ```
  - If branch_id ≠ 2, update migration file INSERT statements

- [ ] **Backup Current Database**
  ```bash
  pg_dump -h <host> -U postgres -d postgres > backup_$(date +%Y%m%d).sql
  ```

- [ ] **Test Migration on Staging**
  ```bash
  psql -h <staging-host> -U postgres -d postgres -f backend/supabase/migrations/28_kyogong_shift_pos_system.sql
  ```

- [ ] **Verify Migration Success**
  ```sql
  -- Check tables created
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name LIKE '%shift%' OR table_name LIKE '%spa%';
  
  -- Check sample data
  SELECT COUNT(*) FROM sales_points WHERE branch_id = 2;
  SELECT COUNT(*) FROM spa_services WHERE branch_id = 2;
  SELECT COUNT(*) FROM dynamic_services WHERE branch_id = 2;
  ```

### 2. Backend Preparation

- [ ] **Update Environment Variables**
  ```bash
  # backend/.env
  DATABASE_URL=<production-url>
  SUPABASE_URL=<production-url>
  SUPABASE_KEY=<production-key>
  ```

- [ ] **Install Dependencies**
  ```bash
  cd backend
  npm install
  ```

- [ ] **Build Backend**
  ```bash
  npm run build
  ```

- [ ] **Run Backend Tests**
  ```bash
  npm test
  ```

- [ ] **Verify Routes Registration**
  ```bash
  # Check server.ts logs for:
  # "API routes registered: /api/kyogong"
  npm start
  ```

### 3. API Testing

- [ ] **Test Sales Points Endpoint**
  ```bash
  curl -H "Authorization: Bearer <token>" \
    http://localhost:5000/api/kyogong/sales-points
  ```
  Expected: 4 sales points returned

- [ ] **Test Open Shift**
  ```bash
  curl -X POST \
    -H "Authorization: Bearer <token>" \
    -H "Content-Type: application/json" \
    -d '{"sales_point_id":1,"opening_cash_float":5000}' \
    http://localhost:5000/api/kyogong/shifts/open
  ```
  Expected: Shift created with shift_number

- [ ] **Test Create Transaction**
  ```bash
  curl -X POST \
    -H "Authorization: Bearer <token>" \
    -H "Content-Type: application/json" \
    -d '{"service_category":"SPA","items":[{"item_type":"SPA_SERVICE","item_name":"Massage","quantity":1,"unit_price":2500}],"payment_method":"CASH","cash_amount":2500}' \
    http://localhost:5000/api/kyogong/shifts/<shift_id>/transactions
  ```
  Expected: Transaction created

- [ ] **Test Close Shift**
  ```bash
  curl -X PUT \
    -H "Authorization: Bearer <token>" \
    -H "Content-Type: application/json" \
    -d '{"closing_cash_counted":7500}' \
    http://localhost:5000/api/kyogong/shifts/<shift_id>/close
  ```
  Expected: Shift closed with variance calculated

- [ ] **Test Get Shift Details**
  ```bash
  curl -H "Authorization: Bearer <token>" \
    http://localhost:5000/api/kyogong/shifts/<shift_id>
  ```
  Expected: Complete shift details with transactions

### 4. Security Verification

- [ ] **Test RLS Policies**
  ```sql
  -- As Cashier: Should see only own shifts
  SET ROLE cashier_user;
  SELECT COUNT(*) FROM cashier_shifts;
  
  -- As Branch Accountant: Should see branch shifts
  SET ROLE accountant_user;
  SELECT COUNT(*) FROM cashier_shifts WHERE branch_id = 2;
  
  -- As Auditor: Should see all shifts
  SET ROLE auditor_user;
  SELECT COUNT(*) FROM cashier_shifts;
  ```

- [ ] **Test Immutability**
  ```sql
  -- Try to delete closed shift (should fail)
  DELETE FROM cashier_shifts WHERE status = 'CLOSED';
  
  -- Try to edit closed shift (should fail via API)
  ```

- [ ] **Test Authorization**
  - [ ] Cashier cannot approve shifts
  - [ ] Cashier cannot void transactions without authorization
  - [ ] Only Reception can record petty cash

### 5. Data Integrity

- [ ] **Verify Triggers**
  ```sql
  -- Test shift number generation
  INSERT INTO cashier_shifts (branch_id, sales_point_id, cashier_id, opened_at, opening_cash_float)
  VALUES (2, 1, '<user-id>', NOW(), 5000);
  
  SELECT shift_number FROM cashier_shifts ORDER BY created_at DESC LIMIT 1;
  -- Expected: KYG-SPA-YYYYMMDD-XXX
  ```

- [ ] **Verify Totals Update**
  ```sql
  -- Create transaction and check shift totals update
  -- Verify total_sales, cash_sales, mpesa_sales, card_sales
  ```

- [ ] **Verify Variance Calculation**
  ```sql
  -- Close shift and verify cash_expected, cash_variance calculated
  ```

- [ ] **Verify Audit Logging**
  ```sql
  SELECT * FROM shift_audit_log ORDER BY created_at DESC LIMIT 10;
  -- Should show OPEN, CLOSE, APPROVE actions
  ```

### 6. Frontend Integration

- [ ] **Verify API Methods Available**
  ```typescript
  import { kyogongAPI } from '@/lib/api';
  
  // Test methods exist
  console.log(typeof kyogongAPI.openShift); // 'function'
  console.log(typeof kyogongAPI.createTransaction); // 'function'
  ```

- [ ] **Test API Calls from Frontend**
  ```typescript
  // In browser console
  const result = await kyogongAPI.getSalesPoints();
  console.log(result); // Should return 4 sales points
  ```

---

## 🚀 Deployment Steps

### Step 1: Database Migration (Production)

```bash
# 1. Connect to production database
psql -h <production-host> -U postgres -d postgres

# 2. Run migration
\i backend/supabase/migrations/28_kyogong_shift_pos_system.sql

# 3. Verify tables created
\dt *shift*
\dt *spa*

# 4. Check sample data
SELECT * FROM sales_points WHERE branch_id = 2;
SELECT COUNT(*) FROM spa_services;
SELECT COUNT(*) FROM dynamic_services;
```

**Rollback Plan** (if needed):
```sql
-- Drop all tables in reverse order
DROP TABLE IF EXISTS shift_audit_log CASCADE;
DROP TABLE IF EXISTS shift_transaction_items CASCADE;
DROP TABLE IF EXISTS shift_transactions CASCADE;
DROP TABLE IF EXISTS dynamic_services CASCADE;
DROP TABLE IF EXISTS petty_cash_ledger CASCADE;
DROP TABLE IF EXISTS pool_tokens_inventory CASCADE;
DROP TABLE IF EXISTS spa_services CASCADE;
DROP TABLE IF EXISTS shift_staff_assignments CASCADE;
DROP TABLE IF EXISTS cashier_shifts CASCADE;
DROP TABLE IF EXISTS sales_points CASCADE;
```

### Step 2: Backend Deployment

```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies
cd backend
npm install

# 3. Build
npm run build

# 4. Restart server
pm2 restart backend
# OR
systemctl restart backend

# 5. Check logs
pm2 logs backend
# OR
journalctl -u backend -f
```

### Step 3: Verification

```bash
# 1. Health check
curl http://localhost:5000/api/health

# 2. Test Kyogong endpoints
curl -H "Authorization: Bearer <token>" \
  http://localhost:5000/api/kyogong/sales-points

# 3. Monitor logs for errors
tail -f backend/logs/error.log
```

### Step 4: Frontend Deployment

```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies
cd frontend
npm install

# 3. Build
npm run build

# 4. Deploy
# (depends on your deployment method)
```

---

## ✅ Post-Deployment Verification

### 1. Smoke Tests

- [ ] **Open Shift**
  - Login as Cashier
  - Navigate to shift manager
  - Open shift for SPA sales point
  - Verify shift number generated

- [ ] **Create Transaction**
  - Select SPA service
  - Add to cart
  - Process payment
  - Verify transaction created

- [ ] **Close Shift**
  - Count cash
  - Enter closing amount
  - Verify variance calculated
  - Close shift successfully

- [ ] **Approve Shift**
  - Login as Branch Accountant
  - View closed shifts
  - Approve shift
  - Verify status changed

### 2. Integration Tests

- [ ] **SPA Cashier Workflow**
  - Open shift
  - Create 3 transactions (different services)
  - Close shift
  - Verify totals correct

- [ ] **Executive Bar Workflow**
  - Open shift
  - Assign 2 waiters
  - Create bar + restaurant orders
  - Close shift

- [ ] **Sports Bar Workflow**
  - Open shift
  - Sell pool tokens
  - Create bar orders
  - Reconcile tokens
  - Close shift

- [ ] **Reception Workflow**
  - Open shift
  - Record petty cash entry
  - Create dynamic service transaction
  - Reconcile petty cash
  - Close shift

### 3. Performance Tests

- [ ] **Load Test**
  ```bash
  # Use Apache Bench or similar
  ab -n 1000 -c 10 -H "Authorization: Bearer <token>" \
    http://localhost:5000/api/kyogong/sales-points
  ```

- [ ] **Database Performance**
  ```sql
  EXPLAIN ANALYZE SELECT * FROM cashier_shifts 
  WHERE branch_id = 2 AND status = 'OPEN';
  ```

### 4. Security Tests

- [ ] **Unauthorized Access**
  - Try accessing endpoints without token
  - Try accessing other cashier's shifts
  - Try approving shift as cashier

- [ ] **SQL Injection**
  - Test with malicious input in API calls
  - Verify parameterized queries used

- [ ] **XSS Prevention**
  - Test with script tags in customer names
  - Verify input sanitization

---

## 📊 Monitoring Setup

### 1. Database Monitoring

```sql
-- Create monitoring view
CREATE OR REPLACE VIEW kyogong_shift_stats AS
SELECT 
  DATE(opened_at) as date,
  sp.name as sales_point,
  COUNT(*) as shifts_count,
  SUM(total_sales) as total_sales,
  AVG(cash_variance) as avg_variance
FROM cashier_shifts cs
JOIN sales_points sp ON cs.sales_point_id = sp.id
WHERE cs.branch_id = 2
GROUP BY DATE(opened_at), sp.name
ORDER BY date DESC;
```

### 2. Application Monitoring

- [ ] **Setup Error Tracking**
  - Sentry or similar
  - Log all API errors
  - Alert on critical errors

- [ ] **Setup Performance Monitoring**
  - New Relic or similar
  - Track API response times
  - Monitor database query performance

- [ ] **Setup Uptime Monitoring**
  - Pingdom or similar
  - Monitor API availability
  - Alert on downtime

### 3. Business Metrics

- [ ] **Daily Shift Report**
  ```sql
  SELECT 
    sp.name,
    COUNT(*) as shifts,
    SUM(total_sales) as sales,
    SUM(ABS(cash_variance)) as total_variance
  FROM cashier_shifts cs
  JOIN sales_points sp ON cs.sales_point_id = sp.id
  WHERE DATE(opened_at) = CURRENT_DATE
  AND cs.branch_id = 2
  GROUP BY sp.name;
  ```

- [ ] **Variance Alert**
  ```sql
  -- Alert when variance > 5%
  SELECT * FROM cashier_shifts
  WHERE ABS(cash_variance) > (cash_expected * 0.05)
  AND status = 'CLOSED'
  AND DATE(closed_at) = CURRENT_DATE;
  ```

---

## 🔧 Troubleshooting

### Common Issues

**Issue**: Migration fails with "relation already exists"  
**Solution**: Drop existing tables or use `IF NOT EXISTS` in migration

**Issue**: Backend won't start - "Cannot find module"  
**Solution**: Run `npm install` and `npm run build`

**Issue**: API returns 404 for /api/kyogong/*  
**Solution**: Verify routes registered in `backend/src/routes/index.ts`

**Issue**: RLS policies blocking all access  
**Solution**: Check user role in JWT token, verify policies

**Issue**: Shift number not generating  
**Solution**: Check trigger exists and branch_id is correct

---

## 📞 Support Contacts

**Development Team**: dev@kyogong.com  
**Database Admin**: dba@kyogong.com  
**Branch Manager**: kyogong@kyogong.com

---

## 📝 Sign-Off

### Pre-Deployment

- [ ] Database migration tested on staging
- [ ] Backend tests passing
- [ ] API endpoints tested
- [ ] Security verified
- [ ] Documentation reviewed

**Signed**: _________________ Date: _________

### Post-Deployment

- [ ] Production migration successful
- [ ] Backend deployed and running
- [ ] Smoke tests passed
- [ ] Integration tests passed
- [ ] Monitoring setup complete

**Signed**: _________________ Date: _________

---

**Deployment Date**: __________  
**Deployed By**: __________  
**Verified By**: __________

**Status**: ⬜ Ready for Deployment | ⬜ Deployed | ⬜ Verified
