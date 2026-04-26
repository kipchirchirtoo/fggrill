# FOOD CONTROL SYSTEM - CODEBASE ANALYSIS & IMPLEMENTATION PLAN

## 📊 EXECUTIVE SUMMARY

Famous Gates Hotel Management System requires a **Unified Food Control & Financial Intelligence Engine** that tracks food usage from stock issuance through POS sales, using recipe-based theoretical vs actual consumption to detect profit leaks across three revenue streams: POS (à la carte), Buffet, and Outside Catering.

---

## 🏗️ EXISTING ARCHITECTURE ANALYSIS

### Core Modules Identified

#### 1. **INVENTORY & STOREKEEPING** ✅ (Mature)
**Location**: `backend/src/controllers/storekeeping/`

**Existing Tables**:
- `store_inventory` - Central/branch stock levels
- `inventory_items` - Master item catalog with SKUs
- `store_purchase_orders` - PO management
- `store_grn` - Goods Received Notes
- `store_stock_movements` - Stock in/out tracking
- `store_suppliers` - Supplier management

**Key Features**:
- Multi-branch inventory tracking
- Purchase order workflow
- GRN processing
- Stock transfers between branches
- Barcode system integration

**Controllers**:
- `items.controller.ts` - Item CRUD
- `grn.controller.ts` - GRN processing
- `purchase-orders.controller.ts` - PO management
- `branch-inventory.controller.ts` - Branch stock
- `transfers.controller.ts` - Inter-branch transfers

---

#### 2. **KITCHEN MANAGEMENT** ✅ (Recently Implemented)
**Location**: `backend/src/controllers/kitchen/`

**Existing Tables** (from `20260126_kitchen_management_clean.sql`):
- `kitchen_stock` - Current kitchen stock balances
- `kitchen_stock_ledger` - Immutable transaction log
- `kitchen_requisitions` - Kitchen requests to store
- `kitchen_requisition_items` - Requisition line items
- `kitchen_grn` - Kitchen goods received
- `kitchen_grn_items` - GRN line items
- `recipes` - Menu item recipes (BOM)
- `recipe_items` - Recipe ingredients
- `kitchen_usage` - Usage tracking (linked to POS)
- `kitchen_wastage` - Wastage logging
- `kitchen_daily_variance` - Daily variance tracking
- `kitchen_food_controls` - Yield rules (raw → produced)

**Key Features**:
- Ledger-based stock tracking (immutable)
- Recipe management with cost calculation
- Auto-deduction from POS sales
- Requisition workflow
- Wastage tracking
- Daily variance calculation

**Controllers**:
- `recipes.controller.ts` - Recipe CRUD + auto-deduct
- `food-control.controller.ts` - Yield rules
- `stock.controller.ts` - Kitchen stock ledger
- `requisitions.controller.ts` - Requisition workflow
- `usage-wastage.controller.ts` - Usage/wastage logging
- `variance-reconciliation.controller.ts` - Variance analysis

**Critical Function**:
```typescript
// backend/src/controllers/kitchen/recipes.controller.ts
export async function deductIngredientsForItem(params: {
    order_id: number | string;
    menu_item_id: string;
    quantity: number;
    branch_id: number;
    user_id?: string;
})
```
This function **already auto-deducts ingredients** when POS sales occur!

---

#### 3. **POS & CASHIER** ✅ (Mature)
**Location**: `backend/src/controllers/cashier.controller.ts`

**Existing Tables**:
- `pos_transactions` - POS sales
- `pos_transaction_items` - Sale line items
- `restaurant_orders` - Restaurant orders
- `restaurant_order_items` - Order line items
- `bar_orders` - Bar orders
- `bar_order_items` - Bar order items
- `shift_transactions` - Kyogong shift sales
- `cashier_shifts` - Cashier shift management

**Key Features**:
- Multi-stream bill lookup (HTL, ORD, BAR, CS, INV, CNF)
- Payment processing (M-Pesa, Cash, Card)
- Shift management
- Receipt generation
- Branch isolation

