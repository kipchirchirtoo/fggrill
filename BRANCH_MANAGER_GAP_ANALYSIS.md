# 🏨 Branch Manager Module - Gap Analysis & Implementation Plan

## Executive Summary
**Current State:** 24 pages exist  
**Required State:** 11 core feature modules  
**Gap:** 7 missing/incomplete modules  
**Status:** ~40% complete

---

## 📊 Existing Pages (What We Have)

### ✅ Fully Implemented
1. **Overview Dashboard** (`/branch-manager/page.tsx`)
   - Stats cards (occupancy, staff, tasks, arrivals, departures)
   - Quick access links
   - Recent bookings table
   - Alerts/notifications panel

2. **Front Desk Operations**
   - ✅ Reservations (`/reservations`)
   - ✅ Check-in (`/checkin`)
   - ✅ Arrivals (`/arrivals`)
   - ✅ Departures (`/departures`)
   - ✅ Guests (`/guests`)

3. **Operations**
   - ✅ Rooms (`/rooms`)
   - ✅ Housekeeping (`/housekeeping`)
   - ✅ Maintenance (`/maintenance`)
   - ✅ Restaurant (`/restaurant`)

4. **Staff Management**
   - ✅ Staff List (`/staff`)
   - ✅ Attendance (`/attendance`)
   - ✅ Leave Management (`/leave`)

5. **Inventory**
   - ✅ Stock (`/stock`)
   - ✅ Stock Out (`/stock-out`)
   - ✅ Wastage Reports (`/wastage`)

6. **Food & Beverage**
   - ✅ Menu Management (`/menu`)
   - ✅ Bar Menu (`/bar-menu`)

7. **Analytics**
   - ✅ Branch Sales (`/analytics`)
   - ✅ Sold Items (`/sold-items`)
   - ✅ Reports (`/reports`)

---

## ❌ Missing/Incomplete Modules (The Gap)

### 1. **Stock & Inventory Dashboard** ❌ MISSING
**Required Features:**
- Real-time stock levels by category
- Low-stock alerts with visual indicators
- Consumption trends (daily/weekly/monthly)
- Stock movement history
- Reorder suggestions based on consumption

**Current State:** Basic stock list exists but lacks:
- Category-based grouping
- Consumption analytics
- Trend visualization
- Automated alerts

**Action:** Enhance `/stock` page with analytics dashboard

---

### 2. **Staff Performance Module** ❌ MISSING
**Required Features:**
- Per-staff KPIs dashboard
- Productivity scores
- Shift coverage analytics
- Attendance rate per staff member
- Performance leaderboard
- Individual staff performance cards

**Current State:** Staff list exists but no performance metrics

**Action:** Create `/staff/performance` page

---

### 3. **Waiter Sales Analytics** ❌ MISSING
**Required Features:**
- Per-waiter order volume
- Revenue contribution by waiter
- Average order value per waiter
- Tips tracking
- Performance comparison
- Time-based analysis (shift performance)

**Current State:** Restaurant page exists but no waiter-specific analytics

**Action:** Create `/restaurant/waiter-sales` page

---

### 4. **Cashier Clearance Module** ❌ MISSING
**Required Features:**
- Daily clearance status per cashier
- Cash vs. system discrepancies flagged
- Approval workflow for clearances
- Shift-by-shift breakdown
- Payment method reconciliation
- Variance reports

**Current State:** No cashier clearance functionality

**Action:** Create `/cashier-clearance` page

---

### 5. **Revenue Oversight Dashboard** ⚠️ INCOMPLETE
**Required Features:**
- Branch revenue summary
- Target vs. actual comparison
- Revenue by category (rooms, F&B, services)
- Daily/weekly/monthly trends
- Revenue forecasting
- Comparison with other branches

**Current State:** Basic analytics exist but lack:
- Target tracking
- Category breakdown
- Forecasting

**Action:** Enhance `/analytics` page

---

