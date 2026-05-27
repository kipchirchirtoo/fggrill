# Phase 1: 8 Missing Dashboards - Implementation Plan

## Overview
This document provides a detailed specification for implementing 8 missing dashboards in the Flutter app for the FamousGate Hotels Management System. Each dashboard specification includes the frontend structure (from Next.js), backend API endpoints, and Flutter implementation requirements.

---

## Dashboard 1: Procurement Dashboard

### Role: `procurement_manager`, `central_storekeeper`, `super_admin`

### Frontend Reference
**File:** `/home/allansamuel/Desktop/fggrill/frontend/src/app/dashboard/procurement/page.tsx`

### Dashboard Structure
```
┌─────────────────────────────────────────────────────────────┐
│  Procurement Overview                                        │
│  Manage your supply chain and accounts payable              │
│  [New Purchase Order]                                        │
├─────────────────────────────────────────────────────────────┤
│  Stats Grid (4 cards):                                       │
│  - Pending POs (awaiting approval)                           │
│  - Open GRNI (received, not invoiced)                        │
│  - Pending Invoices (ready for payment)                     │
│  - Low Stock (items below reorder level)                     │
├─────────────────────────────────────────────────────────────┤
│  Recent Purchase Orders Table                                │
│  Columns: PO Number, Supplier, Total (KES), Status, Action  │
├─────────────────────────────────────────────────────────────┤
│  Quick Access Links:                                         │
│  - Supplier Directory                                        │
│  - Item Master List                                          │
│  - Aging Analysis                                            │
├─────────────────────────────────────────────────────────────┤
│  Compliance Status:                                          │
│  - KRA VAT PINs Verified                                    │
│  - Audit Logs Active                                         │
│  - Open GRNIs (attention if > 10)                            │
└─────────────────────────────────────────────────────────────┘
```

### Backend API Endpoints
**Base Route:** `/api/procurement`

#### Suppliers
- `GET /suppliers` - List suppliers (params: status, category, search)
- `GET /suppliers/:id` - Get supplier details
- `POST /suppliers` - Create supplier
- `PUT /suppliers/:id` - Update supplier
- `DELETE /suppliers/:id` - Delete supplier
- `GET /suppliers/:id/products` - Get supplier products
- `POST /suppliers/:id/products` - Add supplier product
- `PUT /suppliers/products/:id` - Update supplier product
- `DELETE /suppliers/products/:id` - Delete supplier product
- `GET /suppliers/:id/performance` - Get supplier performance

#### Purchase Orders
- `GET /procurement/purchase-orders` - List POs (params: supplier_id, status, from_date, to_date, limit, page, source_module, store_type)
- `GET /procurement/purchase-orders/:id` - Get PO details
- `POST /procurement/purchase-orders` - Create PO
- `PUT /procurement/purchase-orders/:id` - Update PO
- `PUT /procurement/purchase-orders/:id/approve` - Approve PO
- `PUT /procurement/purchase-orders/:id/cancel` - Cancel PO
- `DELETE /procurement/purchase-orders/:id` - Delete PO
- `POST /procurement/purchase-orders/:id/send` - Send PO to supplier

#### GRNs (Goods Received Notes)
- `GET /procurement/grn` - List GRNs (params: supplier_id, status, po_id, from_date, to_date)
- `GET /procurement/grn/:id` - Get GRN details
- `POST /procurement/grn` - Create GRN
- `PUT /procurement/grn/:id/approve` - Approve GRN
- `PUT /procurement/grn/:id/cancel` - Cancel GRN

#### Invoices
- `GET /procurement/invoices` - List invoices (params: supplier_id, status)
- `GET /procurement/invoices/:id` - Get invoice details
- `POST /procurement/invoices` - Create invoice
- `PUT /procurement/invoices/:id/approve` - Approve invoice
- `PUT /procurement/invoices/:id/reject` - Reject invoice

#### Payments
- `GET /procurement/payments` - List payments (params: supplier_id, status)
- `POST /procurement/payments` - Create payment

#### Ledger & Performance
- `GET /procurement/ledger/:supplierId` - Get supplier ledger
- `GET /procurement/performance/:supplierId` - Get supplier performance

#### Reports
- `GET /procurement/reports/vat` - VAT report (params: from_date, to_date, supplier_id)
- `GET /procurement/reports/grni` - GRNI report (params: status)
- `GET /procurement/reports/aging` - Aging analysis (params: supplier_id)
- `GET /procurement/reports/audit-trail` - Audit trail (params: supplier_id, entity_type, entity_id, from_date, to_date)

### Flutter Implementation Requirements

#### Directory Structure
```
lib/features/procurement/
├── data/
│   └── repository.dart
├── domain/
│   ├── models.dart
│   └── providers.dart
└── presentation/
    └── procurement_dashboard.dart
```

#### Key Models
```dart
class Supplier {
  final String id;
  final String name;
  final String? category;
  final String? status;
  final String? kraPin;
  final String? email;
  final String? phone;
  final String? address;
  final List<SupplierProduct>? products;
}

class PurchaseOrder {
  final String id;
  final String poNumber;
  final String supplierId;
  final String supplierName;
  final double total;
  final String status; // pending, approved, received, cancelled
  final DateTime? orderDate;
  final DateTime? expectedDelivery;
  final List<POLineItem>? lineItems;
}

class GRN {
  final String id;
  final String grnNumber;
  final String poId;
  final String supplierId;
  final String status; // pending, approved, cancelled
  final DateTime? receivedDate;
  final List<GRNItem>? items;
}

class Invoice {
  final String id;
  final String invoiceNumber;
  final String supplierId;
  final double total;
  final String status; // pending, approved, rejected, paid
  final DateTime? invoiceDate;
  final DateTime? dueDate;
}
```

#### Key Providers
```dart
// Stats
final procurementStatsProvider = FutureProvider.autoDispose<ProcurementStats>((ref) {
  return ref.read(procurementRepositoryProvider).getStats();
});

// Recent POs
final recentPOsProvider = FutureProvider.autoDispose<List<PurchaseOrder>>((ref) {
  return ref.read(procurementRepositoryProvider).getPurchaseOrders(limit: 5);
});

// Suppliers
final suppliersProvider = FutureProvider.autoDispose<List<Supplier>>((ref) {
  return ref.read(procurementRepositoryProvider).getSuppliers();
});
```

#### UI Components
- Stats cards with icons (Clock, Package, FileText, AlertCircle)
- Recent POs table with status badges
- Quick access links as button cards
- Compliance status section with check/cross indicators

---

## Dashboard 2: Branch Operations Dashboard

### Role: `branch_operations_manager`, `branch_manager`, `branch_storekeeper`, `super_admin`, `general_manager`, `auditor`

