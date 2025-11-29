# Famous Gate Hotel - Role-Based Access Control (RBAC) Analysis

## Overview
This document analyzes and recommends role-based access control for the Famous Gate Hotel ERP system based on industry best practices and hotel management standards.

---

## Current System Roles

| Role | Code | Description |
|------|------|-------------|
| Super Admin | `super_admin` | Full system access, IT administration |
| General Manager | `general_manager` | Executive oversight of all branches |
| Branch Manager | `branch_manager` | Branch-level operations management |
| Receptionist | `receptionist` | Front desk operations |
| Housekeeping | `housekeeping` | Room cleaning and maintenance |
| Housekeeping Supervisor | `housekeeping_supervisor` | Housekeeping team management |
| Restaurant | `restaurant` | F&B operations and POS |
| Maintenance | `maintenance` | Facility maintenance and repairs |
| Accountant | `accountant` | Financial management |
| Auditor | `auditor` | Financial auditing and compliance |
| Central Storekeeper | `central_storekeeper` | Central warehouse management |
| Branch Storekeeper | `branch_storekeeper` | Branch inventory management |
| Employee | `employee` | Basic staff access |
| Guest | `guest` | Guest portal access |

---

## Recommended Module Access Matrix

### Legend
- ✅ **Full Access** - View, Create, Edit, Delete
- 📝 **Modify** - View, Create, Edit (no delete)
- 👁️ **View Only** - Read-only access
- ❌ **No Access** - Hidden from user

---

## 1. SUPER ADMIN (`super_admin`)
**Description:** IT Administrator with full system access

### Access Rights
| Module | Access Level | Notes |
|--------|--------------|-------|
| Admin Dashboard | ✅ Full | System-wide overview |
| User Management | ✅ Full | Create/manage all users |
| Branch Management | ✅ Full | Configure all branches |
| System Settings | ✅ Full | All configurations |
| All Other Modules | ✅ Full | Complete access |
| Audit Logs | ✅ Full | View all system logs |

### Dashboard Widgets
- System health status
- All branches overview
- User activity logs
- Database statistics
- Error logs

---

## 2. GENERAL MANAGER (`general_manager`)
**Description:** Executive oversight of hotel chain operations

### Access Rights
| Module | Access Level | Notes |
|--------|--------------|-------|
| GM Dashboard | ✅ Full | Chain-wide metrics |
| All Branches | ✅ Full | View/manage all branches |
| Financial Reports | 👁️ View | All financial data |
| Staff Management | 👁️ View | All staff across branches |
| Rooms Management | ✅ Full | All rooms across branches |
| Reservations | ✅ Full | Override capabilities |
| Housekeeping | 👁️ View | Monitor all branches |
| Restaurant | 👁️ View | View operations |
| Inventory | 👁️ View | Central + branch stock |
| Reports & Analytics | ✅ Full | All reports |
| Settings | 📝 Modify | Business settings only |

### Dashboard Widgets
- Revenue across all branches
- Occupancy rates comparison
- Staff performance metrics
- Low stock alerts (all branches)
- Pending approvals summary
- Today's arrivals/departures

---

## 3. BRANCH MANAGER (`branch_manager`)
**Description:** Single branch operations management

### Access Rights
| Module | Access Level | Notes |
|--------|--------------|-------|
| Branch Dashboard | ✅ Full | Branch-specific view |
| Reception | 👁️ View | Monitor front desk |
| Rooms (Own Branch) | ✅ Full | Manage branch rooms |
| Reservations (Own Branch) | ✅ Full | Branch bookings |
| Housekeeping (Own Branch) | 👁️ View | Monitor tasks |
| Restaurant (Own Branch) | 👁️ View | View operations |
| Inventory (Own Branch) | 👁️ View | Stock levels |
| Stock Requests | 📝 Modify | Create/approve requests |
| Staff (Own Branch) | 📝 Modify | Manage branch staff |
| Reports (Own Branch) | ✅ Full | Branch reports only |
| Finance (Own Branch) | 👁️ View | Branch financial data |

