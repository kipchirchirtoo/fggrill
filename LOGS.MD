# 📊 Famous Gates Management System: Audit & Log Map

This document provides a comprehensive overview of the system's logging, auditing, and tracking infrastructure. It is designed for system engineers and auditors to understand how data integrity and accountability are maintained.

## 1. Security & Authentication Tracking

The system monitors user access via combined database timestamps and real-time attendance triggers.

| Mechanism | Source | Storage | Description |
|-----------|--------|---------|-------------|
| **Last Login** | `auth.controller.ts` | `users.last_login` | Updated on every successful Email/PIN login. |
| **Password History** | `auth.controller.ts` | `users.password_changed_at` | Tracks when credentials were last rotated. |
| **POS PIN Access** | `pos-login` route | `staff_attendance` | Automatically clocks-in staff when they enter their R/B/C PIN. |
| **Attendance Log** | `staff_attendance` | Table | Logs `user_id`, `clock_in`, `clock_out`, `status`, and `notes`. |

---

## 2. Global Audit Trails (Immutable)

These tables use JSONB snapshots to record state changes, providing a complete history for forensics.

### 🛡️ General Audit Trail (`audit_trail`)
Tracks manual data modifications across most entities.
- **Fields**: `user_id`, `action`, `entity_type`, `entity_id`, `old_values`, `new_values`, `ip_address`, `performed_at`.
- **Mechanism**: Controller-level logging.

### 📦 SCM Audit (`store_procurement_audit_logs`)
High-integrity tracking for procurement transactions.
- **Actions**: Approve, Reject, Submit, Process, Lock, etc.
- **Fields**: `user_email`, `entity_reference`, `changed_fields`, `ip_address`.
- **Compliance**: Implemented with 7-year retention logic (RLS-locked).

### 🏷️ Inventory Audit (`stock_take_audit_log`)
Specifically for tracking the stock-take workflow.
- **Tracking**: Status changes (Draft -> Submitted -> Verified), notification delivery results.

---

## 3. Financial & Operational Reconciliation

Periodic logs created during daily business closures.

### 🌙 Night Audit (`audit_night_sessions`)
Records the "Financial Close" for each day.
- **Data Point**: `total_revenue`, `total_payments`, `occupancy_percentage`, `ADR`, `RevPAR`.
- **Status**: `in_progress`, `completed`.

### ⚠️ Audit Exceptions (`audit_exceptions`)
Specialized log for financial anomalies.
- **Triggers**: Large voids, unexpected discounts, or manual price overrides.
- **Resolution**: Requirement for `resolved_by` and `resolution_notes`.

### 💵 Cashier Logbooks (`cashier_logbooks`)
Daily records for reception and bar cashiers.
- **Reconciliation**: `opening_float`, `closing_float`, `total_mpesa`, `total_swipe`.
- **Line Items**: Linked in `cashier_logbook_lines` for specific bill references.

---

## 4. Module-Specific History Tables

Dynamic tracking of entity state lifecycles.

- **🏨 Front Office**:
    - `room_status_history`: Tracks rooms from `dirty` -> `inspected` -> `available`.
    - `booking_status_history`: Tracks bookings from `confirmed` -> `checked_in` -> `checked_out`.
- **🍽️ F&B**:
    - `restaurant_waste_log`: Tracks loss and shrink (reason, quantity, user).
- **💸 Finance**:
    - `petty_cash_transactions`: Detailed approval trail for cash disbursements.

---

## 5. Application System Logs (Winston)

Real-time execution logs for backend services, stored on the server file system.

- **Location**: `/backend/logs/*.log`
- **File Map**:
    - `error.log`: Critical application errors only.
    - `combined.log`: All events (Info, Warn, Debug, Error).
    - `exceptions.log`: Uncaught process exceptions.
    - `rejections.log`: Unhandled Promise rejections.
- **Configuration**:
    - **Max Size**: 5MB per file.
    - **Retention**: Last 5 rotation cycles.
    - **Format**: JSON-like with Timestamps and Metadata.

---

## 🔍 How to Audit a Specific Action

1. **Check UI Verification**: Look for `audited_at` and `auditor_id` on the entity record (Orders, Invoices).
2. **Search Database**: Query the `audit_trail` or module-specific audit table using `entity_id`.
3. **Review Server Logs**: Check `combined.log` for the specific timestamp to see trace logs.
