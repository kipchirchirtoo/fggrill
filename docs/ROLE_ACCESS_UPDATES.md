# Role Access Updates - Implementation Guide

This document contains the specific code changes needed to implement proper RBAC in Famous Gate Hotel ERP.

---

## Files to Update

### 1. Reception Module

#### `/dashboard/reception/page.tsx`
**Current:** `[UserRole.RECEPTIONIST, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]`
**Status:** ✅ Correct

#### `/dashboard/reception/guests/page.tsx`
**Current:** `[UserRole.RECEPTIONIST]`
**Should be:** `[UserRole.RECEPTIONIST, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]`

#### `/dashboard/reception/reservations/page.tsx`
**Current:** `[UserRole.RECEPTIONIST]`
**Should be:** `[UserRole.RECEPTIONIST, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]`

---

### 2. Housekeeping Module

#### `/dashboard/housekeeping/page.tsx`
**Current:** `[UserRole.HOUSEKEEPING, UserRole.HOUSEKEEPING_SUPERVISOR]`
**Should be:** `[UserRole.HOUSEKEEPING, UserRole.HOUSEKEEPING_SUPERVISOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]`

---

### 3. Maintenance Module

#### `/dashboard/maintenance/page.tsx`
**Current:** `[UserRole.MAINTENANCE]`
**Should be:** `[UserRole.MAINTENANCE, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]`

#### `/dashboard/maintenance/assets/page.tsx`
**Current:** `[UserRole.MAINTENANCE]`
**Should be:** `[UserRole.MAINTENANCE, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]`

#### `/dashboard/maintenance/orders/page.tsx`
**Current:** `[UserRole.MAINTENANCE]`
**Should be:** `[UserRole.MAINTENANCE, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]`

#### `/dashboard/maintenance/schedule/page.tsx`
**Current:** `[UserRole.MAINTENANCE]`
**Should be:** `[UserRole.MAINTENANCE, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]`

---

### 4. Restaurant Module

#### `/dashboard/restaurant/page.tsx`
**Current:** `[UserRole.RESTAURANT]`
**Should be:** `[UserRole.RESTAURANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]`

#### `/dashboard/restaurant/inventory/page.tsx`
**Current:** `[UserRole.RESTAURANT]`
**Should be:** `[UserRole.RESTAURANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.BRANCH_STOREKEEPER]`

#### `/dashboard/restaurant/menu/page.tsx`
**Current:** `[UserRole.RESTAURANT]`
**Should be:** `[UserRole.RESTAURANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]`

#### `/dashboard/restaurant/orders/page.tsx`
**Current:** `[UserRole.RESTAURANT]`
**Should be:** `[UserRole.RESTAURANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]`

---

### 5. Manager Module

#### `/dashboard/manager/guests/page.tsx`
**Current:** `[UserRole.GENERAL_MANAGER]`
**Should be:** `[UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER]`

#### `/dashboard/manager/reports/page.tsx`
**Current:** `[UserRole.GENERAL_MANAGER]`
**Should be:** `[UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER]`

#### `/dashboard/manager/rooms/page.tsx`
**Current:** `[UserRole.GENERAL_MANAGER]`
**Should be:** `[UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER]`

#### `/dashboard/manager/staff/page.tsx`
**Current:** `[UserRole.GENERAL_MANAGER]`
**Should be:** `[UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER]`

---

### 6. Storekeeping Module - Add Auditor View Access

#### `/dashboard/storekeeping/inventory/page.tsx`
**Current:** `[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]`
**Should be:** `[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER, UserRole.AUDITOR]`

#### `/dashboard/storekeeping/reports/page.tsx`
**Current:** `[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]`
**Should be:** `[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER, UserRole.AUDITOR]`

---

### 7. Finance Module - Add Branch Manager View Access

#### `/dashboard/finance/page.tsx`
**Should include:** `[UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.AUDITOR]`

---

### 8. Audit Module

#### `/dashboard/audit/page.tsx`
**Should be:** `[UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]`

---

## Role Constants File

Create a centralized role groups file at `/frontend/src/lib/role-groups.ts`:

```typescript
import { UserRole } from './auth-context';

// Executive roles - full access to all branches
export const EXECUTIVE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER
];

// Management roles - can view most data
export const MANAGEMENT_ROLES = [
  ...EXECUTIVE_ROLES,
  UserRole.BRANCH_MANAGER
];

// Financial roles - access to financial data
export const FINANCE_ROLES = [
  ...EXECUTIVE_ROLES,
  UserRole.ACCOUNTANT,
  UserRole.AUDITOR
];

// Audit roles - read-only financial access
export const AUDIT_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.AUDITOR
];

// Reception roles
export const RECEPTION_ROLES = [
  ...MANAGEMENT_ROLES,
  UserRole.RECEPTIONIST
];

// Housekeeping roles
export const HOUSEKEEPING_ROLES = [
  ...MANAGEMENT_ROLES,
  UserRole.HOUSEKEEPING,
  UserRole.HOUSEKEEPING_SUPERVISOR
];

// Restaurant roles
export const RESTAURANT_ROLES = [
  ...MANAGEMENT_ROLES,
  UserRole.RESTAURANT
];

// Maintenance roles
export const MAINTENANCE_ROLES = [
  ...MANAGEMENT_ROLES,
  UserRole.MAINTENANCE
];

// Central store roles
export const CENTRAL_STORE_ROLES = [
  ...EXECUTIVE_ROLES,
  UserRole.CENTRAL_STOREKEEPER
];

// Branch store roles
export const BRANCH_STORE_ROLES = [
  ...MANAGEMENT_ROLES,
  UserRole.CENTRAL_STOREKEEPER,
  UserRole.BRANCH_STOREKEEPER
];

// All inventory access
export const INVENTORY_ROLES = [
  ...BRANCH_STORE_ROLES,
  UserRole.AUDITOR
];
```

---

## Navigation Menu Updates

Update `/components/layout/dashboard-layout.tsx` to show different menus per role:

### Super Admin / General Manager
- Dashboard (all branches overview)
- Branches
- Reception
- Housekeeping
- Restaurant
- Maintenance
- Inventory/Storekeeping
- Finance
- Reports
- Staff
- Settings

### Branch Manager
- Dashboard (branch overview)
- Reception
- Housekeeping
- Restaurant
- Maintenance
- Inventory (branch only)
- Finance (branch only)
- Reports (branch only)
- Staff (branch only)

### Receptionist
- Dashboard
- Check-in/Check-out
- Reservations
- Guests
- Rooms

### Housekeeping
- Dashboard
- My Tasks
- Room Status
- Supplies

### Housekeeping Supervisor
- Dashboard
- All Tasks
- Room Status
- Staff Assignment
- Inspections
- Supplies
- Reports

### Restaurant
- Dashboard
- Orders/POS
- Menu
- Tables
- Inventory

### Maintenance
- Dashboard
- Work Orders
- Assets
- Schedule

### Accountant
- Dashboard
- Invoices
- Payments
- Reports
- Bank Reconciliation

### Auditor
- Dashboard
- Financial Reports
- Audit Logs
- Inventory Audits
- Compliance

### Central Storekeeper
- Dashboard
- Items Master
- Stock Requests
- Dispatches
- GRN
- Purchase Orders
- Suppliers
- Branches Overview
- Reports

### Branch Storekeeper
- Dashboard
- Branch Stock
- My Requests
- Incoming Deliveries
- Stock Out
- Stock Takes
- Reports

### Employee
- My Profile
- My Schedule
- Leave Requests
- Payslips

---

## Data Filtering by Role

### Backend Middleware

Add branch filtering middleware:

```typescript
// middleware/branch-filter.ts
export const branchFilter = (req, res, next) => {
  const { role, branch_id } = req.user;
  
  // Executive roles see all branches
  if (['super_admin', 'general_manager', 'central_storekeeper'].includes(role)) {
    req.branchFilter = null; // No filter
  } else {
    // Branch-level roles only see their branch
    req.branchFilter = branch_id;
  }
  
  next();
};
```

### Frontend API Calls

Always pass branch context:

```typescript
// Example: Fetch rooms filtered by branch
const fetchRooms = async () => {
  const params = user?.branch_id ? { branch_id: user.branch_id } : {};
  const response = await roomsAPI.getRooms(params);
  // ...
};
```

---

## Conditional UI Based on Role

### Example: Show/Hide Edit Button

```tsx
const canEdit = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.BRANCH_MANAGER
].includes(user?.role);

return (
  <>
    {canEdit && (
      <Button onClick={handleEdit}>Edit</Button>
    )}
  </>
);
```

### Example: Show/Hide Delete Button

```tsx
const canDelete = [
  UserRole.SUPER_ADMIN
].includes(user?.role);

return (
  <>
    {canDelete && (
      <Button variant="destructive" onClick={handleDelete}>Delete</Button>
    )}
  </>
);
```

---

## Testing Checklist

For each role, verify:

1. [ ] Can only see allowed menu items
2. [ ] Dashboard shows role-appropriate widgets
3. [ ] Data is filtered by branch (if applicable)
4. [ ] Cannot access restricted pages directly via URL
5. [ ] Cannot perform restricted actions
6. [ ] Edit/Delete buttons hidden appropriately
7. [ ] API returns 403 for unauthorized requests