**Controllers**:
- `cashier.controller.ts` - Bill lookup, payments
- `cashier-shifts.controller.ts` - Shift management
- `payment.controller.ts` - Payment processing

---

#### 4. **SHIFTS & STAFF** ✅ (Basic)
**Location**: `backend/src/controllers/shifts.controller.ts`

**Existing Tables**:
- `staff_shifts` - Staff shift scheduling
- `shift_templates` - Shift templates
- `shift_swaps` - Shift swap requests
- `cashier_shifts` - Cashier-specific shifts

**Key Features**:
- Shift templates
- Staff scheduling
- Check-in/check-out
- Shift swaps
- Shift statistics

**Controllers**:
- `shifts.controller.ts` - Shift CRUD
- `cashier-shifts.controller.ts` - Cashier shifts

---

#### 5. **MENU ITEMS** ✅ (Mature)
**Location**: `backend/src/database/migrations/08_create_restaurant_tables.sql`

**Existing Tables**:
- `restaurant_menu_items` - Menu items
- `restaurant_menu_categories` - Menu categories
- `bar_menu` - Bar menu items

**Key Features**:
- Menu item management
- Category organization
- Pricing
- Availability tracking

---

#### 6. **ACCOUNTING & FINANCE** ✅ (Mature)
**Location**: `backend/src/controllers/accounting.controller.ts`

**Existing Tables**:
- `accounting_ar_invoices` - Accounts receivable
- `accounting_customers` - Customer ledger
- `finance_invoices` - Finance invoices
- `unpaid_bills` - Unpaid bill tracking
- `credit_bills` - Credit bill management

**Key Features**:
- Invoice generation
- Payment tracking
- Credit management
- Financial reporting

---

#### 7. **AUDITOR & REPORTS** ✅ (Mature)
**Location**: `backend/src/controllers/auditor.controller.ts`

**Existing Tables**:
- `audit_trail` - Audit logging
- `audit_exceptions` - Flagged anomalies
- `audit_sessions` - Audit sessions

**Key Features**:
- Audit trail logging
- Exception flagging
- Report generation
- Variance review

---

## 🎯 GAP ANALYSIS: What's Missing for Full Food Control

### ❌ MISSING COMPONENTS

#### 1. **BUFFET MANAGEMENT** (Not Implemented)
**Required Tables**:
- `buffets` - Buffet events
- `buffet_menu_items` - Buffet menu items
- `buffet_stock_allocations` - Stock allocated to buffets

**Required Features**:
- Buffet event creation
- Guest count tracking (expected vs actual)
- Menu item selection with portion per guest
- Stock allocation and return tracking
- Buffet-specific variance calculation

---

#### 2. **OUTSIDE CATERING** (Not Implemented)
**Required Tables**:
- `catering_events` - Catering events
- `catering_menu_items` - Event menu items
- `catering_stock_allocations` - Stock allocated to events

**Required Features**:
- Event booking and management
- Client information tracking
- Menu planning with quantities
- Stock allocation and return tracking
- Event P&L calculation

---

#### 3. **SHIFT-LEVEL P&L ENGINE** (Not Implemented)
**Required Tables**:
- `shift_financials` - Shift-level P&L
- `food_control_variance` - Variance tracking per shift

**Required Features**:
- Automatic P&L generation at shift close
- Revenue aggregation (POS + Buffet + Catering)
- COGS calculation (Theoretical vs Actual)
- Variance cost calculation
- Food cost percentage tracking
- Accountant review workflow
- Auditor approval workflow

---

#### 4. **THEORETICAL VS ACTUAL ENGINE** (Partially Implemented)
**Existing**: `kitchen_daily_variance` table exists
**Missing**:
- Real-time theoretical calculation from POS sales
- Buffet theoretical calculation
- Catering theoretical calculation
- Shift-level variance aggregation
- Automatic flagging based on thresholds
- Explanation workflow

