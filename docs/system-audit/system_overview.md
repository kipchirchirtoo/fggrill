# System Overview

## Scan Boundary

This audit was generated from the local repository under `/home/allansamuel/Desktop/fggrill`.

- Next.js dashboard route files scanned: 572 `page.tsx` / `layout.tsx` files under `frontend/src/app/dashboard`.
- Frontend shared implementation files scanned: 275 TypeScript/React files under `frontend/src/components`, `frontend/src/hooks`, `frontend/src/lib`, and optional shared service/store/context/provider/util directories.
- Backend route modules scanned: 99 TypeScript files under `backend/src/routes`.
- Backend route declarations inventoried: 1,387 `router.*` declarations.
- Flutter feature folders scanned: `admin`, `auditor`, `bar`, `branch_manager`, `branch_operations`, `director`, `facilities`, `finance`, `gm`, `housekeeping`, `hr`, `kitchen`, `kitchen_operations`, `maintenance`, `pos`, `procurement`, `reception`, `reports`, `store`, `superadmin`, and supporting auth/search/settings/notifications modules.

## Architecture Overview

The system is a multi-client hotel management platform with a shared Node.js API, Python reporting/analytics services, a Next.js dashboard, and a Flutter desktop application. The migration target is the Flutter app in `famous_gates_app`, preserving the existing backend integrations.

Primary boundaries:

- `frontend`: Next.js App Router dashboards, Shadcn-style UI primitives, modular API clients in `src/lib/api`, auth context, protected routes, custom hooks, and domain-specific components.
- `backend`: Express/TypeScript API with route modules, controllers, services, middleware, Supabase/PostgreSQL access, branch isolation, role authorization, audit logging, exports, and uploads.
- `python-services` / `analytics-service`: report, analytics, pricing, and communication services called by backend or dashboard code.
- `famous_gates_app`: Flutter/Riverpod desktop app using Dio, GoRouter, secure storage, and feature modules.

## Dashboard Inventory Summary

The Next.js dashboard includes these role/workspace areas:

- Superadmin: behavioral intelligence, security, system health, users, branches, audit logs, settings.
- Admin: hotel operations, staff, HR/payroll, inventory, storekeeping, finance, reports, rooms, guests, reservations, restaurant, housekeeping, maintenance, fleet, documents, communications.
- Auditor: overview, search, financial verification, shift verification, revenue oversight, sales audit, banking logs, invoices, discrepancies, branch orders, sold items, stock audit, bar stock, purchases, deliveries, kitchen ledger, kitchen requisitions, usage, wastage, staff audit, payroll approvals, stock request approvals, audit reports.
- Central store/storekeeping: master inventory, receiving/GRN, packing, dispatch, suppliers, purchase orders, stock takes, spoilage, vehicles, drivers, reports.
- Branch store: branch stock, requisitions, receive delivery, stock out, purchase orders, kitchen usage/requisitions, reports.
- Branch manager / manager / GM / director: operations, reservations, rooms, staff, leave, finance, reports, discrepancies, drill-downs, approvals.
- HR: employees, attendance, staff attendance, payroll, salaries, adjustments, leave, policies, performance, terminal.
- Branch accounting/accountant: banking, record banking, payments, purchases, credit bills, logbooks, shift P&L/review, stock take, variance, sold items, cashier clearance.
- Operations: bar, cashier, reception, housekeeping, maintenance, facilities, kitchen, kitchen operations, procurement, communications, reports, settings, profile.

## Frontend Architecture

Next.js uses App Router layouts and pages under `frontend/src/app/dashboard`. Most pages are client components using React hooks:

- `useState` for local filters, selected records, forms, modal visibility, loading flags.
- `useEffect` for initial data loading, polling, route-driven refresh, and auth redirects.
- `useMemo` for filtered/sorted table rows and derived KPIs.
- `useCallback` for stable fetch/action handlers.
- Context/auth via `auth-context.tsx` and protected route components.
- API calls through `fetchAPI()` and `buildQuery()` in `frontend/src/lib/api/core.ts`; some file upload/download flows use raw `fetch`, `Blob`, `URL.createObjectURL`, and `localStorage` token reads.

Common frontend UI dependencies:

- `components/ui/*`: button, card, dialog, table, select, input, textarea, tabs, badge.
- `sonner` toast notifications.
- Domain components in `components/admin`, `components/audit`, `components/finance`, `components/store`, `components/restaurant`, and others.
- Export helpers using `jspdf`, `jspdf-autotable`, Blob downloads, and print wrappers.

## Backend Architecture

Backend routing is Express-based and mounted through `backend/src/routes/index.ts`. Common middleware:

- `protect` / `authenticate`: JWT authentication.
- `authorize(...)`: role guards.
- branch isolation helpers for multi-branch filtering.
- upload middleware for documents, staff photos, communication attachments, imports, and images.

Controller/service patterns:

- Controllers parse request/query/body, call Supabase or services, and return `{ success, data, message }` responses.
- Services encapsulate business rules for payroll, shift P&L, reports, notifications, payments, M-Pesa/Paystack/Stripe, storekeeping, and audit workflows.
- Complex finance/reporting queries use PostgreSQL pool access through `db`.

## Service Boundaries

