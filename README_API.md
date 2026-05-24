# FamousGate Hotels Management System

**Complete API Reference & Database Schema Documentation**

---

## 📊 System Overview

- **Base URL:** `https://api.hirall.com`
- **API Version:** v1.0
- **Total Endpoints:** 823
- **Database Tables:** 100+
- **Enums:** 80+
- **Last Updated:** 2026-05-24

---

## 🚀 Quick Start

### Authentication
```bash
# Login
curl -X POST https://api.hirall.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Use token in subsequent requests
curl -X GET https://api.hirall.com/api/bookings \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-branch-id: 1"
```

### Environment Variables
```env
SUPABASE_PROJECT_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-key
DATABASE_URL=postgresql://connection-string
JWT_SECRET=your-jwt-secret
```

---

## 📁 Project Structure

```
fggrill/
├── backend/                    # Node.js/Express API
│   ├── src/
│   │   ├── controllers/        # 200+ controllers
│   │   ├── routes/            # 60+ route files
│   │   ├── models/            # TypeScript models
│   │   ├── services/          # Business logic
│   │   ├── middleware/        # Auth, error handling
│   │   └── utils/             # Utilities
│   ├── scripts/               # Utility scripts
│   │   ├── extract-api-routes.js      # Extract API endpoints
│   │   ├── extract-database-schema.js # Extract DB schema
│   │   ├── schema-audit.js             # Schema audit
│   │   └── cleanup-backups.js         # Cleanup backup files
│   └── package.json
├── frontend/                   # Next.js Dashboard
│   ├── src/
│   │   ├── app/               # App Router pages
│   │   ├── components/        # React components
│   │   ├── lib/               # API clients
│   │   └── hooks/             # Custom hooks
│   └── package.json
├── database/migrations/        # SQL migrations
│   └── 20260524_comprehensive_schema_fix.sql
├── python-services/            # Python microservices
├── famous-gates-desktop/       # Tauri desktop app
├── famousgate-mobile/          # React Native mobile app
└── API_DOCUMENTATION.md        # Full API documentation
```

---

## 🔌 API Endpoints Summary

### By Category

| Category | Endpoints | Description |
|----------|-----------|-------------|
| Authentication | 5 | Login, logout, session management |
| Bookings | 15 | Room booking management |
| Rooms | 12 | Room management |
| Guests | 10 | Guest profile management |
| Payments | 8 | Payment processing |
| Staff | 25 | Staff management & HR |
| Payroll | 20 | Payroll processing |
| Inventory | 30 | Inventory & stock management |
| Kitchen | 25 | Kitchen operations |
| Restaurant | 18 | Restaurant & bar operations |
| Housekeeping | 22 | Housekeeping tasks |
| Finance | 15 | Financial reporting |
| Audit | 12 | Audit & compliance |
| Conference | 10 | Conference & events |
| Catering | 8 | Catering services |
| Branch Operations | 18 | Multi-branch operations |
| Notifications | 6 | User notifications |
| Reports | 35 | Various reports |
| Admin | 20 | Admin functions |
| System | 5 | System utilities |
| **Total** | **823** | **All endpoints** |

---

## 🗄️ Database Schema

### Core Tables (20)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | User accounts | id, email, role, branch_id |
| `branches` | Hotel branches | id, name, code, location |
| `bookings` | Room bookings | id, booking_number, guest_id, room_id |
| `rooms` | Hotel rooms | id, room_number, type_id, status |
| `room_types` | Room types | id, name, base_price |
| `guests` | Guest profiles | id, user_id, loyalty_points |
| `payments` | Payment records | id, booking_id, amount, method |
| `staff_profiles` | Staff details | id, user_id, department, position |
| `staff_attendance` | Attendance | id, staff_id, date, check_in |
| `leave_requests` | Leave management | id, staff_id, start_date, status |
| `inventory_items` | Inventory | id, sku, category, current_stock |
| `purchase_orders` | Purchase orders | id, po_number, supplier_id, status |
| `goods_received_notes` | GRN records | id, grn_number, po_id |
| `stock_movements` | Stock tracking | id, item_id, movement_type |
| `kitchen_stock` | Kitchen inventory | id, item_id, quantity |
| `kitchen_usage_records` | Usage tracking | id, item_id, quantity_used |
| `restaurant_tables` | Restaurant tables | id, table_number, capacity |
| `orders` | Restaurant orders | id, table_id, order_number |
| `housekeeping_tasks` | HK tasks | id, room_id, task_type, status |
| `credit_bills` | Staff credit | id, staff_id, amount, status |

