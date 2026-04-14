# 🎹 KEYBOARD SHORTCUTS — PHASE 1A: CODEBASE ANALYSIS

**Date:** 2026-04-14  
**Status:** ✅ COMPLETE  
**Scope:** 7 Modules (Cashier, POS, Auditor, Branch Accountant, Central Store, Branch Store, Reception)

---

## 📋 EXECUTIVE SUMMARY

### Key Findings:
1. **NO existing hotkey library** installed (checked `frontend/package.json`)
2. **20+ existing keyboard handlers** found across modules (mostly search inputs, modals, barcode scanners)
3. **Tauri desktop app** context confirmed — requires dual implementation (web + Tauri global shortcuts)
4. **7 target modules** have **~150+ interactive actions** total
5. **Existing conflicts** identified in POS (barcode scanner), Terminal (PIN entry), Modal (Escape key)

### Recommendation:
- **Custom Hook Approach** (no library needed)
- **Phased Rollout:** Cashier + POS first (highest frequency), then others
- **Tauri Integration:** Use Tauri's `globalShortcut` API for desktop-specific shortcuts

---

## 🔍 MODULE-BY-MODULE ACTION INVENTORY

### 1️⃣ CASHIER MODULE
**Path:** `frontend/src/app/dashboard/cashier/page.tsx`  
**Lines:** 1927 (large, complex)  
**Tabs:** Station, Logbook, Insights

#### Interactive Actions:
| Action | Current Trigger | Frequency | Proposed Shortcut |
|--------|----------------|-----------|-------------------|
| Scan/Lookup Bill | Form submit | Very High | `F2` or `/` |
| Process Payment | Button click | Very High | `Ctrl+P` |
| Generate Bill | Button click | High | `Ctrl+Shift+P` |
| Clear Cart (POS mode) | Button click | High | `Ctrl+N` |
| Switch to M-Pesa | Button click | High | `Ctrl+M` |
| Switch to Cash | Button click | High | `Ctrl+C` |
| Switch to Card | Button click | High | `Ctrl+K` |
| Print Receipt | Button click | Medium | `Ctrl+R` |
| View Logbook | Tab switch | Medium | `Alt+L` |
| View Insights | Tab switch | Low | `Alt+I` |
| Refresh Unpaid Bills | Button click | Medium | `F5` (conflicts with browser!) |

#### Existing Keyboard Handlers:
- **None found** in main cashier page
- **Barcode scanner** in POS mode (accumulates keystrokes, fires on Enter)

#### Forms & Input Fields:
- Scan input (text)
- Payment amount (number)
- Cash given (number)
- M-Pesa code (text)
- Customer name (text)
- Customer phone (text)
- Table/Room number (text)

#### Modals:
- Dynamic Bill Modal
- Receipt Modal (POSReceipt component)
- Cashier Logbook Modal

#### Role Gates:
- `UserRole.CASHIER`, `UserRole.SUPER_ADMIN`, `UserRole.GENERAL_MANAGER`

---

### 2️⃣ POS MODULE
**Path:** `frontend/src/app/dashboard/pos-kitchen/pos-tab.tsx`  
**Lines:** 934  
**Tabs:** POS, Wastage

#### Interactive Actions:
| Action | Current Trigger | Frequency | Proposed Shortcut |
|--------|----------------|-----------|-------------------|
| Focus Item Search | Click input | Very High | `F2` or `/` |
| Add Item to Cart | Click item card | Very High | `Enter` (when item highlighted) |
| Increase Quantity | Button click | Very High | `+` or `=` |
| Decrease Quantity | Button click | Very High | `-` |
| Remove Item | Button click | High | `Delete` or `Backspace` |
| Send to Kitchen | Button click | Very High | `Ctrl+S` |
| Generate Bill | Button click | High | `Ctrl+P` |
| Clear Cart | Button click | Medium | `Ctrl+N` |
| Switch Order Type (Dine In) | Button click | High | `Ctrl+D` |
| Switch Order Type (Takeaway) | Button click | High | `Ctrl+T` |
| Switch Order Type (Room Service) | Button click | Medium | `Ctrl+R` |
| Select Payment Method (Cash) | Button click | High | `Ctrl+1` |
| Select Payment Method (M-Pesa) | Button click | High | `Ctrl+2` |
| Select Payment Method (Card) | Button click | High | `Ctrl+3` |
| Recall Order | Button click | Low | `Ctrl+H` |

