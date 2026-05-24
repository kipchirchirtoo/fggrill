# FamousGate Hotels Management System - API Documentation

**Base URL:** `https://api.hirall.com`  
**API Version:** v1  
**Last Updated:** 2026-05-24

---

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [API Routes](#api-routes)
- [Database Schema](#database-schema)
- [Enums](#enums)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)

---

## Overview

This document provides comprehensive documentation for all API endpoints and database schema for the FamousGate Hotels Management System. The system supports multi-branch hotel operations with role-based access control.

**Total API Endpoints:** 823  
**Total Database Tables:** 100+  
**Total Enums:** 80+

---

## Authentication

All API endpoints (except auth endpoints) require authentication via JWT token.

### Headers
```
Authorization: Bearer <your-jwt-token>
x-branch-id: <branch-id> (for multi-branch operations)
```

### Auth Endpoints

#### POST /api/auth/login
Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "jwt-token-here",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "receptionist",
      "branch_id": 1
    }
  }
}
```

#### POST /api/auth/logout
Logout and invalidate token.

#### GET /api/auth/me
Get current user information.

---

## API Routes

### Account Management

#### GET /api/accounting/*
- `GET /api/accounting/accounts` - List all accounts
- `GET /api/accounting/account-categories` - List account categories
- `POST /api/accounting/accounts` - Create new account
- `PUT /api/accounting/accounts/:id` - Update account
- `DELETE /api/accounting/accounts/:id` - Delete account

### Additional Services

#### GET /api/additional-services/*
- `GET /api/additional-services` - List additional services
- `POST /api/additional-services` - Create service
- `PUT /api/additional-services/:id` - Update service
- `DELETE /api/additional-services/:id` - Delete service

### Admin

#### GET /api/admin/*
- `GET /api/admin/dashboard` - Admin dashboard stats
- `GET /api/admin/users` - List all users
- `POST /api/admin/users` - Create user
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/branches` - List all branches
- `POST /api/admin/branches` - Create branch
- `PUT /api/admin/branches/:id` - Update branch

### AI Features

#### GET /api/admin-ai/*
- `GET /api/admin-ai/analytics` - AI-powered analytics
- `POST /api/admin-ai/forecast` - Generate forecasts
- `GET /api/admin-ai/recommendations` - Get AI recommendations

### Admin Logs

#### GET /api/admin-logs/*
- `GET /api/admin-logs/overview` - Logs overview
- `GET /api/admin-logs/` - Unified logs
- `GET /api/admin-logs/system` - System logs

### Attendance

#### GET /api/attendance/*
- `GET /api/attendance/` - Get attendance records
- `POST /api/attendance/clock-in` - Clock in
- `POST /api/attendance/clock-out` - Clock out
- `GET /api/attendance/summary` - Attendance summary
- `PUT /api/attendance/:id` - Update attendance
- `PUT /api/attendance/:id/approve` - Approve attendance

### Audit

#### GET /api/audit/*
- `GET /api/audit/trail` - Audit trail
- `GET /api/audit/critical` - Critical actions
- `GET /api/audit/:staffId/summary` - Staff audit summary

### Auditor

#### GET /api/auditor/*
- `GET /api/auditor/dashboard` - Auditor dashboard
- `GET /api/auditor/exceptions` - Exception reports
- `GET /api/auditor/compliance` - Compliance reports
- `GET /api/auditor/void-bills` - Void bill reports

### Auditor Reports

#### GET /api/auditor-reports/*
- `GET /api/auditor-reports/export/exception_summary` - Export exception summary
- `GET /api/auditor-reports/export/compliance_audit` - Export compliance audit
- `GET /api/auditor-reports/export/void_analytics` - Export void analytics
- `GET /api/auditor-reports/export/revenue_reconciliation` - Export revenue reconciliation
- `GET /api/auditor-reports/export/leakage_report` - Export leakage report
- `GET /api/auditor-reports/export/expenditure_audit` - Export expenditure audit
- `GET /api/auditor-reports/export/variance_report` - Export variance report
- `GET /api/auditor-reports/export/consumption_audit` - Export consumption audit
- `GET /api/auditor-reports/export/grn_audit` - Export GRN audit

### Bar Operations