### Frontend Reference
**File:** `/home/allansamuel/Desktop/fggrill/frontend/src/app/dashboard/branch-operations/page.tsx`

### Dashboard Structure
```
┌─────────────────────────────────────────────────────────────┐
│  Branch Operations                                           │
│  Management dashboard for [branch name]                       │
│  [Refresh]                                                   │
├─────────────────────────────────────────────────────────────┤
│  Stats Grid (3 cards):                                       │
│  - Occupancy (percentage)                                    │
│  - Staff (active/total)                                      │
│  - Pending Tasks                                             │
├─────────────────────────────────────────────────────────────┤
│  Second Row Stats (2 cards):                                 │
│  - Arrivals Today                                            │
│  - Departures Today                                          │
├─────────────────────────────────────────────────────────────┤
│  Quick Access (8 links):                                     │
│  - Inventory, Staff, Reservations, Rooms, Reports,           │
│    Communications                                            │
├─────────────────────────────────────────────────────────────┤
│  Upcoming Reservations List                                  │
│  Shows guest name, room type, dates, check-in today badge    │
├─────────────────────────────────────────────────────────────┤
│  Recent Operations / Communications                          │
└─────────────────────────────────────────────────────────────┘
```

### Backend API Endpoints
**Base Route:** `/api/branch-operations`

#### Dashboard
- `GET /branch-operations/dashboard` - Dashboard stats (params: branch_id)
  - Returns: occupancy rate, staff counts, pending tasks, arrivals/departures, upcoming reservations

#### Reservations/Bookings
- `GET /branch-operations/reservations` - List reservations (params: status, from, to, branch_id)
  - Returns: booking number, guest name, dates, status, room details

#### Inventory
- `GET /branch-operations/inventory` - Branch inventory (params: branch_id)
- `GET /branch-operations/inventory/incoming` - Incoming dispatches (params: branch_id)
- `GET /branch-operations/inventory/stock-takes` - Stock takes (params: status, branch_id)
- `POST /branch-operations/inventory/stock-takes` - Create stock take

#### Stock Requests
- `GET /branch-operations/stock-requests` - Stock requests (params: branch_id)

#### Staff
- `GET /branch-operations/staff` - List staff (params: department, status, branch_id)
- `GET /branch-operations/staff/shift-types` - Shift types
- `GET /branch-operations/staff/shifts` - Staff shifts (params: startDate, endDate, staffId, branch_id)
- `POST /branch-operations/staff/shifts` - Create shift
- `PUT /branch-operations/staff/shifts/:shiftId` - Update shift
- `DELETE /branch-operations/staff/shifts/:shiftId` - Delete shift
- `GET /branch-operations/staff/attendance` - Staff attendance (params: startDate, endDate, staffId, branch_id)

#### Rooms
- `GET /branch-operations/rooms` - List rooms (params: branch_id)
- `GET /branch-operations/rooms/:id` - Room details

#### Communications
- `GET /branch-operations/communications` - Communications list
- `POST /branch-operations/communications` - Create communication

### Flutter Implementation Requirements

#### Directory Structure
```
lib/features/branch_operations/
├── data/
│   └── repository.dart
├── domain/
│   ├── models.dart
│   └── providers.dart
└── presentation/
    ├── branch_operations_dashboard.dart
    └── sections/
        ├── inventory_section.dart
        ├── staff_section.dart
        ├── reservations_section.dart
        └── communications_section.dart
```

#### Key Models
```dart
class BranchDashboardStats {
  final double occupancyRate;
  final StaffStats staff;
  final int pendingTasks;
  final int arrivals;
  final int departures;
  final List<Reservation> upcomingReservations;
}

class StaffStats {
  final int total;
  final int active;
}

class Reservation {
  final String id;
  final String reservationNumber;
  final String guestName;
  final String? roomNumber;
  final String? roomType;
  final DateTime checkInDate;
  final DateTime checkOutDate;
  final String status;
}

class StaffShift {
  final String id;
  final String staffId;
  final String staffName;
  final DateTime shiftDate;
  final String startTime;
  final String endTime;
  final String shiftTypeName;
  final String? shiftTypeColor;
  final bool isConfirmed;
}
```

#### Key Providers
```dart
final branchDashboardProvider = FutureProvider.autoDispose<BranchDashboardStats>((ref) {
  final branchId = ref.watch(branchIdProvider);
  return ref.read(branchOperationsRepositoryProvider).getDashboard(branchId);
});

final branchStaffProvider = FutureProvider.autoDispose<List<Staff>>((ref) {
  final branchId = ref.watch(branchIdProvider);
  return ref.read(branchOperationsRepositoryProvider).getStaff(branchId);
});

final branchReservationsProvider = FutureProvider.autoDispose<List<Reservation>>((ref) {
  final branchId = ref.watch(branchIdProvider);
  return ref.read(branchOperationsRepositoryProvider).getReservations(branchId);
});
```

---

## Dashboard 3: Facilities Dashboard

### Role: `facilities_manager`, `branch_manager`, `housekeeping`, `maintenance`, `super_admin`, `general_manager`

### Frontend Reference
**File:** `/home/allansamuel/Desktop/fggrill/backend/src/routes/facilities.routes.ts`

### Dashboard Structure
```
┌─────────────────────────────────────────────────────────────┐
│  Facilities Management                                      │
│  Housekeeping & Maintenance Operations                      │
├─────────────────────────────────────────────────────────────┤
│  Stats Grid:                                                 │
│  - Rooms: total, clean, dirty, out of order, inspected     │
│  - Tasks: total, pending, in progress, completed            │
│  - Work Orders: total, open, in progress, completed         │
│  - Staff: housekeeping, maintenance, on duty                │
├─────────────────────────────────────────────────────────────┤
│  Housekeeping Section:                                       │
│  - Tasks list with room assignments                         │
│  - Inspections with scores                                  │
│  - Lost & Found items                                       │
│  - Supplies inventory                                       │
├─────────────────────────────────────────────────────────────┤
│  Maintenance Section:                                        │
│  - Work orders list                                          │
│  - Assets list                                              │
│  - Maintenance schedule                                     │
│  - Equipment list                                           │
├─────────────────────────────────────────────────────────────┤
│  Staff Section:                                              │
│  - Housekeeping staff list                                  │
│  - Maintenance staff list                                   │
│  - Staff schedule                                           │
└─────────────────────────────────────────────────────────────┘
```

### Backend API Endpoints
**Base Route:** `/api/facilities`

#### Dashboard
- `GET /facilities/dashboard` - Facilities dashboard stats (params: branch_id)