---

#### 5. **PORTION OUTPUT CONVERSION** (Not Implemented)
**Missing**:
- Issued stock → expected portions calculation
- Actual portions sold tracking
- Gap analysis (expected vs actual)
- Portion-level variance reporting

---

#### 6. **WASTE TRACKING ENHANCEMENT** (Basic Implementation)
**Existing**: `kitchen_wastage` table exists
**Missing**:
- Manager approval workflow for theft/excess
- Photo upload for wastage
- Wastage cost calculation
- Wastage trend analysis
- Integration with variance calculation

---

#### 7. **RECIPE LOCKING & CHANGE LOG** (Not Implemented)
**Missing**:
- Recipe lock/unlock by manager
- Recipe change audit trail
- Manager approval for recipe changes
- Recipe version history

---

#### 8. **STOCK ISSUE WORKFLOW** (Partially Implemented)
**Existing**: Kitchen requisitions exist
**Missing**:
- Stock issue to buffet
- Stock issue to catering
- Stock issue to bar (separate from kitchen)
- Issue approval workflow
- Issue tracking by shift

---

#### 9. **ACCOUNTANT DASHBOARD** (Not Implemented)
**Missing**:
- Shift P&L list view
- Shift P&L drill-down
- Variance review interface
- Approval workflow UI
- Multi-shift summary
- Food cost trend charts

---

#### 10. **BRANCH CONFIGURATION** (Not Implemented)
**Missing**:
- Variance threshold configuration
- Food cost alert threshold
- Allowed waste reason codes
- Auto-submit to accountant setting

---

## 📁 EXISTING FRONTEND STRUCTURE

### Relevant Pages Already Exist:

#### Kitchen Operations:
- `/dashboard/kitchen-operations/recipes` ✅
- `/dashboard/kitchen-operations/food-controls` ✅
- `/dashboard/kitchen-operations/requisitions` ✅
- `/dashboard/kitchen-operations/stock` ✅
- `/dashboard/kitchen-operations/usage` ✅
- `/dashboard/kitchen-operations/wastage` ✅

#### Branch Accounting:
- `/dashboard/branch-accounting/food-control` ✅ (exists but likely empty)
- `/dashboard/branch-accounting/shift-review` ✅ (exists but likely basic)
- `/dashboard/branch-accounting/financials` ✅

#### Auditor:
- `/dashboard/auditor/kitchen-requisitions` ✅
- `/dashboard/auditor/kitchen-usage` ✅
- `/dashboard/auditor/kitchen-wastage` ✅
- `/dashboard/auditor/shift-verification` ✅

#### Branch Store:
- `/dashboard/branch-store/kitchen-requisitions` ✅
- `/dashboard/branch-store/kitchen-usage` ✅
- `/dashboard/branch-store/stock-out` ✅

---

## 🚀 IMPLEMENTATION STRATEGY

### Phase 1: Foundation (Backend) - 3-5 days
**Priority**: Critical
**Dependencies**: None

#### Tasks:
1. **Database Migrations**:
   - Create `buffets` and `buffet_menu_items` tables
   - Create `catering_events`, `catering_menu_items`, `catering_stock_allocations` tables
   - Create `shift_financials` table
   - Create `food_control_variance` table
   - Add `cost_per_unit` to `inventory_items` (if missing)
   - Create `recipe_change_log` table
   - Add `is_locked`, `locked_by`, `locked_at` to `recipes` table

2. **TypeScript Types**:
   - Create `backend/src/types/foodControl.ts` with all interfaces
   - Add types for Buffet, Catering, ShiftPnL, Variance

3. **Core Services**:
   - Create `backend/src/services/foodControlService.ts`:
     - `calculatePOSTheoreticalUsage()`
     - `calculateBuffetTheoreticalUsage()`
     - `calculateCateringTheoreticalUsage()`
     - `getActualUsageByShift()`
     - `computeVariance()`
     - `getPortionOutputConversion()`
   
   - Create `backend/src/services/shiftPnLService.ts`:
     - `generateShiftPnL()`
     - `submitForAccountantReview()`
     - `accountantApprove()`
     - `auditorAction()`

