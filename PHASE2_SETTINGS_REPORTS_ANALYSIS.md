# Phase 2: Settings Screen + Reports Analysis

## Executive Summary

This document analyzes the current state of settings screens and reports across the FamousGate Hotels Management System, identifying gaps and providing recommendations for completion.

---

## 1. Current Settings Screens

### 1.1 User Settings (`/dashboard/settings`)
**Location:** `frontend/src/app/dashboard/settings/page.tsx`

**Features:**
- Dark mode toggle
- Push notifications (browser permission)
- Desktop notifications
- Notification sounds
- Notification categories (inventory, finance, housekeeping, bookings, staff, system)
- Language selection (English, Swahili)
- Password change modal
- Settings saved to localStorage

**Roles:** All authenticated users

**Status:** ✅ Complete

---

### 1.2 Admin Settings (`/dashboard/admin/settings`)
**Location:** `frontend/src/app/dashboard/admin/settings/page.tsx`

**Features:**
- Hotel name
- Email
- Phone
- Website
- Currency (KES, USD)
- Timezone (Africa/Nairobi, UTC)

**Roles:** SUPER_ADMIN only

**Status:** ✅ Complete but basic

**Gaps:**
- No backend integration (save is mocked)
- No additional system configuration options
- No branding/logo upload
- No email/SMS provider configuration
- No payment gateway settings

---

### 1.3 Food Control Settings (`/dashboard/admin/settings/food-control`)
**Location:** `frontend/src/app/dashboard/admin/settings/food-control/page.tsx`

**Features:**
- Branch selector
- Variance threshold (KES)
- Variance threshold (percent)
- Food cost alert threshold
- Allowed waste reason codes
- Manager approval for theft toggle
- Auto-submit to accountant toggle

**Roles:** SUPER_ADMIN (via ProtectedRoute)

**Status:** ✅ Complete with backend integration

**Backend:** Uses `/api/branch-food-control-config/{branchId}`

---

## 2. Missing Settings Screens by Role

### 2.1 Branch Manager Settings
**Current:** None

**Recommended Settings:**
- Branch-specific notification preferences
- Branch working hours
- Branch contact information
- Room type pricing overrides
- Approval limits for staff

**Priority:** Medium

---

### 2.2 General Manager Settings
**Current:** None

**Recommended Settings:**
- Multi-branch view preferences
- Report scheduling defaults
- KPI threshold alerts
- Executive dashboard configuration

**Priority:** Medium

---

### 2.3 HR Manager Settings
**Current:** None

**Recommended Settings:**
- Payroll configuration
- Leave policy settings
- Shift scheduling rules
- Attendance tracking settings
- Statutory deduction rates (KRA, NSSF, SHIF, Housing Levy)

**Priority:** High

---

### 2.4 Auditor Settings
**Current:** None

**Recommended Settings:**
- Audit frequency settings
- Exception severity thresholds
- Compliance score weights
- Report distribution preferences

**Priority:** Medium

---

### 2.5 Branch Store Settings
**Current:** None

**Recommended Settings:**
- Low stock alert thresholds
- Reorder point configuration
- Supplier preferences
- Stock take frequency

**Priority:** High

---

### 2.6 Central Store Settings
**Current:** None

**Recommended Settings:**
- Multi-branch stock allocation rules
- Purchase order approval limits
- Supplier management settings
- Dispatch scheduling

**Priority:** High

---

### 2.7 Housekeeping Settings
**Current:** None

**Recommended Settings:**
- Room cleaning standards
- Inspection checklists
- Staff performance metrics
- Linen replacement schedules

**Priority:** Medium

---

### 2.8 Maintenance Settings
**Current:** None

**Recommended Settings:**
- Preventive maintenance schedules
- Work order priority rules
- Vendor contact information
- Equipment tracking settings

**Priority:** Medium

---

### 2.9 Restaurant Settings
**Current:** None

**Recommended Settings:**
- Table configuration
- Service time targets
- Menu item availability
- Reservation rules

**Priority:** Medium

---

### 2.10 Bar Settings
**Current:** None