#### Housekeeping Tasks
- `GET /facilities/housekeeping/tasks` - List tasks (params: branch_id)
- `POST /facilities/housekeeping/tasks` - Create task
- `PUT /facilities/housekeeping/tasks/:id/status` - Update task status

#### Inspections
- `GET /facilities/housekeeping/inspections` - List inspections (params: branch_id)
- `POST /facilities/housekeeping/inspections` - Create inspection

#### Lost & Found
- `GET /facilities/housekeeping/lost-found` - List items (params: branch_id)
- `POST /facilities/housekeeping/lost-found` - Report item
- `PUT /facilities/housekeeping/lost-found/:id/status` - Update item status

#### Work Orders
- `GET /facilities/maintenance/work-orders` - List work orders (params: branch_id)
- `POST /facilities/maintenance/work-orders` - Create work order
- `PUT /facilities/maintenance/work-orders/:id/status` - Update work order status

#### Assets
- `GET /facilities/maintenance/assets` - List assets (params: branch_id)
- `POST /facilities/maintenance/assets` - Create asset

#### Maintenance Schedule
- `GET /facilities/maintenance/schedule` - List schedule (params: branch_id)
- `POST /facilities/maintenance/schedule` - Create schedule entry
- `PUT /facilities/maintenance/schedule/:id/status` - Update schedule

#### Staff
- `GET /facilities/staff` - List facilities staff (params: branch_id, department)
- `POST /facilities/staff` - Create staff

#### Inventory
- `GET /facilities/inventory` - List supplies inventory
- `POST /facilities/inventory/requests` - Create supply request

#### Dropdown Lists
- `GET /facilities/rooms` - Rooms list for dropdowns
- `GET /facilities/staff/list` - Staff list for dropdowns
- `GET /facilities/equipment/list` - Equipment list for dropdowns
- `GET /facilities/supplies/list` - Supplies list for dropdowns

#### Quality Compliance
- `GET /facilities/quality-compliance` - Quality compliance stats

### Flutter Implementation Requirements

#### Directory Structure
```
lib/features/facilities/
├── data/
│   └── repository.dart
├── domain/
│   ├── models.dart
│   └── providers.dart
└── presentation/
    ├── facilities_dashboard.dart
    └── sections/
        ├── housekeeping_section.dart
        ├── maintenance_section.dart
        ├── assets_section.dart
        └── inventory_section.dart
```

#### Key Models
```dart
class FacilitiesDashboardStats {
  final RoomStats rooms;
  final TaskStats tasks;
  final WorkOrderStats workOrders;
  final StaffStats staff;
}

class HousekeepingTask {
  final String id;
  final String? roomId;
  final String? roomNumber;
  final String taskType; // daily_clean, deep_clean, inspection, etc.
  final String priority; // low, normal, high, urgent
  final String status; // pending, in_progress, completed
  final String? assignedTo;
  final String? notes;
  final DateTime? dueDate;
}

class Inspection {
  final String id;
  final String? roomId;
  final String? roomNumber;
  final double cleanlinessScore;
  final double maintenanceScore;
  final double amenitiesScore;
  final double overallScore;
  final String? notes;
  final String? inspectorName;
  final DateTime inspectedAt;
}

class WorkOrder {
  final String id;
  final String orderNumber;
  final String location;
  final String locationType;
  final String issueDescription;
  final String priority; // low, normal, high, urgent
  final String status; // pending, in_progress, completed
  final String maintenanceType; // preventive, corrective
  final String? assignedTo;
  final DateTime createdAt;
}

class MaintenanceAsset {
  final String id;
  final String assetTag;
  final String name;
  final String category;
  final String location;
  final String? serialNumber;
  final DateTime? purchaseDate;
  final DateTime? warrantyExpiry;
  final String status; // operational, maintenance, retired
}
```

#### Key Providers
```dart
final facilitiesDashboardProvider = FutureProvider.autoDispose<FacilitiesDashboardStats>((ref) {
  final branchId = ref.watch(branchIdProvider);
  return ref.read(facilitiesRepositoryProvider).getDashboard(branchId);
});

final housekeepingTasksProvider = FutureProvider.autoDispose<List<HousekeepingTask>>((ref) {
  final branchId = ref.watch(branchIdProvider);
  return ref.read(facilitiesRepositoryProvider).getHousekeepingTasks(branchId);
});

final workOrdersProvider = FutureProvider.autoDispose<List<WorkOrder>>((ref) {
  final branchId = ref.watch(branchIdProvider);
  return ref.read(facilitiesRepositoryProvider).getWorkOrders(branchId);
});
```

---

## Dashboard 4: Kitchen Operations Dashboard

### Role: `kitchen_operations`, `head_chef`, `sous_chef`, `kitchen`, `pos_kitchen`, `super_admin`, `general_manager`, `branch_manager`

### Frontend Reference
**Files:** 
- `/home/allansamuel/Desktop/fggrill/backend/src/routes/kitchen.routes.ts`
- `/home/allansamuel/Desktop/fggrill/backend/src/routes/kitchen-ledger.routes.ts`

### Dashboard Structure
```
┌─────────────────────────────────────────────────────────────┐
│  Kitchen Operations                                         │
│  Kitchen Management & Food Control                          │
├─────────────────────────────────────────────────────────────┤
│  Stats Grid:                                                 │
│  - Stock levels (total items, low stock)                    │
│  - Today's usage                                             │
│  - Today's wastage                                          │
│  - Pending requisitions                                      │
├─────────────────────────────────────────────────────────────┤
│  Stock & Ledger Section:                                    │
│  - Kitchen stock list                                        │
│  - Kitchen ledger entries                                   │
│  - Item history                                             │
│  - Portion stock & ledger                                  │
├─────────────────────────────────────────────────────────────┤
│  Requisitions Section:                                       │
│  - Requisitions list                                        │
│  - Create requisition                                       │
│  - Approve/Reject requisitions                              │
│  - Fulfill requisitions                                     │
├─────────────────────────────────────────────────────────────┤
│  Recipes/BOM Section:                                       │
│  - Recipes list                                             │
│  - Create recipe                                            │
│  - Recipe details with ingredients                          │
│  - Auto-deduct ingredients                                  │
├─────────────────────────────────────────────────────────────┤
│  Usage & Wastage Section:                                    │
│  - Record usage                                             │
│  - Record wastage                                           │
│  - Usage entries list                                       │
│  - Wastage records list                                     │
├─────────────────────────────────────────────────────────────┤
│  Food Control Section:                                       │
│  - Food controls list (yield tracking)                      │
│  - Create food control                                      │
│  - Calculate yield                                          │
│  - Variance reconciliation                                  │
├─────────────────────────────────────────────────────────────┤
│  Reports Section:                                            │
│  - Yield report                                             │
│  - Loss report                                              │
│  - Accountability report                                   │
├─────────────────────────────────────────────────────────────┤
│  Expected Portions Section:                                  │
│  - Expected portions list                                   │
│  - Verify actual portions                                   │
│  - Variance summary                                         │
└─────────────────────────────────────────────────────────────┘
```