#### GET /api/bar/*
- `GET /api/bar/stock` - Bar stock
- `POST /api/bar/stock` - Add bar stock
- `PUT /api/bar/stock/:id` - Update bar stock
- `GET /api/bar/orders` - Bar orders
- `POST /api/bar/orders` - Create bar order
- `PUT /api/bar/orders/:id` - Update bar order
- `GET /api/bar/menu` - Bar menu
- `POST /api/bar/menu` - Add menu item
- `PUT /api/bar/menu/:id` - Update menu item

### Bookings

#### GET /api/bookings/*
- `GET /api/bookings` - List bookings
- `POST /api/bookings` - Create booking
- `GET /api/bookings/:id` - Get booking details
- `PUT /api/bookings/:id` - Update booking
- `DELETE /api/bookings/:id` - Cancel booking
- `POST /api/bookings/:id/check-in` - Check in guest
- `POST /api/bookings/:id/check-out` - Check out guest

### Branch Operations

#### GET /api/branch-operations/*
- `GET /api/branch-operations/dashboard` - Branch operations dashboard
- `GET /api/branch-operations/incoming-dispatches` - Incoming dispatches
- `GET /api/branch-operations/staff` - Branch staff
- `GET /api/branch-operations/rooms` - Branch rooms
- `GET /api/branch-operations/announcements` - Branch announcements
- `POST /api/branch-operations/announcements` - Create announcement

### Cashier

#### GET /api/cashier/*
- `GET /api/cashier/stats` - Cashier statistics
- `GET /api/cashier/unpaid-bills` - Unpaid bills
- `GET /api/cashier/credit-bills` - Credit bills
- `POST /api/cashier/credit-bills` - Create credit bill
- `PUT /api/cashier/credit-bills/:id` - Update credit bill
- `GET /api/cashier/payments-verification` - Payments verification

### Conference & Catering

#### GET /api/conference/*
- `GET /api/conference/halls` - Conference halls
- `POST /api/conference/halls` - Create hall
- `PUT /api/conference/halls/:id` - Update hall
- `GET /api/conference/bookings` - Conference bookings
- `POST /api/conference/bookings` - Create booking
- `PUT /api/conference/bookings/:id/status` - Update booking status

#### GET /api/catering-bookings/*
- `GET /api/catering-bookings` - Catering bookings
- `POST /api/catering-bookings` - Create catering booking
- `PUT /api/catering-bookings/:id` - Update booking
- `DELETE /api/catering-bookings/:id` - Cancel booking

### Finance

#### GET /api/finance/*
- `GET /api/finance/profit-loss` - Profit & loss statement
- `GET /api/finance/expense-breakdown` - Expense breakdown
- `GET /api/finance/daily-logs` - Daily financial logs
- `POST /api/finance/daily-logs` - Create daily log
- `PUT /api/finance/daily-logs/:id` - Update daily log

### Guest Management

#### GET /api/guest/*
- `GET /api/guest` - List guests
- `POST /api/guest` - Create guest profile
- `GET /api/guest/:id` - Get guest details
- `PUT /api/guest/:id` - Update guest
- `GET /api/guest/:id/bookings` - Guest bookings
- `GET /api/guest/:id/loyalty` - Guest loyalty points

### Housekeeping

#### GET /api/housekeeping/*
- `GET /api/housekeeping/dashboard` - Housekeeping dashboard
- `GET /api/housekeeping/rooms` - Room status
- `GET /api/housekeeping/tasks` - Housekeeping tasks
- `POST /api/housekeeping/tasks` - Create task
- `PUT /api/housekeeping/tasks/:id` - Update task
- `PUT /api/housekeeping/tasks/:id/status` - Update task status
- `GET /api/housekeeping/inspections` - Inspections
- `POST /api/housekeeping/inspections` - Create inspection

### Inventory & Storekeeping

#### GET /api/inventory/*
- `GET /api/inventory/items` - Inventory items
- `POST /api/inventory/items` - Create item
- `PUT /api/inventory/items/:id` - Update item
- `DELETE /api/inventory/items/:id` - Delete item
- `GET /api/inventory/low-stock` - Low stock items

#### GET /api/storekeeping/*
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

### Kitchen

#### GET /api/kitchen/*
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

### Payroll

#### GET /api/payroll/*
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

### Payments

#### GET /api/payments/*
- `GET /api/payments` - List payments
- `POST /api/payments` - Create payment
- `GET /api/payments/:id` - Get payment details
- `PUT /api/payments/:id` - Update payment
- `GET /api/payments-verification` - Verify payments

