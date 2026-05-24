🎯 MISSION
Build Famous Gates — a production-grade, cross-platform Flutter application for FamousGate Hotels & Restaurants. The app must run natively on Windows PCs (front desk / cashier stations), Linux desktops (back-office), and Android tablets (waiters / floor staff), all from a single Flutter codebase.

This is a hospitality operations system — not a prototype. Every screen, every interaction, every API call must be production-ready, error-handled, and role-aware.

**⚠️ CRITICAL: DO NOT COMMIT AND PUSH CODE FIRST!! Build locally, test thoroughly, then commit when ready.**

---

## 🏗️ TECH STACK
Layer	Technology
Framework	Flutter 3.x (Dart)
State Management	Riverpod 2.x (with AsyncNotifier + StateNotifier)
Local Database	Drift (SQLite) — for offline hybrid mode
HTTP Client	Dio with interceptors (auth headers, retry, logging)
Navigation	GoRouter with role-scoped shell routes
Sync Engine	Custom background isolate sync service
Auth	JWT tokens stored in flutter_secure_storage
Printing	printing package + ESC/POS for thermal receipts
UI Components	Custom design system (no Material defaults — see UI section)
Platform Channels	Custom for Windows/Linux printer discovery

---

## 🌐 BACKEND INTEGRATION
The app connects to an existing production backend. Do NOT scaffold a new backend.

**Service	Base URL	Purpose**
- Main API	https://api.hirall.com	All business logic (REST/JSON)
- Python Microservices	https://services.hirall.com	Reports, analytics, heavy computation
- Auth	https://api.hirall.com/auth	JWT login, token refresh, license validation

### API Contract Rules
All requests MUST include Authorization: Bearer <jwt> header
All requests MUST include X-Branch-ID: <branch_id> header (branch scoping — critical for RLS)
Token refresh: hit /auth/refresh with refresh token before expiry
On 401 → clear secure storage → redirect to login
On 503/network error → switch to offline mode automatically

### Dio Interceptor Setup
// Required interceptors (implement all three):
// 1. AuthInterceptor — injects JWT + Branch-ID on every request
// 2. RetryInterceptor — retry up to 3x with exponential backoff on 5xx/network errors
// 3. OfflineInterceptor — on network failure, queue write operations to local Drift DB

---

## 👥 ROLES & ACCESS CONTROL (COMPLETE LIST)

The system has **80+ user roles**. Enforce RBAC at the router level — wrong-role users must never see unauthorized screens even by URL manipulation.

### Global Roles (Access All Branches)
- `super_admin` - Full system access
- `general_manager` - All branches management
- `director` - Executive oversight
- `auditor` - Cross-branch auditing
- `hr_manager` - HR across all branches
- `central_storekeeper` - Central inventory management
- `central_operations_manager` - Multi-branch operations
- `finance_manager` - Financial oversight
- `procurement` - Central procurement
- `purchasing_manager` - Purchase management

### Branch-Specific Roles (Access Assigned Branch Only)
- `branch_manager` - Branch management
- `receptionist` / `branch_receptionist` - Front desk operations
- `cashier` - POS/Cashier operations
- `bartender` / `bar_manager` / `barman` / `barmaid` - Bar operations
- `waiter` / `waitress` / `head_waiter` - Restaurant service
- `restaurant_manager` - Restaurant management
- `kitchen` / `head_chef` / `sous_chef` / `chef` / `cook` / `line_cook` / `prep_cook` / `kitchen_operations` / `kitchen_helper` / `dishwasher` - Kitchen operations
- `housekeeping` / `housekeeping_supervisor` / `room_attendant` / `laundry_attendant` - Housekeeping
- `maintenance` / `maintenance_supervisor` / `electrician` / `plumber` / `hvac_technician` / `groundskeeper` - Maintenance
- `branch_storekeeper` / `storekeeper` / `inventory_clerk` - Branch inventory
- `branch_accountant` / `accountant` - Branch accounting
- `front_desk_supervisor` - Front desk supervision
- `concierge` / `bell_captain` / `bellhop` - Guest services
- `security_supervisor` / `security_guard` - Security
- `night_auditor` - Night audit
- `payroll_clerk` - Payroll processing
- `pos_kitchen` - Kitchen POS
- `food_runner` / `busser` / `host_hostess` / `barista` - Restaurant support
- `driver` - Transportation
- `employee` - General employee access
- `guest` - Guest portal access

### Specialized Cashier Roles
- `kyogong_spa_cashier` - Spa cashier
- `kyogong_executive_bar_cashier` - Executive bar cashier
- `kyogong_sports_bar_cashier` - Sports bar cashier
- `kyogong_reception_cashier` - Reception cashier

---