- Auth/profile/notifications: backend API, secure Flutter storage, GoRouter redirects.
- Dashboard data: Node controllers/services, Supabase/PostgreSQL.
- Analytics/reports: Node report controllers plus Python report services where configured.
- Realtime: Socket.IO/Supabase realtime in web stack; Flutter currently uses explicit refresh and request-driven state.
- File flows: backend binary endpoints or frontend-generated PDF/CSV; Flutter must use Dio bytes plus `path_provider`/desktop file save.

## Role Matrix

Global roles observed in routing/branch rules:

- `super_admin`
- `director`
- `general_manager`
- `hr_manager`
- `finance_manager`
- `central_storekeeper`
- `auditor`

Branch/workspace roles observed:

- `branch_manager`
- `branch_accountant`
- `accountant`
- `cashier`
- `receptionist`
- `branch_storekeeper`
- `storekeeper`
- `procurement`
- `kitchen`
- `kitchen_operations`
- `housekeeping`
- `maintenance`
- `facilities`
- `restaurant`
- bar roles including bartender/bar manager variants
- driver and employee portal roles

Flutter route guards are centralized in `famous_gates_app/lib/core/router/app_router.dart` and role routing in `features/auth/domain/role_routes.dart`. Backend role guards remain the source of truth for API access.

## Dependency Graph

High-level request path:

`Flutter screen -> Riverpod controller/provider -> repository -> service/Dio -> Node route -> middleware/auth+authorize+branch -> controller -> service/query -> Supabase/PostgreSQL/Python service -> response -> repository parser -> provider state -> canonical Superadmin-style widgets`

Frontend migration path:

`Next page -> page state/hooks -> lib/api module -> reusable UI component/modals/tables -> Flutter screen -> Riverpod AsyncNotifier/StateNotifier -> repository -> reusable shell/table/dialog/form widgets`

## Critical Flows

- Login/role redirect: token storage, `/auth/me`, role route resolution, protected navigation.
- Branch selection/isolation: global roles can cross branches; branch roles should receive branch-filtered data.
- Auditor verification: anomalies/exceptions, stock audits, shift P&L, cashier logbooks, payroll approvals, stock request approvals, kitchen consumption/wastage, report exports.
- Storekeeping lifecycle: item catalog, requisition, approval, packing, dispatch, delivery confirmation, GRN, stock take, spoilage.
- HR lifecycle: employee CRUD, attendance, leave, payroll, salaries, credit bills, loans/advances, terminal.
- Finance/accounting: banking logs, reconciliation, payments, credit bills, shift P&L, cashier clearance, invoices.
- File import/export: Excel/PDF/CSV downloads and uploads with auth.

## Auth Architecture

Next.js reads tokens from local/session storage through `fetchAPI` and auth context. Flutter uses secure storage via `secureStorageProvider`, `AuthRepository`, and `authNotifierProvider`. GoRouter redirects unauthenticated users to `/login` and sends unauthorized users back to their role home.

Backend supports JWT authentication via Authorization headers and uses `authorize()` for role-based access. Sensitive operations require backend-side authorization regardless of Flutter UI state.

## Routing Architecture

Next.js has nested App Router paths under `/dashboard/{role}/{page}`. Flutter currently has coarse role routes such as `/admin`, `/auditor`, `/central-store`, `/hr`, `/branch-manager`, `/gm`, `/director`, and CRUD module routes. Many Next nested routes are represented inside Flutter as dashboard sections rather than direct GoRouter child routes.

Migration decision: retain role home routes and use dashboard section state for intra-dashboard navigation unless a page requires deep-linkable parameters, query strings, or browser-like history. Those pages should become child routes.

## API Architecture

Frontend API modules use `fetchAPI()` with relative `/api` paths. Flutter uses Dio with the configured API base URL. API parity requires:

- retaining backend path/method/query/body contracts,
- parsing both raw arrays and `{ success, data }`,
- preserving pagination/search/sort query names,
- using `ResponseType.bytes` for export endpoints,
- avoiding invalid `branch_id=null` / `branch_id=NaN`.

## Risks

- The web dashboard surface is much larger than the current Flutter implementation. Flutter has feature folders for most roles, but not every Next page has full modal/action parity yet.
- Some backend routes are duplicated or aliased (`storekeeping.routes.ts` and `routes/storekeeping/*`; auditor aliases added for compatibility). Flutter must choose canonical paths but preserve compatibility where users already hit aliases.
- Some report export endpoints used by Flutter were missing or mismatched and need route verification before enabling UI actions.
- Some backend endpoints return different shapes for similar data (`data`, raw list, paginated object, bytes). Repositories must normalize explicitly.
- Branch-dependent endpoints fail when Flutter sends `null` or `NaN`; repositories must omit invalid branch values.
- Superadmin screen is not currently wired to `SuperAdminScreen` in GoRouter; `/superadmin` maps to `AdminScreen()`. This must be corrected before declaring Superadmin UI parity.

## Migration Blockers

- Exact UI/runtime parity for all 572 dashboard route files cannot be marked complete until every page has a Flutter screen/section, repository method, permission guard, and validation entry. Static metadata for all 572 files is now inventoried in `docs/system-audit/page_inventory.md`.
- Python report/analytics service route contracts need runtime environment variables to verify all remote service calls.
- Some backend endpoints currently return 404/400/403/500 in live runs; these must be fixed or documented per screen before enabling CRUD actions.
- Deep file upload/download flows need desktop save/open behavior and permission-safe paths.
