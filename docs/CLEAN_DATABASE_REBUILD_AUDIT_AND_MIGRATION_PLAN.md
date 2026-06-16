# Clean Database Rebuild Audit and Migration Plan

Date: 2026-06-14  
Scope: `backend`, `frontend`, `famous_gates_app`, `python-services`, migrations, and configuration files.

This document is the first rebuild blueprint for moving FamousGate Hotels to a clean database. It is based on static code analysis of the active workspace. It does not expose secrets from `.env` files.

## Executive Summary

The current system is not suffering from one broken migration. It has accumulated multiple competing data models for the same business domains. The codebase now contains:

- 108 backend route modules.
- 174 backend controller files.
- 53 backend service files.
- 85 Flutter feature screen/repository files.
- 315 migration/schema files across several roots.
- 2,394 schema-changing statements across migrations.
- 3,891 direct data-access references across backend, frontend, Flutter, and Python services.

The strongest structural risk is that the application has several versions of the same truth:

- `simple_items`, `inventory_items`, `inventory_item_catalog`, branch stock tables, store stock tables, and POS stock tables all try to describe inventory.
- `stock_movements`, `branch_stock_movements`, `inventory_movements`, department ledgers, kitchen ledgers, and POS movement fields all try to describe quantity movement.
- `payments`, `branch_payments`, `finance_transactions`, `store_supplier_payments`, cashier payments, POS payments, and invoice payment tables all try to describe money movement.
- `audit_logs`, `audit_trail`, `audit_exceptions`, `financial_audit_logs`, `inventory_audit_logs`, and module-specific audit fields all try to describe auditing.

The correct rebuild is not to “fix” the old database. The correct rebuild is to create a new canonical schema, migrate cleaned data into it, adapt API repositories against the canonical schema, and keep the old DB read-only until the new DB passes module-level verification.

## Phase 1: Codebase Discovery and Audit

### Tech Stack Discovered

Backend:

- Node.js / Express / TypeScript.
- Database access is split between Supabase JavaScript client and raw PostgreSQL `pg.Pool`.
- Supabase service role clients are defined in both `backend/src/config/database.ts` and `backend/src/config/supabase.ts`.
- Raw SQL pool is defined in `backend/src/db.ts` using `DATABASE_URL`.
- API routes are mounted under `/api` from `backend/src/routes/index.ts`.
- Controllers and services use a mixture of Supabase `.from(...)`, RPC calls, and raw SQL.

Frontend:

- Next.js 14 App Router / React / TypeScript.
- Uses `fetchAPI()` and modular API clients under `frontend/src/lib/api`.
- Also contains direct Supabase client usage for realtime and some data reads.
- `frontend/src/lib/supabase.ts` has a hardcoded fallback Supabase URL if env values are missing. That is dangerous during cutover.

Flutter app:

- Flutter desktop/mobile app in `famous_gates_app`.
- Uses Dio REST clients.
- Main API URL is configured through `MAIN_API_URL`, defaulting to production `https://api.hirall.com/api`.
- Python service URL is configured through `PYTHON_SERVICES_URL`, defaulting to `https://services.hirall.com`.
- Most feature modules use repositories under `lib/features/**/data`.

Python services:

- Flask/FastAPI-style microservices under `python-services`.
- Contains Supabase and `DATABASE_URL` environment keys.
- Used for reports, branded PDFs, pricing, and communication.

Database:

- Supabase PostgreSQL.
- Current app uses both PostgREST-style access and direct SQL.
- Branch isolation is usually implemented by `branch_id`, but the code mixes string, integer, UUID, and text-based references in several flows.

### Configuration Structure

Backend environment keys include:

- API/runtime: `NODE_ENV`, `PORT`, `FRONTEND_URL`.
- Database: `DATABASE_URL`, `SUPABASE_PROJECT_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`.
- Auth: `JWT_SECRET`, `JWT_REFRESH_SECRET`, expiry values.
- Python/report services: `PYTHON_SERVICE_URL`, `REPORTS_SERVICE_URL`, report/pricing/template/barcode service URLs.
- Payments: M-Pesa, Stripe, Paystack keys.
- Email/SMS: SMTP, Brevo, Twilio keys.