**Recommended Settings:**
- Pouring standards
- Happy hour configuration
- Stock alert thresholds
- Tab limits

**Priority:** Medium

---

### 2.11 Kitchen Settings
**Current:** None

**Recommended Settings:**
- Recipe management
- Food cost targets
- Preparation time standards
- Wastage tracking rules

**Priority:** High

---

### 2.12 Facilities Manager Settings
**Current:** None

**Recommended Settings:**
- Facility booking rules
- Equipment maintenance schedules
- Space allocation settings

**Priority:** Low

---

### 2.13 Branch Operations Settings
**Current:** None

**Recommended Settings:**
- Operational KPI targets
- Shift scheduling
- Staff assignment rules

**Priority:** Medium

---

### 2.14 Director Settings
**Current:** None

**Recommended Settings:**
- Strategic KPI configuration
- Board report templates
- High-level alert thresholds

**Priority:** Low

---

## 3. Current Reports Pages

### 3.1 Advanced Analytics (`/dashboard/reports/analytics`)
**Location:** `frontend/src/app/dashboard/reports/analytics/page.tsx`

**Features:**
- KPI cards (Total Revenue, Occupancy Rate, ADR, RevPAR)
- Occupancy forecast chart (AI-predicted vs actual)
- Revenue by channel pie chart
- Monthly revenue breakdown bar chart
- ADR & RevPAR trend line chart
- Room type performance table
- AI-powered insights section
- Date range selector (7d, 30d, 90d, YTD)
- PDF export

**Status:** ✅ Complete (frontend-only with sample data)

**Backend Integration:** Partial (uses `reportsAPI.exportReport`)

**Gaps:**
- Sample data only, not connected to real backend
- No real AI predictions
- Export functionality may not work without backend

---

### 3.2 Revenue Analytics (`/dashboard/reports/revenue`)
**Location:** `frontend/src/app/dashboard/reports/revenue/page.tsx`

**Features:**
- Summary cards (Total Revenue, Paid Revenue, Outstanding, ADR)
- Revenue trend bar chart
- Date range selector (7d, 30d, 90d)
- Excel export

**Status:** ✅ Complete with backend integration

**Backend:** Uses `reportAPI.getRevenueReport` and `reportAPI.exportReport`

**Roles:** SUPER_ADMIN, GENERAL_MANAGER

---

### 3.3 GM Reports (`/dashboard/gm/reports`)
**Location:** `frontend/src/app/dashboard/gm/reports/page.tsx`

**Features:**
- Uses ReportsPageComponent
- Branch selector enabled
- Scheduling enabled
- KPI dashboard enabled

**Status:** ✅ Complete

**Roles:** GENERAL_MANAGER, SUPER_ADMIN

---

### 3.4 Auditor Reports (`/dashboard/auditor/audit-reports`)
**Location:** `frontend/src/app/dashboard/auditor/audit-reports/page.tsx`

**Features:**
- Multi-branch selector
- Date range filter
- 9 report types:
  - Exception Summary
  - SOP Compliance Audit
  - Voided Transaction Analysis
  - Revenue Reconciliation
  - Leakage Analysis
  - Expenditure Audit
  - Stock Variance Report
  - Consumption Analytics
  - GRN Audit
- Excel export

**Status:** ✅ Complete with backend integration

**Backend:** Uses `auditorReportsAPI.exportAuditorReport`

**Roles:** AUDITOR, SUPER_ADMIN

---

### 3.5 Branch Manager Reports (`/dashboard/branch-manager/reports`)
**Location:** `frontend/src/app/dashboard/branch-manager/reports/page.tsx`

**Features:**
- Uses ReportsPageComponent
- Branch locked to active branch
- Branch selector disabled
- Scheduling enabled
- KPI dashboard enabled

**Status:** ✅ Complete

**Roles:** GENERAL_MANAGER, SUPER_ADMIN, AUDITOR

---

### 3.6 Branch Store Reports (`/dashboard/branch-store/reports`)
**Location:** `frontend/src/app/dashboard/branch-store/reports/page.tsx`

**Features:**
- Uses ReportsPageComponent
- Branch locked to user's branch
- Branch selector disabled
- Scheduling enabled
- KPI dashboard disabled