### Supporting Tables (80+)

Additional tables for:
- Accounting & Finance
- Audit & Compliance
- Bar Operations
- Conference & Events
- Dispatch & Logistics
- Employee Portal
- Facilities Management
- Fleet Management
- Food Control
- Guest Portal
- HR Reports
- Maintenance
- Notifications
- Petty Cash
- Procurement
- Revenue Oversight
- Security
- Shift Management
- Stock Analytics
- Supplier Management
- VAT & Tax
- Wastage Tracking
- And more...

---

## 📋 All Enums (80+)

### User Roles (80+ values)
`super_admin`, `manager`, `receptionist`, `housekeeping`, `restaurant`, `maintenance`, `accountant`, `guest`, `bartender`, `general_manager`, `branch_manager`, `central_storekeeper`, `branch_storekeeper`, `housekeeping_supervisor`, `branch_operations_manager`, `central_operations_manager`, `facilities_manager`, `pos_kitchen`, `auditor`, `employee`, `kitchen`, `cashier`, `branch_accountant`, `storekeeper`, `head_chef`, `sous_chef`, `front_desk_supervisor`, `concierge`, `bell_captain`, `bellhop`, `room_attendant`, `laundry_attendant`, `restaurant_manager`, `line_cook`, `prep_cook`, `waiter`, `waitress`, `head_waiter`, `barista`, `food_runner`, `busser`, `host_hostess`, `kitchen_operations`, `kitchen_helper`, `dishwasher`, `maintenance_supervisor`, `electrician`, `plumber`, `hvac_technician`, `groundskeeper`, `security_supervisor`, `security_guard`, `night_auditor`, `finance_manager`, `hr_manager`, `payroll_clerk`, `procurement`, `kyogong_spa_cashier`, `kyogong_executive_bar_cashier`, `kyogong_sports_bar_cashier`, `kyogong_reception_cashier`, `chef`, `cook`, `barman`, `barmaid`, `bar_manager`, `driver`, `director`, `inventory_clerk`, `purchasing_manager`

### Status Enums
- **booking_status:** `pending`, `confirmed`, `checked_in`, `checked_out`, `cancelled`, `no_show`
- **payment_status:** `pending`, `partial`, `paid`, `refunded`, `completed`, `failed`
- **room_status:** `available`, `occupied`, `cleaning`, `maintenance`, `out_of_order`, `reserved`
- **order_status:** `draft`, `pending`, `approved`, `rejected`, `ordered`, `received`, `cancelled`
- **po_status:** `draft`, `pending_approval`, `approved`, `sent_to_supplier`, `partially_received`, `fully_received`, `cancelled`, `closed`
- **task_status:** `pending`, `in_progress`, `completed`, `cancelled`
- **task_priority:** `low`, `normal`, `high`, `urgent`
- **supply_status:** `sufficient`, `low`, `critical`, `out_of_stock`

### Category Enums
- **item_category:** `food`, `beverage`, `linen`, `toiletries`, `cleaning_supplies`, `maintenance_items`, `office_supplies`, `kitchen_equipment`, `amenities`, `other`
- **unit_of_measurement:** `pieces`, `kg`, `grams`, `liters`, `ml`, `boxes`, `cartons`, `packets`, `bottles`, `cans`, `rolls`, `sets`, `pairs`, `units`
- **payment_method:** `cash`, `card`, `mpesa`, `bank_transfer`, `pdq`, `cheque`
- **movement_type:** `receipt`, `issue`, `return`, `transfer_out`, `transfer_in`, `adjustment_plus`, `adjustment_minus`, `damage`, `expiry`, `theft`, `opening_balance`