4. **Shift Close Hook**:
   - Modify existing shift close logic to trigger:
     - Variance calculation for all streams
     - Shift P&L generation
     - Threshold checks
     - Auto-submit to accountant

---

### Phase 2: Buffet Module - 2-3 days
**Priority**: High
**Dependencies**: Phase 1

#### Tasks:
1. **Backend API**:
   - Create `backend/src/controllers/buffet.controller.ts`:
     - `createBuffet()`
     - `getBuffets()`
     - `getBuffet()`
     - `updateBuffet()`
     - `closeBuffet()` - triggers variance calculation
     - `addMenuItems()`
   
   - Create `backend/src/routes/buffet.routes.ts`
   - Register routes in main router

2. **Frontend Pages**:
   - Create `/dashboard/branch-accounting/buffet/page.tsx` - Buffet list
   - Create `/dashboard/branch-accounting/buffet/new/page.tsx` - Create buffet
   - Create `/dashboard/branch-accounting/buffet/[buffetId]/page.tsx` - Buffet detail + variance

3. **Components**:
   - `BuffetEventCard.tsx` - Buffet summary card
   - `GuestCountInput.tsx` - Actual guest count input at close
   - `BuffetMenuSelector.tsx` - Menu item selection with portion per guest

---

### Phase 3: Catering Module - 3-4 days
**Priority**: High
**Dependencies**: Phase 1

#### Tasks:
1. **Backend API**:
   - Create `backend/src/controllers/catering.controller.ts`:
     - `createEvent()`
     - `getEvents()`
     - `getEvent()`
     - `updateEvent()`
     - `allocateStock()` - storekeeper allocates ingredients
     - `recordActual()` - record actual guests + returns
     - `completeEvent()` - triggers P&L calculation
   
   - Create `backend/src/routes/catering.routes.ts`
   - Register routes in main router

2. **Frontend Pages**:
   - Create `/dashboard/branch-accounting/catering/page.tsx` - Events list
   - Create `/dashboard/branch-accounting/catering/new/page.tsx` - Create event (multi-step)
   - Create `/dashboard/branch-accounting/catering/[eventId]/page.tsx` - Event detail + P&L
   - Create `/dashboard/branch-accounting/catering/[eventId]/allocate/page.tsx` - Stock allocation
   - Create `/dashboard/branch-accounting/catering/[eventId]/close/page.tsx` - Record actuals

3. **Components**:
   - `CateringEventCard.tsx` - Event summary card
   - `StockAllocationForm.tsx` - Storekeeper stock allocation
   - `CateringMenuSelector.tsx` - Menu item selection with quantities
   - `CateringPnLCard.tsx` - Event P&L summary

---

### Phase 4: Variance & P&L Engine - 3-4 days
**Priority**: Critical
**Dependencies**: Phase 1, 2, 3

#### Tasks:
1. **Backend API**:
   - Create `backend/src/routes/foodControl.ts`:
     - `GET /api/v1/food-control/variance/shift/:shiftId` - Full variance report
     - `POST /api/v1/food-control/variance/:id/explain` - Explain variance
     - `POST /api/v1/food-control/variance/:id/flag` - Flag for audit
     - `GET /api/v1/food-control/variance/pending` - Unexplained variances
     - `GET /api/v1/food-control/portion-output/shift/:shiftId` - Portion output
   
   - Create `backend/src/routes/finance.routes.ts` (or extend existing):
     - `POST /api/v1/finance/shift-pnl/generate/:shiftId` - Generate P&L
     - `GET /api/v1/finance/shift-pnl/:shiftId` - Get P&L
     - `GET /api/v1/finance/shift-pnl` - List P&Ls
     - `POST /api/v1/finance/shift-pnl/:shiftId/submit` - Submit to accountant
     - `POST /api/v1/finance/shift-pnl/:shiftId/review` - Accountant review
     - `POST /api/v1/finance/shift-pnl/:shiftId/approve` - Auditor approve/flag
     - `GET /api/v1/finance/shift-pnl/summary/branch` - Multi-shift summary
     - `GET /api/v1/finance/shift-pnl/food-cost-trend` - Food cost % trend