### Backend API Endpoints
**Base Route:** `/api/kitchen`

#### Stock & Ledger
- `GET /kitchen/stock` - Kitchen stock (params: branch_id)
- `GET /kitchen/stock/ledger` - Kitchen ledger (params: branch_id)
- `GET /kitchen/stock/:sku/history` - Item history (params: sku, branch_id)
- `GET /kitchen/dashboard/stats` - Kitchen dashboard stats (params: branch_id)
- `GET /kitchen/portion-stock` - Portion stock (params: branch_id)
- `GET /kitchen/portion-ledger` - Portion ledger (params: branch_id)

#### Requisitions
- `POST /kitchen/requisitions` - Create requisition
- `GET /kitchen/requisitions` - List requisitions (params: branch_id)
- `GET /kitchen/requisitions/:id` - Get requisition details
- `PUT /kitchen/requisitions/:id/approve` - Approve requisition
- `PUT /kitchen/requisitions/:id/reject` - Reject requisition
- `POST /kitchen/requisitions/:id/fulfill` - Fulfill requisition

#### Recipes/BOM
- `POST /kitchen/recipes` - Create recipe
- `GET /kitchen/recipes` - List recipes (params: branch_id)
- `GET /kitchen/recipes/:id` - Get recipe details
- `PUT /kitchen/recipes/:id` - Update recipe
- `DELETE /kitchen/recipes/:id` - Delete recipe
- `POST /kitchen/recipes/:id/lock` - Lock recipe
- `POST /kitchen/recipes/:id/unlock` - Unlock recipe
- `GET /kitchen/recipes/:id/history` - Recipe history
- `POST /kitchen/recipes/auto-deduct` - Auto-deduct ingredients (called by POS)

#### Usage Tracking
- `POST /kitchen/usage` - Record usage
- `GET /kitchen/usage` - List usage entries (params: branch_id)
- `PUT /kitchen/usage/:id/review` - Review usage
- `PUT /kitchen/usage/:id/audit` - Audit usage

#### Wastage
- `POST /kitchen/wastage` - Record wastage
- `GET /kitchen/wastage` - List wastage records (params: branch_id)
- `PUT /kitchen/wastage/:id` - Update wastage
- `DELETE /kitchen/wastage/:id` - Delete wastage
- `PUT /kitchen/wastage/:id/review` - Review wastage
- `PUT /kitchen/wastage/:id/audit` - Audit wastage

#### Food Control (Yield)
- `GET /kitchen/food-controls` - List food controls (params: branch_id)
- `POST /kitchen/food-controls` - Create food control
- `PUT /kitchen/food-controls/:id` - Update food control
- `DELETE /kitchen/food-controls/:id` - Delete food control
- `POST /kitchen/food-controls/calculate` - Calculate yield

#### Variance Reconciliation
- `GET /kitchen/variance-reasons` - Get variance reasons
- `GET /kitchen/variance` - Get daily variance (params: branch_id)
- `POST /kitchen/variance/:id/reason` - Submit variance reason
- `POST /kitchen/variance/:id/approve` - Approve variance

#### Reports
- `GET /kitchen/reports/yield` - Yield report (params: branch_id)
- `GET /kitchen/reports/loss` - Loss report (params: branch_id)
- `GET /kitchen/reports/accountability` - Accountability report (params: branch_id)

#### Expected Portions
- `GET /kitchen/expected-portions` - Get expected portions (params: branch_id)
- `GET /kitchen/expected-portions/pending` - Get pending verifications (params: branch_id)
- `GET /kitchen/expected-portions/variance/summary` - Variance summary (params: branch_id)
- `GET /kitchen/expected-portions/:id` - Get expected portion details
- `PUT /kitchen/expected-portions/:id/verify` - Verify actual portions

### Kitchen Ledger Endpoints
**Base Route:** `/api/kitchen-ledger`

#### Ledger Entries
- `GET /kitchen-ledger/ledger` - Get ledger entries (params: branch_id)
- `POST /kitchen-ledger/ledger` - Create ledger entry
- `PATCH /kitchen-ledger/ledger/:id` - Update ledger entry
- `PATCH /kitchen-ledger/ledger/:id/status` - Update ledger status

#### Store Receipts
- `GET /kitchen-ledger/receipts` - Get store receipts (params: branch_id)
- `POST /kitchen-ledger/receipts` - Create store receipt
- `PATCH /kitchen-ledger/receipts/:id/verify` - Verify store receipt

#### Portion Tracking
- `GET /kitchen-ledger/portion-tracking` - Get portion tracking (params: branch_id)
- `POST /kitchen-ledger/portion-tracking` - Create portion tracking
- `PATCH /kitchen-ledger/portion-tracking/:id` - Update portion tracking

#### Variance Logs
- `GET /kitchen-ledger/variance-logs` - Get variance logs (params: branch_id)
- `POST /kitchen-ledger/variance-logs` - Create variance log
- `PATCH /kitchen-ledger/variance-logs/:id/approve` - Approve variance log

#### Stats
- `GET /kitchen-ledger/stats` - Get kitchen stats (params: branch_id)

### Flutter Implementation Requirements

#### Directory Structure
```
lib/features/kitchen_operations/
├── data/
│   └── repository.dart
├── domain/
│   ├── models.dart
│   └── providers.dart
└── presentation/
    ├── kitchen_operations_dashboard.dart
    └── sections/
        ├── stock_section.dart
        ├── requisitions_section.dart
        ├── recipes_section.dart
        ├── usage_section.dart
        ├── wastage_section.dart
        ├── food_control_section.dart
        └── reports_section.dart
```

#### Key Models
```dart
class KitchenStock {
  final String sku;
  final String name;
  final String category;
  final double currentStock;
  final double minimumStock;
  final String unit;
  final String? location;
}

class KitchenLedgerEntry {
  final String id;
  final String sku;
  final String itemName;
  final double quantity;
  final String transactionType; // in, out, adjustment
  final String? reference;
  final DateTime transactionDate;
  final String? notes;
}

class Requisition {
  final String id;
  final String requisitionNumber;
  final String? requestedBy;
  final String status; // pending, approved, rejected, fulfilled
  final DateTime requestedDate;
  final List<RequisitionItem> items;
}

class Recipe {
  final String id;
  final String name;
  final String category;
  final double yieldQuantity;
  final String yieldUnit;
  final bool isLocked;
  final List<RecipeIngredient> ingredients;
  final DateTime? createdAt;
}

class UsageEntry {
  final String id;
  final String sku;
  final String itemName;
  final double quantity;
  final String unit;
  final DateTime usageDate;
  final String? notes;
  final String status; // pending, reviewed, audited
}

class WastageRecord {
  final String id;
  final String sku;
  final String itemName;
  final double quantity;
  final String unit;
  final String reason;
  final DateTime wastageDate;
  final String? notes;
  final String status; // pending, reviewed, audited
}

class FoodControl {
  final String id;
  final String itemName;
  final double inputQuantity;
  final double outputQuantity;
  final double yieldPercentage;
  final DateTime controlDate;
  final String? notes;
}
```