### Dashboard Widgets
- Branch revenue today/month
- Room occupancy status
- Staff on duty
- Pending tasks
- Low stock items
- Recent guest feedback

---

## 4. RECEPTIONIST (`receptionist`)
**Description:** Front desk operations

### Access Rights
| Module | Access Level | Notes |
|--------|--------------|-------|
| Reception Dashboard | ✅ Full | Front desk overview |
| Check-in/Check-out | ✅ Full | Process guests |
| Reservations | 📝 Modify | Create/modify bookings |
| Room Status | 👁️ View | View room availability |
| Guest Profiles | 📝 Modify | Manage guest info |
| Payments | 📝 Modify | Process payments |
| Invoices | 📝 Modify | Generate invoices |
| Housekeeping | 👁️ View | View room status |
| Wake-up Calls | ✅ Full | Schedule calls |
| Guest Requests | 📝 Modify | Log service requests |

### Dashboard Widgets
- Today's arrivals/departures
- Room availability grid
- Pending check-ins
- Guest messages
- Quick check-in button
- VIP arrivals alert

### NOT Accessible
- ❌ Financial reports
- ❌ Staff management
- ❌ Inventory management
- ❌ System settings
- ❌ Other branches data

---

## 5. HOUSEKEEPING (`housekeeping`)
**Description:** Room attendants/cleaners

### Access Rights
| Module | Access Level | Notes |
|--------|--------------|-------|
| Housekeeping Dashboard | 📝 Modify | Personal tasks only |
| My Tasks | 📝 Modify | Update task status |
| Room Status | 📝 Modify | Update cleaning status |
| Supply Requests | 📝 Modify | Request supplies |
| Lost & Found | 📝 Modify | Log found items |
| Work Schedule | 👁️ View | View own schedule |

### Dashboard Widgets
- My assigned tasks today
- Priority rooms
- Completed tasks count
- Supply inventory (low stock)

### NOT Accessible
- ❌ Other staff tasks (unless assigned)
- ❌ Guest information
- ❌ Financial data
- ❌ Inventory management
- ❌ Reports

---

## 6. HOUSEKEEPING SUPERVISOR (`housekeeping_supervisor`)
**Description:** Housekeeping team lead

### Access Rights
| Module | Access Level | Notes |
|--------|--------------|-------|
| Housekeeping Dashboard | ✅ Full | Team overview |
| All Tasks | ✅ Full | Assign/manage all tasks |
| Room Status | ✅ Full | Manage all rooms |
| Staff Assignment | 📝 Modify | Assign housekeepers |
| Inspection | ✅ Full | Quality checks |
| Supply Inventory | 👁️ View | Monitor supplies |
| Supply Requests | 📝 Modify | Create/approve requests |
| Work Schedules | 📝 Modify | Team scheduling |
| Reports | 👁️ View | Housekeeping reports |
| Staff Performance | 👁️ View | Team metrics |

### Dashboard Widgets
- Room status overview
- Staff workload distribution
- Pending inspections
- Supply alerts
- Team performance metrics
- Checkout rooms queue

---

## 7. RESTAURANT (`restaurant`)
**Description:** Restaurant/F&B staff

### Access Rights
| Module | Access Level | Notes |
|--------|--------------|-------|
| Restaurant Dashboard | ✅ Full | F&B operations |
| Orders (POS) | ✅ Full | Process orders |
| Menu Management | 📝 Modify | Update menu items |
| Tables | ✅ Full | Table management |
| Kitchen Display | ✅ Full | Order queue |
| Restaurant Inventory | 👁️ View | Stock levels |
| Supply Requests | 📝 Modify | Request ingredients |
| Daily Sales | 👁️ View | Today's sales only |

### Dashboard Widgets
- Active orders
- Table status
- Today's revenue
- Popular items
- Low stock ingredients

### NOT Accessible
- ❌ Room bookings
- ❌ Guest personal data
- ❌ Financial reports
- ❌ Staff management
- ❌ Other department data

---

## 8. MAINTENANCE (`maintenance`)
**Description:** Facility maintenance technicians