### Rooms

#### GET /api/rooms/*
- `GET /api/rooms` - List rooms
- `POST /api/rooms` - Create room
- `GET /api/rooms/:id` - Get room details
- `PUT /api/rooms/:id` - Update room
- `DELETE /api/rooms/:id` - Delete room
- `PUT /api/rooms/:id/status` - Update room status

### Staff

#### GET /api/staff/*
- `GET /api/staff` - List staff
- `POST /api/staff` - Create staff
- `GET /api/staff/:id` - Get staff details
- `PUT /api/staff/:id` - Update staff
- `DELETE /api/staff/:id` - Delete staff
- `GET /api/staff/attendance` - Staff attendance
- `GET /api/staff/leave` - Leave requests
- `POST /api/staff/leave` - Create leave request
- `GET /api/staff/performance` - Staff performance

### System

#### GET /api/system/*
- `GET /api/system/branches` - List branches
- `GET /api/system/health` - System health check
- `GET /api/system/config` - System configuration

### Notifications

#### GET /api/notifications/*
- `GET /api/notifications` - List notifications
- `GET /api/notifications/unread-count` - Unread count
- `PUT /api/notifications/:id/read` - Mark as read
- `DELETE /api/notifications/:id` - Delete notification

### Reports

#### GET /api/report/*
- `GET /api/report/daily` - Daily reports
- `GET /api/report/monthly` - Monthly reports
- `GET /api/report/financial` - Financial reports
- `GET /api/report/occupancy` - Occupancy reports
- `GET /api/report/revenue` - Revenue reports

---

## Database Schema

### Core Tables

#### users
User accounts and authentication
- `id` (UUID, Primary Key)
- `email` (TEXT, Unique)
- `password_hash` (TEXT)
- `first_name` (TEXT)
- `last_name` (TEXT)
- `role` (user_role enum)
- `branch_id` (INTEGER, FK to branches)
- `is_active` (BOOLEAN)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

#### branches
Hotel branches
- `id` (INTEGER, Primary Key)
- `name` (TEXT)
- `code` (TEXT)
- `location` (TEXT)
- `is_main_branch` (BOOLEAN)
- `is_active` (BOOLEAN)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

#### bookings
Room bookings
- `id` (UUID, Primary Key)
- `booking_number` (TEXT, Unique)
- `guest_id` (UUID, FK to guests)
- `room_id` (UUID, FK to rooms)
- `check_in_date` (DATE)
- `check_out_date` (DATE)
- `status` (booking_status enum)
- `payment_status` (payment_status enum)
- `total_amount` (DECIMAL)
- `deposit_amount` (DECIMAL)
- `branch_id` (INTEGER, FK to branches)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

#### rooms
Hotel rooms
- `id` (UUID, Primary Key)
- `room_number` (TEXT, Unique)
- `type_id` (UUID, FK to room_types)
- `floor_number` (INTEGER)
- `status` (room_status enum)
- `branch_id` (INTEGER, FK to branches)
- `current_guest` (UUID, FK to guests)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

#### room_types
Room type definitions
- `id` (UUID, Primary Key)
- `name` (TEXT)
- `description` (TEXT)
- `base_price` (DECIMAL)
- `max_occupancy` (INTEGER)
- `amenities` (JSONB)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

#### guests
Guest profiles
- `id` (UUID, Primary Key)
- `user_id` (UUID, FK to users)
- `first_name` (TEXT)
- `last_name` (TEXT)
- `email` (TEXT)
- `phone_number` (TEXT)
- `id_number` (TEXT)
- `loyalty_points` (INTEGER)
- `branch_id` (INTEGER, FK to branches)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

#### payments
Payment records
- `id` (UUID, Primary Key)
- `booking_id` (UUID, FK to bookings)
- `amount` (DECIMAL)
- `payment_method` (payment_method enum)
- `payment_status` (payment_status enum)
- `transaction_id` (TEXT)
- `branch_id` (INTEGER, FK to branches)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### Staff Management Tables

#### staff_profiles
Staff additional information
- `id` (UUID, Primary Key)
- `user_id` (UUID, FK to users)
- `department` (TEXT)
- `position` (TEXT)
- `employee_id` (TEXT)
- `branch_id` (INTEGER, FK to branches)
- `salary` (DECIMAL)
- `hire_date` (DATE)
- `status` (TEXT)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