Frontend environment keys include:

- `NEXT_PUBLIC_API_URL`.
- `NEXT_PUBLIC_PYTHON_SERVICE_URL`.
- `NEXT_PUBLIC_REPORTS_SERVICE_URL`.
- `NEXT_PUBLIC_SUPABASE_URL`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Flutter environment keys include:

- `MAIN_API_URL`.
- `PYTHON_SERVICES_URL`.
- `APP_ENV`.

Cutover risk: any missing env variable can silently fall back to a production or old Supabase URL in some clients. The new database must be introduced with explicit old/new environment variables and no hardcoded fallbacks.

### API and Data Flow Map

Primary backend route groups found:

- Auth and users: `/api/auth`, `/api/users`, `/api/staff`, `/api/payroll`, `/api/attendance`.
- Reception and hotel: `/api/bookings`, `/api/rooms`, `/api/guests`, `/api/folios`, `/api/conference`, `/api/catering`, `/api/catering-bookings`.
- POS and F&B: `/api/pos`, `/api/restaurant`, `/api/bar`, `/api/kitchen`, `/api/kyogong`, `/api/menu-pricing`.
- Inventory and storekeeping: `/api/store`, `/api/storekeeping`, `/api/procurement`, `/api/inventory`, `/api/inventory-foundation`, `/api/inventory-governance`, `/api/dispatch`, `/api/stock-takes`, `/api/kitchen-ledger`.
- Finance/accounting: `/api/finance`, `/api/accounting`, `/api/cashier`, `/api/payments`, `/api/branch-payments`, `/api/banking`, `/api/credit`, `/api/suppliers`.
- Audit/director/admin: `/api/audit`, `/api/auditor`, `/api/reports/auditor`, `/api/auditor-reports`, `/api/security`, `/api/superadmin`, `/api/admin-logs`, `/api/admin-ai`, `/api/lina`.
- Reports and documents: `/api/reports`, `/api/receipts`, `/api/document-templates`, `/api/barcode`.

Data enters the system through three main paths:

1. Flutter/Frontend REST call -> Express route -> controller/service -> Supabase or raw SQL.
2. Frontend direct Supabase/realtime subscription -> Supabase anon client.
3. Backend/Python service -> Supabase or raw DB connection for reports/PDFs.

Current weakness: not every data change passes through one canonical service. Some modules mutate operational tables directly; some write helper ledgers; newer inventory modules write `inventory_movements`; older modules write module-specific movements. That makes the database impossible to audit reliably.

### Schema Reconciliation Findings

Migration roots found:

- `database/migrations`
- `backend/src/database/migrations`
- `backend/supabase/migrations`
- `backend/src/migrations`

These roots contain overlapping table definitions and repeated repair migrations. The file `backend/supabase/migrations/999999_canonical_tables_consolidation.sql` is not a real canonical rebuild; it only patches `pos_shift_orders.order_type`.

Examples of duplicated table definitions from migration scans:

- 4 definitions: `kitchen_stock`, `kitchen_usage`, `kitchen_wastage`, `kitchen_stock_ledger`, `kitchen_requisitions`, `recipe_items`, `recipes`, `staff_shifts`, `staff_loans`.
- 3 definitions: `simple_items`, `simple_shop_items`, `simple_app_config`, `stock_requests`, `stock_request_items`, `stock_movements`, `branch_stock`, `branch_stock_movements`, `inventory_transfers`, `inventory_transfer_items`, `audit_logs`, `expenses`, `rooms`, `room_types`, `reservations`.
- 2 definitions: `inventory_items`, `inventory_item_catalog`, `inventory_locations`, `inventory_movements`, `inventory_balances`, `inventory_reservations`, `inventory_audit_logs`, `inventory_alerts`, `payments`, `bookings`, `restaurant_orders`, `restaurant_order_items`, `restaurant_menu_items`, `restaurant_menu_categories`, `pos_transactions`, `cashier_logbooks`, `branches`, `users`.

Examples of duplicated enum/type definitions:

- `payment_status`
- `payment_method`
- `user_role`
- `room_status`
- `reservation_status`
- `order_status`
- `invoice_status`
- `transaction_type`
- `waste_reason`