2. **Shift Close Integration**:
   - Modify `backend/src/controllers/shifts.controller.ts` or create hook
   - Add `onShiftClose()` function that:
     - Computes variance for POS, Buffet, Catering
     - Generates shift P&L
     - Checks food cost % threshold
     - Checks unexplained variances
     - Auto-submits to accountant (if configured)

3. **Notification Integration**:
   - High food cost alert → accountant
   - Unexplained variance → manager + chef
   - Shift P&L ready → accountant
   - P&L flagged → manager + admin

---

### Phase 5: Accountant Dashboard - 3-4 days
**Priority**: High
**Dependencies**: Phase 4

#### Tasks:
1. **Frontend Pages**:
   - Enhance `/dashboard/branch-accounting/shift-review/page.tsx`:
     - Shift P&L list with filters (date range, status)
     - Summary cards (revenue, COGS, profit, food cost %)
     - Status badges (draft, pending, reviewed, approved, flagged)
   
   - Create `/dashboard/branch-accounting/shift-review/[shiftId]/page.tsx`:
     - Tabbed drill-down:
       - Overview (revenue by stream, COGS comparison, profit)
       - POS Analysis (top items, variance table)
       - Buffet Analysis (guests, wastage %)
       - Catering Analysis (events, profit margin)
       - Variance Detail (full variance table with filters)
       - Staff Accountability (chef, storekeeper, cashier)
     - Bottom actions: Review & Approve, Flag for Auditor, Export PDF

2. **Components**:
   - `ShiftPnLCard.tsx` - Compact P&L summary card
   - `PnLDrillDown.tsx` - Tabbed drill-down component
   - `VarianceTable.tsx` - Color-coded variance table with explain action
   - `PortionOutputCard.tsx` - Issued stock → portions → gap

3. **Charts**:
   - Revenue by stream (bar chart)
   - Theoretical vs Actual COGS (grouped bar)
   - Gross Profit Expected vs Actual (comparison)
   - Food cost % trend (line chart)

---

### Phase 6: Recipe Management Enhancement - 2 days
**Priority**: Medium
**Dependencies**: Phase 1

#### Tasks:
1. **Backend API**:
   - Enhance `backend/src/controllers/kitchen/recipes.controller.ts`:
     - `POST /api/v1/kitchen/recipes/:id/lock` - Lock recipe (manager only)
     - `POST /api/v1/kitchen/recipes/:id/unlock` - Unlock recipe (manager only)
   
   - Add middleware to check recipe lock before updates
   - Log all recipe changes to `recipe_change_log`

2. **Frontend**:
   - Enhance `/dashboard/kitchen-operations/recipes/page.tsx`:
     - Show lock status icon
     - Lock/unlock button (manager only)
     - Recipe change history modal

---

### Phase 7: Stock Issue Workflow - 2 days
**Priority**: Medium
**Dependencies**: Phase 1

#### Tasks:
1. **Backend API**:
   - Enhance `backend/src/controllers/storekeeping/stock-requests.controller.ts`:
     - Add `issued_to` field (kitchen, buffet, catering, bar)
     - Add `reference_type` and `reference_id` fields
     - Link stock issues to shifts

2. **Frontend**:
   - Enhance `/dashboard/branch-store/stock-out/page.tsx`:
     - Add "Issue To" dropdown (Kitchen, Buffet, Catering, Bar)
     - Add "Reference" field (Buffet ID, Event ID, etc.)
     - Show shift information

---

### Phase 8: Reports & Analytics - 2-3 days
**Priority**: Medium
**Dependencies**: Phase 4, 5

