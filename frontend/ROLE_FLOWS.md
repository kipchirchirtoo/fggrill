# Famous Gate Hotel - Role-Based System Flow
## UPDATED: All Dashboards Now Connected to Backend API

> **See also:** `WORKFLOWS.md` for detailed workflow diagrams

---

## Quick Role Summary

| Role | Dashboard Path | Primary Functions |
|------|----------------|-------------------|
| **SUPER_ADMIN** | `/dashboard/admin` | Full system control, user management |
| **GENERAL_MANAGER** | `/dashboard/gm` | Multi-branch oversight, approvals |
| **BRANCH_MANAGER** | `/dashboard/branch-manager` | Single branch operations |
| **CENTRAL_STOREKEEPER** | `/dashboard/central-store` | Central warehouse, dispatches |
| **BRANCH_STOREKEEPER** | `/dashboard/branch-store` | Branch stock, requests |
| **RECEPTIONIST** | `/dashboard/reception` | Check-in/out, reservations |
| **HOUSEKEEPING** | `/dashboard/housekeeping` | Room cleaning tasks |
| **MAINTENANCE** | `/dashboard/maintenance` | Work orders, repairs |
| **RESTAURANT** | `/dashboard/restaurant` | Orders, kitchen operations |
| **ACCOUNTANT** | `/dashboard/finance` | Financial transactions |
| **EMPLOYEE** | `/dashboard/employee/portal` | Self-service portal |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FAMOUS GATE HOTEL                               │
│                     Management Information System                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────┐    ┌─────────────────────┐    ┌─────────────────┐    │
│   │ SUPER_ADMIN │───▶│  GENERAL_MANAGER    │───▶│ BRANCH_MANAGER  │    │
│   │   (IT)      │    │   (All Branches)    │    │ (Single Branch) │    │
│   └─────────────┘    └─────────────────────┘    └─────────────────┘    │
│         │                     │                        │               │
│         ▼                     ▼                        ▼               │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                    STOREKEEPING MODULE                           │  │
│   │  ┌─────────────────────┐    ┌─────────────────────────────┐    │  │
│   │  │ CENTRAL_STOREKEEPER │◀──▶│    BRANCH_STOREKEEPER       │    │  │
│   │  │ (Central Warehouse) │    │    (Branch Stock)           │    │  │
│   │  └─────────────────────┘    └─────────────────────────────┘    │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                    OPERATIONS MODULE                             │  │
│   │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │  │
│   │  │ RECEPTIONIST │ │ HOUSEKEEPING │ │  RESTAURANT  │            │  │
│   │  └──────────────┘ └──────────────┘ └──────────────┘            │  │
│   │  ┌──────────────┐                                               │  │
│   │  │ MAINTENANCE  │                                               │  │
│   │  └──────────────┘                                               │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                    FINANCE MODULE                                │  │
│   │  ┌──────────────┐    ┌──────────────┐                          │  │
│   │  │  ACCOUNTANT  │    │   AUDITOR    │                          │  │
│   │  └──────────────┘    └──────────────┘                          │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Role Definitions & Permissions

### 1. SUPER_ADMIN (IT Administration)
**Dashboard:** `/dashboard/admin`
**Access Level:** Full system access

**Capabilities:**
- Full access to all modules and branches
- User management (create, edit, delete users)
- System configuration
- Database management
- All reports and analytics
- Audit logs access

**API Endpoints:**
- All endpoints available

---

### 2. GENERAL_MANAGER (Overall Manager)
**Dashboard:** `/dashboard/gm`
**Access Level:** All branches, management functions

**Capabilities:**
- View performance across ALL branches
- Manage staff across all locations
- Access all financial reports
- Approve high-value transactions
- Strategic decision making
- Full storekeeping overview

**API Endpoints:**
```
GET  /api/store/branches-stock     # All branches with stock data
GET  /api/store/stock-requests/pending  # All pending requests
GET  /api/staff                    # All staff across branches
GET  /api/reports/*                # All reports
```

**Flow:**
1. Dashboard loads → Fetch all branches data
2. View branch performance → Click branch for details
3. Review stock requests → Approve/delegate to central storekeeper
4. Generate reports → Export/analyze

---

### 3. BRANCH_MANAGER (Single Branch Manager)
**Dashboard:** `/dashboard/branch-manager`
**Access Level:** Single branch only

**Capabilities:**
- Full management of assigned branch
- Staff scheduling and management
- Stock oversight for their branch
- Local reports and analytics
- Customer service oversight