**Status:** ✅ Complete

**Roles:** BRANCH_STOREKEEPER, BRANCH_MANAGER, SUPER_ADMIN, GENERAL_MANAGER, AUDITOR

---

### 3.7 Housekeeping Reports (`/dashboard/housekeeping/reports`)
**Location:** `frontend/src/app/dashboard/housekeeping/reports/page.tsx`

**Features:**
- Date range selector (Today, This Week, This Month)
- Summary cards (Rooms Cleaned, Avg Time, Pass Rate, Failed Inspections)
- Staff performance table
- Daily cleaning trend chart (placeholder)
- Inspection results chart (placeholder)
- PDF/Excel export (mocked)

**Status:** ⚠️ Partial

**Backend:** Uses `housekeepingAPI.getDailyReport`, `getStaffPerformanceReport`, `getInspectionStats`

**Gaps:**
- Charts are placeholders
- Export is mocked
- No visualizations

**Roles:** HOUSEKEEPING_SUPERVISOR, SUPER_ADMIN, GENERAL_MANAGER, BRANCH_MANAGER

---

## 4. ReportsPageComponent Analysis

**Location:** `frontend/src/components/reports/ReportsPageComponent.tsx`

**Supported Report Categories:**

### 4.1 Operations Reports
- Occupancy Report
- Housekeeping Performance
- Maintenance Log
- Arrivals & Departures
- Manager on Duty

### 4.2 Financial Reports
- Daily Sales Report
- Financial Summary
- Revenue Analysis
- Expense Report
- Payroll Summary

### 4.3 Food & Beverage Reports
- Restaurant Sales
- Bar Sales

### 4.4 Inventory Reports
- Inventory Status
- Room Supplies
- Stock Movement

**Features:**
- Report library with categorized reports
- Scheduled reports management
- Report history
- KPI dashboard
- Branch selector (when not locked)
- Date range filters
- PDF/Excel export
- Service status indicator

**Status:** ✅ Complete

**Backend Integration:**
- Uses `reportsService` which proxies to:
  - `/reports/templates` for scheduled reports
  - `reportsAPI.getReportHistory` for history
  - `auditorReportsAPI.exportBrandedPdf` for PDF export
  - `/reports/generate/{reportType}` for Excel export

---

## 5. Backend Reports Routes

### 5.1 General Reports (`/api/reports`)
**Location:** `backend/src/routes/report.routes.ts`

**Endpoints:**
- `POST /export` - Export report (public for testing)
- `POST /generate/async` - Generate async report
- `GET /jobs/:id/status` - Get report job status
- `GET /dashboard` - Dashboard report
- `GET /revenue` - Revenue report
- `GET /occupancy` - Occupancy report
- `GET /inventory` - Inventory report
- `GET /housekeeping` - Housekeeping report
- `GET /maintenance` - Maintenance report
- `GET /conference` - Conference report
- `GET /` - Get reports
- `POST /` - Create report
- `GET /:id` - Get report
- `PUT /:id` - Update report
- `DELETE /:id` - Delete report
- `POST /:id/generate` - Generate report
- `POST /:id/schedule` - Schedule report
- `POST /:id/send` - Send report
- `GET /:id/history` - Report history
- `GET /templates` - Get templates
- `POST /templates` - Create template
- `PUT /templates/:id` - Update template
- `DELETE /templates/:id` - Delete template
- `GET /stats/overview` - Report stats

**Roles:** SUPER_ADMIN, GENERAL_MANAGER, AUDITOR

**Status:** ✅ Complete

---

### 5.2 Auditor Reports (`/api/auditor-reports`)
**Location:** `backend/src/routes/auditor-reports.routes.ts`

**Endpoints:**
- `GET /export/exception_summary` - Exception summary
- `GET /export/compliance_audit` - Compliance audit
- `GET /export/void_analytics` - Void analytics
- `GET /export/revenue_reconciliation` - Revenue reconciliation
- `GET /export/leakage_report` - Leakage report
- `GET /export/expenditure_audit` - Expenditure audit
- `GET /export/variance_report` - Stock variance report
- `GET /export/consumption_audit` - Consumption analytics
- `GET /export/grn_audit` - GRN audit
- `GET /export/stock_movement` - Stock movement
- `GET /performance` - Branch performance (legacy)
- `GET /stock-usage` - Stock usage (legacy)
- `GET /employee-credit` - Employee credit (legacy)