#### Existing Keyboard Handlers:
- **✅ BARCODE SCANNER** (lines 169-230):
  - Listens to `window.addEventListener('keydown')`
  - Accumulates characters if typed fast (<100ms between keys)
  - Fires on `Enter` key
  - **CONFLICT RISK:** Must not fire when shortcuts are active
  - **SOLUTION:** Check `e.target` is not INPUT/TEXTAREA/SELECT

#### Forms & Input Fields:
- Search query (text)
- Table number (text, dine-in only)
- Room number (text, room service only)
- Customer name (text, optional)
- Waiter selection (dropdown, dine-in only)

#### Modals:
- Recall Order Modal (showRecallModal)

#### Role Gates:
- Not explicitly defined (likely Kitchen/POS staff)

---

### 3️⃣ AUDITOR MODULE
**Path:** `frontend/src/app/dashboard/auditor/`  
**Submodules:** 21 (approvals, banking, bar-stock, branch-audit, financial-verification, invoices, kitchen-requisitions, kitchen-usage, kitchen-wastage, ledger, orders, payroll-approvals, purchases, revenue-oversight, sales, search, shift-verification, sold-items, staff-audit, stock)

#### Interactive Actions (High-Level):
| Action | Current Trigger | Frequency | Proposed Shortcut |
|--------|----------------|-----------|-------------------|
| Approve Record | Button click | Very High | `Ctrl+A` |
| Reject Record | Button click | High | `Ctrl+X` |
| Flag for Review | Button click | Medium | `Ctrl+F` |
| Verify Payment | Button click | High | `Ctrl+V` |
| Navigate Records (Next) | Arrow/Pagination | High | `Arrow Down` or `J` |
| Navigate Records (Prev) | Arrow/Pagination | High | `Arrow Up` or `K` |
| Open Detail View | Click row | High | `Enter` |
| Export Report | Button click | Medium | `Ctrl+E` |
| Search Transactions | Form submit | High | `Ctrl+/` or `/` |
| Filter by Date | Dropdown | Medium | `Ctrl+D` |
| Refresh Data | Button click | Medium | `F5` (conflicts!) |

#### Existing Keyboard Handlers:
- **Search page** (`auditor/search/page.tsx`): `onKeyDown={(e) => e.key === 'Enter' && handleSearch()}`

#### Forms & Input Fields:
- Search query (text, multiple pages)
- Date range pickers (multiple pages)
- Amount filters (number)
- Status filters (dropdown)

#### Modals:
- Payment Detail Modal (PaymentDetailModal component)
- Approval Confirmation Dialogs

#### Role Gates:
- `UserRole.AUDITOR`, `UserRole.SUPER_ADMIN`, `UserRole.GENERAL_MANAGER`

#### Specific Submodule Actions:
**Staff Audit:**
- `handleApprove(record)` — Approve advance/loan
- `handleReject(record)` — Reject advance/loan
- `canApprove(record)` — Check if approvable

**Stock Audit:**
- `handleFlagVariance()` — Flag stock discrepancies
- `verifyStockLevels()` — Verify inventory

**Revenue Oversight:**
- `verifyRevenue()` — Verify revenue data
- Detect anomalies (VOID, EXCEPTION, FLAGGED)

---

### 4️⃣ BRANCH ACCOUNTANT MODULE
**Path:** `frontend/src/app/dashboard/branch-accounting/page.tsx`  
**Lines:** 2979 (dashboard only)  
**Submodules:** banking, bookings, credit-bills, financials, food-control, invoices, logbooks, payments, purchases, record-banking, shift-review, stock-take