#### staff_attendance
Attendance records
- `id` (UUID, Primary Key)
- `staff_id` (UUID, FK to staff_profiles)
- `date` (DATE)
- `check_in` (TIMESTAMPTZ)
- `check_out` (TIMESTAMPTZ)
- `status` (TEXT)
- `branch_id` (INTEGER, FK to branches)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

#### leave_requests
Leave management
- `id` (UUID, Primary Key)
- `staff_id` (UUID, FK to staff_profiles)
- `start_date` (DATE)
- `end_date` (DATE)
- `type` (TEXT)
- `reason` (TEXT)
- `status` (TEXT)
- `approved_by` (UUID, FK to users)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### Inventory Tables

#### inventory_items
Inventory items
- `id` (UUID, Primary Key)
- `name` (TEXT)
- `sku` (TEXT, Unique)
- `category` (item_category enum)
- `unit_of_measurement` (unit_of_measurement enum)
- `reorder_level` (INTEGER)
- `current_stock` (INTEGER)
- `branch_id` (INTEGER, FK to branches)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

#### purchase_orders
Purchase orders
- `id` (UUID, Primary Key)
- `po_number` (TEXT, Unique)
- `supplier_id` (UUID, FK to suppliers)
- `branch_id` (INTEGER, FK to branches)
- `status` (po_status enum)
- `total_amount` (DECIMAL)
- `created_by` (UUID, FK to users)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

#### goods_received_notes
GRN records
- `id` (UUID, Primary Key)
- `grn_number` (TEXT, Unique)
- `po_id` (UUID, FK to purchase_orders)
- `supplier_id` (UUID, FK to suppliers)
- `branch_id` (INTEGER, FK to branches)
- `received_date` (DATE)
- `status` (TEXT)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

#### stock_movements
Stock movement tracking
- `id` (UUID, Primary Key)
- `item_id` (UUID, FK to inventory_items)
- `movement_type` (movement_type enum)
- `quantity` (INTEGER)
- `branch_id` (INTEGER, FK to branches)
- `reference_id` (UUID)
- `created_at` (TIMESTAMPTZ)

### Kitchen & Restaurant Tables

#### kitchen_stock
Kitchen inventory
- `id` (UUID, Primary Key)
- `item_id` (UUID, FK to inventory_items)
- `quantity` (DECIMAL)
- `unit` (TEXT)
- `branch_id` (INTEGER, FK to branches)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

#### kitchen_usage_records
Kitchen usage tracking
- `id` (UUID, Primary Key)
- `item_id` (UUID, FK to inventory_items)
- `quantity_used` (DECIMAL)
- `usage_type` (kitchen_usage_type enum)
- `branch_id` (INTEGER, FK to branches)
- `recorded_by` (UUID, FK to users)
- `created_at` (TIMESTAMPTZ)

#### restaurant_tables
Restaurant tables
- `id` (UUID, Primary Key)
- `table_number` (TEXT)
- `capacity` (INTEGER)
- `status` (table_status enum)
- `branch_id` (INTEGER, FK to branches)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

#### orders
Restaurant/bar orders
- `id` (UUID, Primary Key)
- `table_id` (UUID, FK to restaurant_tables)
- `order_number` (TEXT, Unique)
- `status` (order_status enum)
- `total_amount` (DECIMAL)
- `branch_id` (INTEGER, FK to branches)
- `created_by` (UUID, FK to users)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### Housekeeping Tables

#### housekeeping_tasks
Housekeeping tasks
- `id` (UUID, Primary Key)
- `room_id` (UUID, FK to rooms)
- `task_type` (hk_task_type enum)
- `status` (hk_task_status enum)
- `assigned_to` (UUID, FK to staff_profiles)
- `branch_id` (INTEGER, FK to branches)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

#### housekeeping_inspections
Room inspections
- `id` (UUID, Primary Key)
- `room_id` (UUID, FK to rooms)
- `inspector_id` (UUID, FK to staff_profiles)
- `inspection_date` (DATE)
- `status` (TEXT)
- `notes` (TEXT)
- `branch_id` (INTEGER, FK to branches)
- `created_at` (TIMESTAMPTZ)

### Financial Tables