#### Tasks:
1. **Backend API**:
   - Create `backend/src/controllers/reports/foodControl.controller.ts`:
     - `GET /api/v1/reports/food-cost/daily` - Daily food cost report
     - `GET /api/v1/reports/variance/shift/:shiftId` - Shift variance report
     - `GET /api/v1/reports/consumption` - Item consumption report
     - `GET /api/v1/reports/chef-performance` - Chef performance report
     - `GET /api/v1/reports/waste` - Waste tracking report
     - `GET /api/v1/reports/catering/:eventId/pnl` - Catering event P&L
     - `GET /api/v1/reports/buffet-efficiency` - Buffet efficiency report
     - `GET /api/v1/reports/food-cost-trend` - Food cost % trend
     - `GET /api/v1/reports/branch-comparison` - Multi-branch comparison (admin only)
   
   - All reports support PDF export, date range filtering, CSV export

2. **Frontend**:
   - Create `/dashboard/branch-accounting/reports/food-control/page.tsx` - Report selector
   - Create report viewer components with export buttons

---

### Phase 9: Branch Configuration - 1 day
**Priority**: Low
**Dependencies**: None

#### Tasks:
1. **Backend**:
   - Add `branch_food_control_config` table or extend `branches` table with:
     - `variance_threshold_kes` (e.g., 200)
     - `variance_threshold_percent` (e.g., 10%)
     - `food_cost_alert_threshold` (e.g., 35%)
     - `allowed_waste_reason_codes` (JSON array)
     - `require_manager_approval_for_theft` (boolean)
     - `auto_submit_to_accountant_on_close` (boolean)

2. **Frontend**:
   - Create `/dashboard/admin/settings/food-control/page.tsx` - Configuration UI

---

### Phase 10: Testing & Refinement - 2-3 days
**Priority**: Critical
**Dependencies**: All phases

#### Tasks:
1. **Unit Tests**:
   - Test variance calculation logic
   - Test P&L generation logic
   - Test theoretical usage calculations

2. **Integration Tests**:
   - Test shift close workflow
   - Test buffet creation → close → variance
   - Test catering event → allocation → close → P&L
   - Test POS sale → auto-deduct → variance

3. **E2E Tests**:
   - Test accountant workflow (review → approve)
   - Test auditor workflow (approve → flag)
   - Test manager workflow (explain variance)

4. **Performance Testing**:
   - Test shift close with large datasets
   - Test variance calculation performance
   - Test P&L generation performance

5. **User Acceptance Testing**:
   - Test with real users (accountant, auditor, manager, chef, storekeeper)
   - Gather feedback and refine UI/UX

---

## 🔐 RBAC MATRIX

| Action | Cashier | Chef | Storekeeper | Accountant | Auditor | Manager | Admin |
|--------|---------|------|-------------|------------|---------|---------|-------|
| View recipes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit recipes | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Lock/unlock recipe | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Issue stock | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Explain variance | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Log waste | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Create buffet | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Close buffet | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Create catering event | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Allocate catering stock | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| View shift P&L | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Review P&L (approve) | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Final approve / flag | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| View all branch reports | ❌ | ❌ | ❌ | ✅ (own branch) | ✅ | ✅ | ✅ |

---

## 📊 ESTIMATED TIMELINE

| Phase | Duration | Dependencies | Priority |
|-------|----------|--------------|----------|
| Phase 1: Foundation | 3-5 days | None | Critical |
| Phase 2: Buffet Module | 2-3 days | Phase 1 | High |
| Phase 3: Catering Module | 3-4 days | Phase 1 | High |
| Phase 4: Variance & P&L Engine | 3-4 days | Phase 1, 2, 3 | Critical |
| Phase 5: Accountant Dashboard | 3-4 days | Phase 4 | High |
| Phase 6: Recipe Management | 2 days | Phase 1 | Medium |
| Phase 7: Stock Issue Workflow | 2 days | Phase 1 | Medium |
| Phase 8: Reports & Analytics | 2-3 days | Phase 4, 5 | Medium |
| Phase 9: Branch Configuration | 1 day | None | Low |
| Phase 10: Testing & Refinement | 2-3 days | All phases | Critical |