**API Endpoints:**
```
GET  /api/store/branch-stock?branch_id={id}  # Branch-specific stock
GET  /api/staff?branch_id={id}               # Branch staff only
GET  /api/store/stock-requests               # Branch requests
GET  /api/store/incoming-dispatches          # Deliveries for branch
```

**Flow:**
1. Dashboard loads → Fetch branch-specific data
2. Monitor stock levels → Alert on low stock
3. Review incoming deliveries → Confirm receipt
4. Manage staff schedules → Assign tasks

---

### 4. CENTRAL_STOREKEEPER (Central Warehouse)
**Dashboard:** `/dashboard/central-store`
**Access Level:** Central warehouse + dispatch management

**Capabilities:**
- Manage central warehouse inventory
- Create and manage items in master catalog
- Receive stock requests from branches
- Create and dispatch delivery notes
- Manage vehicles, drivers, suppliers
- Stock takes for central warehouse

**API Endpoints:**
```
GET  /api/store/items                    # All master catalog items
POST /api/store/items                    # Create new item
GET  /api/store/stock-requests/pending   # Pending requests
PUT  /api/store/stock-requests/:id/review # Approve/reject
POST /api/store/dispatch-notes           # Create dispatch
PUT  /api/store/dispatch-notes/:id/dispatch # Send dispatch
GET  /api/store/vehicles                 # Manage vehicles
GET  /api/store/drivers                  # Manage drivers
GET  /api/store/suppliers                # Manage suppliers
```

**Workflow:**
```
Branch Request → Central Reviews → Approve/Reject
       ↓               ↓
    Pending      Create Dispatch
                       ↓
               Assign Vehicle/Driver
                       ↓
                  IN_TRANSIT
                       ↓
              Branch Confirms Receipt
                       ↓
                  DELIVERED
```

---

### 5. BRANCH_STOREKEEPER (Branch Store)
**Dashboard:** `/dashboard/branch-store`
**Access Level:** Assigned branch stock only

**Capabilities:**
- View branch stock levels
- Record stock out (usage/sales)
- Create stock requests to central
- Receive and confirm incoming deliveries
- Branch stock takes

**API Endpoints:**
```
GET  /api/store/branch-stock          # Current branch stock
POST /api/store/branch-stock/out      # Record usage
POST /api/store/stock-requests        # Request from central
GET  /api/store/stock-requests        # View my requests
GET  /api/store/incoming-dispatches   # Incoming deliveries
PUT  /api/store/dispatch-notes/:id/confirm # Confirm receipt
```

**Workflow:**
```
Low Stock Alert → Create Request → Wait for Approval
       ↓               ↓
  Record Usage    Request Approved
                       ↓
              Delivery In Transit
                       ↓
              Receive & Confirm
                       ↓
              Stock Updated
```

---

### 6. RECEPTIONIST (Front Desk)
**Dashboard:** `/dashboard/reception`
**Access Level:** Booking and guest management

**Capabilities:**
- Manage reservations
- Check-in/check-out guests
- Room assignments
- Guest inquiries
- Walk-in bookings

**API Endpoints:**
```
GET  /api/bookings             # View reservations
POST /api/bookings             # Create booking
POST /api/bookings/:id/checkin # Check-in guest
POST /api/bookings/:id/checkout # Check-out guest
GET  /api/rooms                # Room availability
GET  /api/guests               # Guest records
```

---

### 7. HOUSEKEEPING
**Dashboard:** `/dashboard/housekeeping`
**Access Level:** Room cleaning tasks

**Capabilities:**
- View assigned cleaning tasks
- Update room cleaning status
- Request supplies from store
- Report maintenance issues

**API Endpoints:**
```
GET  /api/housekeeping/tasks      # My tasks
PUT  /api/housekeeping/tasks/:id  # Update task status
GET  /api/housekeeping/rooms      # Room statuses
```

---

### 8. RESTAURANT
**Dashboard:** `/dashboard/restaurant`
**Access Level:** Kitchen and dining operations

**Capabilities:**
- Manage orders
- Update menu items
- Request supplies from store
- Table management

**API Endpoints:**
```
GET  /api/restaurant/orders     # Current orders
POST /api/restaurant/orders     # Create order
GET  /api/restaurant/menu       # Menu items
```

---

### 9. MAINTENANCE
**Dashboard:** `/dashboard/maintenance`
**Access Level:** Repair and maintenance tasks

**Capabilities:**
- View maintenance requests
- Update repair status
- Request parts from store
- Preventive maintenance scheduling