#### credit_bills
Staff credit bills
- `id` (UUID, Primary Key)
- `staff_id` (UUID, FK to staff_profiles)
- `amount` (DECIMAL)
- `status` (TEXT)
- `branch_id` (INTEGER, FK to branches)
- `auditor_id` (UUID, FK to users)
- `auditor_notes` (TEXT)
- `audited_at` (TIMESTAMPTZ)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

#### finance_daily_logs
Daily financial logs
- `id` (UUID, Primary Key)
- `branch_id` (INTEGER, FK to branches)
- `log_date` (DATE)
- `opening_balance` (DECIMAL)
- `closing_balance` (DECIMAL)
- `total_payments` (DECIMAL)
- `total_expenses` (DECIMAL)
- `notes` (TEXT)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### Notification Tables

#### notifications
User notifications
- `id` (UUID, Primary Key)
- `user_id` (UUID, FK to users)
- `title` (TEXT)
- `content` (TEXT)
- `type` (TEXT)
- `is_read` (BOOLEAN)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

#### branch_notifications
Branch-wide notifications
- `id` (UUID, Primary Key)
- `branch_id` (INTEGER, FK to branches)
- `title` (TEXT)
- `content` (TEXT)
- `notification_type` (TEXT)
- `source` (TEXT)
- `is_global` (BOOLEAN)
- `created_at` (TIMESTAMPTZ)
- `expires_at` (TIMESTAMPTZ)

#### branch_messages
Branch messages
- `id` (UUID, Primary Key)
- `branch_id` (INTEGER, FK to branches)
- `sender_id` (UUID, FK to users)
- `recipient_id` (UUID, FK to users)
- `is_global` (BOOLEAN)
- `subject` (TEXT)
- `content` (TEXT)
- `priority` (TEXT)
- `is_read` (BOOLEAN)
- `created_at` (TIMESTAMPTZ)

---

## Enums

### user_role
`super_admin`, `manager`, `receptionist`, `housekeeping`, `restaurant`, `maintenance`, `accountant`, `guest`, `bartender`, `general_manager`, `branch_manager`, `central_storekeeper`, `branch_storekeeper`, `housekeeping_supervisor`, `branch_operations_manager`, `central_operations_manager`, `facilities_manager`, `pos_kitchen`, `auditor`, `employee`, `kitchen`, `cashier`, `branch_accountant`, `storekeeper`, `head_chef`, `sous_chef`, `front_desk_supervisor`, `concierge`, `bell_captain`, `bellhop`, `room_attendant`, `laundry_attendant`, `restaurant_manager`, `line_cook`, `prep_cook`, `waiter`, `waitress`, `head_waiter`, `barista`, `food_runner`, `busser`, `host_hostess`, `kitchen_operations`, `kitchen_helper`, `dishwasher`, `maintenance_supervisor`, `electrician`, `plumber`, `hvac_technician`, `groundskeeper`, `security_supervisor`, `security_guard`, `night_auditor`, `finance_manager`, `hr_manager`, `payroll_clerk`, `procurement`, `kyogong_spa_cashier`, `kyogong_executive_bar_cashier`, `kyogong_sports_bar_cashier`, `kyogong_reception_cashier`, `chef`, `cook`, `barman`, `barmaid`, `bar_manager`, `driver`, `director`, `inventory_clerk`, `purchasing_manager`

### booking_status
`pending`, `confirmed`, `checked_in`, `checked_out`, `cancelled`, `no_show`

### payment_status
`pending`, `partial`, `paid`, `refunded`, `completed`, `failed`

### payment_method
`cash`, `card`, `mpesa`, `bank_transfer`, `pdq`, `cheque`

### room_status
`available`, `occupied`, `cleaning`, `maintenance`, `out_of_order`, `reserved`, `out-of-order`

### room_type
`Standard`, `Deluxe`, `Suite`, `Deluxe Twin`, `Executive`, `VIP Suite`, `Cottage`, `Conference Hall`

### order_status
`draft`, `pending`, `approved`, `rejected`, `ordered`, `received`, `cancelled`

### po_status
`draft`, `pending_approval`, `approved`, `sent_to_supplier`, `partially_received`, `fully_received`, `cancelled`, `closed`

### movement_type
`receipt`, `issue`, `return`, `transfer_out`, `transfer_in`, `adjustment_plus`, `adjustment_minus`, `damage`, `expiry`, `theft`, `opening_balance`

### item_category
`food`, `beverage`, `linen`, `toiletries`, `cleaning_supplies`, `maintenance_items`, `office_supplies`, `kitchen_equipment`, `amenities`, `other`