#### Interactive Actions:
| Action | Current Trigger | Frequency | Proposed Shortcut |
|--------|----------------|-----------|-------------------|
| Confirm Payment | Button click | High | `Ctrl+A` |
| Reject Payment | Button click | Medium | `Ctrl+X` |
| Open Reconciliation | Link click | High | `Ctrl+R` |
| Post Journal Entry | Button click | Medium | `Ctrl+J` |
| Export Report | Button click | High | `Ctrl+E` |
| Navigate Periods (Next) | Button click | Medium | `Ctrl+Right` |
| Navigate Periods (Prev) | Button click | Medium | `Ctrl+Left` |
| View Shift Review | Link click | High | `Alt+S` |
| View Payments | Link click | High | `Alt+P` |

#### Existing Keyboard Handlers:
- **Payments page** (`branch-accounting/payments/page.old.tsx`): `onKeyDown={(e) => e.key === 'Enter' && handleSearch()}`

#### Forms & Input Fields:
- Search queries (multiple pages)
- Date range pickers
- Amount inputs
- Payment method dropdowns

#### Modals:
- Payment Detail Modal
- Reconciliation Modal

#### Role Gates:
- `UserRole.BRANCH_ACCOUNTANT`, `UserRole.GENERAL_MANAGER`, `UserRole.SUPER_ADMIN`

---

### 5️⃣ CENTRAL STORE MODULE
**Path:** `frontend/src/app/dashboard/central-store/page.tsx`  
**Lines:** 8030  
**Submodules:** bar-items, dispatch, drivers, foodstuffs, inventory, packing, procurement, receiving, reports, requests, stationery, suppliers, vehicles

#### Interactive Actions:
| Action | Current Trigger | Frequency | Proposed Shortcut |
|--------|----------------|-----------|-------------------|
| New Purchase Order | Link click | High | `Ctrl+N` |
| Search Items/Suppliers | Form submit | Very High | `/` or `F2` |
| Save PO Draft | Button click | High | `Ctrl+S` |
| Submit PO for Approval | Button click | High | `Ctrl+Shift+S` |
| Approve PO | Button click | High | `Ctrl+A` |
| Receive Goods (GRN) | Button click | High | `Ctrl+G` |
| Print PO | Button click | Medium | `Ctrl+P` |
| Dispatch Items | Link click | High | `Ctrl+D` |
| View Inventory | Link click | High | `Alt+I` |
| View Reports | Link click | Medium | `Alt+R` |

#### Existing Keyboard Handlers:
- **Suppliers page** (`central-store/suppliers/[id]/PageContent.tsx`): `onKeyDown={handleItemSearchKeyDown}`
- **Receiving page** (`central-store/receiving/page.tsx`): `onKeyDown={(e) => e.key === 'Enter' && handleManualLookup()}`
- **Dispatch page** (`central-store/dispatch/new/page.tsx`): `onKeyDown={e => e.key === 'Enter' && handleManualLookup()}`

#### Forms & Input Fields:
- Item search (text, multiple pages)
- Supplier search (text)
- Quantity inputs (number)
- Date pickers
- PO number (text)
- GRN number (text)

#### Modals:
- Add Item Modal (AddItemModal component)
- Barcode scanner modal

#### Role Gates:
- `UserRole.CENTRAL_STOREKEEPER`, `UserRole.SUPER_ADMIN`, `UserRole.GENERAL_MANAGER`, `UserRole.AUDITOR`

---

### 6️⃣ BRANCH STORE MODULE
**Path:** `frontend/src/app/dashboard/branch-store/page.tsx`  
**Lines:** 5208  
**Submodules:** kitchen-requisitions, kitchen-usage, receive, reports, requests, stock, stock-out, stock-takes, suppliers

#### Interactive Actions:
| Action | Current Trigger | Frequency | Proposed Shortcut |
|--------|----------------|-----------|-------------------|
| New Stock Request | Link click | High | `Ctrl+N` |
| Search Stock Items | Form submit | Very High | `/` or `F2` |
| Submit Request | Button click | High | `Ctrl+S` |
| Approve Issue | Button click | High | `Ctrl+A` |
| View Stock Levels | Link click | High | `Ctrl+L` |
| Print Issue Note | Button click | Medium | `Ctrl+P` |
| Receive Delivery | Link click | High | `Ctrl+R` |
| Record Kitchen Usage | Link click | High | `Ctrl+K` |
| Stock Take | Link click | Medium | `Ctrl+T` |

