# Billing System Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        UNIFIED BILLING SYSTEM                    │
│                                                                   │
│  Single OPEN bill → Multiple orders → Partial payments → PAID   │
└─────────────────────────────────────────────────────────────────┘
```

## Database Schema

```
┌──────────────────────┐
│  restaurant_bills    │  ← Main bill entity
├──────────────────────┤
│ id (PK)              │
│ bill_number          │  BILL2602180001
│ table_number         │  T-05
│ room_number          │  R-201
│ guest_name           │  John Doe
│ status               │  OPEN/CLOSED/PAID/CANCELLED
│ subtotal             │  1000.00
│ vat_amount           │  160.00 (16%)
│ service_charge       │  100.00
│ total_amount         │  1260.00
│ paid_amount          │  500.00
│ balance              │  760.00
│ vat_rate             │  16.00
│ created_at           │
│ closed_at            │
│ paid_at              │
└──────────────────────┘
         │
         │ 1:N
         ↓
┌──────────────────────┐
│ restaurant_orders    │  ← Multiple orders per bill
├──────────────────────┤
│ id (PK)              │
│ bill_id (FK)         │  ← Links to bill
│ order_number         │  ORD2602180001
│ department           │  restaurant/bar/pool_bar/spa
│ total_amount         │  500.00
│ created_by           │  waiter-uuid
│ created_at           │  2026-02-18 10:00:00
└──────────────────────┘
         │
         │ 1:N
         ↓
┌──────────────────────┐
│restaurant_order_items│  ← Items in each order
├──────────────────────┤
│ id (PK)              │
│ order_id (FK)        │
│ menu_item_id         │
│ quantity             │  2
│ unit_price           │  250.00
│ total_price          │  500.00
└──────────────────────┘

┌──────────────────────┐
│restaurant_bill_      │  ← Payment records
│     payments         │
├──────────────────────┤
│ id (PK)              │
│ bill_id (FK)         │  ← Links to bill
│ payment_number       │  PAY2602180001
│ amount               │  500.00
│ payment_method       │  CASH/MPESA/CARD
│ payment_reference    │  QAB7C8D9E0
│ paid_at              │  2026-02-18 11:00:00
│ cashier_id           │  cashier-uuid
│ reversed             │  false
│ reversed_at          │
│ reversal_reason      │
└──────────────────────┘

┌──────────────────────┐
│restaurant_bill_      │  ← Audit trail
│   audit_log          │
├──────────────────────┤
│ id (PK)              │
│ bill_id (FK)         │
│ action               │  created/order_added/payment_re