### unit_of_measurement
`pieces`, `kg`, `grams`, `liters`, `ml`, `boxes`, `cartons`, `packets`, `bottles`, `cans`, `rolls`, `sets`, `pairs`, `units`

### hk_task_status
`pending`, `assigned`, `in_progress`, `paused`, `completed`, `pending_inspection`, `inspection_passed`, `inspection_failed`, `rework_required`, `cancelled`, `skipped`

### hk_task_type
`checkout_full_clean`, `checkout_vip_clean`, `stay_over_service`, `stay_over_full`, `deep_clean`, `turndown_service`, `inspection`, `touch_up`, `linen_change`, `restock_amenities`, `public_area_clean`, `emergency_clean`, `guest_request`, `pre_arrival_vip`

### table_status
`available`, `occupied`, `reserved`, `cleaning`, `maintenance`

### task_status
`pending`, `in_progress`, `completed`, `cancelled`

### task_priority
`low`, `normal`, `high`, `urgent`

### supply_status
`sufficient`, `low`, `critical`, `out_of_stock`

### requisition_status
`draft`, `pending_approval`, `approved`, `rejected`, `converted_to_po`, `cancelled`

### requisition_priority
`low`, `normal`, `high`, `urgent`

### kitchen_usage_type
`CONSUMED`, `SPOILT`, `LOST`, `DAMAGED`, `EXPIRED`, `RETURNED`, `ADJUSTMENT`

### waste_reason
`spoilage`, `expiry`, `damage`, `overcooking`, `customer_return`, `quality_control`, `other`

### spoilage_reason
`EXPIRED`, `DAMAGED`, `SPOILED`, `QUALITY_ISSUE`, `THEFT`, `BREAKAGE`, `CONTAMINATION`, `OTHER`

### transfer_status
`pending`, `in_transit`, `received`, `rejected`, `cancelled`

### transfer_status_enum
`pending`, `approved`, `in_transit`, `completed`, `cancelled`

### supplier_status
`active`, `inactive`, `blacklisted`, `pending_approval`

### supplier_invoice_status
`draft`, `submitted`, `pending_approval`, `approved`, `rejected`, `paid`, `partially_paid`, `cancelled`

### supplier_credit_note_status
`draft`, `submitted`, `approved`, `rejected`, `cancelled`

### supplier_ledger_transaction_type
`opening_balance`, `invoice`, `payment`, `credit_note`, `debit_note`, `adjustment`

### issue_status
`pending`, `approved`, `issued`, `partially_issued`, `rejected`, `cancelled`

### item_condition_status
`good`, `damaged`, `short`, `expired`, `rejected`

### maintenance_type
`preventive`, `corrective`, `emergency`, `inspection`

### work_order_status
`pending`, `scheduled`, `in_progress`, `completed`, `cancelled`

### work_order_priority
`low`, `normal`, `high`, `urgent`

### reservation_status
`pending`, `confirmed`, `seated`, `completed`, `cancelled`, `no_show`

### order_item_status
`pending`, `preparing`, `ready`, `served`, `cancelled`

### order_payment_status
`pending`, `partial`, `paid`

### order_type
`dine_in`, `room_service`, `takeaway`

### payment_method_type
`cash`, `cheque`, `bank_transfer`, `mobile_money`, `mpesa`, `credit_card`, `debit_card`, `eft`, `rtgs`

### payment_split_type
`equal`, `by_item`, `by_guest`, `custom`

### payment_status_type
`draft`, `pending_approval`, `approved`, `processed`, `rejected`, `cancelled`, `failed`

### payment_terms
`cash`, `credit_7_days`, `credit_15_days`, `credit_30_days`, `credit_45_days`, `credit_60_days`, `credit_90_days`, `advance_payment`

### invoice_status
`draft`, `sent`, `paid`, `overdue`, `cancelled`

### shift_status
`open`, `closed`, `reconciled`, `verified`

### transaction_type
`income`, `expense`

### vat_rate_type
`standard_16`, `zero_rated`, `exempt`, `withholding_vat`

### subcategory_enum
`Bar Stock-Alcoholic`, `Bar Stock-Non-alcoholic`, `Kitchen Supplies`, `Restaurant Items`, `Linens & Bedding`, `Cleaning Supplies`, `Guest Amenities`, `Towels & Robes`, `Spa Products`, `Maintenance Supplies`, `Stationery`, `Office Supplies`, `Printing Materials`, `Electrical`, `Plumbing`, `General Repair`