#### Key Providers
```dart
final kitchenDashboardProvider = FutureProvider.autoDispose<KitchenDashboardStats>((ref) {
  final branchId = ref.watch(branchIdProvider);
  return ref.read(kitchenOperationsRepositoryProvider).getDashboardStats(branchId);
});

final kitchenStockProvider = FutureProvider.autoDispose<List<KitchenStock>>((ref) {
  final branchId = ref.watch(branchIdProvider);
  return ref.read(kitchenOperationsRepositoryProvider).getStock(branchId);
});

final requisitionsProvider = FutureProvider.autoDispose<List<Requisition>>((ref) {
  final branchId = ref.watch(branchIdProvider);
  return ref.read(kitchenOperationsRepositoryProvider).getRequisitions(branchId);
});

final recipesProvider = FutureProvider.autoDispose<List<Recipe>>((ref) {
  final branchId = ref.watch(branchIdProvider);
  return ref.read(kitchenOperationsRepositoryProvider).getRecipes(branchId);
});
```

---

## Dashboard 5: Kyogong Spa POS

### Role: `kyogong_spa_staff`, `receptionist`, `super_admin`, `general_manager`, `branch_manager`

### Frontend Reference
**File:** `/home/allansamuel/Desktop/fggrill/frontend/src/lib/api/kyogong.ts`

### Dashboard Structure
```
┌─────────────────────────────────────────────────────────────┐
│  Kyogong Spa POS                                            │
│  Point of Sale for Spa Services                             │
├─────────────────────────────────────────────────────────────┤
│  Shift Management:                                          │
│  - Open shift                                               │
│  - Current shift details                                    │
│  - Close shift                                              │
│  - Reconcile shift                                          │
│  - Shift history                                            │
├─────────────────────────────────────────────────────────────┤
│  Transactions:                                               │
│  - Create transaction                                       │
│  - Get shift transactions                                   │
│  - Transaction details                                      │
│  - Void transaction                                         │
├─────────────────────────────────────────────────────────────┤
│  Float Tracking:                                            │
│  - Current float                                            │
│  - Adjust float                                             │
│  - Float history                                            │
├─────────────────────────────────────────────────────────────┤
│  SPA Services:                                               │
│  - Service categories                                       │
│  - Services list                                            │
├─────────────────────────────────────────────────────────────┤
│  Petty Cash:                                                 │
│  - Petty cash entries                                       │
│  - Record petty cash                                       │
├─────────────────────────────────────────────────────────────┤
│  Dynamic Services:                                           │
│  - Dynamic services list                                   │
│  - Create dynamic service                                  │
│  - Update dynamic service                                  │
└─────────────────────────────────────────────────────────────┘
```

### Backend API Endpoints
**Base Route:** `/api/kyogong`

#### Sales Points
- `GET /kyogong/sales-points` - List sales points (params: branch_id)
- `GET /kyogong/sales-points/:id` - Get sales point details

#### Shifts
- `POST /kyogong/shifts/open` - Open shift
- `GET /kyogong/shifts/current` - Get current shift
- `GET /kyogong/shifts` - List shifts (params: branch_id)
- `GET /kyogong/shifts/:id` - Get shift details
- `PUT /kyogong/shifts/:id/close` - Close shift
- `PUT /kyogong/shifts/:id/reconcile` - Reconcile shift
- `PUT /kyogong/shifts/:id/approve` - Approve shift
- `PUT /kyogong/shifts/:id/flag` - Flag shift

#### Transactions
- `POST /kyogong/shifts/:shiftId/transactions` - Create transaction
- `GET /kyogong/shifts/:shiftId/transactions` - Get shift transactions
- `GET /kyogong/transactions/:id` - Get transaction details
- `PUT /kyogong/transactions/:id/void` - Void transaction

#### Float Tracking
- `GET /kyogong/shifts/:shiftId/float` - Get current float
- `POST /kyogong/shifts/:shiftId/float/adjust` - Adjust float
- `GET /kyogong/shifts/:shiftId/float/history` - Get float history

#### SPA Services
- `GET /kyogong/spa-services/categories` - Get service categories
- `GET /kyogong/spa-services` - Get services (params: category_id, branch_id)

#### Petty Cash
- `GET /kyogong/petty-cash` - Get petty cash entries (params: branch_id)
- `POST /kyogong/petty-cash` - Record petty cash

#### Dynamic Services
- `GET /kyogong/dynamic-services` - Get dynamic services (params: branch_id)
- `POST /kyogong/dynamic-services` - Create dynamic service
- `PUT /kyogong/dynamic-services/:id` - Update dynamic service

### Flutter Implementation Requirements

#### Directory Structure
```
lib/features/kyogong_spa/
├── data/
│   └── repository.dart
├── domain/
│   ├── models.dart
│   └── providers.dart
└── presentation/
    ├── kyogong_spa_screen.dart
    └── sections/
        ├── shift_section.dart
        ├── transactions_section.dart
        ├── services_section.dart
        └── petty_cash_section.dart
```

#### Key Models
```dart
class SalesPoint {
  final String id;
  final String name;
  final String location;
  final String? branchId;
  final bool isActive;
}

class Shift {
  final String id;
  final String salesPointId;
  final String? openedBy;
  final DateTime openedAt;
  final DateTime? closedAt;
  final String status; // open, closed, reconciled
  final double openingFloat;
  final double closingFloat;
  final double totalSales;
  final double variance;
  final List<Transaction>? transactions;
}

class Transaction {
  final String id;
  final String shiftId;
  final String serviceId;
  final String serviceName;
  final double amount;
  final String paymentMethod; // cash, card, mpesa
  final DateTime createdAt;
  final String status; // active, voided
}

class SpaService {
  final String id;
  final String name;
  final String? categoryId;
  final String categoryName;
  final double price;
  final int duration; // minutes
  final bool isActive;
}

class PettyCashEntry {
  final String id;
  final String shiftId;
  final String type; // in, out
  final double amount;
  final String? reason;
  final DateTime createdAt;
}

class DynamicService {
  final String id;
  final String name;
  final String? description;
  final double price;
  final bool isActive;
}
```