## Phase 2: Gap and Bad Stuff Diagnosis

### Data Layer Technical Debt

1. Multiple database clients.

The backend has at least three database entry points:

- Supabase client in `backend/src/config/database.ts`.
- Supabase client in `backend/src/config/supabase.ts`.
- Raw `pg.Pool` in `backend/src/db.ts`.

This creates inconsistent behavior around transactions, RLS, branch filtering, error handling, and schema visibility.

2. Several canonical truths for inventory.

Inventory is split across legacy and newer tables:

- `simple_items`
- `inventory_items`
- `inventory_item_catalog`
- `branch_stock`
- `store_inventory`
- `restaurant_bar_inventory`
- `pos_outlet_items`
- `pos_shift_stock_counts`
- `inventory_balances`

Only one table should be the item catalog, and only one ledger should be the source of quantity movement.

3. Several movement ledgers.

Movement intent appears in:

- `stock_movements`
- `branch_stock_movements`
- `inventory_movements`
- `department_inventory_ledger`
- `kitchen_stock_ledger`
- `pos_shift_stock_counts`
- module-specific quantity fields

This is why stock can drift. New database rule: no stock quantity changes without a row in a single canonical movement journal.

4. Broken implied foreign keys.

Recent runtime errors already show schema/code mismatch:

- UUID compared to text/string fields.
- Missing tables such as `department_inventory_ledger`.
- Missing columns such as `produced_stock`.
- Missing Supabase relationship hints between orders and users.
- Enum values in code not accepted by DB constraints, such as invalid status values.

5. Direct frontend Supabase access.

The Next frontend contains direct Supabase client usage. For the clean DB, operational writes should go through the backend API so branch isolation, audit logging, and transactions are consistent.

6. Backup and experimental files in active source tree.

The backend source tree includes `.backup`, `.backup2`, and `.new` files near active controllers/routes. These are not necessarily compiled, but they are dangerous during code search, refactors, and future migrations.

7. Status sprawl.

Many modules define their own status values for the same lifecycle concepts:

- approval
- payment
- receipt
- dispatch
- stock take
- audit review

New database rule: each lifecycle needs one state machine and one status vocabulary.

8. Audit is fragmented.

Auditing exists, but not as one universal audit/event model. The rebuild should separate:

- business document events
- inventory movement events
- financial journal events
- user/security audit events
- review/approval tasks

### Likely Dead or Redundant Columns

Static code can identify risky redundant columns, but exact dead-column proof requires live schema introspection. The likely cleanup targets are:

- Repeated denormalized item names/SKUs where a canonical item FK should exist.
- Duplicate `status` and `workflow_status` fields on the same table unless each has a strict purpose.
- Module-specific totals that can be computed from line tables or journals.
- Raw JSON fields used to store relational data, especially item arrays in orders, POs, stock takes, and reports.
- Legacy source columns kept only for migration compatibility after a canonical FK exists.

The new database should still keep selective denormalized display fields for immutable documents, such as invoice line item names and prices, because financial documents must preserve history even if the catalog changes later.

## Phase 3: Target State Design

### Design Rules

1. One canonical table per business concept.
2. Every write that changes stock creates an inventory movement.
3. Every money movement creates a financial journal entry or payment ledger entry.
4. Every controlled action creates an audit event.
5. `branch_id` is always an integer FK to `branches(id)`.
6. All operational document IDs are UUIDs.
7. Human document numbers are unique display keys, never join keys.
8. No direct frontend writes to operational tables.
9. No silent JSON blobs for line items when line tables are required.
10. No duplicate enum/type definitions across migrations.

### Recommended Canonical Domains

Identity and organization:

- `branches`
- `departments`
- `users`
- `staff_profiles`
- `user_branch_roles`
- `role_permissions`

Hotel/reception:

- `guests`
- `room_types`
- `rooms`
- `reservations`
- `bookings`
- `booking_guests`
- `folios`
- `folio_charges`
- `folio_payments`

POS and menu:

- `pos_outlets`
- `pos_outlet_items`
- `pos_shifts`
- `pos_orders`
- `pos_order_items`
- `pos_payments`
- `pos_void_requests`
- `menu_categories`
- `menu_items`
- `menu_item_prices`
- `recipes`
- `recipe_ingredients`

Inventory:

- `inventory_items`
- `inventory_locations`
- `inventory_batches`
- `inventory_balances`
- `inventory_movements`
- `inventory_reservations`
- `inventory_adjustment_requests`
- `inventory_adjustment_items`
- `inventory_alerts`

Stock take and outlet reconciliation:

- `stock_take_sessions`
- `stock_take_lines`
- `outlet_trading_sheets`
- `outlet_trading_sheet_lines`

Production and outlet stock:

- `production_runs`
- `production_inputs`
- `production_outputs`
- `outlet_stock_balances`
- `outlet_stock_movements`

Procurement and supplier finance:

- `suppliers`
- `purchase_orders`
- `purchase_order_items`
- `goods_receipts`
- `goods_receipt_items`
- `supplier_invoices`
- `supplier_invoice_items`
- `supplier_payments`
- `supplier_payment_allocations`
- `supplier_ledger_entries`

Branch requisition, packing, dispatch, receipt:

- `branch_requisitions`
- `branch_requisition_items`
- `packing_lists`
- `packing_list_items`
- `dispatches`
- `dispatch_items`
- `receipt_verifications`
- `receipt_verification_items`

Department request and issue:

- `department_requests`
- `department_request_items`
- `material_issue_notes`
- `material_issue_note_items`

Finance and accounting:

- `chart_of_accounts`
- `journal_entries`
- `journal_lines`
- `bank_accounts`
- `bank_transactions`
- `cashier_shifts`
- `cashier_transactions`
- `cashier_logbooks`
- `branch_payments`
- `payment_receipts`

Audit and workflow:

- `audit_events`
- `approval_tasks`
- `notifications`
- `documents`
- `document_files`
- `governance_reviews`

HR:

- `attendance_logs`
- `leave_requests`
- `payroll_runs`
- `payroll_items`
- `staff_loans`
- `staff_advances`

### Canonical DDL Foundation