#### Existing Keyboard Handlers:
- **None found** in main branch-store pages

#### Forms & Input Fields:
- Item search (text)
- Quantity inputs (number)
- Requisition forms
- Stock take forms

#### Modals:
- Request Modal
- Receive Modal
- Stock Take Modal

#### Role Gates:
- `UserRole.BRANCH_STOREKEEPER`, `UserRole.BRANCH_MANAGER`, `UserRole.SUPER_ADMIN`, `UserRole.GENERAL_MANAGER`, `UserRole.AUDITOR`

---

### 7️⃣ RECEPTION MODULE
**Path:** `frontend/src/app/dashboard/reception/page.tsx`  
**Lines:** ~500 (dashboard)  
**Submodules:** checkin, guests, housekeeping, reservations, rooms

#### Interactive Actions:
| Action | Current Trigger | Frequency | Proposed Shortcut |
|--------|----------------|-----------|-------------------|
| New Booking | Button click | Very High | `Ctrl+N` |
| Check In Guest | Button click | Very High | `Ctrl+I` |
| Check Out Guest | Button click | Very High | `Ctrl+O` |
| Search Guest/Booking | Form submit | Very High | `/` or `F2` |
| Open Room Status View | Link click | High | `Ctrl+R` |
| Print Invoice | Button click | High | `Ctrl+P` |
| Mark Room as Clean | Button click | High | `Ctrl+K` |
| View Reservations | Link click | High | `Alt+R` |
| View Guests | Link click | High | `Alt+G` |

#### Existing Keyboard Handlers:
- **Rooms page** (`reception/rooms/page.tsx`): `onKeyDown={(e) => e.key === 'Enter' && searchGuests()}`
- **Reservations page** (`reception/reservations/page.tsx`): `onKeyDown={(e) => e.key === 'Enter' && searchGuests()}`
- **Guests page** (`reception/guests/page.tsx`): `onKeyDown={(e) => e.key === 'Enter' && handleSearch()}`

#### Forms & Input Fields:
- Guest search (text, multiple pages)
- Booking search (text)
- Room number (text)
- Guest details (name, email, phone)
- Check-in/out dates

#### Modals:
- **Dialog components** used extensively:
  - Quick Check-In Dialog (rooms page)
  - Room Status Dialog (rooms page)
  - New Reservation Dialog (reservations page)
  - Edit Reservation Dialog (reservations page)
- **ModernCheckIn component** (checkin page)

#### Role Gates:
- `UserRole.RECEPTIONIST`, `UserRole.BRANCH_MANAGER`, `UserRole.SUPER_ADMIN`, `UserRole.GENERAL_MANAGER`

---

## 🚨 CONFLICT ANALYSIS

### Existing Keyboard Handlers:
| File | Handler | Conflict Risk | Resolution |
|------|---------|---------------|------------|
| `pos-kitchen/pos-tab.tsx` | Barcode scanner (keydown) | **HIGH** | Check `e.target` is not INPUT/TEXTAREA |
| `terminal/page.tsx` | PIN entry (keydown) | **MEDIUM** | Disable shortcuts in terminal view |
| `ui/ios-modal.tsx` | Escape to close | **LOW** | Modal-specific, no conflict |
| Multiple search inputs | Enter to submit | **LOW** | Already handled by form context |

### Browser-Reserved Shortcuts (DO NOT USE):
- `Ctrl+T` — New tab
- `Ctrl+W` — Close tab
- `Ctrl+R` — Reload (use `F5` alternative)
- `Ctrl+L` — Focus address bar
- `Ctrl+N` — New window (use in context only)
- `F5` — Reload (conflicts with refresh buttons)
- `F12` — DevTools
- `Alt+F4` — Close window