### Access Rights
| Module | Access Level | Notes |
|--------|--------------|-------|
| Maintenance Dashboard | ✅ Full | Work orders overview |
| Work Orders | 📝 Modify | Update order status |
| Assets | 👁️ View | View equipment list |
| Preventive Maintenance | 👁️ View | Scheduled maintenance |
| Spare Parts | 👁️ View | Parts inventory |
| Room Maintenance | 📝 Modify | Mark rooms for repair |
| Schedule | 👁️ View | Own schedule |

### Dashboard Widgets
- Open work orders
- Priority repairs
- Today's schedule
- Equipment due for service

### NOT Accessible
- ❌ Guest information
- ❌ Financial data
- ❌ Booking management
- ❌ Inventory (non-maintenance)

---

## 9. ACCOUNTANT (`accountant`)
**Description:** Financial management

### Access Rights
| Module | Access Level | Notes |
|--------|--------------|-------|
| Finance Dashboard | ✅ Full | Financial overview |
| Accounts Receivable | ✅ Full | Guest payments |
| Accounts Payable | ✅ Full | Vendor payments |
| Invoices | ✅ Full | Create/manage invoices |
| Financial Reports | ✅ Full | All financial reports |
| Payroll | 👁️ View | View payroll data |
| Budget Management | 📝 Modify | Track budgets |
| Bank Reconciliation | ✅ Full | Match transactions |
| Expense Tracking | ✅ Full | All expenses |
| Inventory Value | 👁️ View | Stock valuation |

### Dashboard Widgets
- Revenue today/month/year
- Outstanding payments
- Pending invoices
- Expense breakdown
- Cash flow summary
- Budget vs actual

### NOT Accessible
- ❌ Room assignments
- ❌ Housekeeping tasks
- ❌ Guest personal preferences
- ❌ Operational settings

---

## 10. AUDITOR (`auditor`)
**Description:** Internal/External auditor

### Access Rights
| Module | Access Level | Notes |
|--------|--------------|-------|
| Audit Dashboard | 👁️ View | Audit overview |
| All Financial Data | 👁️ View | Read-only access |
| Audit Logs | 👁️ View | System activity logs |
| Inventory Audits | 👁️ View | Stock discrepancies |
| Transaction History | 👁️ View | All transactions |
| Reports | 👁️ View | All reports |
| Stock Takes | 👁️ View | Physical counts |
| Compliance Reports | ✅ Full | Generate audit reports |

### Dashboard Widgets
- Recent transactions
- Discrepancy alerts
- Pending audits
- Compliance status

### NOT Accessible
- ❌ Cannot modify any data
- ❌ Cannot delete records
- ❌ Cannot access personal data
- ❌ Cannot process transactions

---

## 11. CENTRAL STOREKEEPER (`central_storekeeper`)
**Description:** Central warehouse manager

### Access Rights
| Module | Access Level | Notes |
|--------|--------------|-------|
| Central Store Dashboard | ✅ Full | Warehouse overview |
| All Items | ✅ Full | Manage all products |
| Stock Requests | ✅ Full | Approve/reject requests |
| Dispatches | ✅ Full | Create/manage dispatches |
| GRN (Goods Receipt) | ✅ Full | Receive goods |
| Purchase Orders | 📝 Modify | Create POs |
| Suppliers | ✅ Full | Manage suppliers |
| Vehicles | 📝 Modify | Dispatch vehicles |
| Drivers | 📝 Modify | Assign drivers |
| All Branch Stock | 👁️ View | View branch levels |
| Stock Takes | ✅ Full | Central stock takes |
| Reports | ✅ Full | Inventory reports |

### Dashboard Widgets
- Pending stock requests
- Low stock alerts
- Dispatches in transit
- Today's GRNs
- Branch stock summary
- Pending POs

---

## 12. BRANCH STOREKEEPER (`branch_storekeeper`)
**Description:** Branch inventory manager