### Housekeeping Enums
- **hk_task_status:** `pending`, `assigned`, `in_progress`, `paused`, `completed`, `pending_inspection`, `inspection_passed`, `inspection_failed`, `rework_required`, `cancelled`, `skipped`
- **hk_task_type:** `checkout_full_clean`, `checkout_vip_clean`, `stay_over_service`, `stay_over_full`, `deep_clean`, `turndown_service`, `inspection`, `touch_up`, `linen_change`, `restock_amenities`, `public_area_clean`, `emergency_clean`, `guest_request`, `pre_arrival_vip`
- **hk_room_status:** `clean`, `occupied_dirty`, `out_of_order`, `out_of_service`, `inspected`, `cleaning_in_progress`, `do_not_disturb`, `stay_over`, `checkout`, `early_makeup`, `late_checkout`, `turndown_pending`, `turndown_complete`

### Kitchen Enums
- **kitchen_usage_type:** `CONSUMED`, `SPOILT`, `LOST`, `DAMAGED`, `EXPIRED`, `RETURNED`, `ADJUSTMENT`
- **waste_reason:** `spoilage`, `expiry`, `damage`, `overcooking`, `customer_return`, `quality_control`, `other`
- **spoilage_reason:** `EXPIRED`, `DAMAGED`, `SPOILED`, `QUALITY_ISSUE`, `THEFT`, `BREAKAGE`, `CONTAMINATION`, `OTHER`

### Restaurant Enums
- **table_status:** `available`, `occupied`, `reserved`, `cleaning`, `maintenance`
- **reservation_status:** `pending`, `confirmed`, `seated`, `completed`, `cancelled`, `no_show`
- **order_type:** `dine_in`, `room_service`, `takeaway`

### Financial Enums
- **invoice_status:** `draft`, `sent`, `paid`, `overdue`, `cancelled`
- **payment_terms:** `cash`, `credit_7_days`, `credit_15_days`, `credit_30_days`, `credit_45_days`, `credit_60_days`, `credit_90_days`, `advance_payment`
- **transaction_type:** `income`, `expense`
- **vat_rate_type:** `standard_16`, `zero_rated`, `exempt`, `withholding_vat`

### Supplier Enums
- **supplier_status:** `active`, `inactive`, `blacklisted`, `pending_approval`
- **supplier_invoice_status:** `draft`, `submitted`, `pending_approval`, `approved`, `rejected`, `paid`, `partially_paid`, `cancelled`
- **supplier_ledger_transaction_type:** `opening_balance`, `invoice`, `payment`, `credit_note`, `debit_note`, `adjustment`

### Maintenance Enums
- **maintenance_type:** `preventive`, `corrective`, `emergency`, `inspection`
- **work_order_status:** `pending`, `scheduled`, `in_progress`, `completed`, `cancelled`
- **work_order_priority:** `low`, `normal`, `high`, `urgent`

### Transfer Enums
- **transfer_status:** `pending`, `in_transit`, `received`, `rejected`, `cancelled`
- **transfer_status_enum:** `pending`, `approved`, `in_transit`, `completed`, `cancelled`

### OAuth Enums
- **oauth_authorization_status:** `pending`, `approved`, `denied`, `expired`
- **oauth_client_type:** `public`, `confidential`
- **oauth_registration_type:** `dynamic`, `manual`
- **oauth_response_type:** `code`
- **one_time_token_type:** `confirmation_token`, `reauthentication_token`, `recovery_token`, `email_change_token_new`, `email_change_token_current`, `phone_change_token`

### Other Enums
- `issue_status`, `item_condition_status`, `order_item_status`, `order_payment_status`, `payment_method_type`, `payment_split_type`, `payment_status_type`, `shift_status`, `subcategory_enum`, `prep_station_type`, `procurement_audit_action`, `hk_shift_type`, `hk_supply_request_status`, `housekeeping_task_type`, `requisition_status`, `requisition_priority`

---

## 🛠️ Utility Scripts

### Extract API Routes
```bash
cd backend
node scripts/extract-api-routes.js
```
Outputs: `backend/api-routes.json` with all 823 endpoints

### Extract Database Schema
```bash
cd backend
node scripts/extract-database-schema.js
```
Outputs: `backend/database-schema.json` with all tables and columns