#### Key Providers
```dart
final currentShiftProvider = FutureProvider.autoDispose<Shift?>((ref) {
  return ref.read(kyogongRepositoryProvider).getCurrentShift();
});

final shiftTransactionsProvider = FutureProvider.autoDispose<List<Transaction>>((ref) {
  final shiftId = ref.watch(currentShiftProvider)?.id;
  if (shiftId == null) return Future.value([]);
  return ref.read(kyogongRepositoryProvider).getShiftTransactions(shiftId);
});

final spaServicesProvider = FutureProvider.autoDispose<List<SpaService>>((ref) {
  return ref.read(kyogongRepositoryProvider).getSpaServices();
});

final pettyCashProvider = FutureProvider.autoDispose<List<PettyCashEntry>>((ref) {
  return ref.read(kyogongRepositoryProvider).getPettyCashEntries();
});
```

---

## Dashboard 6: Employee Portal Screen

### Role: `employee` (all staff roles)

### Frontend Reference
**File:** `/home/allansamuel/Desktop/fggrill/frontend/src/lib/api/employee-portal.ts`

### Dashboard Structure
```
┌─────────────────────────────────────────────────────────────┐
│  Employee Portal                                             │
│  Personal Dashboard for Staff Members                       │
├─────────────────────────────────────────────────────────────┤
│  Dashboard Summary:                                         │
│  - Today's schedule                                         │
│  - Upcoming shifts                                          │
│  - Leave balance                                            │
│  - Pending tasks                                            │
├─────────────────────────────────────────────────────────────┤
│  Profile Section:                                            │
│  - Personal information                                     │
│  - Update profile                                           │
├─────────────────────────────────────────────────────────────┤
│  Schedule Section:                                          │
│  - My schedule                                              │
│  - Shift calendar view                                      │
├─────────────────────────────────────────────────────────────┤
│  Time Clock:                                                 │
│  - Clock in/out                                             │
│  - Time clock history                                      │
├─────────────────────────────────────────────────────────────┤
│  Leave Requests:                                             │
│  - My leave requests                                        │
│  - Request leave                                            │
│  - Cancel leave request                                     │
├─────────────────────────────────────────────────────────────┤
│  Tasks:                                                      │
│  - My assigned tasks                                        │
│  - Update task status                                       │
├─────────────────────────────────────────────────────────────┤
│  Content:                                                    │
│  - Payslips                                                 │
│  - Documents                                                │
│  - Announcements                                            │
│  - Training materials                                       │
│  - Performance reviews                                       │
└─────────────────────────────────────────────────────────────┘
```

### Backend API Endpoints
**Base Route:** `/api/employee-portal` (Python Service)

#### Dashboard
- `GET /employee-portal/dashboard` - Employee dashboard summary

#### Profile
- `GET /employee-portal/profile` - Get employee profile
- `PUT /employee-portal/profile` - Update profile

#### Schedule
- `GET /employee-portal/schedules` - Get schedules (params: start_date, end_date)

#### Time Clock
- `POST /employee-portal/clock` - Clock in/out (body: { action: 'clock_in'|'clock_out', notes })
- `GET /employee-portal/time-clock` - Get time clock history (params: start_date, end_date)

#### Leave
- `GET /employee-portal/leave` - Get leave requests
- `POST /employee-portal/leave` - Request leave
- `DELETE /employee-portal/leave/:id` - Cancel leave request

#### Tasks
- `GET /employee-portal/tasks` - Get tasks (params: status)
- `PUT /employee-portal/tasks/:id` - Update task status

#### Content
- `GET /employee-portal/payslips` - Get payslips
- `GET /employee-portal/documents` - Get documents (params: type)
- `GET /employee-portal/announcements` - Get announcements
- `GET /employee-portal/training` - Get training materials
- `GET /employee-portal/performance` - Get performance reviews

### Flutter Implementation Requirements

#### Directory Structure
```
lib/features/employee_portal/
├── data/
│   └── repository.dart
├── domain/
│   ├── models.dart
│   └── providers.dart
└── presentation/
    ├── employee_portal_screen.dart
    └── sections/
        ├── profile_section.dart
        ├── schedule_section.dart
        ├── time_clock_section.dart
        ├── leave_section.dart
        ├── tasks_section.dart
        └── content_section.dart
```

#### Key Models
```dart
class EmployeeDashboard {
  final String employeeName;
  final String employeeId;
  final String department;
  final String position;
  final TodaySchedule todaySchedule;
  final LeaveBalance leaveBalance;
  final int pendingTasks;
  final List<Announcement>? announcements;
}

class TodaySchedule {
  final String? shiftType;
  final String? startTime;
  final String? endTime;
  final bool isOnDuty;
}

class LeaveBalance {
  final int annual;
  final int sick;
  final int compassionate;
  final int maternity;
  final int paternity;
}

class EmployeeProfile {
  final String id;
  final String firstName;
  final String lastName;
  final String email;
  final String phone;
  final String department;
  final String position;
  final String employeeId;
  final DateTime? hireDate;
  final String? avatar;
}

class TimeClockEntry {
  final String id;
  final String action; // clock_in, clock_out
  final DateTime timestamp;
  final String? notes;
}

class LeaveRequest {
  final String id;
  final String leaveType;
  final DateTime startDate;
  final DateTime endDate;
  final int days;
  final String reason;
  final String status; // pending, approved, rejected, cancelled
  final DateTime? requestedDate;
}

class EmployeeTask {
  final String id;
  final String title;
  final String description;
  final String priority; // low, normal, high
  final String status; // pending, in_progress, completed
  final DateTime? dueDate;
}

class Payslip {
  final String id;
  final String period;
  final double grossPay;
  final double netPay;
  final DateTime? issueDate;
  final String? downloadUrl;
}

class Announcement {
  final String id;
  final String title;
  final String content;
  final DateTime postedDate;
  final String? postedBy;
  final bool isImportant;
}
```

#### Key Providers
```dart
final employeeDashboardProvider = FutureProvider.autoDispose<EmployeeDashboard>((ref) {
  return ref.read(employeePortalRepositoryProvider).getDashboard();
});

final employeeProfileProvider = FutureProvider.autoDispose<EmployeeProfile>((ref) {
  return ref.read(employeePortalRepositoryProvider).getProfile();
});

final employeeScheduleProvider = FutureProvider.autoDispose<List<Shift>>((ref) {
  return ref.read(employeePortalRepositoryProvider).getSchedules();
});

final leaveRequestsProvider = FutureProvider.autoDispose<List<LeaveRequest>>((ref) {
  return ref.read(employeePortalRepositoryProvider).getLeaveRequests();
});

final employeeTasksProvider = FutureProvider.autoDispose<List<EmployeeTask>>((ref) {
  return ref.read(employeePortalRepositoryProvider).getTasks();
});
```