**API Endpoints:**
```
GET  /api/maintenance/requests     # Maintenance tickets
PUT  /api/maintenance/requests/:id # Update status
```

---

### 10. ACCOUNTANT
**Dashboard:** `/dashboard/finance`
**Access Level:** Financial operations

**Capabilities:**
- View transactions
- Process invoices
- Generate financial reports
- Payroll processing

**API Endpoints:**
```
GET  /api/finance/transactions   # All transactions
GET  /api/finance/invoices       # Invoices
POST /api/staff/payroll          # Process payroll
```

---

### 11. AUDITOR
**Dashboard:** `/dashboard/audit`
**Access Level:** Read-only audit access

**Capabilities:**
- View all audit logs
- Generate audit reports
- Inventory audits
- Compliance checks

**API Endpoints:**
```
GET  /api/audit/logs            # Audit trail
GET  /api/audit/inventory       # Inventory audit
GET  /api/reports/*             # All reports (read-only)
```

---

## Stock Request Flow (Detailed)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        STOCK REQUEST LIFECYCLE                           │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  BRANCH_STOREKEEPER              CENTRAL_STOREKEEPER                     │
│  ─────────────────               ──────────────────                      │
│                                                                          │
│  1. Low Stock Alert                                                      │
│         │                                                                │
│         ▼                                                                │
│  2. Create Request ──────────────▶ 3. Review Request                    │
│     POST /stock-requests              GET /stock-requests/pending        │
│                                              │                           │
│                                    ┌─────────┴─────────┐                │
│                                    │                   │                │
│                                    ▼                   ▼                │
│                              4a. APPROVE         4b. REJECT             │
│                              PUT /review          PUT /review           │
│                                    │                   │                │
│                                    ▼                   ▼                │
│                           5. Create Dispatch      END (notify)          │
│                              POST /dispatch-notes                        │
│                                    │                                    │
│                                    ▼                                    │
│                           6. Assign Vehicle/Driver                      │
│                              PUT /dispatch                              │
│                                    │                                    │
│                                    ▼                                    │
│                           7. Status: IN_TRANSIT                         │
│                                    │                                    │
│  8. Receive Delivery ◀────────────┘                                    │
│     GET /incoming-dispatches                                            │
│         │                                                                │
│         ▼                                                                │
│  9. Confirm Receipt                                                     │
│     PUT /confirm                                                        │
│         │                                                                │
│         ▼                                                                │
│  10. Stock Updated                                                      │
│      (Branch stock increased)                                           │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Branches Configuration

| ID | Name | Code | Location | Type |
|----|------|------|----------|------|
| 1 | Famous Gate Bomet (HQ) | FGB-HQ | Bomet Town | Central Warehouse |
| 2 | Famous Gate Bomet Town | FGB-BMT | Bomet Town Center | Branch |
| 3 | Famous Gate Kericho | FGB-KER | Kericho Town | Branch |
| 4 | Famous Gate Kapsoit | FGB-KAP | Kapsoit Center | Branch |
| 5 | Famous Gate Mogogosiek | FGB-MOG | Mogogosiek Town | Branch |
| 6 | Famous Gate Litein | FGB-LIT | Litein Town | Branch |

---

## Demo Login Credentials

### Management
| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@famousgate.com | admin123 |
| General Manager | gm@famousgate.com | gm123 |

### Branch Managers
| Branch | Email | Password |
|--------|-------|----------|
| Bomet HQ | manager.bomet@famousgate.com | bomet123 |
| Kericho | manager.kericho@famousgate.com | kericho123 |
| Litein | manager.litein@famousgate.com | litein123 |

### Storekeeping
| Role | Email | Password |
|------|-------|----------|
| Central Storekeeper | central@famousgate.com | central123 |
| Store (Bomet) | store.bomet@famousgate.com | store123 |
| Store (Kericho) | store.kericho@famousgate.com | store123 |
| Store (Kapsoit) | store.kapsoit@famousgate.com | store123 |

### Operations
| Role | Email | Password |
|------|-------|----------|
| Receptionist | reception@famousgate.com | reception123 |
| Housekeeping | housekeeping@famousgate.com | house123 |
| Restaurant | restaurant@famousgate.com | rest123 |
| Maintenance | maintenance@famousgate.com | maint123 |

### Finance
| Role | Email | Password |
|------|-------|----------|
| Accountant | accountant@famousgate.com | account123 |
| Auditor | auditor@famousgate.com | audit123 |