### 6. **Staff Audit Trail** ❌ MISSING
**Required Features:**
- Action logs per staff member
- Role-based audit trail
- Critical action tracking (deletions, voids, discounts)
- Time-stamped activity log
- Filter by staff, action type, date range
- Export functionality

**Current State:** No audit trail functionality

**Action:** Create `/staff/audit` page

---

### 7. **Profit & Loss Statement** ❌ MISSING
**Required Features:**
- Income vs. expenses summary
- Gross margin calculation
- Net margin calculation
- Period-over-period comparison
- Category-wise P&L
- Visual charts (income/expense breakdown)
- Export to PDF/Excel

**Current State:** No P&L functionality

**Action:** Create `/reports/profit-loss` page

---

## 🎯 Implementation Priority

### Phase 1: Critical (Week 1)
1. **Cashier Clearance Module** - High business impact
2. **Staff Performance Module** - Core management need
3. **Revenue Oversight Enhancement** - Decision-making critical

### Phase 2: Important (Week 2)
4. **Waiter Sales Analytics** - Performance tracking
5. **Stock & Inventory Dashboard** - Operational efficiency
6. **Staff Audit Trail** - Compliance & security

### Phase 3: Strategic (Week 3)
7. **Profit & Loss Statement** - Financial reporting

---

## 🛠️ Technical Implementation Plan

### Backend API Requirements

#### New Endpoints Needed:
```typescript
// Staff Performance
GET /api/staff/performance?branch_id={id}&period={period}
GET /api/staff/{id}/kpis

// Waiter Sales
GET /api/restaurant/waiter-sales?branch_id={id}&date={date}
GET /api/restaurant/waiter/{id}/performance

// Cashier Clearance
GET /api/cashier/clearances?branch_id={id}&date={date}
POST /api/cashier/clearances/{id}/approve
GET /api/cashier/{id}/shift-summary

// Revenue Oversight
GET /api/finance/revenue-overview?branch_id={id}&period={period}
GET /api/finance/targets?branch_id={id}

// Staff Audit
GET /api/audit/staff-actions?staff_id={id}&from={date}&to={date}
GET /api/audit/critical-actions?branch_id={id}

// P&L
GET /api/finance/profit-loss?branch_id={id}&from={date}&to={date}
GET /api/finance/expense-breakdown?branch_id={id}&period={period}
```

### Frontend Components Needed:
1. **PerformanceCard** - Staff KPI display
2. **WaiterSalesTable** - Waiter performance table
3. **CashierClearanceCard** - Clearance status card
4. **RevenueChart** - Revenue visualization
5. **AuditLogTable** - Action log display
6. **PLStatement** - P&L report component

### Navigation Updates:
```typescript
// Add to consolidated-nav.tsx under Branch Manager section
<NavGroup label="Analytics & Reports" icon={BarChart3}>
  <NavItem href="/dashboard/branch-manager/staff/performance" label="Staff Performance" />
  <NavItem href="/dashboard/branch-manager/restaurant/waiter-sales" label="Waiter Sales" />
  <NavItem href="/dashboard/branch-manager/cashier-clearance" label="Cashier Clearance" />
  <NavItem href="/dashboard/branch-manager/revenue-oversight" label="Revenue Oversight" />
  <NavItem href="/dashboard/branch-manager/staff/audit" label="Staff Audit" />
  <NavItem href="/dashboard/branch-manager/reports/profit-loss" label="Profit & Loss" />
</NavGroup>
```

---

## 📋 Detailed Feature Specifications

### 1. Cashier Clearance Module
**Page:** `/dashboard/branch-manager/cashier-clearance`

**UI Components:**
- Date selector (default: today)
- Cashier filter dropdown
- Clearance status cards (pending, approved, discrepancies)
- Detailed clearance table with:
  - Cashier name
  - Shift time
  - Expected cash
  - Actual cash
  - Variance
  - Status
  - Actions (approve/flag)