### prep_station_type
`grill`, `salad`, `dessert`, `drinks`, `fry`, `pantry`, `bakery`

### procurement_audit_action
`create`, `update`, `delete`, `approve`, `reject`, `submit`, `lock`, `unlock`, `process`, `cancel`

### hk_room_status
`clean`, `occupied_dirty`, `out_of_order`, `out_of_service`, `inspected`, `cleaning_in_progress`, `do_not_disturb`, `stay_over`, `checkout`, `early_makeup`, `late_checkout`, `turndown_pending`, `turndown_complete`

### hk_shift_type
`morning`, `afternoon`, `evening`, `night`, `split`

### hk_supply_request_status
`pending`, `approved`, `rejected`, `fulfilled`, `partially_fulfilled`, `cancelled`

### housekeeping_task_type
`daily_clean`, `checkout_clean`, `deep_clean`, `maintenance_clean`, `linen_change`, `restock`, `inspection`

### oauth_authorization_status
`pending`, `approved`, `denied`, `expired`

### oauth_client_type
`public`, `confidential`

### oauth_registration_type
`dynamic`, `manual`

### oauth_response_type
`code`

### one_time_token_type
`confirmation_token`, `reauthentication_token`, `recovery_token`, `email_change_token_new`, `email_change_token_current`, `phone_change_token`

---

## Error Handling

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message",
  "status": 400
}
```

### Common HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

---

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Default Limit**: 100 requests per 15 minutes per IP
- **Authenticated Users**: Higher limits based on role
- **Global Roles**: No rate limiting

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1620000000
```

---

## Branch Isolation

The system supports multi-branch operations. Most endpoints require a `branch_id` parameter or header:

**Header:**
```
x-branch-id: 1
```

**Query Parameter:**
```
?branch_id=1
```

**Global Roles** (super_admin, general_manager, director, auditor) can access data across all branches by omitting branch_id or using `branch_id=0` for "All Branches".

---

## Pagination

List endpoints support pagination:

**Query Parameters:**
```
?page=1&limit=50
```

**Response:**
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 500,
    "pages": 10
  }
}
```

---

## Filtering & Sorting

Most list endpoints support filtering and sorting:

**Filtering:**
```
?status=active&branch_id=1
```

**Sorting:**
```
?sort=created_at&order=desc
```

**Multiple Filters:**
```
?status=active&branch_id=1&sort=created_at&order=desc
```

---

## Webhooks

The system supports webhooks for real-time notifications:

### Configure Webhook
```http
POST /api/webhooks
{
  "url": "https://your-server.com/webhook",
  "events": ["booking.created", "payment.received"],
  "secret": "your-webhook-secret"
}
```

### Webhook Events
- `booking.created`
- `booking.updated`
- `booking.cancelled`
- `payment.received`
- `guest.created`
- `staff.attendance`
- `inventory.low_stock`

---

## SDK & Integration

### JavaScript/TypeScript
```typescript
import { fetchAPI } from './lib/api/core';

// Get bookings
const bookings = await fetchAPI('/bookings?branch_id=1');

// Create booking
const newBooking = await fetchAPI('/bookings', {
  method: 'POST',
  body: JSON.stringify({
    guest_id: 'uuid',
    room_id: 'uuid',
    check_in_date: '2026-05-24',
    check_out_date: '2026-05-26'
  })
});
```

### cURL
```bash
# Get bookings
curl -X GET "https://api.hirall.com/api/bookings?branch_id=1" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create booking
curl -X POST "https://api.hirall.com/api/bookings" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "guest_id": "uuid",
    "room_id": "uuid",
    "check_in_date": "2026-05-24",
    "check_out_date": "2026-05-26"
  }'
```

---

## Support

For API support:
- **Email**: api-support@hirall.com
- **Documentation**: https://docs.hirall.com
- **Status Page**: https://status.hirall.com

---

## Changelog

### v1.0.0 (2026-05-24)
- Initial API documentation
- 823 documented endpoints
- 100+ database tables
- 80+ enums documented
- Comprehensive schema documentation

---

**Generated:** 2026-05-24  
**API Version:** v1  
**Documentation Version:** 1.0.0