---

## Dashboard 7: Director Dashboard (Dedicated)

### Role: `director`, `super_admin`, `auditor`, `central_storekeeper`

### Frontend Reference
**File:** `/home/allansamuel/Desktop/fggrill/frontend/src/app/dashboard/director/page.tsx`

### Dashboard Structure
```
┌─────────────────────────────────────────────────────────────┐
│  Executive Dashboard                                         │
│  Complete oversight of Famous Gate Hotels operations         │
│  [Branch Selector] [Date Range] [Refresh] [Export Report]   │
├─────────────────────────────────────────────────────────────┤
│  Key Metrics (4 cards):                                     │
│  - Total Revenue (with margin %)                            │
│  - Net Profit (with invoice count)                          │
│  - Occupancy Rate (with rooms)                              │
│  - Active Staff (with attendance %)                          │
├─────────────────────────────────────────────────────────────┤
│  Secondary Metrics (4 cards):                               │
│  - Total Expenses                                           │
│  - Inventory Value                                          │
│  - Pending Discrepancies                                    │
│  - Low Stock Items                                          │
├─────────────────────────────────────────────────────────────┤
│  Charts Row:                                                 │
│  - Revenue & Profit Trend (Line Chart)                      │
│  - Revenue Breakdown by Department (Pie Chart)               │
│  - Payment Method Intelligence (Pie Chart)                   │
│  - Revenue vs Expenses Comparison (Bar Chart)                │
│  - Revenue by Branch (Bar Chart)                            │
│  - Banking Reconciliation View                              │
├─────────────────────────────────────────────────────────────┤
│  Status Overview (3 cards):                                  │
│  - Financial Health                                          │
│  - Operations                                               │
│  - Audit & Compliance                                       │
├─────────────────────────────────────────────────────────────┤
│  Branch Submission Tracking Table:                            │
│  - Branch name, status, submissions, drafts, efficiency      │
├─────────────────────────────────────────────────────────────┤
│  Quick Actions:                                              │
│  - Payment Details, Banking Control, Discrepancies,         │
│    Deep Drill-Down, Review Tasks                            │
├─────────────────────────────────────────────────────────────┤
│  Connected Departments:                                      │
│  - Auditor Portal, HR Command, Financial Workspace,          │
│    Procurement                                               │
└─────────────────────────────────────────────────────────────┘
```

### Backend API Endpoints
**Base Route:** `/api/finance/director`

#### Comprehensive Dashboard
- `GET /finance/director/comprehensive` - Comprehensive dashboard data (params: startDate, endDate, branchId)
  - Returns: financial stats, occupancy, staff, inventory, discrepancies, submissions

#### Reports
- `GET /finance/director/export-pdf` - Export PDF report (params: startDate, endDate, reportType, branchId)
  - reportType: comprehensive, financial, occupancy, staff

#### Banking
- `GET /finance/director/banking` - Banking reconciliation details
- `GET /finance/director/payments` - Payment details

#### Discrepancies
- `GET /finance/director/discrepancies` - Discrepancies list
- `POST /finance/director/discrepancies/:id/resolve` - Resolve discrepancy

#### Tasks
- `GET /finance/director/tasks` - Review tasks
- `PUT /finance/director/tasks/:id/complete` - Complete task

#### Drill-Down
- `GET /finance/director/drill-down` - Deep drill-down analytics (params: startDate, endDate, branchId, metric)

### Flutter Implementation Requirements

#### Directory Structure
```
lib/features/director/
├── data/
│   └── repository.dart
├── domain/
│   ├── models.dart
│   └── providers.dart
└── presentation/
    ├── director_dashboard.dart
    └── sections/
        ├── financial_section.dart
        ├── operations_section.dart
        ├── banking_section.dart
        ├── discrepancies_section.dart
        └── reports_section.dart
```

#### Key Models
```dart
class DirectorDashboardData {
  final FinancialStats financial;
  final OccupancyStats occupancy;
  final StaffStats staff;
  final InventoryStats inventory;
  final DiscrepancyStats discrepancies;
  final List<BranchSubmission> submissions;
  final DateTime lastUpdated;
}

class FinancialStats {
  final double totalRevenue;
  final double totalExpenses;
  final double netProfit;
  final double profitMargin;
  final int paidInvoices;
  final int pendingInvoices;
  final List<DailyTrend> trendByDate;
  final Map<String, double> revenueByDepartment;
  final Map<String, double> paymentMethodTotals;
  final List<BranchRevenue> revenueByBranch;
  final BankingTotals bankingTotals;
}

class OccupancyStats {
  final double occupancyRate;
  final int occupiedRooms;
  final int totalRooms;
}

class StaffStats {
  final int activeStaff;
  final int totalStaff;
  final double attendanceRate;
}

class InventoryStats {
  final double totalValue;
  final int lowStockItems;
  final double stockHealthRate;
}

class DiscrepancyStats {
  final int pendingFlags;
  final int criticalFlags;
  final double resolutionRate;
}

class DailyTrend {
  final String date;
  final double revenue;
  final double profit;
  final double expenses;
}

class BranchRevenue {
  final String name;
  final double revenue;
}

class BankingTotals {
  final double expectedCash;
  final double totalBanked;
  final double totalUnbanked;
  final int recordsWithVariance;
}

class BranchSubmission {
  final String id;
  final String name;
  final int submitted;
  final int drafts;
  final int totalDays;
}
```

#### Key Providers
```dart
final directorDashboardProvider = FutureProvider.autoDispose<DirectorDashboardData>((ref) {
  final dateRange = ref.watch(dateRangeProvider);
  final branchId = ref.watch(selectedBranchIdProvider);
  return ref.read(directorRepositoryProvider).getComprehensiveDashboard(
    startDate: dateRange.start,
    endDate: dateRange.end,
    branchId: branchId,
  );
});

final branchesProvider = FutureProvider.autoDispose<List<Branch>>((ref) {
  return ref.read(directorRepositoryProvider).getBranches();
});
```

---

## Dashboard 8: GM Dashboard (Dedicated)

### Role: `general_manager`, `super_admin`

### Frontend Reference
**File:** `/home/allansamuel/Desktop/fggrill/frontend/src/app/dashboard/gm/page.tsx`