The full DDL should be generated as a new baseline migration set. Below is the core shape and conventions.

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE branches (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT NOT NULL DEFAULT 'units',
  is_stockable BOOLEAN NOT NULL DEFAULT TRUE,
  is_perishable BOOLEAN NOT NULL DEFAULT FALSE,
  tracking_mode TEXT NOT NULL DEFAULT 'none'
    CHECK (tracking_mode IN ('none', 'batch', 'lot', 'expiry', 'serial')),
  default_cost NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (default_cost >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE inventory_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  location_type TEXT NOT NULL CHECK (location_type IN (
    'central_store',
    'branch_store',
    'department',
    'pos_outlet',
    'production',
    'transit',
    'supplier',
    'customer',
    'waste',
    'adjustment'
  )),
  department_id UUID,
  outlet_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE inventory_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(id),
  batch_number TEXT,
  lot_number TEXT,
  expiry_date DATE,
  supplier_id UUID,
  unit_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  received_document_type TEXT,
  received_document_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (batch_number IS NOT NULL OR lot_number IS NOT NULL OR expiry_date IS NOT NULL)
);

CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_number TEXT NOT NULL UNIQUE,
  branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN (
    'purchase_receipt',
    'grn_posting',
    'branch_requisition_dispatch',
    'central_store_packing',
    'department_issue',
    'pos_issue',
    'production_consumption',
    'production_output',
    'stock_take_adjustment',
    'return',
    'write_off',
    'transfer',
    'reservation',
    'reservation_release'
  )),
  item_id UUID NOT NULL REFERENCES inventory_items(id),
  batch_id UUID REFERENCES inventory_batches(id),
  source_location_id UUID NOT NULL REFERENCES inventory_locations(id),
  destination_location_id UUID NOT NULL REFERENCES inventory_locations(id),
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  reason TEXT NOT NULL,
  document_type TEXT NOT NULL,
  document_id UUID,
  document_number TEXT,
  actor_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE inventory_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id),
  location_id UUID NOT NULL REFERENCES inventory_locations(id),
  batch_id UUID REFERENCES inventory_batches(id),
  current_quantity NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (current_quantity >= 0),
  reserved_quantity NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  damaged_quantity NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (damaged_quantity >= 0),
  expired_quantity NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (expired_quantity >= 0),
  available_quantity NUMERIC(14,3) GENERATED ALWAYS AS (
    current_quantity - reserved_quantity - damaged_quantity - expired_quantity
  ) STORED,
  last_movement_id UUID REFERENCES inventory_movements(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (item_id, location_id, batch_id),
  CHECK (reserved_quantity <= current_quantity),
  CHECK (current_quantity - reserved_quantity - damaged_quantity - expired_quantity >= 0)
);
```

### What Gets Removed

Remove or archive after ETL:

- Duplicate item catalogs: `simple_items`, old `inventory_items` variants, `inventory_item_catalog` if replaced by canonical `inventory_items`.
- Duplicate movement ledgers once data is merged: `stock_movements`, `branch_stock_movements`, kitchen-specific stock ledgers, department-specific ad hoc ledgers.
- Duplicate stock tables once balances are rebuilt: `branch_stock`, `store_inventory`, legacy POS stock count-only tables.
- Redundant status columns where a canonical state machine exists.
- Backup/new experimental source files from active trees.
- Frontend direct operational Supabase writes.

Keep as archive/read-only:

- Historical financial documents.
- Historical receipts/invoices/GRNs.
- Original document PDF references.
- Legacy audit logs, mapped into `audit_events` where possible.

The app will still function because every current business workflow maps into a cleaner canonical equivalent:

- Old POs -> `purchase_orders`.
- Old GRNs -> `goods_receipts`.
- Old supplier invoices -> `supplier_invoices`.
- Old stock requests -> `branch_requisitions`.
- Old dispatch notes -> `dispatches`.
- Old stock takes -> `stock_take_sessions`.
- Old POS orders -> `pos_orders`.
- Old stock movements -> `inventory_movements`.

## Phase 4: Execution and Migration Plan

### 1. Environment Setup

Add old/new database variables side by side:

```bash
DATABASE_URL_OLD=...
DATABASE_URL_NEW=...
SUPABASE_URL_OLD=...
SUPABASE_SERVICE_ROLE_KEY_OLD=...
SUPABASE_URL_NEW=...
SUPABASE_SERVICE_ROLE_KEY_NEW=...
MIGRATION_MODE=dual_read
```

Then update backend database config to support explicit target selection:

- `backend/src/config/database.ts`
- `backend/src/config/supabase.ts`
- `backend/src/db.ts`

Rules:

- No hardcoded Supabase fallback URLs.
- No frontend direct writes.
- All cutover testing uses `DATABASE_TARGET=new`.
- Old DB stays read-only after final ETL.

### 2. Build the Clean Baseline

Create a new migration directory:

```text
database/clean-baseline/
```

Recommended file order:

```text
001_extensions_and_helpers.sql
002_identity_and_branches.sql
003_hotel_reception.sql
004_pos_menu_and_outlets.sql
005_inventory_core.sql
006_procurement_supplier_finance.sql
007_requisition_dispatch_receipt.sql
008_stock_take_production_adjustment.sql
009_finance_accounting.sql
010_audit_workflow_documents.sql
011_indexes_and_rls.sql
012_seed_reference_data.sql
```

Do not copy old migrations into the clean database. They are the problem.

### 3. Data Cleaning and Extraction

Use staging tables in the new DB:

```sql
CREATE SCHEMA IF NOT EXISTS migration_stage;
CREATE SCHEMA IF NOT EXISTS migration_audit;

CREATE TABLE migration_audit.id_map (
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_table TEXT NOT NULL,
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source_table, source_id, target_table)
);
```

ETL order:

1. Branches and users.
2. Staff profiles and roles.
3. Guests, rooms, room types.
4. Suppliers and vendors.
5. Inventory item catalog.
6. Locations: central store, branch stores, departments, POS outlets, production areas.
7. Opening inventory balances rebuilt from trusted source tables.
8. Open POs, GRNs, supplier invoices, supplier payments.
9. Open reservations/bookings/folios.
10. Open POS shifts/orders.
11. Stock requests, dispatches, receipt verification.
12. Stock takes and adjustments.
13. Audit/event history and documents.

Example dedupe for inventory catalog:

```sql
INSERT INTO inventory_items (sku, name, category, unit, default_cost, metadata)
SELECT DISTINCT ON (canonical_sku)
  canonical_sku,
  item_name,
  category,
  unit,
  default_cost,
  jsonb_build_object('legacy_sources', legacy_sources)