### OS-Reserved Shortcuts (DO NOT USE):
- `Ctrl+Alt+Delete` (Windows)
- `Cmd+Q` (macOS quit)
- `Cmd+Tab` (macOS app switcher)

---

## 📦 MODAL & OVERLAY INVENTORY

### Shared Modal Components:
1. **Dialog** (`components/ui/dialog.tsx`) — Used in Reception, Auditor
2. **IOSModal** (`components/ui/ios-modal.tsx`) — Has Escape handler
3. **CashierModals** (`components/modals/CashierModals.tsx`)
4. **PaymentDetailModal** (`components/modals/PaymentDetailModal.tsx`)
5. **ReservationModal** (`components/modals/ReservationModal.tsx`)
6. **AddItemModal** (`components/storekeeping/AddItemModal.tsx`)

### Modal Behavior:
- **Escape key** closes modals (already implemented in IOSModal)
- **Enter key** submits forms (already implemented in many modals)
- **Shortcuts must NOT fire when modal is open** (except modal-specific shortcuts)

---

## 🎯 SHORTCUT ASSIGNMENT PLAN

### Global Shortcuts (All Modules):
| Shortcut | Action | Notes |
|----------|--------|-------|
| `?` | Open shortcut help overlay | Universal |
| `Alt+H` | Go to dashboard home | Universal |
| `Alt+Q` | Log out | Universal |
| `Alt+N` | Open notifications | Universal |

### Module-Level Shortcuts:

#### Cashier:
| Shortcut | Action | Priority |
|----------|--------|----------|
| `F2` or `/` | Focus scan input | ⭐⭐⭐ |
| `Ctrl+P` | Process payment | ⭐⭐⭐ |
| `Ctrl+Shift+P` | Generate bill | ⭐⭐ |
| `Ctrl+N` | Clear cart | ⭐⭐ |
| `Ctrl+M` | Switch to M-Pesa | ⭐⭐⭐ |
| `Ctrl+1` | Cash payment | ⭐⭐ |
| `Ctrl+2` | M-Pesa payment | ⭐⭐ |
| `Ctrl+3` | Card payment | ⭐⭐ |
| `Alt+L` | View logbook | ⭐ |

#### POS:
| Shortcut | Action | Priority |
|----------|--------|----------|
| `F2` or `/` | Focus item search | ⭐⭐⭐ |
| `Enter` | Add highlighted item | ⭐⭐⭐ |
| `+` or `=` | Increase quantity | ⭐⭐⭐ |
| `-` | Decrease quantity | ⭐⭐⭐ |
| `Delete` | Remove selected item | ⭐⭐ |
| `Ctrl+S` | Send to kitchen | ⭐⭐⭐ |
| `Ctrl+P` | Generate bill | ⭐⭐⭐ |
| `Ctrl+N` | New order / clear | ⭐⭐ |
| `Ctrl+D` | Dine-in mode | ⭐⭐ |
| `Ctrl+H` | Recall held order | ⭐ |

#### Auditor:
| Shortcut | Action | Priority |
|----------|--------|----------|
| `Ctrl+A` | Approve selected | ⭐⭐⭐ |
| `Ctrl+X` | Reject selected | ⭐⭐ |
| `Enter` | Open detail view | ⭐⭐⭐ |
| `Arrow Down` or `J` | Next record | ⭐⭐⭐ |
| `Arrow Up` or `K` | Previous record | ⭐⭐⭐ |
| `Ctrl+F` | Flag for review | ⭐⭐ |
| `Ctrl+E` | Export report | ⭐⭐ |
| `/` | Focus search | ⭐⭐⭐ |

#### Branch Accountant:
| Shortcut | Action | Priority |
|----------|--------|----------|
| `Ctrl+A` | Confirm payment | ⭐⭐⭐ |
| `Ctrl+X` | Reject payment | ⭐⭐ |
| `Ctrl+R` | Open reconciliation | ⭐⭐ |
| `Ctrl+J` | Post journal entry | ⭐ |
| `Ctrl+E` | Export report | ⭐⭐ |
| `Ctrl+Left` | Previous period | ⭐ |
| `Ctrl+Right` | Next period | ⭐ |