### Dashboard Structure
```
┌─────────────────────────────────────────────────────────────┐
│  General Manager                                            │
│  Overview of all operations                                 │
│  [Branch Selector] [Refresh]                                │
├─────────────────────────────────────────────────────────────┤
│  Stats Grid (4 cards):                                       │
│  - Occupancy (percentage)                                    │
│  - Branches (count)                                         │
│  - Staff (count)                                            │
│  - Leave Requests (count)                                   │
├─────────────────────────────────────────────────────────────┤
│  Quick Access (6 links):                                     │
│  - Branches, Finance, Staff, Reports, Leave, Compare        │
├─────────────────────────────────────────────────────────────┤
│  Branch Performance:                                         │
│  - List of branches with occupancy % vs target              │
│  - Progress bars showing performance                        │
├─────────────────────────────────────────────────────────────┤
│  Pending Actions:                                            │
│  - List of pending items (leave, approvals, reviews)         │
│  - Urgent indicators                                         │
├─────────────────────────────────────────────────────────────┤
│  Management Links:                                           │
│  - Reservations, Staff Overview, Reports, Targets          │
└─────────────────────────────────────────────────────────────┘
```

### Backend API Endpoints
**Base Route:** `/api` (Multiple services)

#### Dashboard Stats
- `GET /finance/dashboard` - Finance dashboard stats (params: branch_id)
- `GET /staff` - Staff list (params: branch_id)
- `GET /staff/leave-requests` - Leave requests (params: status, branch_id)

#### Branches
- `GET /branches` - List all branches
- `GET /branches/:id` - Branch details
- `GET /branches/:id/performance` - Branch performance

#### Finance
- `GET /finance/reports` - Financial reports (params: branch_id, start_date, end_date)
- `GET /finance/branches` - Branch financial data

#### Staff
- `GET /staff` - All staff (params: branch_id)
- `GET /staff/leave-requests` - Leave requests (params: status, branch_id)

#### Reports
- `GET /reports/branch-comparison` - Branch comparison report
- `GET /reports/performance` - Performance reports

#### Reservations
- `GET /reservations` - All reservations (params: branch_id, status, from, to)

### Flutter Implementation Requirements

#### Directory Structure
```
lib/features/gm/
├── data/
│   └── repository.dart
├── domain/
│   ├── models.dart
│   └── providers.dart
└── presentation/
    ├── gm_dashboard.dart
    └── sections/
        ├── branches_section.dart
        ├── finance_section.dart
        ├── staff_section.dart
        ├── reports_section.dart
        └── reservations_section.dart
```

#### Key Models
```dart
class GMDashboardStats {
  final double occupancyRate;
  final int totalStaff;
  final int pendingLeave;
  final int branches;
  final List<BranchPerformance> branchPerformance;
  final List<PendingAction> pendingActions;
}

class BranchPerformance {
  final String id;
  final String name;
  final double occupancy;
  final double target;
  final double revenue;
  final int staffCount;
}

class PendingAction {
  final int id;
  final String type; // leave, approval, review
  final String title;
  final String time;
  final bool urgent;
}

class Branch {
  final String id;
  final String name;
  final String location;
  final String? branchCode;
  final bool isActive;
}

class GMFinanceOverview {
  final double totalRevenue;
  final double totalExpenses;
  final double netProfit;
  final List<BranchFinancialData> branchData;
}

class BranchFinancialData {
  final String branchId;
  final String branchName;
  final double revenue;
  final double expenses;
  final double profit;
}
```

#### Key Providers
```dart
final gmDashboardProvider = FutureProvider.autoDispose<GMDashboardStats>((ref) {
  final branchId = ref.watch(selectedBranchIdProvider);
  return ref.read(gmRepositoryProvider).getDashboardStats(branchId);
});

final branchesProvider = FutureProvider.autoDispose<List<Branch>>((ref) {
  return ref.read(gmRepositoryProvider).getBranches();
});

final branchPerformanceProvider = FutureProvider.autoDispose<List<BranchPerformance>>((ref) {
  return ref.read(gmRepositoryProvider).getBranchPerformance();
});

final pendingActionsProvider = FutureProvider.autoDispose<List<PendingAction>>((ref) {
  return ref.read(gmRepositoryProvider).getPendingActions();
});
```

---

## Implementation Guidelines

### 1. Architecture Pattern
Follow the existing Flutter app architecture:
- **Riverpod** for state management
- **Repository pattern** for API calls
- **FutureProvider.autoDispose** for async data
- **Freezed** for immutable models
- **GoRouter** for navigation
- **PhosphorIcons** for icons

### 2. File Structure
Each dashboard should follow this structure:
```
lib/features/<feature_name>/
├── data/
│   └── repository.dart          # API calls
├── domain/
│   ├── models.dart               # Data models (Freezed)
│   └── providers.dart            # Riverpod providers
└── presentation/
    ├── <feature>_dashboard.dart  # Main screen
    └── sections/                 # Sub-sections (if needed)
        └── <section>_section.dart
```

### 3. Common Components
Reuse existing components where possible:
- `DashboardShell` for multi-tab dashboards
- `AsyncValueWidget` for loading/error states
- `PermissionGuard` for role-based UI
- `BranchSelector` for branch selection
- `IOSCard`, `IOSButton` for consistent styling

### 4. API Integration
- Use `Dio` HTTP client
- Implement proper error handling
- Add loading states
- Cache responses where appropriate
- Handle branch_id in headers or query params

### 5. Role-Based Access
- Use `PermissionGuard` widgets for sensitive actions
- Check permissions before showing buttons/sections
- Use `authorize()` middleware equivalent in Flutter

### 6. Real-time Updates
- Use `PollingProvider` for data that needs periodic refresh
- Implement pull-to-refresh functionality
- Consider WebSocket integration for critical data

### 7. Testing
- Write unit tests for providers
- Write widget tests for UI components
- Test API integration with mock data
- Test error scenarios

### 8. Performance
- Use `autoDispose` for providers to free resources
- Implement pagination for large lists
- Lazy load images and data
- Optimize rebuilds with `select` in Riverpod

---

## Priority Order

1. **Procurement Dashboard** - High impact, central operations
2. **Branch Operations Dashboard** - High impact, branch management
3. **Facilities Dashboard** - Medium impact, housekeeping/maintenance
4. **Kitchen Operations Dashboard** - Medium impact, kitchen management
5. **GM Dashboard** - Medium impact, executive oversight
6. **Director Dashboard** - Medium impact, financial oversight
7. **Kyogong Spa POS** - Low impact, specific location
8. **Employee Portal** - Low impact, self-service

---

## Notes

- All dashboards should support branch selection (where applicable)
- All dashboards should have refresh functionality
- All dashboards should handle loading and error states gracefully
- All dashboards should follow the existing design system
- All dashboards should be responsive for different screen sizes
- All dashboards should implement proper permission checks
- All dashboards should use the existing API base URL from config