FROM (
  SELECT
    COALESCE(NULLIF(sku, ''), NULLIF(item_id, ''), UPPER(regexp_replace(name, '\s+', '-', 'g'))) AS canonical_sku,
    COALESCE(item_name, name, description, sku, item_id) AS item_name,
    category,
    COALESCE(unit_of_measure, unit, 'units') AS unit,
    COALESCE(unit_cost, cost_price, buying_price, 0) AS default_cost,
    ARRAY[source_table] AS legacy_sources,
    updated_at
  FROM migration_stage.legacy_items_union
) x
ORDER BY canonical_sku, updated_at DESC NULLS LAST;
```

Example branch stock balance rebuild:

```sql
INSERT INTO inventory_balances (branch_id, item_id, location_id, current_quantity, reserved_quantity, damaged_quantity, expired_quantity)
SELECT
  s.branch_id,
  m.target_id::uuid AS item_id,
  l.id AS location_id,
  SUM(GREATEST(s.quantity, 0)) AS current_quantity,
  0,
  0,
  0
FROM migration_stage.legacy_branch_stock s
JOIN migration_audit.id_map m
  ON m.source_table = s.source_table
 AND m.source_id = s.source_item_id
 AND m.target_table = 'inventory_items'
JOIN inventory_locations l
  ON l.branch_id = s.branch_id
 AND l.location_type = 'branch_store'