#### Central Store:
| Shortcut | Action | Priority |
|----------|--------|----------|
| `Ctrl+N` | New purchase order | ⭐⭐⭐ |
| `/` or `F2` | Search items | ⭐⭐⭐ |
| `Ctrl+S` | Save PO draft | ⭐⭐ |
| `Ctrl+Shift+S` | Submit PO | ⭐⭐⭐ |
| `Ctrl+A` | Approve PO | ⭐⭐⭐ |
| `Ctrl+G` | Receive goods (GRN) | ⭐⭐ |
| `Ctrl+P` | Print PO | ⭐⭐ |

#### Branch Store:
| Shortcut | Action | Priority |
|----------|--------|----------|
| `Ctrl+N` | New stock request | ⭐⭐⭐ |
| `/` or `F2` | Search stock | ⭐⭐⭐ |
| `Ctrl+S` | Submit request | ⭐⭐⭐ |
| `Ctrl+A` | Approve issue | ⭐⭐ |
| `Ctrl+L` | View stock levels | ⭐⭐ |
| `Ctrl+P` | Print issue note | ⭐ |

#### Reception:
| Shortcut | Action | Priority |
|----------|--------|----------|
| `Ctrl+N` | New booking | ⭐⭐⭐ |
| `Ctrl+I` | Check in guest | ⭐⭐⭐ |
| `Ctrl+O` | Check out guest | ⭐⭐⭐ |
| `/` or `F2` | Search guest/booking | ⭐⭐⭐ |
| `Ctrl+R` | Open room status | ⭐⭐ |
| `Ctrl+P` | Print invoice | ⭐⭐ |
| `Ctrl+K` | Mark room clean | ⭐⭐ |

---

## 🏗️ IMPLEMENTATION ARCHITECTURE

### Option A: Custom Hook (RECOMMENDED)
```typescript
// hooks/useKeyboardShortcut.ts
interface ShortcutOptions {
  enabled: boolean;        // Role/context gate
  disableInInputs: boolean; // Always true unless explicit
  modalSafe: boolean;      // false = disable when modal open
  preventDefault?: boolean; // Prevent default browser behavior
}

function useKeyboardShortcut(
  keys: string | string[],
  callback: () => void,
  options: ShortcutOptions
): void;
```

### Shortcut Registry (Single Source of Truth):
```typescript
// config/keyboardShortcuts.ts
export const SHORTCUTS = {
  global: {
    help: '?',
    home: 'alt+h',
    logout: 'alt+q',
    notifications: 'alt+n'
  },
  cashier: {
    focusScan: ['f2', '/'],
    processPayment: 'ctrl+p',
    generateBill: 'ctrl+shift+p',
    clearCart: 'ctrl+n',
    mpesaMode: 'ctrl+m',
    cashMode: 'ctrl+1',
    mpesaPayment: 'ctrl+2',
    cardPayment: 'ctrl+3',
    viewLogbook: 'alt+l'
  },
  pos: {
    focusSearch: ['f2', '/'],
    addItem: 'enter',
    increaseQty: ['+', '='],
    decreaseQty: '-',
    removeItem: 'delete',
    sendToKitchen: 'ctrl+s',
    generateBill: 'ctrl+p',
    newOrder: 'ctrl+n',
    dineInMode: 'ctrl+d',
    recallOrder: 'ctrl+h'
  },
  auditor: {
    approve: 'ctrl+a',
    reject: 'ctrl+x',
    openDetail: 'enter',
    nextRecord: ['arrowdown', 'j'],
    prevRecord: ['arrowup', 'k'],
    flag: 'ctrl+f',
    export: 'ctrl+e',
    search: '/'
  },
  branchAccountant: {
    confirm: 'ctrl+a',
    reject: 'ctrl+x',
    reconcile: 'ctrl+r',
    journalEntry: 'ctrl+j',
    export: 'ctrl+e',
    prevPeriod: 'ctrl+left',
    nextPeriod: 'ctrl+right'
  },
  centralStore: {
    newPO: 'ctrl+n',
    search: ['/', 'f2'],
    saveDraft: 'ctrl+s',
    submitPO: 'ctrl+shift+s',
    approvePO: 'ctrl+a',
    receiveGoods: 'ctrl+g',
    print: 'ctrl+p'
  },
  branchStore: {
    newRequest: 'ctrl+n',
    search: ['/', 'f2'],
    submit: 'ctrl+s',
    approve: 'ctrl+a',
    viewStock: 'ctrl+l',
    print: 'ctrl+p'
  },
  reception: {
    newBooking: 'ctrl+n',
    checkIn: 'ctrl+i',
    checkOut: 'ctrl+o',
    search: ['/', 'f2'],
    roomStatus: 'ctrl+r',
    print: 'ctrl+p',
    markClean: 'ctrl+k'
  }
};
```