**API Integration:**
- `GET /api/cashier/clearances` - Fetch clearances
- `POST /api/cashier/clearances/{id}/approve` - Approve clearance
- `POST /api/cashier/clearances/{id}/flag` - Flag discrepancy

---

### 2. Staff Performance Module
**Page:** `/dashboard/branch-manager/staff/performance`

**UI Components:**
- Performance leaderboard
- Individual staff cards with:
  - Attendance rate
  - Punctuality score
  - Task completion rate
  - Customer ratings (if available)
  - Revenue contribution
- Filter by department/role
- Date range selector
- Export functionality

**API Integration:**
- `GET /api/staff/performance` - Fetch performance data
- `GET /api/staff/{id}/kpis` - Individual KPIs

---

### 3. Waiter Sales Analytics
**Page:** `/dashboard/branch-manager/restaurant/waiter-sales`

**UI Components:**
- Waiter performance table
- Revenue contribution chart
- Average order value comparison
- Top performers highlight
- Shift-wise breakdown
- Date range selector

**API Integration:**
- `GET /api/restaurant/waiter-sales` - Fetch waiter sales
- `GET /api/restaurant/waiter/{id}/performance` - Individual performance

---

### 4. Revenue Oversight Dashboard
**Page:** `/dashboard/branch-manager/revenue-oversight` (or enhance `/analytics`)

**UI Components:**
- Revenue summary cards (total, target, variance)
- Revenue by category chart
- Daily trend line chart
- Target progress bar
- Period comparison table
- Branch comparison (if multi-branch)

**API Integration:**
- `GET /api/finance/revenue-overview` - Revenue data
- `GET /api/finance/targets` - Target data

---

### 5. Staff Audit Trail
**Page:** `/dashboard/branch-manager/staff/audit`

**UI Components:**
- Audit log table with:
  - Timestamp
  - Staff name
  - Action type
  - Details
  - IP address (if available)
- Filter by staff, action type, date range
- Search functionality
- Export to CSV

**API Integration:**
- `GET /api/audit/staff-actions` - Fetch audit logs
- `GET /api/audit/critical-actions` - Critical actions only

---

### 6. Profit & Loss Statement
**Page:** `/dashboard/branch-manager/reports/profit-loss`

**UI Components:**
- P&L summary cards (revenue, expenses, profit)
- Income breakdown chart
- Expense breakdown chart
- Period comparison table
- Margin calculations
- Export to PDF/Excel

**API Integration:**
- `GET /api/finance/profit-loss` - P&L data
- `GET /api/finance/expense-breakdown` - Expense details

---

### 7. Stock & Inventory Dashboard Enhancement
**Page:** `/dashboard/branch-manager/stock` (enhance existing)

**Add:**
- Category-based grouping
- Consumption trend charts
- Low-stock alerts section
- Reorder suggestions
- Stock movement timeline

**API Integration:**
- `GET /api/store/consumption-trends` - Consumption data
- `GET /api/store/reorder-suggestions` - Reorder alerts

---

## 🔐 Security & Permissions

All pages must:
- Be protected with `ProtectedRoute` component
- Allow only `UserRole.BRANCH_MANAGER`, `UserRole.GENERAL_MANAGER`, `UserRole.SUPER_ADMIN`
- Respect branch isolation (only show data for active branch)
- Log all critical actions

---

## 📊 Success Metrics

1. **Module Completion:** 11/11 modules implemented
2. **Feature Coverage:** 100% of required features
3. **API Integration:** All endpoints connected
4. **Navigation:** All pages accessible from sidebar
5. **Role Protection:** All pages properly guarded
6. **Branch Isolation:** All queries scoped to active branch

---

## 🚀 Next Steps

1. **Review & Approve** this gap analysis
2. **Backend API Development** - Create missing endpoints
3. **Frontend Implementation** - Build missing pages
4. **Testing** - Verify all features work
5. **Documentation** - Update user guides

---

**Prepared by:** Kiro AI  
**Date:** 2026-04-18  
**Status:** Ready for Implementation
