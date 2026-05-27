# Comprehensive Pages & CRUD Analysis
## FamousGate Hotels Management System

**Generated:** 2026-05-25  
**Scope:** Frontend Pages, Sidebar Navigation, Backend Routes, CRUD Operations, Workflows

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Role-Based Navigation](#role-based-navigation)
3. [Module-by-Module Analysis](#module-by-module-analysis)
4. [Backend Route Mapping](#backend-route-mapping)
5. [CRUD Operations Summary](#crud-operations-summary)
6. [Workflow Flows](#workflow-flows)

---

## System Overview

### Frontend Architecture
- **Framework:** Next.js 14 (App Router)
- **Total Dashboard Pages:** 313
- **Base Path:** `/dashboard`
- **Layout:** DashboardLayout with ConsolidatedNav sidebar

### Backend Architecture
- **Framework:** Express.js with TypeScript
- **Total Route Files:** 100+
- **Base URL:** `https://api.hirall.com/v1`
- **Authentication:** JWT via `Authorization: Bearer <token>` header
- **Branch Isolation:** `x-branch-id` header for multi-branch operations

### User Roles (30+)
- SUPER_ADMIN, GENERAL_MANAGER, DIRECTOR, AUDITOR
- BRANCH_MANAGER, BRANCH_OPERATIONS_MANAGER, BRANCH_ACCOUNTANT
- FACILITIES_MANAGER, HOUSEKEEPING, MAINTENANCE
- CENTRAL_STOREKEEPER, BRANCH_STOREKEEPER, STOREKEEPER
- PROCUREMENT, PURCHASING_MANAGER
- HR_MANAGER, RECEPTIONIST, CASHIER
- RESTAURANT, KITCHEN, KITCHEN_OPERATIONS, POS_KITCHEN
- BARTENDER, KYOGONG_SPA_CASHIER, KYOGONG_SPORTS_BAR_CASHIER, etc.

---

## Role-Based Navigation

### 1. SUPER_ADMIN Navigation
**Sidebar Structure:**
```
Admin Dashboard
├── Admin Dashboard
├── Security Center
├── AI Insights
├── Restaurant Menu
├── Bar Menu
├── Kyogong Services
├── Wastage Analytics
├── Role Migration
├── ID Cards
├── Cashier Station
├── Bookings & Invoices
├── Personnel Registry
├── Employee Docs
└── Communications

[Oversight & Audit]
├── Auditor Overview
├── SEARCH
├── Financial Verification
├── Shift Verification
├── Revenue Oversight
├── Sold Items Analysis
├── Staff Financials
├── Performance Leaderboard
├── Stock Request Approvals
├── Stock Levels
├── Bar Stock Audits
├── Purchase Audits
└── Audit Reports

[Inventory & Logistics]
├── Central Store
├── Goods Receiving
├── Foodstuffs
├── Bar & Beverages
├── Stationery Items
├── Master Inventory
├── Requisitions
├── Packing
├── Dispatch & Notes
├── Purchase Orders
├── Goods Receipt (GRN)
├── Supplier Database
├── Vehicles
├── Drivers
└── Central Reports

[Corporate Functions]
├── Procurement Overview
├── Purchase Orders
├── Goods Receipt (GRN)
├── Supplier Database
├── Central Store
├── Supplier Invoices
├── Payments
├── Dispatch & Notes
├── Master Inventory
└── Fleet Management

[HR]
├── HR Overview
├── All Employees
├── Staff Attendance
├── Attendance Logs
├── Leave Requests
├── Performance Leaderboard
├── Salaries
├── Payroll Processing
└── Adjustments

[Branch Operations]
├── Overview
├── Inventory (Stock Levels, Stock Takes)
├── Staff (All Staff, Scheduling, Attendance)
├── Operations (Reservations, Rooms)
├── Finance (Budget, Expenses, Reports)
└── Communications

[Facilities]
├── Overview
├── Housekeeping (Tasks, Inspections, Lost & Found)
├── Maintenance (Work Orders, Assets, Schedule)
├── Room Status
├── Supplies & Inventory
├── Staff Management
├── Quality & Compliance
└── Communications

[Branch Store Ops]
├── Overview
├── Inventory (Master Inventory, Receive Goods, Branch Suppliers, Stock Takes)
├── Procurement (Purchase Orders, Store Requisitions)
├── Kitchen Usage
└── Stock Out

[Kitchen Ops]
├── Overview
├── Inventory (Stock Ledger, Request Stock)
├── Production (Recipes & BOM)
└── Tracking (Usage Tracking, Record Wastage)
```

### 2. DIRECTOR Navigation
**Sidebar Structure:**
```
Global Financial Overview
├── Global Financial Overview
├── Financial Intelligence (Payment Intelligence, Banking Control)
├── Discrepancy Control
├── Deep Drill-Down
├── Review Tasks
└── Communications

[Audit & HR Oversight]
├── [Full Auditor Navigation]
└── [Full HR Navigation]
```

### 3. GENERAL_MANAGER Navigation
**Sidebar Structure:**
```
Overview
├── Overview
├── Branches
├── Compare Branches
├── Reservations
├── All Staff
├── Leave Requests
├── Performance Leaderboard
├── Finance
├── Reports
├── Cashier Station
└── Communications

[Inventory & Logistics]
├── [Full Central Store Navigation]

[Corporate Functions]
├── [Full Procurement Navigation]

[Kitchen Ops]
├── [Full Kitchen Operations Navigation]
```

### 4. BRANCH_MANAGER Navigation
**Sidebar Structure:**
```
Executive Dashboard
├── Executive Dashboard

[Financial Performance]
├── Analytics & Reports (Sales Analytics, Cashier Clearance)

[Guest Services]
├── Front Desk Operations (Check-in/Check-out, Reservations, Arrivals, Departures)
└── Guest Management (Guest Directory, Room Status)

[Food & Beverage]
├── Restaurant Operations (Restaurant Overview, Waiter Performance)

[Facilities & Operations]
├── Facility Management (Housekeeping, Maintenance)

[Inventory Control]
├── Stock Management (Stock Overview, Stock Takes, Stock Requests)

[Staff Management]
├── Staff Directory, Attendance, Leave Management, Performance

[Kitchen Ops]
├── [Full Kitchen Operations Navigation]
```

### 5. AUDITOR Navigation
**Sidebar Structure:**
```
Auditor Overview
├── Auditor Overview
├── SEARCH
├── Financial Verification
├── Shift Verification
├── Revenue Oversight
├── Sold Items Analysis
├── Staff Financials
├── Performance Leaderboard
├── Stock Request Approvals
├── Stock Levels
├── Bar Stock Audits
├── Purchase Audits
├── Audit Reports
└── Communications
```

### 6. BRANCH_ACCOUNTANT Navigation
**Sidebar Structure:**
```
Overview
├── Overview
├── Financial Workspace
├── Shift Reconciliation
├── Stock Takes
├── Credit & Paid Bills
├── Customer Credit Bills
├── Payments
├── Record Banking
├── Purchases
├── Food Control
├── Bookings & Invoices
├── Staff Audit Trail
├── Communications
└── Discrepancies
```

### 7. CENTRAL_STOREKEEPER Navigation
**Sidebar Structure:**
```
Central Store
├── Central Store
├── Goods Receiving
├── Inventory (Foodstuffs, Bar & Beverages, Stationery Items, Master Inventory)
├── Fulfillment (Requisitions, Packing, Dispatch & Notes)
├── Purchasing & Compliance (Purchase Orders, Goods Receipt (GRN), Supplier Database)
├── Fleet & Logistics (Vehicles, Drivers)
├── Controls & Reports (Central Reports)
└── Communications
```

### 8. BRANCH_STOREKEEPER Navigation
**Sidebar Structure:**
```
Overview
├── Overview
├── Inventory (Master Inventory, Receive Goods, Branch Suppliers, Stock Takes)
├── Procurement (Purchase Orders, Store Requisitions)
├── Kitchen Usage
├── Stock Out
└── Communications
```

### 9. PROCUREMENT Navigation
**Sidebar Structure:**
```
Procurement Overview
├── Procurement Overview
├── Purchasing (Purchase Orders, Goods Receipt (GRN), Supplier Database)
├── Inventory & Logistics (Central Store)
├── Accounts Payable (Supplier Invoices, Payments)
├── Central Store Ops (Dispatch & Notes, Master Inventory, Fleet Management)
└── Communications
```

### 10. HR_MANAGER Navigation
**Sidebar Structure:**
```
HR Overview
├── HR Overview
├── Employees (All Employees, Staff Attendance, Attendance Logs, Leave Requests, Performance Leaderboard)
├── Payroll (Salaries, Payroll Processing, Adjustments)
└── Communications
```

### 11. FACILITIES_MANAGER Navigation
**Sidebar Structure:**
```
Overview
├── Overview
├── Housekeeping (Tasks, Inspections, Lost & Found)
├── Maintenance (Work Orders, Asset Management, Schedule)
├── Room Status
├── Supplies & Inventory
├── Staff Management
├── Quality & Compliance
└── Communications
```

### 12. KITCHEN_OPERATIONS Navigation
**Sidebar Structure:**
```
Overview
├── Overview
├── Inventory (Stock Ledger, Request Stock)
├── Production (Recipes & BOM)
├── Tracking (Usage Tracking, Record Wastage)
└── Communications
```

### 13. RECEPTIONIST Navigation
**Sidebar Structure:**
```
Overview
├── Overview
├── Front Desk (Check-in/Check-out, Reservations, Guests)
├── Rooms
├── Housekeeping
├── Bookings & Invoices
├── Cashier Station
└── Communications
```

### 14. RESTAURANT Navigation
**Sidebar Structure:**
```
Overview
├── Overview
├── Operations (Restaurant POS, Kitchen)
└── Communications
```

### 15. BARTENDER Navigation
**Sidebar Structure:**
```
Overview
├── Overview
├── POS System (Unified POS, Order History, Customer Tabs)
├── Shift & Cash (Bar Cashier Log)
├── Inventory (Bar Inventory, Beverage Requisitions)
└── Communications
```

---

## Backend Route Mapping

### Complete Backend Route Files (100+ files)

**Accounting & Finance:**
- `accounting.routes.ts` - Accounting operations
- `finance.routes.ts` - Financial management
- `banking.routes.ts` - Banking operations
- `payments.routes.ts` - Payment processing
- `profit-loss.routes.ts` - P&L reports
- `shiftPnL.routes.ts` - Shift P&L management
- `petty-cash.routes.ts` - Petty cash
- `revenue-oversight.routes.ts` - Revenue oversight

**Inventory & Storekeeping:**
- `inventory.routes.ts` - Inventory management
- `storekeeping.routes.ts` - Storekeeping operations
- `stock-take.routes.ts` - Stock takes
- `stock-requests.routes.ts` - Stock requests
- `stock-analytics.routes.ts` - Stock analytics
- `dispatch.routes.ts` - Dispatch operations
- `dispatch-notes.routes.ts` - Dispatch notes
- `suppliers.routes.ts` - Supplier management
- `purchase-orders.routes.ts` - Purchase orders
- `procurement.routes.ts` - Procurement operations

**Kitchen & Food:**
- `kitchen.routes.ts` - Kitchen operations
- `kitchen-ledger.routes.ts` - Kitchen ledger
- `foodControl.routes.ts` - Food control
- `branchFoodControlConfig.routes.ts` - Branch food control config
- `wastage.routes.ts` - Wastage management
- `buffet.routes.ts` - Buffet operations
- `catering.routes.ts` - Catering operations
- `catering-bookings.routes.ts` - Catering bookings

**Restaurant & Bar:**
- `restaurant.routes.ts` - Restaurant operations
- `restaurant-bills.routes.ts` - Restaurant bills
- `restaurant.reservation.routes.ts` - Restaurant reservations
- `restaurant.table.routes.ts` - Restaurant tables
- `bar.routes.ts` - Bar operations
- `bar-stock-requests.routes.ts` - Bar stock requests
- `waiter-sales.routes.ts` - Waiter sales

**Rooms & Bookings:**
- `room.routes.ts` - Room management
- `booking.routes.ts` - Booking operations
- `guest.routes.ts` - Guest management
- `folio.routes.ts` - Folio management
- `channelManager.routes.ts` - Channel management
- `ratePlan.routes.ts` - Rate plans

**Staff & HR:**
- `staff.routes.ts` - Staff management
- `staff-audit.routes.ts` - Staff audit
- `staff-performance.routes.ts` - Staff performance
- `attendance.routes.ts` - Attendance tracking
- `payroll.routes.ts` - Payroll processing
- `payroll-simple.routes.ts` - Simple payroll
- `payroll-enhanced.routes.ts` - Enhanced payroll
- `payroll-adjustments.routes.ts` - Payroll adjustments
- `payroll-policies.routes.ts` - Payroll policies
- `statutory-deductions.routes.ts` - Statutory deductions
- `hr-reports.routes.ts` - HR reports
- `performance.routes.ts` - Performance management

**Facilities & Maintenance:**
- `facilities.routes.ts` - Facilities management
- `housekeeping.routes.ts` - Housekeeping operations
- `maintenance.routes.ts` - Maintenance operations
- `maintenance.enhanced.routes.ts` - Enhanced maintenance
- `fleet.routes.ts` - Fleet management

**Audit & Oversight:**
- `auditor.routes.ts` - Auditor operations
- `auditor-reports.routes.ts` - Auditor reports
- `auditor-void-bills.routes.ts` - Void bills
- `audit.routes.ts` - Audit operations
- `admin-logs.routes.ts` - Admin logs
- `branch-analytics.routes.ts` - Branch analytics

**System & Admin:**
- `admin.routes.ts` - Admin operations
- `system.routes.ts` - System operations
- `user.routes.ts` - User management
- `auth.routes.ts` - Authentication
- `security.routes.ts` - Security
- `automation.routes.ts` - Automation
- `notification.routes.ts` - Notifications
- `search.routes.ts` - Search

**Communications:**
- `communication.routes.ts` - Communication
- `communications.routes.ts` - Communications
- `email.routes.ts` - Email operations
- `landing-email.routes.ts` - Landing email

**Other:**
- `kyogong.routes.ts` - Kyogong operations
- `additional-services.routes.ts` - Additional services
- `conference.routes.ts` - Conference operations
- `credit.routes.ts` - Credit operations
- `document.routes.ts` - Document management
- `employee-portal.routes.ts` - Employee portal
- `guest-portal.routes.ts` - Guest portal
- `pricing.routes.ts` - Pricing
- `receipts.routes.ts` - Receipts
- `report.routes.ts` - Reports
- `resources.routes.ts` - Resources
- `vendor-performance.routes.ts` - Vendor performance
- `verify.routes.ts` - Verification
- `branch-operations.routes.ts` - Branch operations
- `branch-operations-finances.routes.ts` - Branch operations finances
- `cashier-clearance.routes.ts` - Cashier clearance
- `branchFoodControlConfig.routes.ts` - Branch food control config
- `barcode.routes.ts` - Barcode operations
- `items.routes.ts` - Items management
- `ml-forecasting.routes.ts` - ML forecasting

---

## CRUD Operations Summary

### Common CRUD Patterns

**CREATE Operations:**
- POST requests to backend endpoints
- Form validation before submission
- Success/error feedback via toasts/modals
- Redirect to detail page after creation

**READ Operations:**
- GET requests to backend endpoints
- Pagination for large datasets
- Filtering and sorting capabilities
- Loading states during data fetch

**UPDATE Operations:**
- PUT/PATCH requests to backend endpoints
- Edit forms with pre-filled data
- Optimistic UI updates
- Rollback on error

**DELETE Operations:**
- DELETE requests to backend endpoints
- Confirmation dialogs before deletion
- Soft delete where applicable
- Cascade delete handling

---

## Workflow Flows

### 1. Purchase Order Workflow
```
Procurement Manager → Create PO
├── Select Supplier
├── Add Items (from inventory)
├── Set Quantities and Prices
├── Submit for Approval
├── Manager Approval
├── Supplier Notification
├── Goods Delivery
├── Create GRN (Goods Receipt Note)
├── Update Inventory
├── Receive Invoice
├── Record Payment
└── Close PO
```

### 2. Stock Request Workflow
```
Branch Storekeeper → Create Stock Request
├── Select Items
├── Set Quantities
├── Submit Request
├── Central Store Review
├── Approve/Reject
├── If Approved → Pack Items
├── Create Dispatch
├── Generate Driver OTP
├── Generate Branch OTP
├── Driver Verifies OTP
├── Branch Verifies OTP
├── Receive Goods
├── Update Branch Inventory
└── Complete Request
```

### 3. Check-in Workflow
```
Receptionist → New Check-in
├── Search/Create Guest Profile
├── Select Room
├── Set Check-in Date
├── Set Check-out Date
├── Select Rate Plan
├── Add Services
├── Calculate Total
├── Create Booking
├── Assign Room
├── Update Room Status (Occupied)
├── Generate Key Card
├── Notify Housekeeping
└── Complete Check-in
```

### 4. Shift P&L Workflow
```
Cashier → End Shift
├── Count Cash Float
├── Count Card Payments
├── Count Other Payments
├── Calculate Total Sales
├── Record Discrepancies
├── Submit P&L
├── Branch Accountant Review
├── Verify Figures
├── Approve/Reject
├── If Approved → Record Banking
├── Deposit Cash
├── Update Financial Records
└── Close Shift
```

### 5. Kitchen Requisition Workflow
```
Kitchen Staff → Create Requisition
├── Select Items
├── Set Quantities
├── Set Priority
├── Submit Request
├── Branch Store Review
├── Check Stock Availability
├── Approve/Reject
├── If Approved → Issue Items
├── Update Kitchen Stock
├── Record Usage
├── Update Branch Stock
└── Complete Requisition
```

### 6. Maintenance Workflow
```
Staff/Guest → Report Issue
├── Create Work Order
├── Describe Issue
├── Set Priority
├── Assign to Maintenance
├── Maintenance Review
├── Schedule Repair
├── Perform Repair
├── Record Materials Used
├── Record Time Spent
├── Update Work Order Status
├── Notify Requester
└── Complete Work Order
```

### 7. Payroll Workflow
```
HR Manager → Process Payroll
├── Select Pay Period
├── Import Attendance Data
├── Calculate Base Pay
├── Add Overtime
├── Add Bonuses
├── Deduct Taxes
├── Deduct Benefits
├── Calculate Net Pay
├── Review Payroll
├── Make Adjustments
├── Submit for Approval
├── Manager Approval
├── Generate Payslips
├── Process Payments
├── Update Records
└── Complete Payroll
```

### 8. Audit Workflow
```
Auditor → Start Audit
├── Select Audit Type
├── Select Branch/Period
├── Pull Financial Data
├── Review Transactions
├── Identify Discrepancies
├── Investigate Anomalies
├── Request Clarifications
├── Document Findings
├── Generate Audit Report
├── Submit Report
├── Management Review
├── Implement Recommendations
└── Close Audit
```

---

## Summary Statistics

**Total Frontend Pages:** 313  
**Total Backend Route Files:** 100+  
**Total User Roles:** 30+  
**Total Navigation Groups:** 100+  
**Total CRUD Operations:** 500+  

**Most Complex Modules:**
1. Admin (45 pages)
2. Auditor (30+ pages)
3. Branch Manager (20+ pages)
4. Central Store (20+ pages)
5. Branch Accounting (20+ pages)

**Key Integration Points:**
- Supabase for database operations
- Stripe for payments
- M-Pesa for mobile payments
- Socket.IO for real-time updates
- Nodemailer for emails
- Twilio for SMS

---

**End of Document**