### Schema Audit
```bash
cd backend
node scripts/schema-audit.js
```
Identifies missing tables, columns, and schema issues

### Cleanup Backup Files
```bash
cd backend
node scripts/cleanup-backups.js
```
Removes 55+ .backup files from codebase

---

## 📖 Full Documentation

For complete API documentation with detailed endpoint descriptions, request/response examples, and authentication details, see:

**[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)**

---

## 🔐 Authentication & Authorization

### JWT Token Structure
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "receptionist",
  "branch_id": 1,
  "active_role": "receptionist",
  "active_branch_id": 1
}
```

### Role-Based Access Control

**Global Roles** (access all branches):
- super_admin
- general_manager
- director
- auditor
- hr_manager
- central_storekeeper

**Branch Roles** (access assigned branch only):
- branch_manager
- receptionist
- housekeeping
- restaurant
- maintenance
- accountant
- And 60+ other roles

### Branch Isolation

Most endpoints require branch identification:

**Header:**
```
x-branch-id: 1
```

**Query Parameter:**
```
?branch_id=1
```

---

## 📡 API Response Format

### Success
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful",
  "count": 100,
  "pages": 10
}
```

### Error
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error",
  "status": 400,
  "details": { ... }
}
```

---

## 🔄 Pagination & Filtering

### Pagination
```
GET /api/bookings?page=1&limit=50
```

### Filtering
```
GET /api/bookings?status=confirmed&branch_id=1
```

### Sorting
```
GET /api/bookings?sort=created_at&order=desc
```

### Combined
```
GET /api/bookings?status=confirmed&branch_id=1&page=1&limit=50&sort=created_at&order=desc
```

---

## 🌐 Multi-Branch Support

The system supports multi-branch hotel operations:

### Branch Selection
```typescript
// Set active branch
localStorage.setItem('activeBranchId', '1');

// API calls automatically include branch
const bookings = await fetchAPI('/bookings');
```

### Global Access
```typescript
// Global roles can access all branches
localStorage.setItem('activeBranchId', '0'); // All branches
```

---

## 📊 Real-Time Features

### WebSocket Support
- Room status updates
- New bookings
- Payment notifications
- Staff attendance changes

### Webhooks
Configure webhooks for:
- Booking events
- Payment events
- Inventory alerts
- Staff events

---

## 🧪 Testing

### Run API Tests
```bash
cd backend
npm test
```

### Run Schema Audit
```bash
cd backend
node scripts/schema-audit.js
```

### Test Endpoints
```bash
# Health check
curl https://api.hirall.com/api/system/health

# Get branches
curl https://api.hirall.com/api/system/branches

# Get rooms (with auth)
curl https://api.hirall.com/api/rooms?branch_id=1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🚢 Deployment

### Environment Setup
```env
NODE_ENV=production
PORT=5000
SUPABASE_PROJECT_URL=your-url
SUPABASE_SERVICE_ROLE_KEY=your-key
JWT_SECRET=your-secret
```

### Database Migrations
```bash
# Apply latest migration
psql -U user -d database -f database/migrations/20260524_comprehensive_schema_fix.sql
```

### Start Server
```bash
cd backend
npm install
npm run build
npm start
```

---

## 📞 Support

- **API Documentation:** [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- **Schema Fix Guide:** [COMPREHENSIVE_ERROR_FIX_GUIDE.md](./COMPREHENSIVE_ERROR_FIX_GUIDE.md)
- **Raw SQL Replacement:** [backend/scripts/REPLACE_RAW_SQL_GUIDE.md](./backend/scripts/REPLACE_RAW_SQL_GUIDE.md)
- **Email:** api-support@hirall.com
- **Status:** https://status.hirall.com

---

## 📝 Changelog

### 2026-05-24
- Added comprehensive API documentation
- Created database schema extraction scripts
- Added API route extraction scripts
- Documented 823 API endpoints
- Documented 100+ database tables
- Documented 80+ enums
- Created utility scripts for maintenance

---

## 📄 License

Proprietary - FamousGate Hotels Management System

---

**Generated:** 2026-05-24  
**Version:** 1.0.0  
**Maintained by:** FamousGate Development Team