GROUP BY s.branch_id, m.target_id, l.id;
```

### 4. Code Adaptation

Backend files to adapt first:

- `backend/src/config/database.ts`
- `backend/src/config/supabase.ts`
- `backend/src/db.ts`
- `backend/src/routes/index.ts`
- inventory controllers/services
- storekeeping controllers/services
- procurement controllers/services
- POS controllers/services
- branch accountant supplier finance/payment controllers
- auditor/director dashboards and reporting controllers

Frontend files to audit:

- `frontend/src/lib/api/core.ts`
- `frontend/src/lib/supabase.ts`
- `frontend/src/lib/realtime.ts`
- `frontend/src/lib/api/**`
- dashboard modules that still query Supabase directly.

Flutter files to audit:

- `famous_gates_app/lib/core/config/app_config.dart`
- `famous_gates_app/lib/core/network/dio_client.dart`
- `famous_gates_app/lib/features/**/data/*repository*.dart`
- role dashboards for reception, POS, branch storekeeper, branch accountant, auditor, director, central store, and superadmin.

Python files to audit:

- `python-services/app.py`
- report generators that query Supabase or `DATABASE_URL`
- branded invoice/receipt generators

### 5. Testing Checklist

Backend:

- `cd backend && npm run build`
- Run endpoint smoke tests for all major route groups.
- Verify no endpoint references removed legacy tables.
- Verify branch isolation on every branch-scoped endpoint.
- Verify stock movements write exactly one canonical movement row per action.
- Verify money movements write payment/journal rows.
- Verify audit events are created.

Flutter:

- `cd famous_gates_app && dart analyze lib/features/branch_storekeeper lib/features/branch_accountant lib/features/auditor lib/features/director lib/features/pos lib/features/reception`
- Login by role.
- Test reception bookings/rooms/guests.
- Test POS shift/open/order/payment/close.
- Test branch store PO -> receive goods -> GRN -> BA ready to bill -> invoice -> payment.
- Test department request -> MIN -> stock reduction.
- Test stock take and trading sheet export.
- Test auditor queues.
- Test director dashboards.

Frontend:

- `cd frontend && npm run build`
- Confirm no hardcoded old Supabase fallback is active.
- Confirm all operational writes use backend API.

Python services:

- `cd python-services && python app.py`
- Generate invoices, GRNs, supplier payment receipts, stock take workbooks, reports.

Data reconciliation:

- Branch count old vs new.
- User count old vs new.
- Room count old vs new.
- Active bookings old vs new.
- Open POs old vs new.
- Open invoices old vs new.
- Inventory value old vs new by branch/location.
- Supplier balance old vs new.
- POS shift totals old vs new.
- Audit event count by module.

### 6. Cutover Plan

1. Freeze old DB schema.
2. Apply clean baseline to new DB.
3. Run ETL into staging.
4. Run validation queries.
5. Run app in staging against new DB.
6. Fix code references to legacy tables.
7. Run final delta ETL.
8. Put old DB into read-only mode.
9. Switch backend env to new DB.
10. Smoke test all roles.
11. Keep old DB available for rollback for 7-14 days.
12. After sign-off, archive old DB and remove compatibility code.

## Immediate Next Engineering Actions

Implemented package:

- Clean baseline root: `backend/supabase/clean-db`.
- Canonical schema migration: `backend/supabase/clean-db/migrations/0001_clean_core_schema.sql`.
- ETL mapping scripts: `backend/supabase/clean-db/etl/*.sql`.
- Rebuild runner: `backend/scripts/clean-db-rebuild.js`.
- Active old-data mapper/stager: `backend/scripts/map-and-stage-active-db-data.js`.
- Active old-data report: `docs/OLD_DB_ACTIVE_TABLE_DATA_MAP.md`.
- Backend scripts:
  - `npm run clean-db:audit`
  - `npm run clean-db:apply-schema`
  - `npm run clean-db:run-etl`
  - `npm run clean-db:reconcile`
  - `npm run clean-db:map-active`
  - `npm run clean-db:stage-active`
  - `npm run clean-db:staging-summary`

Safe execution order:

1. Add old/new database variables to `backend/.env`.
2. Run `cd backend && npm run clean-db:audit`.
3. Create the fresh Supabase database.
4. Run `cd backend && npm run clean-db:apply-schema -- --execute`.
5. Load old database exports into `legacy_import` on the new database.
6. Or stage only live old tables with data:
   - `cd backend && npm run clean-db:map-active -- --no-samples`
   - `cd backend && npm run clean-db:stage-active -- --execute --replace --no-samples --batch=1000`
   - `cd backend && npm run clean-db:staging-summary`
7. Run canonical ETL:
   - `cd backend && npm run clean-db:run-etl -- --execute`
   - identity/RBAC can also be run independently from `backend/supabase/clean-db/etl/010_identity_rbac_from_raw_staging.sql`.
8. Run `cd backend && npm run clean-db:reconcile`.
9. Run backend, frontend, Flutter, and Python service smoke tests against the new DB.
10. Only after module verification, switch production backend env to the new DB.

Current live migration checkpoint:

- New DB clean schema applied.
- Old DB active rows staged into `legacy_import`: 114 active tables, 15307 rows.
- Identity/RBAC canonical ETL completed:
  - `branches`: 10
  - `roles`: 20
  - `users`: 40
  - `departments`: 180
  - `staff_profiles`: 363
  - `staff_profiles_with_user_id`: 0
  - `user_branch_roles`: 72
- Identity model correction: `users` are login/auth accounts only. `staff_profiles` are separate HR/personnel records and keep nullable `user_id` links. The ETL no longer creates fake user rows for staff profiles.
- RBAC correction: roles are seeded from legacy `users` and `user_branch_roles` only. `staff_profiles.role` remains job/staff metadata and is not used as an application permission role.

Remaining engineering actions before cutover:

1. Replace hardcoded frontend Supabase fallbacks.
2. Move all operational frontend Supabase reads behind backend endpoints.
3. Refactor high-risk backend controllers to repository/service boundaries against canonical tables.
4. Remove or remap missing-table references such as `store_dispatches`, `payroll`, `supplier_invoices`, and `stock_in_records`.
5. Add compatibility read views only for routes that cannot be refactored before first cutover.

## Bottom Line

The clean database should not inherit the current migration chain. It should start from a fresh canonical baseline and migrate only clean, mapped, deduplicated data. The old database should become a source system for ETL, not the foundation for the next version.