**Total Estimated Time**: 23-33 days (4-7 weeks)

---

## 🎯 CRITICAL SUCCESS FACTORS

1. **Leverage Existing Infrastructure**:
   - Kitchen stock ledger system is already in place
   - Recipe auto-deduction from POS is already working
   - Shift management exists
   - Branch isolation is enforced

2. **Minimal Breaking Changes**:
   - Don't modify existing tables (extend via new tables)
   - Don't change existing POS flow
   - Don't alter inventory deduction logic

3. **Phased Rollout**:
   - Start with POS variance (already partially working)
   - Add Buffet module
   - Add Catering module
   - Finally integrate all into Shift P&L

4. **User Training**:
   - Accountants need training on P&L review workflow
   - Auditors need training on approval workflow
   - Managers need training on variance explanation
   - Chefs need training on buffet/catering workflows

5. **Data Migration**:
   - Backfill `cost_per_unit` for existing inventory items
   - Create opening balances for kitchen stock
   - Migrate existing recipes if needed

---

## 🚨 RISKS & MITIGATION

### Risk 1: Performance Issues with Variance Calculation
**Mitigation**:
- Use database indexes on `kitchen_stock_ledger` (branch_id, item_sku, transaction_date)
- Cache theoretical usage calculations
- Run variance calculation asynchronously at shift close
- Implement pagination for large datasets

### Risk 2: Data Inconsistency Between Modules
**Mitigation**:
- Use database transactions for all multi-table operations
- Implement data validation at API level
- Add database constraints (foreign keys, check constraints)
- Regular data integrity checks

### Risk 3: User Adoption Resistance
**Mitigation**:
- Involve users in design phase
- Provide comprehensive training
- Create user guides and videos
- Implement gradual rollout (one branch at a time)

### Risk 4: Recipe Cost Accuracy
**Mitigation**:
- Implement recipe locking to prevent unauthorized changes
- Require manager approval for recipe changes
- Maintain recipe change audit trail
- Regular recipe cost reviews

### Risk 5: Shift Close Blocking Due to Unexplained Variances
**Mitigation**:
- Implement variance threshold configuration
- Allow manager override with justification
- Provide clear variance explanation workflow
- Send notifications to relevant staff

---

## 📝 NEXT STEPS

1. **Review & Approval**:
   - Review this analysis with stakeholders
   - Get approval for implementation plan
   - Prioritize phases based on business needs

2. **Team Assignment**:
   - Assign backend developers to Phase 1
   - Assign frontend developers to UI design
   - Assign QA team to test planning

3. **Environment Setup**:
   - Create development database
   - Set up test data
   - Configure CI/CD pipeline

4. **Kickoff Phase 1**:
   - Create database migrations
   - Implement core services
   - Set up TypeScript types
   - Integrate shift close hook

---

## 📚 REFERENCES

- Existing Kitchen Management Migration: `backend/src/database/migrations/20260126_kitchen_management_clean.sql`
- Recipe Controller: `backend/src/controllers/kitchen/recipes.controller.ts`
- Food Control Controller: `backend/src/controllers/kitchen/food-control.controller.ts`
- Cashier Controller: `backend/src/controllers/cashier.controller.ts`
- Shifts Controller: `backend/src/controllers/shifts.controller.ts`
- Storekeeping Controllers: `backend/src/controllers/storekeeping/`
- Frontend Kitchen Operations: `frontend/src/app/dashboard/kitchen-operations/`
- Frontend Branch Accounting: `frontend/src/app/dashboard/branch-accounting/`

---

**Document Version**: 1.0  
**Last Updated**: 2026-04-25  
**Author**: AI Development Assistant  
**Status**: Ready for Review