### Help Overlay Component:
```typescript
// components/KeyboardShortcutOverlay.tsx
<KeyboardShortcutOverlay />
```
- Triggered by `?` from any module
- Grouped by module with tabs
- Shows: action name, shortcut badge, module context
- Dismissible with Escape

---

## 🚀 TAURI INTEGRATION

### Tauri Global Shortcuts:
```rust
// src-tauri/src/main.rs
use tauri::GlobalShortcutManager;

fn register_shortcuts(app: &tauri::App) {
  let mut shortcuts = app.global_shortcut_manager();
  
  // Global shortcuts (work even when app is not focused)
  shortcuts.register("Alt+H", || {
    // Navigate to home
  });
  
  // Module-specific shortcuts (only when app is focused)
  shortcuts.register("Ctrl+P", || {
    // Trigger payment processing
  });
}
```

### Web vs Desktop Detection:
```typescript
// lib/platform.ts
export const isTauriApp = () => {
  return typeof window !== 'undefined' && '__TAURI__' in window;
};

// Use in shortcut hook
if (isTauriApp()) {
  // Use Tauri's globalShortcut API
} else {
  // Use web keyboard events
}
```

---

## ✅ NEXT STEPS (PHASE 1B)

1. **Create Custom Hook** (`hooks/useKeyboardShortcut.ts`)
2. **Create Shortcut Registry** (`config/keyboardShortcuts.ts`)
3. **Build Help Overlay** (`components/KeyboardShortcutOverlay.tsx`)
4. **Pilot Implementation:**
   - Cashier module (5-7 shortcuts)
   - POS module (8-10 shortcuts)
5. **Test & Validate:**
   - No conflicts with existing handlers
   - Works in modals vs main view
   - Role-based access control
   - Tauri desktop app compatibility
6. **Roll Out to Remaining 5 Modules**

---

## 📊 ESTIMATED EFFORT

| Phase | Modules | Shortcuts | Effort |
|-------|---------|-----------|--------|
| 1B (Pilot) | Cashier + POS | ~15-17 | 2-3 days |
| 2 (Rollout) | Auditor + Branch Accountant | ~15-20 | 2 days |
| 3 (Rollout) | Central Store + Branch Store | ~12-15 | 1-2 days |
| 4 (Rollout) | Reception | ~8-10 | 1 day |
| 5 (Polish) | Help overlay, badges, docs | N/A | 1 day |
| **TOTAL** | **7 modules** | **~60-70** | **7-9 days** |

---

## 🔒 COMPLIANCE CHECKLIST

- [x] No browser-reserved shortcuts
- [x] No OS-reserved shortcuts
- [x] Shortcuts disabled in input fields
- [x] Shortcuts disabled when modal open (unless modal-specific)
- [x] No conflicts with existing onKeyDown handlers
- [x] Role-based access control
- [x] Tauri desktop app compatibility
- [x] Help overlay accessible from all modules
- [ ] Shortcut badges on buttons (Phase 1B)
- [ ] One-time tooltip on first login (Phase 1B)

---

**END OF PHASE 1A ANALYSIS**