### Access Rights
| Module | Access Level | Notes |
|--------|--------------|-------|
| Branch Store Dashboard | ✅ Full | Branch inventory |
| Branch Stock | ✅ Full | Manage branch items |
| Stock Requests | 📝 Modify | Create requests to central |
| Incoming Dispatches | 📝 Modify | Receive dispatches |
| Stock Out | ✅ Full | Issue to departments |
| Kitchen Usage | ✅ Full | Track restaurant usage |
| Stock Takes | ✅ Full | Branch stock counts |
| Wastage | 📝 Modify | Log wastage |
| Reports (Branch) | 👁️ View | Branch reports only |

### Dashboard Widgets
- Branch stock levels
- Low stock items
- Pending requests
- Incoming deliveries
- Today's stock out
- Wastage this month

### NOT Accessible
- ❌ Central warehouse operations
- ❌ Other branches data
- ❌ Supplier management
- ❌ Purchase orders
- ❌ Financial data

---

## 13. EMPLOYEE (`employee`)
**Description:** General staff member

### Access Rights
| Module | Access Level | Notes |
|--------|--------------|-------|
| Employee Dashboard | 👁️ View | Personal overview |
| My Profile | 📝 Modify | Update personal info |
| My Schedule | 👁️ View | View shifts |
| Leave Requests | 📝 Modify | Apply for leave |
| Payslips | 👁️ View | View own payslips |
| Announcements | 👁️ View | Company news |
| Training | 👁️ View | Training materials |

### Dashboard Widgets
- Today's shift
- Upcoming schedule
- Leave balance
- Announcements

---

## 14. GUEST (`guest`)
**Description:** Hotel guest (portal access)

### Access Rights
| Module | Access Level | Notes |
|--------|--------------|-------|
| Guest Portal | 👁️ View | Personal dashboard |
| My Reservations | 👁️ View | View bookings |
| Room Service | 📝 Modify | Order services |
| Feedback | 📝 Modify | Submit feedback |
| Invoice | 👁️ View | View own bills |
| Amenities | 👁️ View | View hotel services |

---

## Implementation Recommendations

### 1. Role Hierarchy
```
SUPER_ADMIN
    └── GENERAL_MANAGER
            ├── BRANCH_MANAGER
            │       ├── RECEPTIONIST
            │       ├── HOUSEKEEPING_SUPERVISOR
            │       │       └── HOUSEKEEPING
            │       ├── RESTAURANT
            │       └── MAINTENANCE
            ├── ACCOUNTANT
            ├── AUDITOR
            └── CENTRAL_STOREKEEPER
                    └── BRANCH_STOREKEEPER
```

### 2. Cross-Department Access for Coordination

| From Role | Can View | Purpose |
|-----------|----------|---------|
| Receptionist | Housekeeping room status | Inform guests of room readiness |
| Housekeeping | Front desk checkouts | Know which rooms to clean |
| Restaurant | Guest room numbers | Charge to room |
| Maintenance | All room status | Schedule repairs |

### 3. Data Isolation (Multi-Branch)

- **Branch-level staff** should only see their branch data
- **Central staff** (GM, Central Storekeeper) see all branches
- **Filter by `branch_id`** in all queries for branch users

### 4. Sensitive Data Protection

| Data Type | Accessible By |
|-----------|---------------|
| Guest personal info | Receptionist, Manager |
| Financial data | Accountant, Auditor, GM |
| Staff salary | HR, Accountant, GM |
| System logs | Super Admin, Auditor |
| Passwords | Nobody (hashed) |

### 5. Audit Trail Requirements

All modules should log:
- Who made changes
- When changes were made
- What was changed (before/after)
- IP address / device

---

## Current Issues to Fix

Based on analysis of the codebase:

1. **Maintenance module too restrictive** - Only MAINTENANCE role allowed, but managers should be able to view
2. **Reception guests page** - Only RECEPTIONIST allowed, should include managers
3. **Manager pages** - Only GENERAL_MANAGER, should include BRANCH_MANAGER
4. **Storekeeping inventory** - Missing AUDITOR for view access
5. **Housekeeping** - Missing BRANCH_MANAGER view access

---

## Files to Update

See `ROLE_ACCESS_UPDATES.md` for specific code changes needed.
