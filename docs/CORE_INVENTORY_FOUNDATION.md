# Core Inventory Foundation

## Current Map

Backend inventory is currently split across several modules:

- `backend/src/controllers/inventory.controller.ts` uses `simple_items` for master/catalog style item reads and writes.
- `backend/src/services/branch-inventory.service.ts` updates `branch_stock` and writes `branch_stock_movements`.
- `backend/src/services/enterprise-inventory.service.ts` handles department issue, POS consumption, production, stock-take review, and writes `department_inventory_ledger` plus `inventory_audit_log`.
- Storekeeping controllers under `backend/src/controllers/storekeeping/` handle branch GRN, purchase orders, central/branch stock, dispatch notes, supplier invoices, and payments.
- POS controllers under `backend/src/controllers/outlet-pos.controller.ts` post POS orders and call enterprise inventory mapping logic.
- Auditor/report modules read many of those tables but do not own inventory truth.

Flutter inventory screens are spread across:

- `famous_gates_app/lib/features/store/`
- `famous_gates_app/lib/features/branch_storekeeper/`
- `famous_gates_app/lib/features/branch_accountant/`
- `famous_gates_app/lib/features/auditor/`
- `famous_gates_app/lib/features/pos/`
- `famous_gates_app/lib/features/reports/`

Python services already include report and receipt generation, but not inventory truth.

## Missing From Core Inventory Spec

Existing tables track stock, but the truth is fragmented. The missing shared foundation is:

- One location model for central, branch, department, POS, supplier, transit, production, waste, adjustment, and reservation locations.
- One item catalog bridge that can reference existing `simple_items` and later `store_items`.
- One append-only movement ledger with source, destination, reason, document reference, actor, and reversal support.
- One reservation table that reduces available quantity without reducing current quantity.
- Batch, lot, and expiry tracking attached to the movement ledger.
- One balance materialization layer computed from movements/reservations, not directly mutated as truth.
- One audit and alert model for every inventory action.

## Migration Plan

Create new foundation tables instead of rewriting legacy tables immediately:

- `inventory_locations`
- `inventory_item_catalog`
- `inventory_batches`
- `inventory_movements`
- `inventory_reservations`
- `inventory_balances`
- `inventory_audit_logs`
- `inventory_alerts`

Extend later workflow work by routing existing flows into the new ledger, then deprecating direct mutations:

- Replace direct `branch_stock.quantity` updates with ledger-backed posting.
- Keep `branch_stock` as compatibility/materialized branch stock until all Flutter screens migrate.
- Keep `branch_stock_movements`, `department_inventory_ledger`, and `inventory_audit_logs` as legacy/audit mirrors during migration.
- Do not remove existing tables during this foundation work.

## State Machines

Requisition:
`draft -> submitted -> approved -> reserved -> packed -> dispatched -> received -> closed`
Rejected/cancelled can exit before reservation. Partial dispatch keeps `partially_dispatched`.

Dispatch:
`draft -> packed -> in_transit -> received -> reconciled -> closed`
Exceptions: `short_shipped`, `damaged`, `rejected`.

Receipt:
`draft -> posted -> partially_received -> fully_received -> ready_to_bill -> billed -> paid_closed`
Only GRN posting changes received quantity.

Department issue:
`requested -> approved -> reserved -> issued -> completed`
Insufficient stock: `pending_balance`. Partial issue creates completed issued quantity plus pending balance.

POS production:
`ordered -> mapped -> reserved -> consumed -> produced -> served -> closed`
Voids/reversals must create reversal movements.

Stock take:
`draft -> submitted_to_accountant -> accountant_reviewed -> submitted_to_auditor -> locked -> adjustment_posted -> closed`

Adjustment:
`draft -> submitted -> approved -> posted -> closed`
Rejected adjustments never alter stock.

## Done Criteria

- Balances can be recomputed from `inventory_movements` and `inventory_reservations`.
- Reservations reduce available quantity only.
- Batch/lot/expiry data can be stored and searched.
- Inventory actions write audit logs automatically.
- Low/out-of-stock and invalid attempt alerts can be generated.
- New API endpoints exist for balances, movements, reservations, alerts, locations, and recompute.