## 📦 MODULES TO BUILD (COMPLETE DASHBOARD SYSTEM)

### MODULE 1: AUTH & LICENSE (Priority: Critical)
Screens: Splash → License Validation → Login → Role Router

**API Endpoints:**
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/license/validate` - Validate license
- `POST /api/auth/refresh` - Refresh token

**Features:**
- Splash Screen with Famous Gates logo (fade-in animation)
- License validation on first launch
- JWT storage in flutter_secure_storage
- Role-based routing after login
- Auto-lock after 10 minutes inactivity
- Biometric auth support (fingerprint on Android)

---

### MODULE 2: SUPERADMIN DASHBOARD (Priority: High)
**API Endpoints:**
- `GET /api/admin/dashboard` - Admin dashboard stats
- `GET /api/admin/users` - List all users
- `POST /api/admin/users` - Create user
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/branches` - List all branches
- `POST /api/admin/branches` - Create branch
- `PUT /api/admin/branches/:id` - Update branch
- `GET /api/admin-ai/analytics` - AI-powered analytics
- `GET /api/admin-ai/forecast` - Generate forecasts
- `GET /api/admin-logs/overview` - Logs overview
- `GET /api/admin-logs/` - Unified logs
- `GET /api/admin-logs/system` - System logs

**Features:**
- Today's revenue (KES) — big card, prominent
- Active orders count
- Rooms occupied / available
- Top 5 selling items today (bar chart using fl_chart)
- Recent transactions list (last 10)
- Alerts: low stock items, pending sync items, expiring licenses
- User management (CRUD)
- Branch management (CRUD)
- System logs viewer
- AI analytics dashboard
- License management

---

### MODULE 3: POS / CASHIER (Priority: #1 — Build this first)
**API Endpoints:**
- `GET /api/cashier/stats` - Cashier statistics
- `GET /api/cashier/unpaid-bills` - Unpaid bills
- `GET /api/cashier/credit-bills` - Credit bills
- `POST /api/cashier/credit-bills` - Create credit bill
- `PUT /api/cashier/credit-bills/:id` - Update credit bill
- `GET /api/cashier/payments-verification` - Payments verification
- `GET /api/payments` - List payments
- `POST /api/payments` - Create payment
- `GET /api/payments/:id` - Get payment details
- `PUT /api/payments/:id` - Update payment