**Roles:** AUDITOR, SUPER_ADMIN

**Status:** ✅ Complete

---

### 5.3 HR Reports (`/api/hr-reports`)
**Location:** `backend/src/routes/hr-reports.routes.ts`

**Endpoints:**
- `GET /kra-p10` - KRA P10 report
- `GET /nssf` - NSSF report
- `GET /shif` - SHIF report
- `GET /housing-levy` - Housing levy report

**Roles:** SUPER_ADMIN, GENERAL_MANAGER, HR_MANAGER

**Status:** ✅ Complete

---

## 6. Missing Report Types by Module

### 6.1 HR Reports
**Current:** Only statutory reports (KRA P10, NSSF, SHIF, Housing Levy)

**Missing:**
- Employee attendance report
- Leave balance report
- Overtime report
- Staff turnover report
- Training records report
- Performance review summary
- Department headcount report
- Salary structure report

**Priority:** High

---

### 6.2 Kitchen Reports
**Current:** None (except via ReportsPageComponent)

**Missing:**
- Recipe cost analysis
- Food cost percentage report
- Wastage by category
- Ingredient usage report
- Menu profitability analysis
- Kitchen performance metrics
- Production volume report

**Priority:** High

---

### 6.3 Bar Reports
**Current:** None (except via ReportsPageComponent)

**Missing:**
- Pour cost analysis
- Top-selling drinks
- Bar inventory variance
- Happy hour performance
- Tab aging report
- bartender performance

**Priority:** Medium

---

### 6.4 Restaurant Reports
**Current:** None (except via ReportsPageComponent)

**Missing:**
- Table turnover rate
- Server performance
- Menu item popularity
- Reservation adherence
- Average ticket size
- Peak hours analysis

**Priority:** Medium

---

### 6.5 Maintenance Reports
**Current:** None (except via ReportsPageComponent)

**Missing:**
- Work order aging
- Preventive maintenance compliance
- Vendor performance
- Equipment downtime
- Maintenance cost analysis
- Parts usage report

**Priority:** Medium

---

### 6.6 Housekeeping Reports
**Current:** Basic performance report

**Missing:**
- Room cleanliness scores
- Linen usage report
- Guest satisfaction scores
- Staff productivity analysis
- Lost & found report
- Amenity consumption report

**Priority:** Medium

---

### 6.7 Central Store Reports
**Current:** None

**Missing:**
- Inter-branch transfer report
- Supplier performance report
- Purchase order analysis
- Stock valuation report
- Lead time analysis
- Central stock status

**Priority:** High

---

### 6.8 Branch Store Reports
**Current:** Via ReportsPageComponent

**Missing:**
- Reorder recommendations
- Slow-moving stock report
- Expiry date tracking
- Stock take variance analysis
- Supplier comparison report

**Priority:** Medium

---

### 6.9 Finance Reports
**Current:** Via ReportsPageComponent

**Missing:**
- Cash flow statement
- Balance sheet
- Budget vs actual
- Aging receivables
- Bank reconciliation
- Petty cash report
- Credit bill aging
- Payment method analysis

**Priority:** High

---

### 6.10 Conference Reports
**Current:** Backend endpoint exists

**Missing:**
- Conference room utilization
- Booking cancellation rate
- Equipment usage report
- Catering revenue per event
- Client satisfaction report

**Priority:** Low

---

## 7. Backend Settings Routes

**Finding:** No dedicated settings routes found in backend.

**Recommendation:** Create settings controller and routes for:
- System configuration
- Branch-specific settings
- User preferences
- Module-specific settings (HR, Kitchen, Bar, etc.)

---

## 8. Recommendations