**Layout (Landscape-optimized):**
```
┌─────────────────────────────────────────────────────────────┐
│  HEADER: Branch Name | Shift: John Doe | Time | Sync Status │
├─────────────────────┬───────────────────────────────────────┤
│                     │                                       │
│   PRODUCT GRID      │         ORDER PANEL                   │
│  (searchable,       │  - Line items (qty, name, price)      │
│   categorized)      │  - Discounts / complimentary toggle   │
│                     │  - Sub-total, tax (16% VAT), total    │
│                     │  - Payment method selector            │
│                     │  - CHARGE button                      │
│                     │                                       │
├─────────────────────┴───────────────────────────────────────┤
│  FOOTER: [New Order] [Hold Order] [Recall] [Daily Summary]  │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- Product grid with categories (Food, Drinks, Accommodation, Extras)
- Real-time search (filter local cache)
- Order panel with line items
- Discount/complimentary toggle (requires superadmin PIN for >10%)
- Payment methods: Cash, M-Pesa, Card, Credit (Room Charge)
- M-Pesa STK push with polling
- Room charge attachment to guest folio
- Automatic receipt printing (ESC/POS)
- Hold & Recall orders
- Offline mode with sync queue
- Daily summary reports

---

### MODULE 4: BAR POS (Priority: High)
**API Endpoints:**
- `GET /api/bar/stock` - Bar stock
- `POST /api/bar/stock` - Add bar stock
- `PUT /api/bar/stock/:id` - Update bar stock
- `GET /api/bar/orders` - Bar orders
- `POST /api/bar/orders` - Create bar order
- `PUT /api/bar/orders/:id` - Update bar order
- `GET /api/bar/menu` - Bar menu
- `POST /api/bar/menu` - Add menu item
- `PUT /api/bar/menu/:id` - Update menu item

**Features:**
- Bar-specific product categories (Alcoholic, Non-alcoholic, Mixers)
- Stock level indicators
- Age verification prompts
- Happy hour pricing support
- Tab management (guest tabs)
- Bottle service
- Bar inventory tracking
- Bartender performance metrics

---

### MODULE 5: RESTAURANT / WAITER ORDERING
**API Endpoints:**
- `GET /api/restaurant/tables` - Restaurant tables
- `POST /api/restaurant/tables` - Create table
- `PUT /api/restaurant/tables/:id` - Update table
- `GET /api/orders` - List orders
- `POST /api/orders` - Create order
- `PUT /api/orders/:id` - Update order
- `GET /api/orders/:id` - Get order details
- `PUT /api/orders/:id/status` - Update order status

**Layout (Portrait + Landscape on Android tablet):**
- Table map view (grid of table buttons, color coded: 🟢 Free | 🟡 Occupied | 🔴 Bill Requested)
- Tap table → open order screen
- Order screen: product grid (no payment section)
- Order status tracking: Pending → Preparing → Ready → Served

**Waiter-specific features:**
- View own active orders
- "Call for bill" button → notifies cashier
- Transfer table (move order to different table)
- Split bill request (flag for cashier)
- Add notes per item (e.g. "no onions", "well done")
- Table status updates (poll every 10s)

---

### MODULE 6: BRANCH MANAGER DASHBOARD
**API Endpoints:**
- `GET /api/branch-operations/dashboard` - Branch operations dashboard
- `GET /api/branch-operations/incoming-dispatches` - Incoming dispatches
- `GET /api/branch-operations/staff` - Branch staff
- `GET /api/branch-operations/rooms` - Branch rooms
- `GET /api/branch-operations/announcements` - Branch announcements
- `POST /api/branch-operations/announcements` - Create announcement
- `GET /api/branches-stock` - Branch stock
- `GET /api/dashboard/branch` - Branch dashboard

**Features:**
- Branch overview statistics
- Staff management (branch-specific)
- Room status overview
- Incoming dispatches
- Branch announcements
- Stock levels
- Branch performance metrics
- Shift management

---

### MODULE 7: BRANCH RECEPTIONIST
**API Endpoints:**
- `GET /api/bookings` - List bookings
- `POST /api/bookings` - Create booking
- `GET /api/bookings/:id` - Get booking details
- `PUT /api/bookings/:id` - Update booking
- `DELETE /api/bookings/:id` - Cancel booking
- `POST /api/bookings/:id/check-in` - Check in guest
- `POST /api/bookings/:id/check-out` - Check out guest
- `GET /api/rooms` - List rooms
- `POST /api/rooms` - Create room
- `PUT /api/rooms/:id` - Update room
- `PUT /api/rooms/:id/status` - Update room status
- `GET /api/guest` - List guests
- `POST /api/guest` - Create guest profile
- `GET /api/guest/:id` - Get guest details
- `PUT /api/guest/:id` - Update guest

**Features:**
- Room booking management
- Check-in / Check-out process
- Room status management
- Guest profile management
- Room availability calendar
- Key card management
- Guest folio management
- Room assignment
- Housekeeping requests

---

### MODULE 8: BRANCH STOREKEEPER
**API Endpoints:**
- `GET /api/inventory/items` - Inventory items
- `POST /api/inventory/items` - Create item
- `PUT /api/inventory/items/:id` - Update item
- `DELETE /api/inventory/items/:id` - Delete item
- `GET /api/inventory/low-stock` - Low stock items
- `GET /api/storekeeping/dashboard` - Storekeeping dashboard
- `GET /api/storekeeping/purchase-orders` - Purchase orders
- `POST /api/storekeeping/purchase-orders` - Create PO
- `PUT /api/storekeeping/purchase-orders/:id` - Update PO
- `GET /api/storekeeping/grn` - Goods received notes
- `POST /api/storekeeping/grn` - Create GRN
- `GET /api/storekeeping/dispatch-notes` - Dispatch notes
- `POST /api/storekeeping/dispatch-notes` - Create dispatch
- `GET /api/storekeeping/stock-requests` - Stock requests
- `POST /api/storekeeping/stock-requests` - Create stock request
- `GET /api/stock-movements` - Stock movements

**Features:**
- Inventory management
- Purchase order creation and tracking
- Goods received notes (GRN)
- Stock requests to central store
- Dispatch notes
- Stock movement tracking
- Low stock alerts
- Expiry tracking
- Supplier management
- Stock takes

---

### MODULE 9: CENTRAL STOREKEEPER
**API Endpoints:**
- `GET /api/dashboard/central` - Central dashboard
- `GET /api/branches-stock` - All branches stock
- `GET /api/central-stock-takes/:id` - Central stock takes
- `POST /api/central-stock-takes/:id/submit` - Submit stock take
- `POST /api/central-stock-takes/:id/approve` - Approve stock take
- `GET /api/central-spoilage` - Central spoilage
- `POST /api/central-spoilage` - Record spoilage
- `GET /api/central-spoilage/summary` - Spoilage summary
- `GET /api/stock-requests/approved` - Approved stock requests
- `GET /api/stock-requests/pending` - Pending stock requests
- `POST /api/dispatch-notes` - Create dispatch
- `PUT /api/dispatch-notes/:id/dispatch` - Dispatch items
- `PUT /api/dispatch-notes/:id/logistics` - Logistics update
- `GET /api/incoming-dispatches` - Incoming dispatches

**Features:**
- Multi-branch inventory overview
- Central stock management
- Stock request approval
- Dispatch management
- Central stock takes
- Spoilage tracking across branches
- Inter-branch transfers
- Supplier management
- Central procurement
- Valuation reports

---

### MODULE 10: AUDITOR
**API Endpoints:**
- `GET /api/auditor/dashboard` - Auditor dashboard
- `GET /api/auditor/exceptions` - Exception reports
- `GET /api/auditor/compliance` - Compliance reports
- `GET /api/auditor/void-bills` - Void bill reports
- `GET /api/auditor-reports/export/exception_summary` - Export exception summary
- `GET /api/auditor-reports/export/compliance_audit` - Export compliance audit
- `GET /api/auditor-reports/export/void_analytics` - Export void analytics
- `GET /api/auditor-reports/export/revenue_reconciliation` - Export revenue reconciliation
- `GET /api/auditor-reports/export/leakage_report` - Export leakage report
- `GET /api/auditor-reports/export/expenditure_audit` - Export expenditure audit
- `GET /api/auditor-reports/export/variance_report` - Export variance report
- `GET /api/auditor-reports/export/consumption_audit` - Export consumption audit
- `GET /api/auditor-reports/export/grn_audit` - Export GRN audit
- `GET /api/audit/trail` - Audit trail
- `GET /api/audit/critical` - Critical actions
- `GET /api/audit/:staffId/summary` - Staff audit summary

**Features:**
- Auditor dashboard with key metrics
- Exception tracking and reporting
- Compliance monitoring
- Void bill analysis
- Revenue reconciliation
- Leakage detection
- Expenditure audit
- Stock variance reports
- Consumption analytics
- GRN audit
- Audit trail viewer
- Staff performance audit
- Export reports to PDF

---

### MODULE 11: DIRECTOR
**API Endpoints:**
- `GET /api/admin/dashboard` - Admin dashboard
- `GET /api/admin-ai/analytics` - AI-powered analytics
- `GET /api/admin-ai/forecast` - Generate forecasts
- `GET /api/branches` - All branches
- `GET /api/finance/profit-loss` - Profit & loss
- `GET /api/finance/expense-breakdown` - Expense breakdown
- `GET /api/report/daily` - Daily reports
- `GET /api/report/monthly` - Monthly reports
- `GET /api/report/financial` - Financial reports
- `GET /api/report/occupancy` - Occupancy reports
- `GET /api/report/revenue` - Revenue reports

**Features:**
- Executive dashboard
- Multi-branch overview
- AI-powered analytics and forecasting
- Financial performance (P&L)
- Revenue trends
- Occupancy rates
- Branch comparison
- Strategic insights
- Executive reports
- KPI tracking
- Market analysis

---

### MODULE 12: BRANCH ACCOUNTANT
**API Endpoints:**
- `GET /api/accounting/accounts` - List accounts
- `GET /api/accounting/account-categories` - List account categories
- `POST /api/accounting/accounts` - Create account
- `PUT /api/accounting/accounts/:id` - Update account
- `GET /api/accounting/ap-bills` - Accounts payable
- `GET /api/accounting/ar-invoices` - Accounts receivable
- `GET /api/accounting/bank-accounts` - Bank accounts
- `GET /api/accounting/bank-transactions` - Bank transactions
- `GET /api/accounting/budgets` - Budgets
- `GET /api/accounting/chart-of-accounts` - Chart of accounts
- `GET /api/accounting/customers` - Customers
- `GET /api/accounting/vendors` - Vendors
- `GET /api/accounting/journal-entries` - Journal entries
- `GET /api/finance/daily-logs` - Daily financial logs
- `POST /api/finance/daily-logs` - Create daily log
- `PUT /api/finance/daily-logs/:id` - Update daily log
- `GET /api/finance/profit-loss` - Profit & loss statement
- `GET /api/credit-bills` - Credit bills

**Features:**
- Chart of accounts management
- Journal entries
- Accounts payable (AP)
- Accounts receivable (AR)
- Bank account management
- Bank reconciliation
- Budget tracking
- Vendor management
- Customer management
- Daily financial logs
- Profit & loss statements
- Expense tracking
- Tax compliance
- Financial reports

---

### MODULE 13: HR MODULE
**API Endpoints:**
- `GET /api/staff` - List staff
- `POST /api/staff` - Create staff
- `GET /api/staff/:id` - Get staff details
- `PUT /api/staff/:id` - Update staff
- `DELETE /api/staff/:id` - Delete staff
- `GET /api/staff/attendance` - Staff attendance
- `GET /api/attendance/` - Get attendance records
- `POST /api/attendance/clock-in` - Clock in
- `POST /api/attendance/clock-out` - Clock out
- `GET /api/attendance/summary` - Attendance summary
- `PUT /api/attendance/:id` - Update attendance
- `PUT /api/attendance/:id/approve` - Approve attendance
- `GET /api/staff/leave` - Leave requests
- `POST /api/staff/leave` - Create leave request
- `GET /api/payroll/summary` - Payroll summary
- `GET /api/payroll/draft` - Draft payroll
- `POST /api/payroll/generate` - Generate payroll
- `POST /api/payroll/approve` - Approve payroll
- `GET /api/payroll/credit-bills` - Credit bills
- `POST /api/payroll/credit-bills` - Create credit bill
- `GET /api/payroll/loans` - Staff loans
- `POST /api/payroll/loans` - Create loan
- `GET /api/payroll/advances` - Salary advances
- `POST /api/payroll/advances` - Create advance

**Features:**
- Staff profile management
- Attendance tracking (clock in/out)
- Leave management
- Payroll processing
- Salary calculations
- Deductions management
- Loans and advances
- Credit bills
- Payroll reports
- Staff performance
- Shift management
- Department management
- Position management
- HR reports

---

### MODULE 14: KITCHEN OPERATIONS
**API Endpoints:**
- `GET /api/kitchen/dashboard/stats` - Kitchen dashboard stats
- `GET /api/kitchen/stock` - Kitchen stock
- `GET /api/kitchen/requisitions` - Kitchen requisitions
- `POST /api/kitchen/requisitions` - Create requisition
- `GET /api/kitchen/usage` - Kitchen usage records
- `POST /api/kitchen/usage` - Record usage
- `GET /api/kitchen/wastage` - Wastage records
- `POST /api/kitchen/wastage` - Record wastage
- `GET /api/kitchen/recipes` - Recipes
- `POST /api/kitchen/recipes` - Create recipe
- `GET /api/kitchen-usage/trackable-items` - Trackable items
- `GET /api/kitchen-usage/staff` - Kitchen staff usage
- `GET /api/kitchen-usage/accountability` - Accountability reports
- `GET /api/kitchen-usage/summary` - Usage summary

**Features:**
- Kitchen display system (KDS)
- Order queue management
- Recipe management
- Kitchen inventory
- Requisition management
- Usage tracking
- Wastage recording
- Staff accountability
- Prep station management
- Cooking time tracking
- Kitchen performance metrics

---

### MODULE 15: HOUSEKEEPING
**API Endpoints:**
- `GET /api/housekeeping/dashboard` - Housekeeping dashboard
- `GET /api/housekeeping/rooms` - Room status
- `GET /api/housekeeping/tasks` - Housekeeping tasks
- `POST /api/housekeeping/tasks` - Create task
- `PUT /api/housekeeping/tasks/:id` - Update task
- `PUT /api/housekeeping/tasks/:id/status` - Update task status
- `GET /api/housekeeping/inspections` - Inspections
- `POST /api/housekeeping/inspections` - Create inspection
- `GET /api/housekeeping/linen` - Linen management
- `GET /api/housekeeping/lost-found` - Lost & found
- `GET /api/housekeeping/maintenance` - Maintenance requests

**Features:**
- Room status dashboard
- Task assignment
- Task tracking
- Inspections
- Linen management
- Lost & found tracking
- Maintenance requests
- Staff scheduling
- Performance metrics
- Supply requests

---

### MODULE 16: MAINTENANCE
**API Endpoints:**
- `GET /api/maintenance/work-orders` - Work orders
- `POST /api/maintenance/work-orders` - Create work order
- `PUT /api/maintenance/work-orders/:id` - Update work order
- `GET /api/maintenance/equipment` - Equipment
- `GET /api/maintenance/schedule` - Maintenance schedule
- `GET /api/facilities/vehicles` - Vehicles
- `GET /api/facilities/vehicle-assignments` - Vehicle assignments

**Features:**
- Work order management
- Equipment tracking
- Preventive maintenance scheduling
- Corrective maintenance
- Emergency maintenance
- Vehicle management
- Maintenance history
- Vendor management
- Cost tracking

---

### MODULE 17: CONFERENCE & EVENTS
**API Endpoints:**
- `GET /api/conference/halls` - Conference halls
- `POST /api/conference/halls` - Create hall
- `PUT /api/conference/halls/:id` - Update hall
- `GET /api/conference/bookings` - Conference bookings
- `POST /api/conference/bookings` - Create booking
- `PUT /api/conference/bookings/:id/status` - Update booking status
- `GET /api/catering-bookings` - Catering bookings
- `POST /api/catering-bookings` - Create catering booking
- `PUT /api/catering-bookings/:id` - Update booking
- `DELETE /api/catering-bookings/:id` - Cancel booking

**Features:**
- Conference hall booking
- Event management
- Catering services
- Equipment booking
- AV equipment management
- Event calendar
- Pricing management
- Event reports

---

### MODULE 18: REPORTS (All Roles)
**API Endpoints:**
- `GET /api/report/daily` - Daily reports
- `GET /api/report/monthly` - Monthly reports
- `GET /api/report/financial` - Financial reports
- `GET /api/report/occupancy` - Occupancy reports
- `GET /api/report/revenue` - Revenue reports
- `GET /api/auditor-reports/export/*` - Various audit exports
- `GET /api/reports/*` - Additional reports

**Features:**
- Daily sales reports
- Monthly summaries
- Financial statements
- Occupancy reports
- Revenue analysis
- Staff performance
- Inventory reports
- Expense reports
- Export to PDF
- Date range filtering
- Custom report generation

---

### MODULE 19: NOTIFICATIONS
**API Endpoints:**
- `GET /api/notifications` - List notifications
- `GET /api/notifications/unread-count` - Unread count
- `PUT /api/notifications/:id/read` - Mark as read
- `DELETE /api/notifications/:id` - Delete notification
- `GET /api/branch-operations/announcements` - Branch announcements
- `POST /api/branch-operations/announcements` - Create announcement

**Features:**
- Real-time notifications
- Branch announcements
- Task alerts
- System alerts
- Notification history
- Mark as read/unread
- Delete notifications

---

### MODULE 20: SETTINGS & CONFIGURATION
**API Endpoints:**
- `GET /api/system/branches` - List branches
- `GET /api/system/health` - System health check
- `GET /api/system/config` - System configuration
- `GET /api/branches/:id` - Branch details
- `PUT /api/branches/:id` - Update branch

**Features:**
- Branch settings
- User preferences
- Printer configuration
- Tax rate settings
- System configuration
- License management
- App updates

---

## 📴 OFFLINE / HYBRID ARCHITECTURE
```
┌─────────────────────────────────────────────────────┐
│                   APP LAYER (Flutter)               │
│                                                     │
│  ┌─────────────┐        ┌────────────────────────┐  │
│  │  UI / Views │◄──────►│  Riverpod Providers    │  │
│  └─────────────┘        └──────────┬─────────────┘  │
│                                    │                 │
│                          ┌─────────▼──────────┐      │
│                          │  Repository Layer  │      │
│                          │  (decides: local   │      │
│                          │   vs remote)       │      │
│                          └────┬──────────┬────┘      │
│                               │          │           │
│              ┌────────────────▼─┐  ┌─────▼─────────┐│
│              │  Drift (SQLite)  │  │  Dio HTTP     ││
│              │  Local DB        │  │  Client       ││
│              │                  │  │               ││
│              │  - products      │  │  api.hirall   ││
│              │  - offline_sales │  │  .com         ││
│              │  - held_orders   │  │               ││
│              │  - menu_cache    │  │               ││
│              └──────────────────┘  └───────────────┘│
└─────────────────────────────────────────────────────┘
```

### Drift Tables to create:
```sql
-- products_cache: local copy of menu
CREATE TABLE products_cache (
  id TEXT PRIMARY KEY, name TEXT, category TEXT,
  price REAL, is_active INTEGER, last_synced INTEGER
);

-- offline_sales: queued when no internet
CREATE TABLE offline_sales (
  local_id TEXT PRIMARY KEY, branch_id TEXT,
  cashier_id TEXT, items_json TEXT, total REAL,
  payment_method TEXT, created_at INTEGER,
  sync_status TEXT DEFAULT 'pending' -- 'pending' | 'synced' | 'failed'
);

-- held_orders: paused orders
CREATE TABLE held_orders (
  id TEXT PRIMARY KEY, label TEXT,
  items_json TEXT, created_at INTEGER
);
```

---

## 🎨 UI / DESIGN SYSTEM
Philosophy: Clean, professional hospitality software. Not a consumer app — a tool used by staff under pressure. Clarity over decoration.

### Color Palette
```dart
const kPrimary        = Color(0xFF1A3C5E);  // Deep navy — brand anchor
const kAccent         = Color(0xFFD4A843);  // Warm gold — Famous Gates brand
const kSurface        = Color(0xFFFAF9F7);  // Warm off-white background
const kCardBg         = Color(0xFFFFFFFF);  // Pure white cards
const kTextPrimary    = Color(0xFF1A1A1A);  // Near-black text
const kTextSecondary  = Color(0xFF6B7280);  // Muted labels
const kSuccess        = Color(0xFF16A34A);  // Green — confirmed/synced
const kWarning        = Color(0xFFF59E0B);  // Amber — offline/pending
const kError          = Color(0xFFDC2626);  // Red — errors
const kDivider        = Color(0xFFE5E7EB);  // Subtle dividers
```

### Typography
- Display/Headers: 'Playfair Display' (elegant, hotel-appropriate)
- Body/UI: 'DM Sans' (clean, highly legible on tablet screens)

### Component Rules
- Cards: 12px border radius, subtle shadow
- Buttons: 8px radius, minimum 48px height
- Inputs: outlined style, 8px radius, focus ring in kPrimary
- Icons: phosphor_flutter — no Material icons
- Spacing: 8px grid system (8, 16, 24, 32, 48)
- Loading states: skeleton loaders
- Empty states: illustration + message + action button
- Error states: icon + message + retry button

### Responsive Breakpoints
- < 600px → phone layout
- 600-900 → tablet layout
- > 900px → desktop layout

---

## 🔒 SECURITY REQUIREMENTS
- JWT stored ONLY in flutter_secure_storage
- License key stored in flutter_secure_storage
- No sensitive data in logs
- Certificate pinning for api.hirall.com
- Superadmin PIN (4-digit) for sensitive operations
- Auto-lock after 10 minutes inactivity
- Biometric auth support

---

## 📁 PROJECT STRUCTURE
```
famous_gates_app/
├── lib/
│   ├── main.dart
│   ├── app.dart                    # MaterialApp + GoRouter setup
│   ├── core/
│   │   ├── config/                 # Environment config, API URLs
│   │   ├── database/               # Drift DB definition + DAOs
│   │   ├── network/                # Dio client + interceptors
│   │   ├── router/                 # GoRouter config + guards
│   │   ├── theme/                  # ThemeData, colors, typography
│   │   └── utils/                  # Formatters, validators, extensions
│   ├── features/
│   │   ├── auth/
│   │   │   ├── data/               # AuthRepository, AuthRemoteDataSource
│   │   │   ├── domain/             # User model, AuthState
│   │   │   └── presentation/       # Splash, License, Login screens
│   │   ├── pos/
│   │   │   ├── data/               # SalesRepository, ProductRepository
│   │   │   ├── domain/             # Order, Product, Sale models
│   │   │   └── presentation/       # POS screen, CartPanel, ProductGrid
│   │   ├── bar_pos/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   └── presentation/
│   │   ├── restaurant/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   └── presentation/       # TableMap, OrderScreen
│   │   ├── branch_manager/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   └── presentation/
│   │   ├── reception/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   └── presentation/
│   │   ├── branch_storekeeper/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   └── presentation/
│   │   ├── central_storekeeper/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   └── presentation/
│   │   ├── auditor/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   └── presentation/
│   │   ├── director/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   └── presentation/
│   │   ├── branch_accountant/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   └── presentation/
│   │   ├── hr/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   └── presentation/
│   │   ├── kitchen/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   └── presentation/
│   │   ├── housekeeping/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   └── presentation/
│   │   ├── maintenance/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   └── presentation/
│   │   ├── conference/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   └── presentation/
│   │   ├── reports/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   └── presentation/
│   │   ├── notifications/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   └── presentation/
│   │   ├── settings/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   └── presentation/
│   │   └── shared/
│   │       ├── widgets/            # Shared UI components
│   │       └── providers/          # Shared Riverpod providers
│   └── services/
│       ├── sync_service.dart       # Background offline sync
│       ├── print_service.dart      # ESC/POS + PDF printing
│       └── connectivity_service.dart
├── windows/                        # Windows-specific configs
├── linux/                          # Linux-specific configs
├── android/                        # Android (tablet) configs
├── pubspec.yaml
└── README.md
```

---

## 📋 PUBSPEC DEPENDENCIES
```yaml
dependencies:
  flutter:
    sdk: flutter

  # State management
  flutter_riverpod: ^2.5.1
  riverpod_annotation: ^2.3.5

  # Navigation
  go_router: ^14.2.0

  # Networking
  dio: ^5.4.3
  connectivity_plus: ^6.0.3

  # Local DB
  drift: ^2.18.0
  sqlite3_flutter_libs: ^0.5.22
  path_provider: ^2.1.3
  path: ^1.9.0

  # Auth & Security
  flutter_secure_storage: ^9.0.0
  local_auth: ^2.2.0

  # UI
  google_fonts: ^6.2.1
  phosphor_flutter: ^2.1.0
  shimmer: ^3.0.0
  fl_chart: ^0.68.0

  # Printing
  printing: ^5.13.1
  pdf: ^3.11.0
  esc_pos_utils_plus: ^2.0.2

  # Utils
  intl: ^0.19.0
  uuid: ^4.4.0
  freezed_annotation: ^2.4.4
  json_annotation: ^4.9.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  build_runner: ^2.4.9
  riverpod_generator: ^2.4.0
  freezed: ^2.5.2
  json_serializable: ^6.8.0
  drift_dev: ^2.18.0
```

---

## 🚀 BUILD & DELIVERY REQUIREMENTS

### Windows
- Build: `flutter build windows --release`
- Installer: Use msix package to create .msix installer
- Auto-updater: check https://api.hirall.com/app/updates?platform=windows&version=<current>
- Target: Windows 10+ (64-bit)

### Linux
- Build: `flutter build linux --release`
- Package as .deb (for Ubuntu/Debian hotel PCs)
- Target: Ubuntu 20.04+

### Android (Tablets)
- Build: `flutter build apk --release --target-platform android-arm64`
- Min SDK: 24 (Android 7.0)
- Target SDK: 34
- Orientation: Lock to landscape for POS/Cashier, allow both for Waiter
- Tablet layout activated at sw600dp

---

## ✅ ACCEPTANCE CRITERIA

### Auth
- License validation works on first launch and re-checks on every app start
- JWT stored securely, never in plain SharedPreferences
- Role-based routing enforced at router level (not just UI-level)
- Auto-lock after 10 min inactivity works on all platforms

### POS
- Can complete a full sale in under 30 seconds
- M-Pesa STK push flow works end-to-end with polling
- Offline sales queue correctly and sync when internet restored
- Hold/Recall works across app restarts
- Superadmin PIN gate works for discounts and complimentary

### Restaurant
- Waiter can take order, submit to kitchen, and mark as served
- Table status updates reflect in real-time (poll every 10s)
- Cannot access payment/billing functions as waiter role

### All Modules
- Each module loads within 2 seconds
- All CRUD operations work for respective roles
- Reports can be exported as PDF
- Cross-platform compatibility maintained
- Tablet layout is touch-friendly
- Thermal receipt prints correctly on all platforms

---

## ⚠️ CRITICAL RULES

1. **DO NOT COMMIT AND PUSH CODE FIRST!!** Build locally, test thoroughly, then commit when ready.
2. Never hardcode API URLs — use environment config (--dart-define)
3. Never skip error handling — every async call must have .catchError or try/catch
4. Every screen must have 3 states: loading skeleton | data | error+retry
5. Branch ID must be injected on EVERY API request
6. Never use setState in feature screens — use Riverpod only
7. Offline queue must be idempotent — use local_id as idempotency key
8. Test on tablet screen (1280x800) — primary target device
9. All currency must display as KES X,XXX.00
10. All dates/times in Kenya timezone (Africa/Nairobi, UTC+3)
11. Do not use deprecated Flutter APIs — target Flutter 3.22+

---

## 📌 START HERE

Build in this exact sequence:

1. Scaffold the Flutter project with the folder structure above
2. Set up pubspec.yaml with all dependencies
3. Implement core/ layer: theme, router, Dio client, Drift DB
4. Build auth feature completely (Splash → License → Login → Role Router)
5. Build pos feature completely (this is the #1 priority)
6. Build bar_pos feature
7. Build restaurant (waiter) feature
8. Build branch_manager dashboard
9. Build reception feature
10. Build branch_storekeeper feature
11. Build central_storekeeper feature
12. Build auditor feature
13. Build director dashboard
14. Build branch_accountant feature
15. Build hr module
16. Build kitchen operations
17. Build housekeeping
18. Build maintenance
19. Build conference & events
20. Build reports module
21. Build notifications
22. Build settings
23. Implement sync service + print service
24. Configure Windows, Linux, Android build targets
25. Write a README.md with setup, env vars, and build instructions

**Do not ask for clarification — make reasonable decisions and document them in comments.**

---

## 📊 DATABASE SCHEMA REFERENCE

Refer to `/home/allansamuel/Desktop/fggrill/backend/database-schema.json` for complete database schema including:
- 100+ tables with all columns
- Column data types, constraints, defaults
- 80+ enums with all possible values
- Relationships between tables

## 📡 API REFERENCE

Refer to `/home/allansamuel/Desktop/fggrill/API_DOCUMENTATION.md` for complete API documentation including:
- 823 API endpoints
- Request/response formats
- Authentication requirements
- Error handling
- Rate limiting

## 🗄️ ROLES & PERMISSIONS

Refer to the user_role enum in database-schema.json for complete list of 80+ roles:
- Global roles (access all branches)
- Branch-specific roles (access assigned branch only)
- Specialized roles (spa cashier, bar cashier, etc.)

---

**Generated:** 2026-05-24  
**Based on:** FamousGate Hotels Management System API Documentation  
**API Base URL:** https://api.hirall.com  
**Database:** PostgreSQL (Supabase)