### 8.1 High Priority
1. **Create HR Manager Settings** - Payroll configuration, statutory rates, leave policies
2. **Create Branch Store Settings** - Stock thresholds, reorder points
3. **Create Central Store Settings** - Allocation rules, approval limits
4. **Create Kitchen Settings** - Recipe management, food cost targets
5. **Add HR Reports** - Attendance, leave, overtime, turnover
6. **Add Finance Reports** - Cash flow, balance sheet, budget vs actual
7. **Add Central Store Reports** - Transfers, supplier performance, stock valuation

### 8.2 Medium Priority
1. **Create Branch Manager Settings** - Branch preferences, approval limits
2. **Create General Manager Settings** - Multi-branch view, KPI alerts
3. **Create Auditor Settings** - Audit frequency, exception thresholds
4. **Create Housekeeping Settings** - Cleaning standards, inspection checklists
5. **Create Maintenance Settings** - PM schedules, work order rules
6. **Create Restaurant Settings** - Table config, service targets
7. **Create Bar Settings** - Pouring standards, stock alerts
8. **Add Kitchen Reports** - Recipe cost, wastage, menu profitability
9. **Add Bar Reports** - Pour cost, top-selling drinks
10. **Add Restaurant Reports** - Table turnover, server performance
11. **Add Maintenance Reports** - Work order aging, PM compliance
12. **Add Housekeeping Reports** - Cleanliness scores, linen usage

### 8.3 Low Priority
1. **Create Facilities Manager Settings** - Booking rules, equipment tracking
2. **Create Branch Operations Settings** - KPI targets, shift scheduling
3. **Create Director Settings** - Strategic KPI, board reports
4. **Add Conference Reports** - Room utilization, equipment usage

### 8.4 Backend Improvements
1. **Create Settings Controller** - Handle all settings CRUD operations
2. **Create Settings Routes** - `/api/settings/*` endpoints
3. **Create Settings Database Tables** - Store configuration data
4. **Implement Report Scheduling Service** - For automated report generation
5. **Connect Advanced Analytics to Real Data** - Replace sample data with live queries

---

## 9. Implementation Plan

### Phase 2.1: Settings Infrastructure (Week 1)
- Create settings database schema
- Create settings controller
- Create settings routes
- Implement settings API clients

### Phase 2.2: Core Settings Screens (Week 2)
- HR Manager Settings
- Branch Store Settings
- Central Store Settings
- Kitchen Settings

### Phase 2.3: Additional Settings Screens (Week 3)
- Branch Manager Settings
- General Manager Settings
- Auditor Settings
- Housekeeping Settings
- Maintenance Settings
- Restaurant Settings
- Bar Settings

### Phase 2.4: HR & Finance Reports (Week 4)
- HR Reports (attendance, leave, overtime, turnover)
- Finance Reports (cash flow, balance sheet, budget vs actual)
- Central Store Reports (transfers, supplier performance)

### Phase 2.5: F&B Reports (Week 5)
- Kitchen Reports (recipe cost, wastage, menu profitability)
- Bar Reports (pour cost, top-selling drinks)
- Restaurant Reports (table turnover, server performance)

### Phase 2.6: Operations Reports (Week 6)
- Maintenance Reports (work order aging, PM compliance)
- Housekeeping Reports (cleanliness scores, linen usage)
- Advanced Analytics (connect to real data)

---

## 10. Summary Statistics

**Settings Screens:**
- Current: 3 (User, Admin, Food Control)
- Missing: 14
- Completion: 18%

**Reports Pages:**
- Current: 7
- Missing: ~30 report types
- Completion: ~19%

**Backend Routes:**
- Reports: 3 route files (general, auditor, HR)
- Settings: 0 route files
- Completion: Reports 60%, Settings 0%

---

## 11. Conclusion

The system has a solid foundation for reports with the ReportsPageComponent providing a reusable framework. However, settings screens are severely lacking with only basic user and admin settings. 

The highest priority items are:
1. HR Manager Settings (critical for payroll operations)
2. Branch/Central Store Settings (critical for inventory management)
3. Kitchen Settings (critical for food cost control)
4. HR & Finance Reports (critical for business operations)
5. Central Store Reports (critical for multi-branch operations)

The backend needs a dedicated settings infrastructure to support the frontend settings screens.
